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

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const memoryStore = new Map<string, RateLimitRecord>();
const WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_REQUESTS = 10;

function enforceMemoryRateLimit(identifier: string): boolean {
  const now = Date.now();
  const record = memoryStore.get(identifier);

  if (memoryStore.size > 5000) {
    for (const [key, value] of memoryStore.entries()) {
      if (now > value.resetAt) memoryStore.delete(key);
    }
  }

  if (!record || now > record.resetAt) {
    memoryStore.set(identifier, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }

  if (record.count >= MAX_REQUESTS) {
    return false;
  }

  record.count += 1;
  return true;
}

export async function enforceAuthRateLimit(identifier: string): Promise<boolean> {
  const configuredLimiter = getLimiter();
  if (configuredLimiter) {
    try {
      const result = await configuredLimiter.limit(identifier);
      return result.success;
    } catch (err) {
      console.warn("[rate-limit] Upstash error, falling back to memory:", err);
    }
  }

  return enforceMemoryRateLimit(identifier);
}

/**
 * Account identifiers must not be placed in a shared Redis key in plaintext.
 * Hashing also makes the key stable across requests from different IPs.
 */
export function getAccountRateLimitKey(scope: string, email: string): string {
  const digest = createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
  return `${scope}:account:${digest}`;
}
