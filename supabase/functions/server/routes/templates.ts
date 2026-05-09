import { Hono } from "npm:hono";
import { getServiceClient, requireRole } from "../middleware/auth.ts";

const templates = new Hono();

// GET /templates — list all templates
templates.get("/", async (c) => {
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from("templates")
    .select(`
      *,
      creator:profiles!templates_created_by_fkey(id, name)
    `)
    .order("created_at", { ascending: false });

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  return c.json({ data });
});

// GET /templates/:id — single template
templates.get("/:id", async (c) => {
  const id = c.req.param("id");
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from("templates")
    .select(`
      *,
      creator:profiles!templates_created_by_fkey(id, name)
    `)
    .eq("id", id)
    .single();

  if (error) {
    return c.json({ error: error.message }, 404);
  }

  return c.json({ data });
});

// POST /templates — create template (admin only)
templates.post("/", requireRole("Admin"), async (c) => {
  const user = c.get("user");
  const supabase = getServiceClient();
  const { name, projectType, phases } = await c.req.json();

  if (!name || !projectType || !phases || !Array.isArray(phases)) {
    return c.json({ error: "Missing required fields: name, projectType, phases (array)" }, 400);
  }

  if (!["Residential", "Commercial"].includes(projectType)) {
    return c.json({ error: "Invalid projectType. Must be Residential or Commercial" }, 400);
  }

  // Validate phases structure
  const totalWeight = phases.reduce((sum: number, p: any) => sum + (p.weight || 0), 0);
  if (totalWeight !== 100) {
    return c.json({ error: `Phase weights must sum to 100. Current sum: ${totalWeight}` }, 400);
  }

  const { data, error } = await supabase
    .from("templates")
    .insert({
      name,
      project_type: projectType,
      phases,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  // Activity log
  await supabase.from("activity_log").insert({
    user_id: user.id,
    action: "created",
    entity_type: "template",
    entity_id: data.id,
    details: { name },
  });

  return c.json({ data }, 201);
});

// PUT /templates/:id — update template (admin only)
templates.put("/:id", requireRole("Admin"), async (c) => {
  const id = c.req.param("id");
  const user = c.get("user");
  const supabase = getServiceClient();
  const body = await c.req.json();

  const updateData: any = { updated_at: new Date().toISOString() };

  if (body.name !== undefined) updateData.name = body.name;
  if (body.projectType !== undefined) {
    if (!["Residential", "Commercial"].includes(body.projectType)) {
      return c.json({ error: "Invalid projectType" }, 400);
    }
    updateData.project_type = body.projectType;
  }
  if (body.phases !== undefined) {
    const totalWeight = body.phases.reduce((sum: number, p: any) => sum + (p.weight || 0), 0);
    if (totalWeight !== 100) {
      return c.json({ error: `Phase weights must sum to 100. Current sum: ${totalWeight}` }, 400);
    }
    updateData.phases = body.phases;
  }

  const { data, error } = await supabase
    .from("templates")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  // Activity log
  await supabase.from("activity_log").insert({
    user_id: user.id,
    action: "updated",
    entity_type: "template",
    entity_id: id,
    details: updateData,
  });

  return c.json({ data });
});

// DELETE /templates/:id — delete template (admin only)
templates.delete("/:id", requireRole("Admin"), async (c) => {
  const id = c.req.param("id");
  const user = c.get("user");
  const supabase = getServiceClient();

  const { data: tpl } = await supabase.from("templates").select("name").eq("id", id).single();

  const { error } = await supabase.from("templates").delete().eq("id", id);

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  // Activity log
  await supabase.from("activity_log").insert({
    user_id: user.id,
    action: "deleted",
    entity_type: "template",
    entity_id: id,
    details: { name: tpl?.name },
  });

  return c.json({ success: true });
});

export default templates;
