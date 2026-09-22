-- Run with the Supabase migration runner before deploying the matching app code.
-- This migration is additive: it preserves existing users, folders, notes, and
-- legacy share state while supplying the fields required by the hardened API.
begin;

create extension if not exists pgcrypto;

alter table "User"
  add column if not exists "verificationCodeHash" text,
  add column if not exists "verificationExpiresAt" timestamptz,
  add column if not exists "verificationAttempts" integer not null default 0,
  add column if not exists "passwordResetCodeHash" text,
  add column if not exists "passwordResetExpiresAt" timestamptz,
  add column if not exists "passwordResetAttempts" integer not null default 0;

-- Legacy demo credentials must not remain usable once production auth ships.
do $$ begin
  if exists (select 1 from information_schema.columns where table_name = 'User' and column_name = 'verificationOtp') then
    update "User" set "verificationOtp" = null, "verificationToken" = null;
  end if;
end $$;

alter table "Note"
  add column if not exists "shareToken" text,
  add column if not exists "legacyShareId" text,
  add column if not exists "revision" integer not null default 0,
  add column if not exists "themeColor" text not null default 'default';

-- Keep the sidebar's color preview out of the note-body listing query. Existing
-- frontmatter remains the source of truth for rendering; this backfill only
-- copies one of the known color keys into the indexed metadata column.
update "Note"
set "themeColor" = lower(substring(
  "content" from $$color:[[:space:]]*['"]?(default|sage|ocean|lavender|peach|rose)['"]?$$
))
where "themeColor" = 'default'
  and "content" ~ $$^---\r?\n$$
  and substring(
    "content" from $$color:[[:space:]]*['"]?(default|sage|ocean|lavender|peach|rose)['"]?$$
  ) is not null;

-- Existing public links get a new opaque token. Retain the old record itself;
-- deployment must notify owners to copy the new link from the app.
update "Note"
set "shareToken" = encode(gen_random_bytes(32), 'hex'), "legacyShareId" = "id"::text
where "isShared" = true and "shareToken" is null;

create unique index if not exists "Note_shareToken_key"
  on "Note" ("shareToken") where "shareToken" is not null;
create unique index if not exists "Note_legacyShareId_key"
  on "Note" ("legacyShareId") where "legacyShareId" is not null;
create index if not exists "Note_userId_updatedAt_idx"
  on "Note" ("userId", "updatedAt" desc);
create index if not exists "Folder_userId_parentId_idx"
  on "Folder" ("userId", "parentId");

-- Browser clients have a publishable Supabase key but no Supabase Auth session;
-- deny direct table access and make the server API the only data boundary.
alter table "User" enable row level security;
alter table "Folder" enable row level security;
alter table "Note" enable row level security;
revoke all on table "User", "Folder", "Note" from anon, authenticated;

-- Defend the service-role API with relational integrity. Existing installations
-- may already have equivalent constraints, so add them only when absent.
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'Folder_parentId_fkey') then
    alter table "Folder" add constraint "Folder_parentId_fkey"
      foreign key ("parentId") references "Folder"("id") on delete cascade not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'Note_folderId_fkey') then
    alter table "Note" add constraint "Note_folderId_fkey"
      foreign key ("folderId") references "Folder"("id") on delete set null not valid;
  end if;
end $$;

-- A single Postgres function makes account deletion atomic. It is called only
-- by the server-side service-role client, never exposed to anon/authenticated.
create or replace function public.delete_nota_account(target_user_id text)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from "Note" where "userId"::text = target_user_id;
  delete from "Folder" where "userId"::text = target_user_id;
  delete from "User" where "id"::text = target_user_id;
end;
$$;
revoke all on function public.delete_nota_account(text) from public, anon, authenticated;

commit;
