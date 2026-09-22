-- Run with the Supabase migration runner before deploying the matching app code.
-- This migration is additive: it preserves existing users, folders, notes, and
-- legacy share state while supplying the fields required by the hardened API.
begin;

create extension if not exists pgcrypto;

alter table "User"
  add column if not exists "emailVerified" boolean not null default false,
  add column if not exists "sessionVersion" integer not null default 0,
  add column if not exists "verificationCodeHash" text,
  add column if not exists "verificationExpiresAt" timestamptz,
  add column if not exists "verificationAttempts" integer not null default 0,
  add column if not exists "passwordResetCodeHash" text,
  add column if not exists "passwordResetExpiresAt" timestamptz,
  add column if not exists "passwordResetAttempts" integer not null default 0;

-- Legacy demo credentials must not remain usable once production auth ships.
do $$ begin
  if exists (
    select 1 from information_schema.columns where table_name = 'User' and column_name = 'verificationOtp'
  ) and exists (
    select 1 from information_schema.columns where table_name = 'User' and column_name = 'verificationToken'
  ) then
    update "User" set "verificationOtp" = null, "verificationToken" = null;
  elsif exists (
    select 1 from information_schema.columns where table_name = 'User' and column_name = 'verificationOtp'
  ) then
    update "User" set "verificationOtp" = null;
  elsif exists (
    select 1 from information_schema.columns where table_name = 'User' and column_name = 'verificationToken'
  ) then
    update "User" set "verificationToken" = null;
  end if;
end $$;

alter table "Note"
  add column if not exists "isShared" boolean not null default false,
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
  if not exists (
    select 1 from pg_constraint
    where conname = 'Folder_parentId_fkey'
      and conrelid = '"Folder"'::regclass
      and confrelid = '"Folder"'::regclass
  ) then
    alter table "Folder" add constraint "Folder_parentId_fkey"
      foreign key ("parentId") references "Folder"("id") on delete cascade not valid;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'Note_folderId_fkey'
      and conrelid = '"Note"'::regclass
      and confrelid = '"Folder"'::regclass
  ) then
    alter table "Note" add constraint "Note_folderId_fkey"
      foreign key ("folderId") references "Folder"("id") on delete set null not valid;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = '"Folder"'::regclass
      and confrelid = '"User"'::regclass
      and contype = 'f'
  ) then
    alter table "Folder" add constraint "Folder_userId_fkey"
      foreign key ("userId") references "User"("id") on delete cascade not valid;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = '"Note"'::regclass
      and confrelid = '"User"'::regclass
      and contype = 'f'
  ) then
    alter table "Note" add constraint "Note_userId_fkey"
      foreign key ("userId") references "User"("id") on delete cascade not valid;
  end if;
end $$;

-- Folder moves must check ownership, ancestry, and the update under one
-- transaction. The per-user advisory lock makes A -> B and B -> A concurrent
-- moves serialize instead of creating a cycle between two successful checks.
create or replace function public.update_nota_folder(
  target_folder_id text,
  target_user_id text,
  target_name text,
  name_provided boolean,
  target_parent_id text,
  parent_provided boolean
)
returns "Folder"
language plpgsql
security definer
set search_path = public
as $$
declare
  folder_row "Folder"%rowtype;
  next_parent text;
  has_cycle boolean;
begin
  perform pg_advisory_xact_lock(hashtext(target_user_id));

  select * into folder_row
  from "Folder"
  where "id" = target_folder_id and "userId" = target_user_id
  for update;

  if not found then
    raise exception 'FOLDER_NOT_FOUND' using errcode = 'P0002';
  end if;

  next_parent := case
    when parent_provided then target_parent_id
    else folder_row."parentId"
  end;

  if next_parent is not null then
    if not exists (
      select 1 from "Folder"
      where "id" = next_parent and "userId" = target_user_id
    ) then
      raise exception 'FOLDER_PARENT_NOT_FOUND' using errcode = 'P0003';
    end if;

    if next_parent = target_folder_id then
      raise exception 'FOLDER_CYCLE' using errcode = 'P0001';
    end if;

    with recursive ancestors(id) as (
      select next_parent
      union
      select f."parentId"
      from "Folder" f
      join ancestors a on a.id = f."id"
      where f."userId" = target_user_id and f."parentId" is not null
    )
    select exists (select 1 from ancestors where id = target_folder_id)
      into has_cycle;

    if has_cycle then
      raise exception 'FOLDER_CYCLE' using errcode = 'P0001';
    end if;
  end if;

  update "Folder"
  set "name" = case when name_provided then target_name else folder_row."name" end,
      "parentId" = next_parent,
      "updatedAt" = now()
  where "id" = target_folder_id and "userId" = target_user_id
  returning * into folder_row;

  return folder_row;
end;
$$;
revoke all on function public.update_nota_folder(text, text, text, boolean, text, boolean) from public, anon, authenticated;
grant execute on function public.update_nota_folder(text, text, text, boolean, text, boolean) to service_role;

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
grant execute on function public.delete_nota_account(text) to service_role;

commit;
