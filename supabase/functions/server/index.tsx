import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";
import { authMiddleware } from "./middleware/auth.ts";
import * as kv from "./kv_store.tsx";

// Route modules
import projectRoutes from "./routes/projects.ts";
import userRoutes from "./routes/users.ts";
import templateRoutes from "./routes/templates.ts";
import milestoneRoutes from "./routes/milestones.ts";
import notificationRoutes from "./routes/notifications.ts";
import activityRoutes from "./routes/activity.ts";

const app = new Hono();

const BASE = "/make-server-9bb778f6";

// Enable logger
app.use("*", logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// =========================================================
// PUBLIC ROUTES (no auth required)
// =========================================================

// Health check endpoint
app.get(`${BASE}/health`, (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Password reset request (public — user may not be logged in)
app.post(`${BASE}/auth/reset-password`, async (c) => {
  try {
    const { email } = await c.req.json();
    if (!email) {
      return c.json({ error: "Email is required" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) {
      return c.json({ error: "Server configuration error" }, 500);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { error } = await supabase.auth.resetPasswordForEmail(email);

    if (error) {
      return c.json({ error: error.message }, 400);
    }

    return c.json({ success: true, message: "Password reset email sent" });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// =========================================================
// LEGACY KV STORE ENDPOINTS (kept for backward compatibility)
// =========================================================

app.get(`${BASE}/kv/:key`, async (c) => {
  try {
    const key = c.req.param("key");
    const value = await kv.get(key);
    return c.json({ value });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

app.post(`${BASE}/kv/:key`, async (c) => {
  try {
    const key = c.req.param("key");
    const { value } = await c.req.json();
    await kv.set(key, value);
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

app.get(`${BASE}/kv/prefix/:prefix`, async (c) => {
  try {
    const prefix = c.req.param("prefix");
    const values = await kv.getByPrefix(prefix);
    return c.json({ values });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// =========================================================
// AUTHENTICATED ROUTES (JWT required)
// =========================================================

// Apply auth middleware to all /api/* routes
app.use(`${BASE}/api/*`, authMiddleware);

// Mount route modules
app.route(`${BASE}/api/projects`, projectRoutes);
app.route(`${BASE}/api/users`, userRoutes);
app.route(`${BASE}/api/templates`, templateRoutes);
app.route(`${BASE}/api/milestones`, milestoneRoutes);
app.route(`${BASE}/api/notifications`, notificationRoutes);
app.route(`${BASE}/api/activity`, activityRoutes);

// =========================================================
// START SERVER
// =========================================================

Deno.serve(app.fetch);
