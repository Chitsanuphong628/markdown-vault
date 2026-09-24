begin;

create table if not exists "McpCredential" (
  "id" text primary key default gen_random_uuid()::text,
  "userId" text not null references "User"("id") on delete cascade,
  "tokenHash" text not null unique,
  "createdAt" timestamptz not null default now(),
  "expiresAt" timestamptz not null,
  "revokedAt" timestamptz
);

create index if not exists "McpCredential_userId_idx" on "McpCredential" ("userId");
alter table "McpCredential" enable row level security;
revoke all on table "McpCredential" from anon, authenticated;

-- Lock the parent first. FK checks on concurrent child inserts then wait until
-- this transaction finishes, so the emptiness check cannot race with inserts.
create or replace function public.delete_nota_empty_folder(target_folder_id text, target_user_id text)
returns boolean language plpgsql security definer set search_path = public as $$
declare found_id text;
begin
  select f."id" into found_id from "Folder" f
  where f."id" = target_folder_id and f."userId" = target_user_id for update;
  if found_id is null then return false; end if;
  if exists (select 1 from "Folder" c where c."parentId" = found_id)
    or exists (select 1 from "Note" n where n."folderId" = found_id) then
    return false;
  end if;
  delete from "Folder" f where f."id" = found_id and f."userId" = target_user_id;
  return true;
end;
$$;
revoke all on function public.delete_nota_empty_folder(text, text) from public, anon, authenticated;
grant execute on function public.delete_nota_empty_folder(text, text) to service_role;

commit;
