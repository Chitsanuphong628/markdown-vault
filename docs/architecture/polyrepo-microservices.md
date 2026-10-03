# Nota polyrepo microservices

## Target

Split the current application into four repositories: three independently deployable backend services and one web application. The current checkout remains the source of truth while the services are extracted in stages; do not create empty GitHub repositories or copy incomplete service code before its contracts and smoke tests are ready.

| Repository | Deployable responsibility | Data it owns |
| --- | --- | --- |
| `nota-web` | Next.js web app, PWA, Settings composition, editor/viewer, diagrams, browser-side import/export, and a same-origin BFF/router | None |
| `nota-identity-service` | Registration, login, sessions, verification, password recovery, verified-user checks, and account lifecycle | `User` |
| `nota-notes-service` | Notes, folders, search, revisions, sharing, server-side import/export, and all note/folder APIs | `Note`, `Folder` |
| `nota-mcp-service` | MCP transport, OAuth clients/tokens, API credentials, tool registration, and MCP APIs | MCP credential/OAuth tables |

`Content` is a package inside `nota-web`, not a network service: Markdown parsing, editor behavior, preview, and diagram rendering are called in-process by the UI. Platform adapters (Supabase clients, email, rate limiting) live with the service that uses them; they are not standalone services.

## Request flow

```text
Browser ──same-origin existing URLs──> nota-web BFF/router
                                      ├──> Identity API
                                      └──> Notes API

MCP clients ──existing MCP/OAuth URL──> nota-mcp-service
                                         ├──> Identity API (user/session verification)
                                         └──> Notes API (all note, folder, and share tools)
```

Keep the existing browser paths, share URLs, OAuth discovery paths, and MCP endpoint through the web router/custom-domain routing. The MCP public endpoint must continue to advertise the same issuer/resource locations during cutover. Service-to-service calls use authenticated identities and explicit timeouts; browser cookies and Supabase service-role secrets are never forwarded to another service.

## Data isolation

The first deployment can keep the existing Supabase project to avoid a schema/data migration, but that alone does not create service ownership. Before enabling separate deployments:

1. Each service must connect as its own PostgreSQL login role, granted only its owned tables and operations; do not treat one Supabase `secret` key per service as isolation, because those keys use `service_role` and bypass RLS.
2. Vercel serverless functions use Supavisor transaction mode for those roles, with a small per-instance pool, SSL required, and prepared statements disabled. Verify the custom-role connection string and effective role before cutover.
3. Notes stores `userId` as an identity reference and validates the caller through Identity; it does not query `User`.
4. MCP stores subject IDs and calls Identity/Notes APIs; it does not query `User`, `Note`, or `Folder` directly.
5. Account deletion remains atomic in the shared database during this first cut. If databases are separated later, replace the existing foreign-key cascade with an idempotent cross-service deletion workflow before moving data.
6. Use backward-compatible migrations and preserve existing note IDs, Markdown bytes, revisions, share tokens, and OAuth client IDs.

The present code uses one Supabase service-role client. Supabase secret/service-role keys bypass RLS, so a separate API key per service does not provide table-level isolation. The first cut therefore keeps one Supabase project but replaces shared clients with least-privilege Postgres login roles and service-owned APIs. Until those roles and service authentication are in place, separate Vercel projects would still be one shared-trust system and must not be described as production-isolated microservices.

## Compatibility contracts

- `nota-web` keeps the existing browser-facing `/api/auth/**`, `/api/notes/**`, `/api/folders/**`, `/api/share/**`, and MCP/OAuth URLs as BFF or routing contracts.
- Identity starts with the existing auth request/response contracts and adds a private verification endpoint for service callers. Replace the shared HS256 secret with a rotatable asymmetric signing key/JWKS only through a dual-validation session migration.
- Notes exposes versioned internal contracts for owner-scoped CRUD, compare-and-swap updates, folder moves, and share revocation. It returns explicit conflict/authorization errors so the BFF can preserve current HTTP responses.
- MCP exposes the existing transport and ten tool names. It calls Notes APIs instead of importing Notes implementation code.
- Keep request/response schemas next to each service and publish compatibility tests from consumers; do not create a shared contracts repository that becomes a fourth backend dependency.

## Migration sequence

1. **Prepare contracts in the current checkout:** freeze API behavior with contract tests, define service authentication, timeouts, and error mapping, and add service adapters behind current route handlers. No public URL or data changes.
2. **Extract Identity first:** Notes and MCP currently import Identity directly. Move auth handlers and `User` ownership to `nota-identity-service`, preserve browser paths through the BFF, and verify existing sessions through a compatibility endpoint before any signing-key rotation. Test registration, login, logout, verification, reset, account deletion, and service verification.
3. **Extract Notes:** create `nota-notes-service` from the Notes server use cases and DB ownership; route current Next.js handlers through it. Verify ownership, revision conflicts, folder moves/cycles, search, share revocation, and import/export before switching traffic.
4. **Extract MCP:** move OAuth and Streamable HTTP transport; replace direct Identity/Notes imports with authenticated API clients. Verify discovery, PKCE/token flows, revocation, API keys, all ten tools, and current endpoint URLs.
5. **Separate web:** keep UI and Content in `nota-web`; replace internal server imports with BFF clients and route existing paths to the owning APIs. Deploy each repo as its own Vercel project with health checks, environment isolation, and preview contract tests.
6. **Cut over and retire the monolith server code:** compare preview behavior, deploy incrementally, monitor errors, and retain a route rollback window. Remove old handlers only after the deployed services pass the same contract suite.

Each step must pass tests, typecheck, lint, build, and preview smoke checks before the next service is extracted. Do not extract all modules in one move.

## MVP exclusions

No Billing service until subscription rules are defined. No standalone Content service, queue, event bus, or new state library. Do not split the Supabase project in the first cut unless restricted table-level access cannot be established safely; if separate databases become necessary, plan a distinct data migration with rollback.

## Current status

The extraction code is pushed to four private repositories. The original checkout remains the existing application and is not cut over; its `src/modules/*` layout is still present as a reference until a preview is approved and the production routing migration is planned.

| Repository | Latest pushed `main` commit | CI |
| --- | --- | --- |
| [nota-identity-service](https://github.com/Chitsanuphong628/nota-identity-service) | `3ff2b37` | passed |
| [nota-notes-service](https://github.com/Chitsanuphong628/nota-notes-service) | `00381d4` | passed |
| [nota-mcp-service](https://github.com/Chitsanuphong628/nota-mcp-service) | `fcd4647` | passed |
| [nota-web](https://github.com/Chitsanuphong628/nota-web) | `a019e93` | passed |

The services have local PostgreSQL permission tests, contract tests, and independent GitHub CI. The built Web smoke test exercises a production build against authenticated mock Identity, Notes, and MCP upstreams, including cookie handling, subject assertions, OAuth discovery, and MCP SSE.

**Preview and cutover are still pending.** Supabase Free rejected database branching, so an empty development project `nota-dev-microservices` (`spfzfncwckxunitjplju`, `ap-southeast-1`) was created after approval. The baseline and three service-role migrations are applied there; it contains no production data. Live catalog checks confirmed RLS is on, public roles have no table reads, and Identity, Notes, and MCP each have only their owned-table grants. The service roles remain `NOLOGIN`; no database passwords or application connection strings have been configured. Vercel CLI/project linkage is absent here, and no Vercel projects or service URLs have been configured. Do not deploy a service against the production database or move public traffic until each service has a verified dev connection and the four Vercel previews pass their checks.

## Platform references

- [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys) and [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security): secret/service-role keys bypass RLS; table grants and row policies are separate controls.
- [Supabase Postgres roles](https://supabase.com/docs/guides/database/postgres/roles): use a separate database login for each service and grant only required database permissions.
- [Supabase Postgres connections](https://supabase.com/docs/guides/database/connecting-to-postgres): serverless services use the shared transaction pooler; custom role usernames include the project reference and transaction mode has client constraints.
- [Vercel rewrites](https://vercel.com/docs/routing/rewrites): external-origin rewrites can preserve the visible path. The implementation may use Next.js BFF route handlers instead where dynamic upstream configuration or response streaming requires it.
