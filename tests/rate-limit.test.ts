import assert from "node:assert/strict";
import test from "node:test";
import { enforceAuthRateLimit } from "../src/lib/rate-limit";

test("enforceAuthRateLimit allows requests in production when Upstash is absent using in-memory limiter", async () => {
  const previousEnv = process.env.NODE_ENV;
  const previousUrl = process.env.UPSTASH_REDIS_REST_URL;
  const previousToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  try {
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;

    const id = `test-user-${Date.now()}`;

    // Should allow initial 10 requests
    for (let i = 0; i < 10; i++) {
      const allowed = await enforceAuthRateLimit(id);
      assert.equal(allowed, true, `Request ${i + 1} should be allowed`);
    }

    // 11th request should be rate-limited
    const eleventh = await enforceAuthRateLimit(id);
    assert.equal(eleventh, false, "11th request should be rate limited");

    // Other identifiers should still be allowed
    const otherId = `other-user-${Date.now()}`;
    const otherAllowed = await enforceAuthRateLimit(otherId);
    assert.equal(otherAllowed, true, "New identifier should be allowed");
  } finally {
    (process.env as Record<string, string | undefined>).NODE_ENV = previousEnv;
    if (previousUrl !== undefined) process.env.UPSTASH_REDIS_REST_URL = previousUrl;
    if (previousToken !== undefined) process.env.UPSTASH_REDIS_REST_TOKEN = previousToken;
  }
});
