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
        review_status, approval_notes, rejection_reason, rejection_category, submitted_for_review_at,
        agent:profiles!agent_id(id, name)
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

  // Execute atomic DB transaction via stored procedure
  const { data: updateId, error: rpcError } = await supabase.rpc('submit_milestone_update', {
    p_milestone_id: milestoneId,
    p_agent_id: user.id,
    p_percent_done: percentDone,
    p_note: note || null,
    p_photo_urls: photoUrls || [],
    p_latitude: latitude || null,
    p_longitude: longitude || null,
  });

  if (rpcError) {
    const status = rpcError.code === 'P0003' ? 403 : rpcError.code === 'P0002' ? 404 : 500;
    return c.json({ error: rpcError.message || 'Failed to submit update' }, status);
  }

  // Decoupled Side Effect: Dispatch notifications asynchronously after success
  (async () => {
    try {
      const { data: mData } = await supabase
        .from('milestones')
        .select('name, project:projects(id, name, manager_id)')
        .eq('id', milestoneId)
        .single();
        
      if (mData?.project?.manager_id) {
        await supabase.from("notifications").insert({
          user_id: mData.project.manager_id,
          title: "Milestone Update Submitted",
          body: `${user.name} submitted a progress update of ${percentDone}% for "${mData.name}" on "${mData.project.name}". Pending your review.`,
          type: "update_pending",
          reference_id: mData.project.id,
        });
      }
    } catch(err) {
      console.error("Failed to send side-effect notifications", err);
    }
  })();

  return c.json({ data: { id: updateId, review_status: 'pending' } }, 201);
});

// POST /updates/:updateId/approve — approve progress update (manager)
milestones.post("/updates/:updateId/approve", rateLimiter('transitions'), async (c) => {
  const updateId = c.req.param("updateId");
  const user = c.get("user");
  const supabase = getServiceClient();
  const body = await c.req.json();
  const { approvalNotes, expectedVersion } = body;

  if (expectedVersion === undefined) {
    return c.json({ error: "Missing required 'expectedVersion' field for optimistic locking" }, 400);
  }

  const { error: rpcError } = await supabase.rpc('approve_milestone_update', {
    p_update_id: updateId,
    p_reviewer_id: user.id,
    p_approval_notes: approvalNotes || null,
    p_expected_version: expectedVersion
  });

  if (rpcError) {
    if (rpcError.code === 'PR003') return c.json({ error: rpcError.message }, 409); // Conflict (version)
    if (rpcError.code === 'P0003') return c.json({ error: rpcError.message }, 403); // Forbidden
    if (rpcError.code === 'PR002' || rpcError.code === 'PR001') return c.json({ error: rpcError.message }, 400);
    if (rpcError.code === 'P0002') return c.json({ error: rpcError.message }, 404);
    return c.json({ error: rpcError.message }, 500);
  }

  // Decoupled Side Effect
  (async () => {
    try {
      const { data: update } = await supabase.from('milestone_updates').select('agent_id, percent_done, milestone_id').eq('id', updateId).single();
      if (update?.agent_id) {
        const { data: mData } = await supabase.from('milestones').select('name, project:projects(id, name)').eq('id', update.milestone_id).single();
        if (mData) {
          await supabase.from("notifications").insert({
            user_id: update.agent_id,
            title: "Update Approved",
            body: `Your update of ${update.percent_done}% for "${mData.name}" was approved by ${user.name}.`,
            type: "update_approved",
            reference_id: mData.project.id,
          });
        }
      }
    } catch(err) {
      console.error("Side-effect failed", err);
    }
  })();

  return c.json({ data: { success: true } });
});

// POST /updates/:updateId/reject — reject progress update (manager)
milestones.post("/updates/:updateId/reject", rateLimiter('transitions'), async (c) => {
  const updateId = c.req.param("updateId");
  const user = c.get("user");
  const supabase = getServiceClient();
  const body = await c.req.json();
  const { rejectionReason } = body;

  const { error: rpcError } = await supabase.rpc('reject_milestone_update', {
    p_update_id: updateId,
    p_reviewer_id: user.id,
    p_rejection_reason: rejectionReason || null
  });

  if (rpcError) {
    if (rpcError.code === 'P0003') return c.json({ error: rpcError.message }, 403); // Forbidden
    if (rpcError.code === 'PR002' || rpcError.code === 'PR001') return c.json({ error: rpcError.message }, 400);
    if (rpcError.code === 'P0002') return c.json({ error: rpcError.message }, 404);
    return c.json({ error: rpcError.message }, 500);
  }

  // Decoupled Side Effect
  (async () => {
    try {
      const { data: update } = await supabase.from('milestone_updates').select('agent_id, percent_done, milestone_id').eq('id', updateId).single();
      if (update?.agent_id) {
        const { data: mData } = await supabase.from('milestones').select('name, project:projects(id, name)').eq('id', update.milestone_id).single();
        if (mData) {
          await supabase.from("notifications").insert({
            user_id: update.agent_id,
            title: "Update Rejected",
            body: `Your update of ${update.percent_done}% for "${mData.name}" was rejected by ${user.name}.`,
            type: "update_rejected",
            reference_id: mData.project.id,
          });
        }
      }
    } catch(err) {
      console.error("Side-effect failed", err);
    }
  })();

  return c.json({ data: { success: true } });
});

// POST /updates/:updateId/changes-requested — request changes on update (manager)
milestones.post("/updates/:updateId/changes-requested", rateLimiter('transitions'), async (c) => {
  const updateId = c.req.param("updateId");
  const user = c.get("user");
  const supabase = getServiceClient();
  const body = await c.req.json();
  const { reason, category } = body;

  if (!reason || reason.trim() === '') {
    return c.json({ error: "A reason is required when requesting changes" }, 400);
  }

  const { error: rpcError } = await supabase.rpc('request_changes_milestone_update', {
    p_update_id: updateId,
    p_reviewer_id: user.id,
    p_reason: reason,
    p_category: category || null,
  });

  if (rpcError) {
    if (rpcError.code === 'P0003') return c.json({ error: rpcError.message }, 403);
    if (rpcError.code === 'P0004') return c.json({ error: rpcError.message }, 400);
    if (rpcError.code === 'PR002' || rpcError.code === 'PR001') return c.json({ error: rpcError.message }, 400);
    if (rpcError.code === 'P0002') return c.json({ error: rpcError.message }, 404);
    return c.json({ error: rpcError.message }, 500);
  }

  return c.json({ data: { success: true } });
});

// POST /updates/:updateId/rework-required — require full rework (manager)
milestones.post("/updates/:updateId/rework-required", rateLimiter('transitions'), async (c) => {
  const updateId = c.req.param("updateId");
  const user = c.get("user");
  const supabase = getServiceClient();
  const body = await c.req.json();
  const { reason, category } = body;

  if (!reason || reason.trim() === '') {
    return c.json({ error: "A reason is required when requesting rework" }, 400);
  }

  const { error: rpcError } = await supabase.rpc('request_rework_milestone_update', {
    p_update_id: updateId,
    p_reviewer_id: user.id,
    p_reason: reason,
    p_category: category || null,
  });

  if (rpcError) {
    if (rpcError.code === 'P0003') return c.json({ error: rpcError.message }, 403);
    if (rpcError.code === 'P0004') return c.json({ error: rpcError.message }, 400);
    if (rpcError.code === 'PR002' || rpcError.code === 'PR001') return c.json({ error: rpcError.message }, 400);
    if (rpcError.code === 'P0002') return c.json({ error: rpcError.message }, 404);
    return c.json({ error: rpcError.message }, 500);
  }

  return c.json({ data: { success: true } });
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
