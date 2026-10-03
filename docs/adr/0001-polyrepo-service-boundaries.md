---
status: accepted
---

# Nota service repositories and ownership

Nota will move from one Next.js deployment to four repositories: `nota-web` plus independently deployable Identity, Notes, and MCP services. The web application is a client/BFF repository, not a microservice; Content remains an in-process package. The services preserve current public HTTP, share, and MCP/OAuth contracts while communicating through authenticated APIs and keeping their current logical table ownership. To avoid a first-cut data migration, they remain on the existing Supabase project but use distinct least-privilege PostgreSQL login roles; Supabase secret/service-role API keys are not service isolation because they bypass RLS. Vercel remains the deployment platform, with same-origin routing at the web boundary.
