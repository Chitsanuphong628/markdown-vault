begin;

create table if not exists "McpOAuthClient" (
  "clientId" text primary key,
  "clientName" text not null,
  "redirectUris" jsonb not null,
  "createdAt" timestamptz not null default now(),
  constraint "McpOAuthClient_redirectUris_array" check (jsonb_typeof("redirectUris") = 'array')
);

create table if not exists "McpOAuthCode" (
  "jti" text primary key,
  "expiresAt" timestamptz not null
);

create index if not exists "McpOAuthCode_expiresAt_idx" on "McpOAuthCode" ("expiresAt");

alter table "McpOAuthClient" enable row level security;
alter table "McpOAuthCode" enable row level security;
revoke all on table "McpOAuthClient", "McpOAuthCode" from anon, authenticated;

commit;
