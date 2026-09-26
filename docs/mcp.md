# Nota MCP setup

Nota keeps the ten original tool names and serves them through the official MCP TypeScript SDK v2. It supports local stdio and remote Streamable HTTP at `/api/mcp`. The SDK negotiates the current 2026-07-28 protocol and supports 2025-era clients. A host still needs support for one of those transports and a way to supply credentials; no server can guarantee compatibility with arbitrary client-specific config formats.

## Enable

1. After a backup, apply `supabase/migrations/202609240000_mcp_credentials.sql` and then `supabase/migrations/202609250001_mcp_oauth_state.sql` to a non-production project and validate both before applying them to the target Supabase project.
2. Set `ENABLE_MCP=true` only after both migrations are applied. Keep `SUPABASE_SERVICE_ROLE_KEY` on the server only.
3. Sign in to a verified Nota account, open Settings → MCP, and either connect through OAuth or generate a manual credential. A manual credential is shown once; only its SHA-256 hash is stored. It expires in 90 days and can be revoked from the same page.

In Settings → MCP, choose Cursor, Claude, or ChatGPT. All three clients use the same Nota MCP endpoint. **Add to Cursor** opens Cursor's install prompt when Nota's OAuth discovery and dynamic client registration are available; approve installation and complete OAuth in Cursor. Opening the link alone does not confirm a connection. **Open Claude Connectors** and **Open ChatGPT Plugins** copy the MCP URL and open each client's setup page in a new tab; they do not create a connection automatically. In Claude, use Customize → Connectors → Add custom connector (Team/Enterprise may require an Owner to add it first). In ChatGPT, enable Developer mode, then use the plus button on Plugins to create an app, enter the MCP URL, and scan tools; some accounts expose creation through Settings → Apps → Create. Claude and ChatGPT need a publicly reachable HTTPS endpoint; `localhost` is not reachable from their cloud services. The MCP tab retains manual key and config options for clients that need them.

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

Use `https://your-nota-domain.example/api/mcp` as a Streamable HTTP endpoint. Supply `Authorization: Bearer <MCP key>` through your client's secure credential facility. The endpoint accepts only exact hosts in `APP_ALLOWED_ORIGINS` or trusted Vercel system domains, checks browser Origin, validates a bearer token on every request, and returns HTTP 401 for invalid or missing credentials. It has no cross-origin browser access by default. OAuth access-token `aud` must match the exact host used for that request.

The endpoint is stateless. No `Mcp-Session-Id` storage is required. It accepts legacy 2025-era Streamable HTTP requests through the SDK's stateless fallback. The older HTTP+SSE transport is deprecated by MCP and is not served here.

## Optional OAuth sign-in

With `ENABLE_MCP=true`, Nota publishes OAuth authorization-server and protected-resource metadata for `/api/mcp`. A client that supports MCP OAuth discovery can connect using only `https://your-nota-domain.example/api/mcp`: it registers a public client, opens Nota's consent page, and exchanges a PKCE S256 authorization code for a revocable 90-day MCP credential. Users who are signed out return to the same consent request after login. The client must send a registered `redirect_uri` and its `client_id` during token exchange. Manual MCP keys remain available for clients without this flow.

Apply `supabase/migrations/202609250001_mcp_oauth_state.sql` before enabling the native OAuth flow. It stores client registrations and authorization-code JTIs in Supabase; code redemption atomically removes the JTI so a code cannot be used on another server instance. Apply the earlier MCP credentials migration first. Existing signed-in users can revoke issued credentials from Settings → MCP.

To use an external authorization server instead, set all four `MCP_OAUTH_*` variables shown in `.env.example`. The provider must issue JWT access tokens with `iss` matching `MCP_OAUTH_ISSUER`, `aud` equal to the exact `/api/mcp` URL, `sub` equal to a verified Nota `User.id`, and the `mcp` scope. The server verifies signatures through the configured HTTPS JWKS URL. Do not configure an unrelated OAuth provider whose subjects are not Nota user IDs.

## Tool behavior

Every note and folder query is scoped to the authenticated owner. `create_note` and `create_folder` validate destination folder ownership. `update_note` requires the current `revision` to prevent overwriting a newer edit. `delete_folder` only deletes an empty folder. `share_note` rotates or removes the opaque public share token. `scan_and_cleanup` is a read-only count and performs no deletion.

MCP hosts should ask for confirmation before destructive tools. MCP annotations advertise destructive operations, but host approval behavior is controlled by the client.
