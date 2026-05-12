import { Hono } from "npm:hono";
import { getServiceClient, requireRole } from "../middleware/auth.ts";

const users = new Hono();

// GET /users — list all users (admin only)
users.get("/", requireRole("Admin"), async (c) => {
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  return c.json({ data });
});

// GET /users/by-role/:role — list users by role
users.get("/by-role/:role", async (c) => {
  const role = c.req.param("role");
  const supabase = getServiceClient();

  if (!["Admin", "Manager", "Agent"].includes(role)) {
    return c.json({ error: "Invalid role" }, 400);
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, name, email, role, is_active")
    .eq("role", role)
    .eq("is_active", true)
    .order("name");

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  return c.json({ data });
});

// POST /users — invite/create user (admin only)
users.post("/", requireRole("Admin"), async (c) => {
  const adminUser = c.get("user");
  const supabase = getServiceClient();
  const { email, password, name, role } = await c.req.json();

  if (!email || !password || !name || !role) {
    return c.json({ error: "Missing required fields: email, password, name, role" }, 400);
  }

  if (!["Admin", "Manager", "Agent"].includes(role)) {
    return c.json({ error: "Invalid role. Must be Admin, Manager, or Agent" }, 400);
  }

  if (password.length < 8) {
    return c.json({ error: "Password must be at least 8 characters" }, 400);
  }

  // 1. Manually check if user already exists to provide a better error message
  const { data: existingUser } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (existingUser) {
    return c.json({ error: "A user with this email already exists" }, 400);
  }

  // 2. Create the user via admin API
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    user_metadata: { name, role },
    email_confirm: true,
  });

  if (error) {
    return c.json({ error: error.message }, 400);
  }

  // Activity log
  await supabase.from("activity_log").insert({
    user_id: adminUser.id,
    action: "created",
    entity_type: "user",
    entity_id: data.user.id,
    details: { name, email, role },
  });

  return c.json({ data: data.user }, 201);
});

// PUT /users/:id — update user role/status (admin only)
users.put("/:id", requireRole("Admin"), async (c) => {
  const id = c.req.param("id");
  const adminUser = c.get("user");
  const supabase = getServiceClient();
  const body = await c.req.json();

  const updateData: any = { updated_at: new Date().toISOString() };

  if (body.role !== undefined) {
    if (!["Admin", "Manager", "Agent"].includes(body.role)) {
      return c.json({ error: "Invalid role" }, 400);
    }
    updateData.role = body.role;
    // Also update auth user_metadata
    await supabase.auth.admin.updateUserById(id, {
      user_metadata: { role: body.role },
    });
  }

  if (body.name !== undefined) {
    updateData.name = body.name;
    await supabase.auth.admin.updateUserById(id, {
      user_metadata: { name: body.name },
    });
  }

  if (body.isActive !== undefined) {
    updateData.is_active = body.isActive;
  }

  const { data, error } = await supabase
    .from("profiles")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  // Activity log
  await supabase.from("activity_log").insert({
    user_id: adminUser.id,
    action: "updated",
    entity_type: "user",
    entity_id: id,
    details: updateData,
  });

  return c.json({ data });
});

// DELETE /users/:id — deactivate user (admin only)
users.delete("/:id", requireRole("Admin"), async (c) => {
  const id = c.req.param("id");
  const adminUser = c.get("user");
  const supabase = getServiceClient();

  // Don't allow self-deactivation
  if (id === adminUser.id) {
    return c.json({ error: "Cannot deactivate your own account" }, 400);
  }

  const { data, error } = await supabase
    .from("profiles")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  // Activity log
  await supabase.from("activity_log").insert({
    user_id: adminUser.id,
    action: "deactivated",
    entity_type: "user",
    entity_id: id,
    details: { name: data.name },
  });

  return c.json({ data });
});

export default users;
