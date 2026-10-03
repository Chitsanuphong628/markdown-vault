# Nota polyrepo microservices

## Problem Statement

Nota is currently deployed as one Next.js application. Feature modules clarify code ownership, but they are not independent services or repositories. The product needs separate deployment and data-access boundaries as it grows while preserving behavior for existing users and MCP clients.

## Solution

Extract the current application into four private GitHub repositories: `nota-web`, `nota-identity-service`, `nota-notes-service`, and `nota-mcp-service`. The last three are backend microservices; `nota-web` is the browser application and BFF. Keep Markdown editing and rendering in-process as Content code within the web repository. Each service builds and deploys independently on Vercel, while the web BFF preserves existing browser-facing URLs.

Keep the production Supabase project and data untouched during preview. Use the approved, empty `nota-dev-microservices` project for preview deployments; give each service a distinct PostgreSQL login restricted to its owned tables and operations, and use the Supabase transaction pooler from Vercel functions. Do not use one `service_role`/secret API key per service as isolation: Supabase documents that those keys bypass RLS. Services call one another through authenticated HTTP contracts, never by importing implementation or querying another service's tables.

## User Stories

1. As a Nota user, I want registration and sign-in to continue working at the same URLs, so that I do not have to create a new account or change how I sign in.
2. As a Nota user, I want my existing session to remain valid during service extraction, so that deployment does not unexpectedly sign me out.
3. As a Nota user, I want to create, read, edit, move, search, export, and delete notes as before, so that the repository split is invisible in normal use.
4. As a Nota user, I want revision conflicts to remain visible and recoverable, so that concurrent edits do not silently overwrite each other.
5. As a Nota user, I want folder ownership and cycle checks to remain enforced, so that notes and folders cannot cross accounts or form invalid trees.
6. As a Nota user, I want share links to keep their current URL and revocation behavior, so that existing links continue to work until I revoke them.
7. As a Nota user, I want Markdown, frontmatter, diagrams, and editor switching to remain unchanged, so that extraction never rewrites note contents.
8. As an MCP client, I want the current discovery, OAuth, token, and Streamable HTTP URLs to remain available, so that existing client configuration keeps working.
9. As an MCP client, I want the same ten tools and response fields, so that extraction does not break integrations.
10. As a Nota operator, I want Identity, Notes, and MCP deployed independently, so that a change to one service does not require redeploying all backend code.
11. As a Nota operator, I want each backend to have access only to its owned tables, so that compromise of one service does not grant unrestricted database access.
12. As a Nota operator, I want service health and preview contract checks, so that I can validate a service before routing traffic to it.
13. As a Nota operator, I want the web BFF to keep same-origin browser requests, so that cookies, CORS, OAuth redirects, and public URLs remain stable.
14. As a Nota operator, I want account deletion to remain atomic in the shared database during this first cut, so that account cleanup does not leave orphaned records.
15. As a developer, I want each repository to run tests, typecheck, lint, and build independently, so that ownership boundaries are verifiable.
16. As a developer, I want internal service contracts documented and tested, so that services can change without reaching into each other's code.

## Implementation Decisions

- `nota-web` owns the Next.js UI, PWA, BFF, and Content package. It owns no database tables.
- `nota-identity-service` owns registration, login, session verification, email verification, password recovery, account lifecycle, and `User`.
- `nota-notes-service` owns `Note`, `Folder`, search, revisions, public sharing, and server-side import/export.
- `nota-mcp-service` owns MCP transport, OAuth clients/codes/tokens, API credentials, tool registration, and the ten MCP tools.
- Preserve current public HTTP paths, response shapes, statuses, share URLs, OAuth discovery, and MCP endpoint. The web BFF routes browser requests to the owning service without changing visible paths.
- MCP calls Identity and Notes over authenticated APIs. Notes uses Identity verification for user claims. No service imports another service's implementation.
- Keep current production data in the existing Supabase project. Preview uses a separate empty Supabase project with the same schema migrations and service-owned PostgreSQL roles; no production data is copied. Existing session deletion cascades remain atomic in the shared production database until a separately planned data migration.
- Preserve current session cookies through a compatibility migration; no service shares the current unrestricted JWT or Supabase service-role secret. Any signing-key change requires dual validation and an explicit rollback window.
- Deploy each repository as its own Vercel project. Preview deployments must use preview upstreams and isolated credentials.
- New repositories are private under the existing GitHub account. Do not copy note data, production keys, or `.env` files into them.
- No subscription/Billing service, production data split, queue, event bus, API schema break, or Markdown/schema change in this migration. The separate dev project is only for isolated previews.

## Testing Decisions

- Tests should exercise public HTTP behavior, user-level ownership, service authentication, and the actual PostgreSQL permission boundary rather than private function structure.
- Capture current route contracts before extraction, then run the same cases against the BFF and the independently deployed service.
- Test all ten MCP tool calls, OAuth discovery/authorization/token behavior, credential revocation, owner isolation, revision conflicts, folder moves/cycles, and share revocation.
- Test that a service's database role can access its own tables and is denied access to tables owned by another service. Test Vercel transaction-pooler configuration with prepared statements disabled and TLS required.
- Test that existing Markdown bytes, frontmatter, editor modes, imports, exports, and share URL behavior remain unchanged.
- Each repository runs tests, typecheck, lint, build, health checks, and preview contract checks before traffic is switched.
- Prior art includes the existing MCP contract/OAuth tests, Notes operations tests, Markdown preservation suites, and current `/api/health` route.

## Out of Scope

- Billing/subscriptions, a standalone Content service, a queue or event bus, a production data split, a new client state library, and changes to public API/Markdown/schema contracts.
- Production deployment or traffic cutover without service-specific database credentials and verified Vercel preview environments.

## Further Notes

The extraction code is pushed to four private repositories. The latest role-compatibility fixes are on `main`; their CI runs are in progress. Local tests cover the BFF and service contracts; the Web built smoke uses mock upstreams. Supabase branching is unavailable on the linked Free plan, so an empty development project was created after approval. Its schema and service roles are installed, and live permission queries confirm the table boundaries. Vercel projects, service login passwords, connection strings, and preview environments are not configured yet. See [the architecture status](../architecture/polyrepo-microservices.md#current-status).

Supabase documents that secret/service-role API keys bypass RLS, recommends a database user per service, and provides a shared transaction pooler for serverless workloads. Vercel external rewrites can preserve browser-visible URLs, although the web BFF may be used for dynamic upstream selection and streaming.

- https://supabase.com/docs/guides/getting-started/api-keys
- https://supabase.com/docs/guides/database/postgres/roles
- https://supabase.com/docs/guides/database/connecting-to-postgres
- https://vercel.com/docs/routing/rewrites
