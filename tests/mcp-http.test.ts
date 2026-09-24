import assert from "node:assert/strict";
import test from "node:test";

process.env.NEXT_PUBLIC_APP_URL = "https://nota.example";
process.env.APP_ALLOWED_ORIGINS = "https://nota.example";
process.env.ENABLE_MCP = "true";

test("HTTP MCP rejects missing and invalid bearer credentials before protocol dispatch", async () => {
  const { serveMcpHttp } = await import("../src/lib/mcp/http");
  const request = (authorization?: string) => new Request("https://nota.example/api/mcp", {
    method: "POST", headers: authorization ? { Authorization: authorization } : {},
  });
  const missing = await serveMcpHttp(request());
  assert.equal(missing.status, 401);
  assert.match(missing.headers.get("www-authenticate") ?? "", /^Bearer/);
  const invalid = await serveMcpHttp(request("Bearer not-a-valid-nota-key"));
  assert.equal(invalid.status, 401);
});

test("HTTP MCP rejects another host and browser origin", async () => {
  const { serveMcpHttp } = await import("../src/lib/mcp/http");
  assert.equal((await serveMcpHttp(new Request("https://evil.example/api/mcp"))).status, 403);
  assert.equal((await serveMcpHttp(new Request("https://nota.example/api/mcp", {
    headers: { Origin: "https://evil.example" },
  }))).status, 403);
});
