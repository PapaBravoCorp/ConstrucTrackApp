import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";
import * as kv from "./kv_store.tsx";

const app = new Hono();

// Enable logger
app.use('*', logger(console.log));

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

// Health check endpoint
app.get("/make-server-9bb778f6/health", (c) => {
  return c.json({ status: "ok" });
});

// Signup endpoint
app.post("/make-server-9bb778f6/signup", async (c) => {
  try {
    const { email, password, name, role } = await c.req.json();
    
    if (!email || !password || !name || !role) {
      return c.json({ error: "Missing required fields" }, 400);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      return c.json({ error: "Server configuration error" }, 500);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: { name, role },
      email_confirm: true
    });

    if (error) {
      return c.json({ error: error.message }, 400);
    }

    return c.json({ user: data.user });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// KV Store endpoints for frontend to fetch/store data easily
app.get("/make-server-9bb778f6/kv/:key", async (c) => {
  try {
    const key = c.req.param("key");
    const value = await kv.get(key);
    return c.json({ value });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

app.post("/make-server-9bb778f6/kv/:key", async (c) => {
  try {
    const key = c.req.param("key");
    const { value } = await c.req.json();
    await kv.set(key, value);
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

app.get("/make-server-9bb778f6/kv/prefix/:prefix", async (c) => {
  try {
    const prefix = c.req.param("prefix");
    const values = await kv.getByPrefix(prefix);
    return c.json({ values });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

Deno.serve(app.fetch);
