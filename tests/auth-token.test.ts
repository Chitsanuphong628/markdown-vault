import assert from "node:assert/strict";
import test from "node:test";

process.env.AUTH_TOKEN_PEPPER = "test-pepper-that-is-long-enough-for-the-auth-code-suite";

test("one-time code is six digits and only matches its HMAC", async () => {
  const { createOneTimeCode, hashOneTimeCode, matchesOneTimeCode } = await import("../src/lib/auth");
  const code = createOneTimeCode();
  assert.match(code, /^\d{6}$/);
  const hash = hashOneTimeCode(code);
  assert.equal(matchesOneTimeCode(code, hash), true);
  assert.equal(matchesOneTimeCode("000000", hash), code === "000000");
  assert.equal(matchesOneTimeCode("abc123", hash), false);
});
