import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import type { RegisteredClientInfo } from "../src/lib/mcp/oauth";

process.env.NEXT_PUBLIC_APP_URL = "https://nota.example";
process.env.APP_ALLOWED_ORIGINS = "https://nota.example";
process.env.ENABLE_MCP = "true";
process.env.JWT_SECRET = "test-jwt-secret-with-at-least-32-characters-long-1234";

function createPkcePair() {
  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

test("getNativeOAuthMetadata returns RFC 8414 compliant metadata with registration_endpoint", async () => {
  const { getNativeOAuthMetadata } = await import("../src/lib/mcp/oauth");
  const metadata = getNativeOAuthMetadata("https://nota.example/api/mcp");

  assert.equal(metadata.issuer, "https://nota.example");
  assert.equal(metadata.authorization_endpoint, "https://nota.example/oauth/authorize");
  assert.equal(metadata.token_endpoint, "https://nota.example/api/oauth/token");
  assert.equal(metadata.registration_endpoint, "https://nota.example/api/oauth/register");
  assert.deepEqual(metadata.code_challenge_methods_supported, ["S256"]);
  assert.deepEqual(metadata.token_endpoint_auth_methods_supported, ["none"]);
});

test("serveMcpOAuthMetadata serves RFC 8414 and RFC 9728 discovery endpoints", async () => {
  const { serveMcpOAuthMetadata } = await import("../src/lib/mcp/http");

  const authServerRes = serveMcpOAuthMetadata(
    new Request("https://nota.example/.well-known/oauth-authorization-server")
  );
  assert.equal(authServerRes.status, 200);
  const authServerJson = await authServerRes.json();
  assert.equal(authServerJson.authorization_endpoint, "https://nota.example/oauth/authorize");
  assert.equal(authServerJson.token_endpoint, "https://nota.example/api/oauth/token");
  assert.equal(authServerJson.registration_endpoint, "https://nota.example/api/oauth/register");

  const resourceRes = serveMcpOAuthMetadata(
    new Request("https://nota.example/.well-known/oauth-protected-resource/api/mcp")
  );
  assert.equal(resourceRes.status, 200);
  const resourceJson = await resourceRes.json();
  assert.equal(resourceJson.resource, "https://nota.example/api/mcp");
});

function fakeOAuthStore() {
  const clients = new Map<string, RegisteredClientInfo>();
  const codes = new Set<string>();
  return {
    async saveClient(client: RegisteredClientInfo) { clients.set(client.client_id, client); },
    async findClient(id: string) { return clients.get(id) ?? null; },
    async saveCode(jti: string) { codes.add(jti); },
    async consumeCode(jti: string) { return codes.delete(jti); },
  };
}

test("registered clients can authorize only their registered callback", async () => {
  const { createOAuthService } = await import("../src/lib/mcp/oauth");
  const oauth = createOAuthService(fakeOAuthStore(), async () => ({ token: "test-token" }));
  const client = await oauth.registerDynamicClient({
    client_name: "Cursor IDE",
    redirect_uris: ["cursor://anysphere.cursor-mcp/oauth/callback"],
  });

  assert.match(client.client_id, /^nota_cursor-ide_[0-9a-f]{24}$/);
  assert.equal(client.client_name, "Cursor IDE");
  assert.deepEqual(client.redirect_uris, ["cursor://anysphere.cursor-mcp/oauth/callback"]);
  assert.equal(client.token_endpoint_auth_method, "none");

  const { challenge } = createPkcePair();
  await assert.rejects(() => oauth.issueAuthorizationCode({
    userId: "user-123", clientId: client.client_id,
    redirectUri: "https://evil.example/callback", codeChallenge: challenge,
  }), /redirect_uri/);
  await assert.rejects(() => oauth.issueAuthorizationCode({
    userId: "user-123", clientId: "unknown-client",
    redirectUri: client.redirect_uris[0], codeChallenge: challenge,
  }), /client_id/);
  assert.equal(typeof await oauth.issueAuthorizationCode({
    userId: "user-123", clientId: client.client_id,
    redirectUri: client.redirect_uris[0], codeChallenge: challenge,
  }), "string");
});

test("registration retains a non-Latin client display name", async () => {
  const { createOAuthService } = await import("../src/lib/mcp/oauth");
  const oauth = createOAuthService(fakeOAuthStore());
  const client = await oauth.registerDynamicClient({
    client_name: "ผู้ช่วยโน้ต ไทย",
    redirect_uris: ["https://client.example/callback"],
  });
  assert.equal((await oauth.findClient(client.client_id))?.client_name, "ผู้ช่วยโน้ต ไทย");
});

test("verifyPkce validates S256 code verifier and rejects invalid verifiers", async () => {
  const { verifyPkce } = await import("../src/lib/mcp/oauth");
  const { verifier, challenge } = createPkcePair();

  assert.equal(verifyPkce(verifier, challenge, "S256"), true);
  assert.equal(verifyPkce("wrong-verifier-value-that-does-not-match", challenge, "S256"), false);
  assert.equal(verifyPkce(verifier, challenge, "plain"), false);
  assert.equal(verifyPkce("short", crypto.createHash("sha256").update("short").digest("base64url"), "S256"), false);
});

test("a code can be redeemed only once across OAuth service instances", async () => {
  const { createOAuthService } = await import("../src/lib/mcp/oauth");
  const store = fakeOAuthStore();
  const first = createOAuthService(store, async () => ({ token: "test-token" }));
  const second = createOAuthService(store, async () => ({ token: "test-token" }));
  const { verifier, challenge } = createPkcePair();
  const client = await first.registerDynamicClient({
    client_name: "Cursor", redirect_uris: ["http://127.0.0.1:54321/callback"],
  });

  const code = await first.issueAuthorizationCode({
    userId: "user-123",
    clientId: client.client_id,
    redirectUri: "http://127.0.0.1:54321/callback",
    codeChallenge: challenge,
    scope: "mcp",
  });

  assert.equal(typeof code, "string");
  assert.equal(code.split(".").length, 3);

  await assert.rejects(
    () =>
      first.exchangeCodeForToken({
        code,
        clientId: client.client_id,
        redirectUri: "http://evil.example/callback",
        codeVerifier: verifier,
      }),
    /redirect_uri mismatch/
  );

  assert.equal((await first.exchangeCodeForToken({
    code, clientId: client.client_id,
    redirectUri: "http://127.0.0.1:54321/callback", codeVerifier: verifier,
  })).access_token, "test-token");

  await assert.rejects(
    () =>
      second.exchangeCodeForToken({
        code,
        clientId: client.client_id,
        redirectUri: "http://127.0.0.1:54321/callback",
        codeVerifier: verifier,
      }),
    /Authorization code has already been used/
  );
});
