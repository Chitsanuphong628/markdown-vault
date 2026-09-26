import assert from "node:assert/strict";
import test from "node:test";
import { createCursorInstallUrl, isMcpOAuthMetadataReady } from "../src/lib/mcp/connect";

test("Cursor install URL contains only the named remote MCP server config", () => {
  const endpoint = "https://nota.example/api/mcp?source=ไทย&mode=1";
  const link = new URL(createCursorInstallUrl(endpoint));
  assert.equal(link.protocol, "cursor:");
  assert.equal(link.host, "anysphere.cursor-deeplink");
  assert.equal(link.pathname, "/mcp/install");
  assert.equal(link.searchParams.get("name"), "nota-vault");
  const config = JSON.parse(Buffer.from(link.searchParams.get("config")!, "base64").toString("utf8"));
  assert.deepEqual(config, { url: endpoint });
  assert.equal(link.searchParams.size, 2);
  assert.doesNotMatch(link.href, /Bearer|NOTA_API_KEY|PASTE_YOUR_MCP_KEY/);
});

test("direct install requires usable OAuth registration and PKCE metadata", () => {
  const metadata = {
    issuer: "https://nota.example",
    authorization_endpoint: "https://nota.example/oauth/authorize",
    token_endpoint: "https://nota.example/api/oauth/token",
    registration_endpoint: "https://nota.example/api/oauth/register",
    code_challenge_methods_supported: ["S256"],
  };
  assert.equal(isMcpOAuthMetadataReady(metadata), true);
  assert.equal(isMcpOAuthMetadataReady({ ...metadata, registration_endpoint: undefined }), false);
  assert.equal(isMcpOAuthMetadataReady({ ...metadata, code_challenge_methods_supported: [] }), false);
  assert.equal(isMcpOAuthMetadataReady(null), false);
});
