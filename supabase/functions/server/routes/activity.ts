import { Hono } from "npm:hono";
import { getServiceClient, requireRole } from "../middleware/auth.ts";

const activityLog = new Hono();

// GET /activity — list activity log entries (admin only)
activityLog.get("/", requireRole("Admin"), async (c) => {
  const supabase = getServiceClient();
  const limit = parseInt(c.req.query("limit") || "50");
  const offset = parseInt(c.req.query("offset") || "0");
  const entityType = c.req.query("entityType");

  let query = supabase
    .from("activity_log")
    .select(`
      *,
      user:profiles(id, name, role)
    `, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (entityType) {
    query = query.eq("entity_type", entityType);
  }

  const { data, error, count } = await query;

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  return c.json({ data, total: count });
});

export default activityLog;
