import { Context, Next } from "npm:hono";
import { kv } from "../kv_store.tsx";
import { getServiceClient } from "./auth.ts";

export type RateLimitConfig = {
  maxRequests: number;
  windowMs: number;
};

const limits: Record<string, RateLimitConfig> = {
  transitions: { maxRequests: 20, windowMs: 60000 },
  comments: { maxRequests: 10, windowMs: 60000 },
  uploads: { maxRequests: 30, windowMs: 60000 },
  default: { maxRequests: 100, windowMs: 60000 },
};

/**
 * Generates a security audit log on rate limit (429) triggers.
 */
async function logSecurityAudit(userId: string, action: string, ip: string, path: string) {
  const supabase = getServiceClient();
  // We use a lightweight table 'activity_log' but label it specifically
  await supabase.from("activity_log").insert({
    user_id: userId,
    action: "rate_limit_exceeded",
    entity_type: "user",
    entity_id: userId,
    details: { action, ip, path, message: "User exceeded rate limits" }
  });
}

/**
 * Middleware that limits the number of requests per user per time window.
 */
export function rateLimiter(actionType: 'transitions' | 'comments' | 'uploads' | 'default') {
  return async (c: Context, next: Next) => {
    const user = c.get("user");
    if (!user) {
      return next(); // If not authenticated, let authMiddleware handle it
    }

    const config = limits[actionType] || limits.default;
    const key = `ratelimit:${actionType}:${user.id}`;

    // Increment request count in KV
    const res = await kv.get<{ count: number; expiresAt: number }>(key);
    const now = Date.now();

    let count = 1;
    let expiresAt = now + config.windowMs;

    if (res && res.expiresAt > now) {
      count = res.count + 1;
      expiresAt = res.expiresAt;
    }

    if (count > config.maxRequests) {
      // Create security audit log
      const ip = c.req.header("x-forwarded-for") || c.req.header("x-real-ip") || "unknown";
      await logSecurityAudit(user.id, actionType, ip, c.req.path);

      c.res.headers.set('Retry-After', String(Math.ceil((expiresAt - now) / 1000)));
      return c.json({ error: "Too Many Requests", warning: "Rate limit exceeded. Please wait." }, 429);
    }

    // Save back to KV
    await kv.set(key, { count, expiresAt }, config.windowMs);

    await next();
  };
}
