import { Hono } from "npm:hono";
import { getServiceClient } from "../middleware/auth.ts";

const notifications = new Hono();

// GET /notifications — get current user's notifications
notifications.get("/", async (c) => {
  const user = c.get("user");
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  // Count unread
  const { count } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("is_read", false);

  return c.json({ data, unreadCount: count || 0 });
});

// PUT /notifications/:id/read — mark single notification as read
notifications.put("/:id/read", async (c) => {
  const id = c.req.param("id");
  const user = c.get("user");
  const supabase = getServiceClient();

  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  return c.json({ success: true });
});

// PUT /notifications/read-all — mark all notifications as read
notifications.put("/read-all", async (c) => {
  const user = c.get("user");
  const supabase = getServiceClient();

  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", user.id)
    .eq("is_read", false);

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  return c.json({ success: true });
});

export default notifications;
