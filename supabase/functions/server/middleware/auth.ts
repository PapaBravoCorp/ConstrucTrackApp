import { createClient } from "jsr:@supabase/supabase-js@2.49.8";
import type { Context, Next } from "npm:hono";

/**
 * JWT Authentication middleware for Hono.
 * Validates the Authorization: Bearer <token> header using Supabase Auth.
 * Attaches the authenticated user to the Hono context via c.set('user', ...).
 */
export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json({ error: "Missing or invalid Authorization header" }, 401);
  }

  const token = authHeader.replace("Bearer ", "");

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseServiceKey) {
    return c.json({ error: "Server configuration error" }, 500);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Verify the JWT and get the user
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    return c.json({ error: "Invalid or expired token" }, 401);
  }

  // Fetch profile from our profiles table
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return c.json({ error: "User profile not found" }, 401);
  }

  if (!profile.is_active) {
    return c.json({ error: "Account is deactivated" }, 403);
  }

  // Attach user info to context
  c.set("user", {
    id: user.id,
    email: user.email,
    name: profile.name,
    role: profile.role,
    profile,
  });

  await next();
}

/**
 * Role-based authorization middleware factory.
 * Use after authMiddleware. Checks if the authenticated user has one of the allowed roles.
 *
 * Usage: app.post("/admin-only", requireRole("Admin"), handler)
 */
export function requireRole(...roles: string[]) {
  return async (c: Context, next: Next) => {
    const user = c.get("user");
    if (!user) {
      return c.json({ error: "Authentication required" }, 401);
    }
    if (!roles.includes(user.role)) {
      return c.json({ error: "Insufficient permissions" }, 403);
    }
    await next();
  };
}

/**
 * Helper to get a service-role Supabase client (for admin operations).
 */
export function getServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}
