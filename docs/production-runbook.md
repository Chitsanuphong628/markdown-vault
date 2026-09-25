# Production release runbook

## Before merge

1. Create an encrypted Supabase backup and record row counts for `User`, `Folder`, and `Note`.
2. Restore it into a non-production Supabase project, run the migrations in filename order (`202609220000_initial_schema.sql` then `202609220001_public_production_hardening.sql`), then compare counts, owner references, and active-share counts. The baseline is idempotent for existing installations; never use it as permission to reset or drop a live database.
   Validate each `NOT VALID` foreign key in that restored project before production; any orphaned legacy row is a release blocker until repaired.
3. Generate new, distinct `JWT_SECRET` and `AUTH_TOKEN_PEPPER`; revoke the tracked legacy JWT secret everywhere it may have been used.
4. Add all values from `.env.example` as Vercel Production secrets. Verify the Vercel production domain in Resend. Set `NEXT_PUBLIC_APP_URL` to the canonical origin used for metadata and links, and `APP_ALLOWED_ORIGINS` to the exact HTTPS domains allowed to serve requests.
   Keep Vercel system environment variables exposed: the origin policy also trusts the exact `VERCEL_PROJECT_PRODUCTION_URL` and deployment `VERCEL_URL` on production, while preview uses its own branch/deployment URLs. The canonical URL alone does not authorize a request origin.
5. Configure Upstash Redis. The application fails closed for auth traffic in production if it is absent.
6. Require GitHub PR approval, GitHub Actions, and Vercel preview checks before merging `main`.

## Release verification

- Verify register, verification email, legacy-password login, reset-password email, note CRUD, tokenized sharing, legacy shared-link compatibility, share revocation, and account deletion on a Vercel preview.
- Confirm response headers include CSP, HSTS, `X-Content-Type-Options`, and clickjacking protection.
- Check Sentry/uptime alerts and `/api/health` before inviting users.

## Recovery objective

- RPO: no more than one hour of data loss.
- RTO: restore public service within four hours.
- Run and record a restore rehearsal quarterly. During an incident, disable writes, restore the newest point-in-time backup, validate ownership/counts, then re-enable traffic.

## MCP release gate

The web folder-delete route uses `delete_nota_empty_folder`. Apply and validate `202609240000_mcp_credentials.sql` and then `202609250001_mcp_oauth_state.sql` on a restored non-production database **before deploying this code**, even when MCP remains disabled. MCP stays disabled until both migrations are applied to production, the MCP tests pass, and the tenant-isolation/security review is complete. Then set `ENABLE_MCP=true`. Keep the old `nota_sec_` JWTs, `NOTA_USER_ID`, and `MCP_JWT_SECRET` disabled. See [MCP setup](mcp.md).
