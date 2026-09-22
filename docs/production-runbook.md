# Production release runbook

## Before merge

1. Create an encrypted Supabase backup and record row counts for `User`, `Folder`, and `Note`.
2. Restore it into a non-production Supabase project, run the migration, then compare counts, owner references, and active-share counts.
   Validate each `NOT VALID` foreign key in that restored project before production; any orphaned legacy row is a release blocker until repaired.
3. Generate new, distinct `JWT_SECRET` and `AUTH_TOKEN_PEPPER`; revoke the tracked legacy JWT secret everywhere it may have been used.
4. Add all values from `.env.example` as Vercel Production secrets. Verify the Vercel production domain in Resend and set `NEXT_PUBLIC_APP_URL` to that exact origin.
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

## Deliberately disabled

MCP is not a production feature in this release. Do not configure `NOTA_USER_ID`, `NOTA_API_KEY`, or deploy `mcp-server` until it has a separate tenant-isolation security review.
