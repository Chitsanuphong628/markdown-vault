import assert from "node:assert/strict";
import test from "node:test";
import { createIdentityServiceClient } from "../src/modules/identity/server/service-client";

test("Identity BFF forwards auth routes while keeping the browser URL and cookie boundary", async () => {
  let capturedUrl = "";
  let capturedHeaders = new Headers();
  const client = createIdentityServiceClient({
    baseUrl: "https://identity.example.test/base/",
    caller: "nota-web",
    token: "internal-token-that-must-not-go-to-public-auth-routes",
    fetcher: async (input, init) => {
      capturedUrl = String(input);
      capturedHeaders = new Headers(init?.headers);
      return new Response(JSON.stringify({ success: true }), {
        status: 201,
        headers: { "content-type": "application/json", "set-cookie": "token=opaque; Path=/; HttpOnly; SameSite=Lax" },
      });
    },
  });
  const request = new Request("https://nota.example.test/api/auth/register?from=web", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: "token=old-session",
      origin: "https://nota.example.test",
      host: "nota.example.test",
      "x-vercel-forwarded-for": "198.51.100.17",
      authorization: "user-supplied-header",
    },
    body: JSON.stringify({ email: "test@example.com" }),
  });
  const response = await client.proxyOrLocal(request, () => { throw new Error("local handler must not run"); });
  assert.equal(capturedUrl, "https://identity.example.test/api/auth/register?from=web");
  assert.equal(capturedHeaders.get("cookie"), "token=old-session");
  assert.equal(capturedHeaders.get("origin"), "https://nota.example.test");
  assert.equal(capturedHeaders.get("x-forwarded-host"), "nota.example.test");
  assert.equal(capturedHeaders.get("x-vercel-forwarded-for"), "198.51.100.17");
  assert.equal(capturedHeaders.get("authorization"), "Bearer internal-token-that-must-not-go-to-public-auth-routes");
  assert.equal(capturedHeaders.get("x-nota-service"), "nota-web");
  assert.equal(response.status, 201);
  assert.match(response.headers.get("set-cookie") ?? "", /^token=opaque/);
  assert.deepEqual(await response.json(), { success: true });
});

test("an unset Identity URL keeps the in-process compatibility handler", async () => {
  const client = createIdentityServiceClient({ baseUrl: null, caller: "nota-web", token: null });
  let called = false;
  const response = await client.proxyOrLocal(new Request("http://localhost/api/auth/me"), () => {
    called = true;
    return Response.json({ user: null }, { status: 401 });
  });
  assert.equal(called, true);
  assert.equal(response.status, 401);
});

test("session verification uses the caller token and validates the Identity response", async () => {
  let requestHeaders = new Headers();
  let requestBody = "";
  const client = createIdentityServiceClient({
    baseUrl: "https://identity.example.test",
    caller: "nota-notes-service",
    token: "notes-token",
    fetcher: async (_input, init) => {
      requestHeaders = new Headers(init?.headers);
      requestBody = String(init?.body);
      return Response.json({ user: { id: "user-1", email: "one@example.com", name: "One", emailVerified: true } });
    },
  });
  const user = await client.verifySession("legacy-session-jwt");
  assert.deepEqual(user, { id: "user-1", email: "one@example.com", name: "One", emailVerified: true });
  assert.equal(requestHeaders.get("x-nota-service"), "nota-notes-service");
  assert.equal(requestHeaders.get("authorization"), "Bearer notes-token");
  assert.deepEqual(JSON.parse(requestBody), { token: "legacy-session-jwt" });
});

test("session verification accepts an existing account with a null display name", async () => {
  const client = createIdentityServiceClient({
    baseUrl: "https://identity.example.test",
    caller: "nota-web",
    token: "web-token",
    fetcher: async () => Response.json({ user: { id: "user-2", email: "legacy@example.com", name: null, emailVerified: false } }),
  });

  assert.deepEqual(await client.verifySession("legacy-session"), {
    id: "user-2",
    email: "legacy@example.com",
    name: null,
    emailVerified: false,
  });
});

test("untrusted Identity configuration and failed email checks fail closed", async () => {
  assert.throws(() => createIdentityServiceClient({ baseUrl: "http://identity.example.test", caller: "nota-web", token: "x" }), /HTTPS/);
  const client = createIdentityServiceClient({
    baseUrl: "https://identity.example.test",
    caller: "nota-mcp-service",
    token: "mcp-token",
    fetcher: async () => new Response("unavailable", { status: 503 }),
  });
  await assert.rejects(client.isEmailVerified("user-1"), /Identity service is unavailable/);
  assert.equal(await client.verifySession("token"), null);
});
