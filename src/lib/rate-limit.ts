import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { createHash } from "node:crypto";

let limiter: Ratelimit | null | undefined;

function getLimiter(): Ratelimit | null {
  if (limiter !== undefined) return limiter;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    limiter = null;
    return limiter;
  }
  limiter = new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.slidingWindow(10, "10 m"),
    prefix: "nota:auth",
  });
  return limiter;
}

export async function enforceAuthRateLimit(identifier: string): Promise<boolean> {
  const configuredLimiter = getLimiter();
  if (!configuredLimiter) {
    // Local development must remain usable. Production must not silently run
    // without the shared, serverless-safe limiter.
    return process.env.NODE_ENV !== "production";
  }
  const result = await configuredLimiter.limit(identifier);
  return result.success;
}

/**
 * Account identifiers must not be placed in a shared Redis key in plaintext.
 * Hashing also makes the key stable across requests from different IPs.
 */
export function getAccountRateLimitKey(scope: string, email: string): string {
  const digest = createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
  return `${scope}:account:${digest}`;
}
