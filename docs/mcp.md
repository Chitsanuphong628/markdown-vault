# Nota MCP setup

Nota keeps the ten original tool names and serves them through the official MCP TypeScript SDK v2. It supports local stdio and remote Streamable HTTP at `/api/mcp`. The SDK negotiates the current 2026-07-28 protocol and supports 2025-era clients. A host still needs support for one of those transports and a way to supply credentials; no server can guarantee compatibility with arbitrary client-specific config formats.

## Enable

1. Apply `supabase/migrations/202609240000_mcp_credentials.sql` to the target Supabase project after a backup and test it in a non-production project.
2. Set `ENABLE_MCP=true` in the app environment. Keep `SUPABASE_SERVICE_ROLE_KEY` on the server only.
3. Sign in to a verified Nota account, open Settings → MCP, and generate a credential. Copy it immediately. Only its SHA-256 hash is stored. It expires in 90 days. Revoke it from the same page if a client is retired or the key is exposed.

The old `nota_sec_` JWT and `NOTA_USER_ID` configurations are intentionally rejected. They do not have revocation or safe user binding. Delete them from old client configurations.

## Local stdio

Install project dependencies, then configure a stdio-capable client to launch:

```json
{
  "mcpServers": {
    "nota-vault": {
      "command": "node",
      "args": ["/absolute/path/to/nota/mcp-server/index.js"],
      "env": { "NOTA_API_KEY": "PASTE_YOUR_MCP_KEY" }
    }
  }
}
```

The process writes MCP protocol data only to stdout. Diagnostics go to stderr. The credential is rechecked before each tool invocation, so revocation affects already-running stdio clients.

## Remote HTTP

Use `https://your-nota-domain.example/api/mcp` as a Streamable HTTP endpoint. Supply `Authorization: Bearer <MCP key>` through your client's secure credential facility. The endpoint requires the exact configured public host, checks browser Origin, validates a bearer token on every request, and returns HTTP 401 for invalid or missing credentials. It has no cross-origin browser access by default.

The endpoint is stateless. No `Mcp-Session-Id` storage is required. It accepts legacy 2025-era Streamable HTTP requests through the SDK's stateless fallback. The older HTTP+SSE transport is deprecated by MCP and is not served here.

## Optional OAuth sign-in

For hosts that require OAuth discovery and interactive sign-in, connect an external OAuth authorization server and set all four `MCP_OAUTH_*` variables shown in `.env.example`. The provider must issue JWT access tokens with `iss` matching `MCP_OAUTH_ISSUER`, `aud` equal to the exact `/api/mcp` URL, `sub` equal to a verified Nota `User.id`, and the `mcp` scope. The server verifies signatures through the configured HTTPS JWKS URL and publishes RFC 9728 protected-resource metadata. Do not configure this using an unrelated OAuth provider whose subjects are not Nota user IDs. This repo does not implement an authorization server or an OAuth consent screen.

## Tool behavior

Every note and folder query is scoped to the authenticated owner. `create_note` and `create_folder` validate destination folder ownership. `update_note` requires the current `revision` to prevent overwriting a newer edit. `delete_folder` only deletes an empty folder. `share_note` rotates or removes the opaque public share token. `scan_and_cleanup` is a read-only count and performs no deletion.

MCP hosts should ask for confirmation before destructive tools. MCP annotations advertise destructive operations, but host approval behavior is controlled by the client.
