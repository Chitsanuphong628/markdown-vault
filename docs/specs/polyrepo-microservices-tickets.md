# Draft: polyrepo extraction tickets

These are proposed end-to-end slices for the spec [Split Nota into isolated service repositories](https://github.com/Chitsanuphong628/markdown-vault/issues/3). Publish one GitHub issue per slice after the user confirms this granularity.

## 1. Run Identity from its own repository

**Blocked by:** None.

**What it delivers:** Existing registration, login, session, verification, reset, and account deletion behavior runs through an independent Identity service while the current browser URLs still work.

- [ ] Identity owns `User` operations and uses a least-privilege database login.
- [ ] Existing sessions remain valid during cutover; Notes/MCP can verify a user without reading `User` themselves.
- [ ] The service has its own private GitHub repo, tests, typecheck, lint, build, and health check.
- [ ] Public request/response fields, statuses, cookies, and URLs match current contract tests.

## 2. Run Notes from its own repository

**Blocked by:** 1. Run Identity from its own repository.

**What it delivers:** Existing note, folder, search, share, and import/export APIs run through an independent Notes service without changing the browser contract.

- [ ] Notes owns `Note` and `Folder` reads/writes and uses a role limited to those tables and required functions.
- [ ] Ownership, revision conflicts, folder moves/cycles, search excerpts, share revocation, and account deletion cascade remain correct.
- [ ] The service authenticates user context through Identity and never reads the `User` table.
- [ ] The service has its own private GitHub repo, tests, typecheck, lint, build, and health check.
- [ ] Existing notes API responses and share URLs pass contract tests through the BFF.

## 3. Run MCP from its own repository

**Blocked by:** 1. Run Identity from its own repository; 2. Run Notes from its own repository.

**What it delivers:** Existing MCP discovery, OAuth, credentials, transport, and ten tools run from an independent MCP service.

- [ ] MCP owns only its credential and OAuth tables with a least-privilege database login.
- [ ] MCP calls Identity and Notes through authenticated APIs; no feature implementation is imported across repositories.
- [ ] OAuth discovery, PKCE, token expiry/revocation, API keys, MCP URL, and all ten tool names/response fields pass contract tests.
- [ ] The service has its own private GitHub repo, tests, typecheck, lint, build, and health check.

## 4. Run the Nota web app from its own repository

**Blocked by:** 1. Run Identity from its own repository; 2. Run Notes from its own repository; 3. Run MCP from its own repository.

**What it delivers:** The UI, PWA, Markdown editor/viewer, diagrams, and browser-side export run in a standalone web repository that routes existing same-origin URLs to the services.

- [ ] The web app owns no database access or service-role credentials.
- [ ] Its BFF preserves current auth, note, folder, share, OAuth/MCP, manifest, and static asset URLs.
- [ ] Content stays in-process in the web repo; there is no standalone Content network service.
- [ ] Existing Markdown bytes, editor modes, public note views, PWA behavior, and responsive Settings pass regression checks.
- [ ] The web app has its own private GitHub repo, tests, typecheck, lint, and build.

## 5. Verify preview routing and cut over safely

**Blocked by:** 1. Run Identity from its own repository; 2. Run Notes from its own repository; 3. Run MCP from its own repository; 4. Run the Nota web app from its own repository.

**What it delivers:** Four Vercel previews operate together with isolated environment variables, the existing public URLs route correctly, and rollback remains available.

- [ ] Each service connects through a service-specific PostgreSQL role; denied cross-table access is verified on a development database branch.
- [ ] Preview BFF routing reaches the correct service and preserves cookies, OAuth metadata, streaming MCP transport, and error responses.
- [ ] End-to-end tests cover account/session flows, note/folder/share behavior, revisions, Markdown preservation, and all MCP tools.
- [ ] Health checks and deployment rollback steps are documented and exercised before public traffic moves.
- [ ] No production data or credential is copied into a service repo or preview environment without an explicit configured secret.
