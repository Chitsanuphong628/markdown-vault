import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";

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

test("serveMcpOAuthMetadata serves RFC 8414 and RFC 9470 discovery endpoints", async () => {
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

test("registerDynamicClient creates RFC 7591 public PKCE client", async () => {
  const { registerDynamicClient } = await import("../src/lib/mcp/oauth");
  const client = registerDynamicClient({
    client_name: "Cursor IDE",
    redirect_uris: ["cursor://anysphere.cursor-mcp/oauth/callback"],
  });

  assert.match(client.client_id, /^nota_cursor-ide_[0-9a-f]{8}$/);
  assert.equal(client.client_name, "Cursor IDE");
  assert.deepEqual(client.redirect_uris, ["cursor://anysphere.cursor-mcp/oauth/callback"]);
  assert.equal(client.token_endpoint_auth_method, "none");
});

test("verifyPkce validates S256 code verifier and rejects invalid verifiers", async () => {
  const { verifyPkce } = await import("../src/lib/mcp/oauth");
  const { verifier, challenge } = createPkcePair();

  assert.equal(verifyPkce(verifier, challenge, "S256"), true);
  assert.equal(verifyPkce("wrong-verifier-value-that-does-not-match", challenge, "S256"), false);
  assert.equal(verifyPkce(verifier, challenge, "plain"), false);
});

test("issueAuthorizationCode signs a short-lived PKCE authorization code and exchangeCodeForToken blocks replay or mismatch", async () => {
  const { issueAuthorizationCode, exchangeCodeForToken } = await import("../src/lib/mcp/oauth");
  const { verifier, challenge } = createPkcePair();

  const code = issueAuthorizationCode({
    userId: "user-123",
    clientId: "cursor-client",
    redirectUri: "http://127.0.0.1:54321/callback",
    codeChallenge: challenge,
    scope: "mcp",
  });

  assert.equal(typeof code, "string");
  assert.equal(code.split(".").length, 3);

  // First use with mismatched redirectUri should fail and consume the code JTI
  await assert.rejects(
    () =>
      exchangeCodeForToken({
        code,
        clientId: "cursor-client",
        redirectUri: "http://evil.example/callback",
        codeVerifier: verifier,
      }),
    /redirect_uri mismatch/
  );

  // Replaying the same code must be rejected immediately
  await assert.rejects(
    () =>
      exchangeCodeForToken({
        code,
        clientId: "cursor-client",
        redirectUri: "http://127.0.0.1:54321/callback",
        codeVerifier: verifier,
      }),
    /Authorization code has already been used/
  );
});
