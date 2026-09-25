import assert from "node:assert/strict";
import test from "node:test";
import { postLoginPath } from "../src/lib/auth-redirect";

test("login resumes the original OAuth authorization request", () => {
  const next = "/oauth/authorize?client_id=client-1&state=abc";
  assert.equal(postLoginPath(`?next=${encodeURIComponent(next)}`), next);
});

test("login rejects external and unrelated return destinations", () => {
  assert.equal(postLoginPath("?next=https%3A%2F%2Fevil.example"), "/");
  assert.equal(postLoginPath("?next=%2F%2Fevil.example"), "/");
  assert.equal(postLoginPath("?next=%2Fsettings"), "/");
});
