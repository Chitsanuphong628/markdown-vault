# Nota

Nota is a Markdown knowledge vault backed by Supabase and deployed through Vercel.

## Local setup

1. Copy `.env.example` to `.env` and supply development-only credentials.
2. Apply the SQL in `supabase/migrations/` to a non-production Supabase project before using the hardened auth and sharing flows.
3. Run `npm run dev`.

## Verification

Run `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build` before opening a pull request. Production configuration, backup rehearsal, and release gates are in `docs/production-runbook.md`.

## MCP

See [MCP setup and security](docs/mcp.md) for local stdio and remote Streamable HTTP configuration. Apply `supabase/migrations/202609240000_mcp_credentials.sql` before enabling MCP.
