import { Hono } from "npm:hono";
import { getServiceClient, requireRole } from "../middleware/auth.ts";

const projects = new Hono();

// GET /projects — list projects (filtered by role)
projects.get("/", async (c) => {
  const user = c.get("user");
  const supabase = getServiceClient();

  let query = supabase
    .from("projects")
    .select(`
      *,
      manager:profiles!projects_manager_id_fkey(id, name, email, role),
      agents:project_agents(agent_id, profile:profiles(id, name, email, role)),
      milestones(id, name, weight, percent_done, sort_order, last_update, thumbnail_url)
    `)
    .order("created_at", { ascending: false });

  // Filter by role
  if (user.role === "Manager") {
    query = query.eq("manager_id", user.id);
  } else if (user.role === "Agent") {
    // Get project IDs where this agent is assigned
    const { data: assignments } = await supabase
      .from("project_agents")
      .select("project_id")
      .eq("agent_id", user.id);

    const projectIds = assignments?.map((a: any) => a.project_id) || [];
    if (projectIds.length === 0) {
      return c.json({ data: [] });
    }
    query = query.in("id", projectIds);
  }
  // Admin sees all — no filter needed

  const { data, error } = await query;

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  // Sort milestones by sort_order
  const enriched = (data || []).map((p: any) => ({
    ...p,
    milestones: (p.milestones || []).sort((a: any, b: any) => a.sort_order - b.sort_order),
  }));

  return c.json({ data: enriched });
});

// GET /projects/:id — single project with full detail
projects.get("/:id", async (c) => {
  const id = c.req.param("id");
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from("projects")
    .select(`
      *,
      manager:profiles!projects_manager_id_fkey(id, name, email, role),
      agents:project_agents(agent_id, profile:profiles(id, name, email, role)),
      milestones(
        id, name, weight, percent_done, sort_order, last_update, thumbnail_url,
        updates:milestone_updates(id, percent_done, note, photo_urls, latitude, longitude, created_at, agent:profiles(id, name))
      )
    `)
    .eq("id", id)
    .single();

  if (error) {
    return c.json({ error: error.message }, 404);
  }

  // Sort milestones and their updates
  if (data.milestones) {
    data.milestones.sort((a: any, b: any) => a.sort_order - b.sort_order);
    data.milestones.forEach((m: any) => {
      if (m.updates) {
        m.updates.sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      }
    });
  }

  return c.json({ data });
});

// POST /projects — create project (admin only)
projects.post("/", requireRole("Admin"), async (c) => {
  const user = c.get("user");
  const supabase = getServiceClient();
  const body = await c.req.json();

  const { name, address, type, startDate, endDate, client, managerId, agentIds, milestones: milestoneData, templateId } = body;

  if (!name || !address || !type || !startDate || !endDate || !client) {
    return c.json({ error: "Missing required fields: name, address, type, startDate, endDate, client" }, 400);
  }

  // Create project
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .insert({
      name,
      address,
      type,
      start_date: startDate,
      end_date: endDate,
      client,
      manager_id: managerId || null,
      template_id: templateId || null,
      created_by: user.id,
      status: "On Track",
      percent_done: 0,
    })
    .select()
    .single();

  if (projectError) {
    return c.json({ error: projectError.message }, 500);
  }

  // Assign agents
  if (agentIds && agentIds.length > 0) {
    const agentRows = agentIds.map((agentId: string) => ({
      project_id: project.id,
      agent_id: agentId,
    }));
    await supabase.from("project_agents").insert(agentRows);

    // Create notifications for assigned agents
    const agentNotifs = agentIds.map((agentId: string) => ({
      user_id: agentId,
      title: "New Project Assignment",
      body: `You have been assigned to project "${name}"`,
      type: "assignment",
      reference_id: project.id,
    }));
    await supabase.from("notifications").insert(agentNotifs);
  }

  // Notify manager
  if (managerId) {
    await supabase.from("notifications").insert({
      user_id: managerId,
      title: "New Project Assignment",
      body: `You have been assigned as manager for "${name}"`,
      type: "assignment",
      reference_id: project.id,
    });
  }

  // Create milestones
  if (milestoneData && milestoneData.length > 0) {
    const milestoneRows = milestoneData.map((m: any, index: number) => ({
      project_id: project.id,
      name: m.name,
      weight: m.weight,
      sort_order: index,
      percent_done: 0,
    }));
    await supabase.from("milestones").insert(milestoneRows);
  }

  // Activity log
  await supabase.from("activity_log").insert({
    user_id: user.id,
    action: "created",
    entity_type: "project",
    entity_id: project.id,
    details: { name },
  });

  return c.json({ data: project }, 201);
});

// PUT /projects/:id — update project
projects.put("/:id", requireRole("Admin", "Manager"), async (c) => {
  const id = c.req.param("id");
  const user = c.get("user");
  const supabase = getServiceClient();
  const body = await c.req.json();

  const updateData: any = { updated_at: new Date().toISOString() };
  const allowedFields = ["name", "address", "type", "client", "status"];
  for (const field of allowedFields) {
    if (body[field] !== undefined) updateData[field] = body[field];
  }
  if (body.startDate) updateData.start_date = body.startDate;
  if (body.endDate) updateData.end_date = body.endDate;
  if (body.managerId !== undefined) updateData.manager_id = body.managerId;
  if (body.percentDone !== undefined) updateData.percent_done = body.percentDone;

  const { data, error } = await supabase
    .from("projects")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  // Update agent assignments if provided
  if (body.agentIds !== undefined) {
    await supabase.from("project_agents").delete().eq("project_id", id);
    if (body.agentIds.length > 0) {
      const agentRows = body.agentIds.map((agentId: string) => ({
        project_id: id,
        agent_id: agentId,
      }));
      await supabase.from("project_agents").insert(agentRows);
    }
  }

  // Check if status changed to Delayed — notify
  if (body.status === "Delayed") {
    // Notify admin + manager
    const notifUsers: string[] = [];
    if (data.manager_id) notifUsers.push(data.manager_id);
    // Get admins
    const { data: admins } = await supabase.from("profiles").select("id").eq("role", "Admin");
    admins?.forEach((a: any) => notifUsers.push(a.id));

    const uniqueUsers = [...new Set(notifUsers)];
    const notifs = uniqueUsers.map((uid) => ({
      user_id: uid,
      title: "Project Delayed",
      body: `Project "${data.name}" has been marked as Delayed`,
      type: "delay",
      reference_id: id,
    }));
    if (notifs.length > 0) await supabase.from("notifications").insert(notifs);
  }

  // Activity log
  await supabase.from("activity_log").insert({
    user_id: user.id,
    action: "updated",
    entity_type: "project",
    entity_id: id,
    details: updateData,
  });

  return c.json({ data });
});

// DELETE /projects/:id — delete project (admin only)
projects.delete("/:id", requireRole("Admin"), async (c) => {
  const id = c.req.param("id");
  const user = c.get("user");
  const supabase = getServiceClient();

  // Get project name for log
  const { data: project } = await supabase.from("projects").select("name").eq("id", id).single();

  const { error } = await supabase.from("projects").delete().eq("id", id);

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  // Activity log
  await supabase.from("activity_log").insert({
    user_id: user.id,
    action: "deleted",
    entity_type: "project",
    entity_id: id,
    details: { name: project?.name },
  });

  return c.json({ success: true });
});

export default projects;
