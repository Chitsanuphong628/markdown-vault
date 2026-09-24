import assert from "node:assert/strict";
import test from "node:test";

test("session cache hits and avoids db queries within TTL", async () => {
  const { resolveUserFromPayload, clearSessionCache, sessionCache } = await import("../src/lib/auth");
  clearSessionCache();

  let dbQueries = 0;
  const mockDb = async (userId: string) => {
    dbQueries++;
    return {
      id: userId,
      email: "test@example.com",
      name: "Test User",
      emailVerified: true,
      sessionVersion: 1,
    };
  };

  const payload = { userId: "user-123", email: "test@example.com", sessionVersion: 1 };

  // First call: cache miss -> queries DB
  const user1 = await resolveUserFromPayload(payload, mockDb);
  assert.equal(dbQueries, 1);
  assert.equal(user1?.id, "user-123");
  assert.equal(sessionCache.has("user-123"), true);

  // Second call within TTL: cache hit -> does NOT query DB
  const user2 = await resolveUserFromPayload(payload, mockDb);
  assert.equal(dbQueries, 1);
  assert.equal(user2?.email, "test@example.com");

  // Third call within TTL: cache hit -> still 1 DB query
  const user3 = await resolveUserFromPayload(payload, mockDb);
  assert.equal(dbQueries, 1);
  assert.equal(user3?.id, "user-123");
});

test("session cache rejects and evicts when token sessionVersion does not match", async () => {
  const { resolveUserFromPayload, clearSessionCache } = await import("../src/lib/auth");
  clearSessionCache();

  let dbQueries = 0;
  const mockDb = async (userId: string) => {
    dbQueries++;
    return {
      id: userId,
      email: "test@example.com",
      name: "Test User",
      emailVerified: true,
      sessionVersion: 2, // DB is at version 2
    };
  };

  // Cached with version 2
  await resolveUserFromPayload({ userId: "user-revoked", email: "test@example.com", sessionVersion: 2 }, mockDb);
  assert.equal(dbQueries, 1);

  // Older token with version 1 arrives: rejected immediately from cache
  const result = await resolveUserFromPayload(
    { userId: "user-revoked", email: "test@example.com", sessionVersion: 1 },
    mockDb
  );
  assert.equal(result, null);
});

test("invalidateSessionUser explicitly removes user from session cache", async () => {
  const { resolveUserFromPayload, invalidateSessionUser, clearSessionCache, sessionCache } = await import("../src/lib/auth");
  clearSessionCache();

  let dbQueries = 0;
  const mockDb = async (userId: string) => {
    dbQueries++;
    return {
      id: userId,
      email: "test@example.com",
      name: "Test User",
      emailVerified: true,
      sessionVersion: 1,
    };
  };

  const payload = { userId: "user-logout", email: "test@example.com", sessionVersion: 1 };
  await resolveUserFromPayload(payload, mockDb);
  assert.equal(dbQueries, 1);
  assert.equal(sessionCache.has("user-logout"), true);

  // Invalidate (e.g. on logout or password change)
  invalidateSessionUser("user-logout");
  assert.equal(sessionCache.has("user-logout"), false);

  // Next call must re-query DB
  await resolveUserFromPayload(payload, mockDb);
  assert.equal(dbQueries, 2);
});
