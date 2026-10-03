# Nota modular monolith

> This describes the current single-repository extraction state. The requested target has changed to multiple deployable services; see [polyrepo microservices](./polyrepo-microservices.md) for the target and migration sequence.

## Runtime boundary

Nota remains one Next.js application deployed on Vercel with the existing Supabase project. `src/app` owns URL routing and HTTP/page composition. It does not own persistence rules. Server-side modules may use platform adapters; browser modules must not import server entrypoints.

## Data ownership

| Module | Owned data / behavior | Allowed dependencies |
| --- | --- | --- |
| Identity | `User`, password and verification flows, web sessions, account recovery | Platform database, email, and rate-limit adapters |
| Notes | `Note`, `Folder`, folder lifecycle, search, public sharing, import/export, editor drafts and save coordination | Platform database; Content contracts; app-shell client/shared contracts for localized copy, shortcuts, PWA control, and Settings composition |
| Content | Markdown parsing, preservation, editing, preview, diagrams and conversion | Notes passes Markdown text and callbacks; app-shell client/shared contracts for localized copy and shortcuts; no database access |
| MCP | MCP credentials, OAuth clients/codes, transport, tool registration, connection UI | Notes use cases for all note/folder/share operations; Identity's verified-user check; platform adapters |
| App shell | Settings composition, language, shortcuts, PWA and app-level layout | Public client entrypoints from feature modules; Identity account panel and MCP client panel for their Settings tabs |
| Platform | Supabase client, email delivery, rate limiting and environment configuration | External services only; no feature policy |

Billing is intentionally outside this MVP until subscription rules are defined.

## Current entrypoints

- Notes: `src/modules/notes/client.ts`, `server.ts`, and `shared.ts`. `NotesWorkspace` and browser state live in the client side; the server side owns every Note/Folder query.
- Content: `src/modules/content/client.ts` and `shared.ts`. Markdown conversion and editor code do not access the database.
- Identity: `src/modules/identity/server.ts` and `shared.ts`. Auth HTTP handlers sit behind the server entrypoint; client pages use only shared copy/redirect helpers.
- MCP: `src/modules/mcp/client.ts` and `server.ts`. OAuth, credential, status, and transport handlers live behind the MCP server entrypoint.
- App shell: `src/modules/app-shell/client.ts` and `shared.ts`.
- Platform: `src/platform/server.ts` is the sole public entrypoint for Supabase, environment, email, request security, and rate-limit adapters.

`eslint/module-boundaries.mjs` rejects deep cross-module imports, dependencies outside the allow-list below, client-to-server/platform imports, and database access outside the owning module. This is used by `npm run lint`.

Account deletion stays in Identity. Its existing database delete/cascade remains the lifecycle coordinator for dependent MCP credentials and note data; the refactor does not add a schema or transaction boundary.

## Dependency rules

1. `src/app/**` composes route handlers and pages from public module entrypoints.
2. `Language` is a neutral UI contract in `src/shared/language.ts`; App shell owns preference state and controls.
3. Cross-module imports must use public entrypoints and follow this allow-list: Notes → App shell (`client`, `shared`) and Content (`client`, `shared`); Content → App shell (`client`, `shared`); MCP → Identity (`server`) and Notes (`server`); App shell → Identity (`client`) and MCP (`client`). Identity has no feature-module dependency.
4. Notes owns export behavior; its export panel is supplied to Settings through a render slot so App shell does not import Notes. Identity owns account actions and MCP owns connection/key/tool UI; Settings composes their client panels.
5. Client entrypoints and files marked `"use client"` must not import database, email, OAuth-secret, or service-role code. The import rule also blocks server modules from importing client entrypoints; `server.ts` public paths are reserved for server callers.
6. Only Notes code reads or mutates `Note` and `Folder`. MCP invokes Notes operations rather than issuing those queries itself.
7. Platform adapters contain infrastructure mechanics, not account, note, folder, sharing, or OAuth policy.

## Contracts that must remain stable

- Existing HTTP paths, methods, response shapes, status codes, and share URLs.
- `Note` and `Folder` schema, Markdown bytes, and revision-based compare-and-swap updates.
- Owner checks for every private operation, folder-cycle prevention, and share-link revocation.
- Existing OAuth discovery and token behavior, MCP transport, and the ten registered tool names.
- Existing Next.js/Vercel deployment and Supabase data store; no service, queue, state library, or schema is added here.

## Baseline before extraction (2026-09-27)

- `npm test`: 146 passed, 0 failed.
- `npm run typecheck`: passed.
- `npm run lint`: 0 errors, 23 existing warnings.
- `npm run build`: passed; Next.js generated all 31 static pages/routes.

The tests above are the behavioral baseline for structural changes. Lint warnings are recorded rather than cleaned up opportunistically in this refactor.

## Verification after extraction (2026-09-27)

- `npm test`: 155 passed, 0 failed, including MCP tool dispatch, Notes ownership/revision/share/folder tests, and the Markdown suites.
- `npm run typecheck`: passed.
- `npm run lint`: 0 errors; 14 warnings remain.
- `npm run build`: passed and generated all 31 routes. The local build environment printed the existing stdio MCP `NOTA_API_KEY` configuration warning; it did not prevent compilation.
- Local read-only smoke check: `/` rendered the signed-in workspace and `/api/health` returned 200. Settings rendered the Identity account panel, Notes export panel, and MCP panel; the local MCP readiness check correctly displayed unavailable. No credential or note content was created, changed, or exported during this check.
- Responsive Settings check: at 320, 375, 414, and 768 px the document width stayed within the viewport; the mobile Settings tabs remained reachable by horizontal scrolling. Desktop Settings also rendered. PWA installation itself and physical iOS/Android devices were not exercised.

## Extraction order

1. Notes server use cases shared by web routes and MCP.
2. Identity and MCP server boundaries, including their Settings panels.
3. Content, Notes, and App shell client modules; Notes export is supplied to Settings through a render slot.
4. Enforced module dependency allow-list and removal of obsolete implementation aliases.

The extraction order is also the recommended order for later module work: finish and verify one ownership boundary before moving the next. The former `src/lib` and `src/components` implementations have been moved under their owning modules; `src/app` keeps URLs and Next.js composition.
