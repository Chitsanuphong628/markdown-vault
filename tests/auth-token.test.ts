import assert from "node:assert/strict";
import test from "node:test";
import jwt from "jsonwebtoken";

process.env.AUTH_TOKEN_PEPPER = "test-pepper-that-is-long-enough-for-the-auth-code-suite";
process.env.JWT_SECRET = "test-jwt-secret-that-is-long-enough-for-the-auth-suite";

test("one-time code is six digits and only matches its HMAC", async () => {
  const { createOneTimeCode, hashOneTimeCode, matchesOneTimeCode } = await import("../src/lib/auth");
  const code = createOneTimeCode();
  assert.match(code, /^\d{6}$/);
  const hash = hashOneTimeCode(code);
  assert.equal(matchesOneTimeCode(code, hash), true);
  assert.equal(matchesOneTimeCode("000000", hash), code === "000000");
  assert.equal(matchesOneTimeCode("abc123", hash), false);
});

test("session tokens carry the session version used for revocation", async () => {
  const { signToken, verifyToken } = await import("../src/lib/auth");
  const payload = { userId: "user-1", email: "user@example.com", sessionVersion: 4 };
  const token = signToken(payload);
  const legacyToken = jwt.sign(
    { userId: payload.userId, email: payload.email },
    process.env.JWT_SECRET as string,
    { expiresIn: "7d", issuer: "nota-web", audience: "nota-web" }
  );

  assert.equal(verifyToken(token)?.sessionVersion, 4);
  assert.equal(verifyToken(legacyToken), null);
});
