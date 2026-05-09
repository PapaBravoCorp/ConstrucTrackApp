import { Hono, Context } from "npm:hono";
import { logger } from "npm:hono/logger";
import { cors } from "npm:hono/cors";
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";

import { authMiddleware } from "./middleware/auth.ts";
import projectRoutes from "./routes/projects.ts";
import userRoutes from "./routes/users.ts";
import templateRoutes from "./routes/templates.ts";
import milestoneRoutes from "./routes/milestones.ts";
import notificationRoutes from "./routes/notifications.ts";
import activityRoutes from "./routes/activity.ts";

import { kv } from "./kv_store.tsx";

const app = new Hono();

// This handles the Supabase function name prefix
const api = new Hono().basePath("/api");
const auth = new Hono().basePath("/auth");

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
app.get("/health", (c: Context) => c.json({ status: "ok", timestamp: new Date().toISOString() }));
app.get("/server/health", (c: Context) => c.json({ status: "ok", timestamp: new Date().toISOString() }));

// Password reset request (public)
auth.post("/reset-password", async (c: Context) => {
  try {
    const { email } = await c.req.json();
    if (!email) {
      return c.json({ error: "Email is required" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) {
      return c.json({ error: "Server configuration error" }, 500);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { error } = await supabase.auth.resetPasswordForEmail(email);

    if (error) {
      return c.json({ error: error.message }, 400);
    }

    return c.json({ message: "Password reset email sent" });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// =========================================================
// LEGACY KV STORE ENDPOINTS (kept for backward compatibility)
// =========================================================

const handleKV = async (c: Context) => {
  try {
    const key = c.req.param("key");
    const value = await kv.get(key);
    return c.json({ value });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
};

app.get("/kv/:key", handleKV);
app.get("/server/kv/:key", handleKV);

// =========================================================
// PROTECTED API ROUTES (require authentication)
// =========================================================

// Apply auth middleware to all /api routes
api.use("/*", authMiddleware);

// Mount modules to the api sub-app
api.route("/projects", projectRoutes);
api.route("/users", userRoutes);
api.route("/templates", templateRoutes);
api.route("/milestones", milestoneRoutes);
api.route("/notifications", notificationRoutes);
api.route("/activity", activityRoutes);

// =========================================================
// MOUNT SUB-APPS TO MAIN APP
// =========================================================

app.route("/", auth);
app.route("/server", auth);
app.route("/", api);
app.route("/server", api);

// =========================================================
// START SERVER
// =========================================================

Deno.serve(async (req: Request) => {
  return app.fetch(req);
});
