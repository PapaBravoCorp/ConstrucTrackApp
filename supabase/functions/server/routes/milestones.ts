import { Hono } from "npm:hono";
import { getServiceClient } from "../middleware/auth.ts";
import { computeScheduleStatus } from "../lib/scheduleStatus.ts";
import { assertValidTransition, MilestoneStatus } from "../lib/workflowTransitions.ts";
import { validateDependencies } from "../lib/dependencyValidator.ts";
import { emitDomainEvent, DomainEventType } from "../lib/domainEvents.ts";
import { rateLimiter } from "../middleware/rateLimiter.ts";

const milestones = new Hono();

// GET /milestones/:projectId — list milestones for a project
milestones.get("/:projectId", async (c) => {
  const projectId = c.req.param("projectId");
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from("milestones")
    .select(`
      *,
      updates:milestone_updates(
        id, percent_done, note, photo_urls, latitude, longitude, created_at,
        agent:profiles(id, name)
      )
    `)
    .eq("project_id", projectId)
    .order("sort_order");

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  // Sort updates by date within each milestone and append schedule_status
  const enriched = (data || []).map((m: any) => ({
    ...m,
    schedule_status: computeScheduleStatus(m.status || 'Pending', m.due_date || null),
    updates: (m.updates || []).sort(
      (a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    ),
  }));

  return c.json({ data: enriched });
});

// POST /milestones/:milestoneId/update — submit progress update (agent)
milestones.post("/:milestoneId/update", rateLimiter('uploads'), async (c) => {
  const milestoneId = c.req.param("milestoneId");
  const user = c.get("user");
  const supabase = getServiceClient();
  const body = await c.req.json();

  const { percentDone, note, photoUrls, latitude, longitude } = body;

  if (percentDone === undefined || percentDone < 0 || percentDone > 100) {
    return c.json({ error: "percentDone must be between 0 and 100" }, 400);
  }

  // Get the milestone and its project
  const { data: milestone, error: mError } = await supabase
    .from("milestones")
    .select("*, project:projects(id, name, manager_id)")
    .eq("id", milestoneId)
    .single();

  if (mError || !milestone) {
    return c.json({ error: "Milestone not found" }, 404);
  }

  // Create the update record
  const { data: update, error: uError } = await supabase
    .from("milestone_updates")
    .insert({
      milestone_id: milestoneId,
      agent_id: user.id,
      percent_done: percentDone,
      note: note || null,
      photo_urls: photoUrls || [],
      latitude: latitude || null,
      longitude: longitude || null,
    })
    .select()
    .single();

  if (uError) {
    return c.json({ error: uError.message }, 500);
  }

  // Update milestone percent_done and last_update
  const thumbnailUrl = photoUrls && photoUrls.length > 0 ? photoUrls[0] : milestone.thumbnail_url;
  await supabase
    .from("milestones")
    .update({
      percent_done: percentDone,
      last_update: new Date().toISOString(),
      thumbnail_url: thumbnailUrl,
    })
    .eq("id", milestoneId);

  // Recalculate project percent_done
  const { data: allMilestones } = await supabase
    .from("milestones")
    .select("percent_done, weight")
    .eq("project_id", milestone.project.id);

  if (allMilestones) {
    const projectPercent = Math.round(
      allMilestones.reduce((acc: number, m: any) => acc + (m.percent_done * (m.weight / 100)), 0)
    );
    await supabase
      .from("projects")
      .update({ percent_done: projectPercent, updated_at: new Date().toISOString() })
      .eq("id", milestone.project.id);
  }

  // Notify the project manager
  if (milestone.project.manager_id) {
    await supabase.from("notifications").insert({
      user_id: milestone.project.manager_id,
      title: "Milestone Updated",
      body: `${user.name} updated "${milestone.name}" to ${percentDone}% on "${milestone.project.name}"`,
      type: "update",
      reference_id: milestone.project.id,
    });
  }

  // Notify admins
  const { data: admins } = await supabase.from("profiles").select("id").eq("role", "Admin");
  if (admins && admins.length > 0) {
    const adminNotifs = admins
      .filter((a: any) => a.id !== milestone.project.manager_id) // Don't double-notify
      .map((a: any) => ({
        user_id: a.id,
        title: "Milestone Updated",
        body: `${user.name} updated "${milestone.name}" to ${percentDone}% on "${milestone.project.name}"`,
        type: "update",
        reference_id: milestone.project.id,
      }));
    if (adminNotifs.length > 0) {
      await supabase.from("notifications").insert(adminNotifs);
    }
  }

  // Activity log
  await supabase.from("activity_log").insert({
    user_id: user.id,
    action: "progress_update",
    entity_type: "milestone",
    entity_id: milestoneId,
    details: {
      milestoneName: milestone.name,
      projectName: milestone.project.name,
      percentDone,
      note,
    },
  });

  return c.json({ data: update }, 201);
});

// PUT /milestones/:milestoneId/status — state transition enforcement
milestones.put("/:milestoneId/status", rateLimiter('transitions'), async (c) => {
  const milestoneId = c.req.param("milestoneId");
  const user = c.get("user");
  const supabase = getServiceClient();
  const body = await c.req.json();
  const { status: nextState } = body;

  if (!nextState) {
    return c.json({ error: "Missing required 'status' field" }, 400);
  }

  // Fetch current state and project details
  const { data: milestone, error: mError } = await supabase
    .from("milestones")
    .select("status, project_id, name, organization_id")
    .eq("id", milestoneId)
    .single();

  if (mError || !milestone) {
    return c.json({ error: "Milestone not found" }, 404);
  }

  const currentState = milestone.status as MilestoneStatus;
  const organizationId = milestone.organization_id;
  const projectId = milestone.project_id;

  // Validate transition
  try {
    assertValidTransition(currentState, nextState as MilestoneStatus);
  } catch (err: any) {
    return c.json({ error: err.message }, 400);
  }

  // Enforce dependencies if moving to 'In Progress'
  let responseWarning: string | undefined = undefined;
  if (nextState === 'In Progress' && organizationId) {
    const depCheck = await validateDependencies(organizationId, projectId, milestoneId, user.id);
    if (!depCheck.allowed) {
      return c.json({ error: depCheck.warning }, 409); // Conflict
    }
    if (depCheck.warning) {
      responseWarning = depCheck.warning;
    }
  }

  // Execute transition
  const { data: updated, error: uError } = await supabase
    .from("milestones")
    .update({ 
      status: nextState,
      updated_at: new Date().toISOString()
    })
    .eq("id", milestoneId)
    .select()
    .single();

  if (uError) {
    return c.json({ error: uError.message }, 500);
  }

  // Emit Domain Event
  if (organizationId) {
    // Determine event type based on nextState
    let eventType: DomainEventType = 'MilestoneSubmittedForReview';
    let message = `Milestone status changed from ${currentState} to ${nextState}`;

    if (nextState === 'Completed') eventType = 'MilestoneApproved';
    else if (nextState === 'Rejected') eventType = 'MilestoneRejected';
    else if (nextState === 'Reopened') eventType = 'MilestoneReopened';
    else if (nextState === 'Blocked') eventType = 'MilestoneBlocked';
    else if (nextState === 'Archived') eventType = 'MilestoneArchived';
    else if (nextState === 'Under Review') eventType = 'MilestoneSubmittedForReview';

    // If it's a simple In Progress or Pending transition, we might not have a specific enum, just use 'STATUS_CHANGE' activity via MilestoneSubmittedForReview for now.
    // Actually, 'MilestoneSubmittedForReview' translates to 'STATUS_CHANGE' in domainEvents.ts.
    if (['In Progress', 'Pending', 'Cancelled'].includes(nextState)) {
       eventType = 'MilestoneSubmittedForReview'; 
    }

    await emitDomainEvent(eventType, {
      organizationId,
      projectId,
      milestoneId,
      userId: user.id,
      message,
      metadata: { from: currentState, to: nextState }
    });
  }

  return c.json({ data: updated, warning: responseWarning });
});

export default milestones;
