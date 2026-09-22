-- Baseline schema for a new Supabase project.
-- The IF NOT EXISTS guards also make this safe to run before the additive
-- hardening migration against an existing installation.
begin;

create extension if not exists pgcrypto;

create table if not exists "User" (
  "id" text primary key default gen_random_uuid()::text,
  "email" text not null unique,
  "passwordHash" text not null,
  "name" text,
  "emailVerified" boolean not null default false,
  "sessionVersion" integer not null default 0,
  "verificationCodeHash" text,
  "verificationExpiresAt" timestamptz,
  "verificationAttempts" integer not null default 0,
  "passwordResetCodeHash" text,
  "passwordResetExpiresAt" timestamptz,
  "passwordResetAttempts" integer not null default 0,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create table if not exists "Folder" (
  "id" text primary key default gen_random_uuid()::text,
  "name" text not null,
  "parentId" text references "Folder"("id") on delete cascade,
  "userId" text not null references "User"("id") on delete cascade,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create table if not exists "Note" (
  "id" text primary key default gen_random_uuid()::text,
  "title" text not null,
  "content" text not null,
  "folderId" text references "Folder"("id") on delete set null,
  "userId" text not null references "User"("id") on delete cascade,
  "isShared" boolean not null default false,
  "shareToken" text,
  "legacyShareId" text,
  "revision" integer not null default 0,
  "themeColor" text not null default 'default',
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create index if not exists "Note_userId_updatedAt_idx"
  on "Note" ("userId", "updatedAt" desc);
create index if not exists "Folder_userId_parentId_idx"
  on "Folder" ("userId", "parentId");
create unique index if not exists "Note_shareToken_key"
  on "Note" ("shareToken") where "shareToken" is not null;
create unique index if not exists "Note_legacyShareId_key"
  on "Note" ("legacyShareId") where "legacyShareId" is not null;

commit;
