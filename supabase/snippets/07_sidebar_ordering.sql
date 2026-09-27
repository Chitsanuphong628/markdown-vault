-- Persist a user-defined order for notes and folders in each sibling group.
begin;

do $$
begin
  -- Backfill only while introducing the column. Reapplying the setup snippet
  -- must not replace an order that users have already customized.
  if not exists (
    select 1 from pg_attribute
    where attrelid = 'public."Note"'::regclass and attname = 'sortOrder' and not attisdropped
  ) then
    alter table public."Note" add column "sortOrder" integer not null default 0;
    with ranked as (
      select "id", row_number() over (
        partition by "userId", "folderId"
        order by "updatedAt" desc, "id"
      ) - 1 as position
      from public."Note"
    )
    update public."Note" as note
    set "sortOrder" = ranked.position::integer
    from ranked
    where ranked."id" = note."id";
  end if;

  if not exists (
    select 1 from pg_attribute
    where attrelid = 'public."Folder"'::regclass and attname = 'sortOrder' and not attisdropped
  ) then
    alter table public."Folder" add column "sortOrder" integer not null default 0;
    with ranked as (
      select "id", row_number() over (
        partition by "userId", "parentId"
        order by "name" asc, "id"
      ) - 1 as position
      from public."Folder"
    )
    update public."Folder" as folder
    set "sortOrder" = ranked.position::integer
    from ranked
    where ranked."id" = folder."id";
  end if;
end;
$$;

create index if not exists "Note_userId_folderId_sortOrder_idx"
  on public."Note" ("userId", "folderId", "sortOrder");
create index if not exists "Folder_userId_parentId_sortOrder_idx"
  on public."Folder" ("userId", "parentId", "sortOrder");

-- New notes and folders go at the top of their sibling group. Keeping this in
-- database triggers also covers import and MCP inserts.
create or replace function public.assign_nota_sidebar_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  should_assign boolean := false;
  first_position integer;
begin
  if tg_op = 'INSERT' then
    should_assign := true;
  elsif tg_table_name = 'Note' then
    should_assign := new."folderId" is distinct from old."folderId";
  else
    should_assign := new."parentId" is distinct from old."parentId";
  end if;

  if not should_assign then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtext(new."userId"));

  if tg_table_name = 'Note' then
    select min("sortOrder") into first_position
    from public."Note"
    where "userId" = new."userId"
      and "folderId" is not distinct from new."folderId"
      and "id" is distinct from new."id";
  else
    select min("sortOrder") into first_position
    from public."Folder"
    where "userId" = new."userId"
      and "parentId" is not distinct from new."parentId"
      and "id" is distinct from new."id";
  end if;

  new."sortOrder" := coalesce(first_position - 1, 0);
  return new;
end;
$$;

drop trigger if exists "Note_assign_sidebar_order_insert" on public."Note";
create trigger "Note_assign_sidebar_order_insert"
  before insert on public."Note"
  for each row execute function public.assign_nota_sidebar_order();
drop trigger if exists "Note_assign_sidebar_order_move" on public."Note";
create trigger "Note_assign_sidebar_order_move"
  before update of "folderId" on public."Note"
  for each row execute function public.assign_nota_sidebar_order();

drop trigger if exists "Folder_assign_sidebar_order_insert" on public."Folder";
create trigger "Folder_assign_sidebar_order_insert"
  before insert on public."Folder"
  for each row execute function public.assign_nota_sidebar_order();
drop trigger if exists "Folder_assign_sidebar_order_move" on public."Folder";
create trigger "Folder_assign_sidebar_order_move"
  before update of "parentId" on public."Folder"
  for each row execute function public.assign_nota_sidebar_order();

-- Remove the earlier five-argument draft if it was applied during rollout.
drop function if exists public.reorder_nota_sidebar_item(text, text, text, text, text);

create or replace function public.reorder_nota_sidebar_item(
  target_user_id text,
  target_kind text,
  target_item_id text,
  target_parent_id text,
  target_before_id text default null,
  target_after_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ordered_ids text[];
  source_parent text;
  before_position integer;
  position_index integer;
  has_cycle boolean;
begin
  if target_kind is null or target_kind not in ('note', 'folder') then
    raise exception 'SIDEBAR_ITEM_KIND_INVALID' using errcode = '22023';
  end if;
  if target_before_id is not null and target_after_id is not null then
    raise exception 'SIDEBAR_POSITION_INVALID' using errcode = '22023';
  end if;

  -- Serialize moves for this user so sibling renumbering and cycle checks are atomic.
  perform pg_advisory_xact_lock(hashtext(target_user_id));

  if target_kind = 'note' then
    select "folderId" into source_parent
    from public."Note"
    where "id" = target_item_id and "userId" = target_user_id
    for update;
    if not found then
      raise exception 'SIDEBAR_ITEM_NOT_FOUND' using errcode = 'P0002';
    end if;

    if target_parent_id is not null and not exists (
      select 1 from public."Folder"
      where "id" = target_parent_id and "userId" = target_user_id
    ) then
      raise exception 'SIDEBAR_PARENT_NOT_FOUND' using errcode = 'P0003';
    end if;

    if target_before_id is not null and not exists (
      select 1 from public."Note"
      where "id" = target_before_id and "userId" = target_user_id
        and "folderId" is not distinct from target_parent_id
        and "id" <> target_item_id
    ) then
      raise exception 'SIDEBAR_BEFORE_ITEM_INVALID' using errcode = '22023';
    end if;
    if target_after_id is not null and not exists (
      select 1 from public."Note"
      where "id" = target_after_id and "userId" = target_user_id
        and "folderId" is not distinct from target_parent_id
        and "id" <> target_item_id
    ) then
      raise exception 'SIDEBAR_AFTER_ITEM_INVALID' using errcode = '22023';
    end if;

    select coalesce(array_agg("id" order by "sortOrder", "id"), array[]::text[])
      into ordered_ids
    from public."Note"
    where "userId" = target_user_id
      and "folderId" is not distinct from target_parent_id
      and "id" <> target_item_id;

    if target_before_id is null and target_after_id is null then
      ordered_ids := array_append(ordered_ids, target_item_id);
    elsif target_before_id is not null then
      before_position := array_position(ordered_ids, target_before_id);
      ordered_ids := coalesce(ordered_ids[1:before_position - 1], array[]::text[])
        || array[target_item_id]
        || coalesce(ordered_ids[before_position:cardinality(ordered_ids)], array[]::text[]);
    else
      before_position := array_position(ordered_ids, target_after_id);
      ordered_ids := coalesce(ordered_ids[1:before_position], array[]::text[])
        || array[target_item_id]
        || coalesce(ordered_ids[before_position + 1:cardinality(ordered_ids)], array[]::text[]);
    end if;

    if source_parent is distinct from target_parent_id then
      update public."Note" set "folderId" = target_parent_id
      where "id" = target_item_id and "userId" = target_user_id;

      with ranked as (
        select "id", row_number() over (order by "sortOrder", "id") - 1 as position
        from public."Note"
        where "userId" = target_user_id
          and "folderId" is not distinct from source_parent
          and "id" <> target_item_id
      )
      update public."Note" as note
      set "sortOrder" = ranked.position::integer
      from ranked where ranked."id" = note."id";
    end if;

    for position_index in 1..cardinality(ordered_ids) loop
      update public."Note"
      set "sortOrder" = position_index - 1
      where "id" = ordered_ids[position_index] and "userId" = target_user_id;
    end loop;
    before_position := array_position(ordered_ids, target_item_id);

    return jsonb_build_object('kind', 'note', 'id', target_item_id,
      'parentId', target_parent_id, 'sortOrder', before_position - 1);
  end if;

  select "parentId" into source_parent
  from public."Folder"
  where "id" = target_item_id and "userId" = target_user_id
  for update;
  if not found then
    raise exception 'SIDEBAR_ITEM_NOT_FOUND' using errcode = 'P0002';
  end if;

  if target_parent_id is not null then
    if not exists (
      select 1 from public."Folder"
      where "id" = target_parent_id and "userId" = target_user_id
    ) then
      raise exception 'SIDEBAR_PARENT_NOT_FOUND' using errcode = 'P0003';
    end if;

    if target_parent_id = target_item_id then
      raise exception 'FOLDER_CYCLE' using errcode = 'P0001';
    end if;

    with recursive ancestors(id) as (
      select target_parent_id
      union
      select folder."parentId"
      from public."Folder" as folder
      join ancestors on ancestors.id = folder."id"
      where folder."userId" = target_user_id and folder."parentId" is not null
    )
    select exists(select 1 from ancestors where id = target_item_id) into has_cycle;

    if has_cycle then
      raise exception 'FOLDER_CYCLE' using errcode = 'P0001';
    end if;
  end if;

  if target_before_id is not null and not exists (
    select 1 from public."Folder"
    where "id" = target_before_id and "userId" = target_user_id
      and "parentId" is not distinct from target_parent_id
      and "id" <> target_item_id
  ) then
    raise exception 'SIDEBAR_BEFORE_ITEM_INVALID' using errcode = '22023';
  end if;
  if target_after_id is not null and not exists (
    select 1 from public."Folder"
    where "id" = target_after_id and "userId" = target_user_id
      and "parentId" is not distinct from target_parent_id
      and "id" <> target_item_id
  ) then
    raise exception 'SIDEBAR_AFTER_ITEM_INVALID' using errcode = '22023';
  end if;

  select coalesce(array_agg("id" order by "sortOrder", "name", "id"), array[]::text[])
    into ordered_ids
  from public."Folder"
  where "userId" = target_user_id
    and "parentId" is not distinct from target_parent_id
    and "id" <> target_item_id;

  if target_before_id is null and target_after_id is null then
    ordered_ids := array_append(ordered_ids, target_item_id);
  elsif target_before_id is not null then
    before_position := array_position(ordered_ids, target_before_id);
    ordered_ids := coalesce(ordered_ids[1:before_position - 1], array[]::text[])
      || array[target_item_id]
      || coalesce(ordered_ids[before_position:cardinality(ordered_ids)], array[]::text[]);
  else
    before_position := array_position(ordered_ids, target_after_id);
    ordered_ids := coalesce(ordered_ids[1:before_position], array[]::text[])
      || array[target_item_id]
      || coalesce(ordered_ids[before_position + 1:cardinality(ordered_ids)], array[]::text[]);
  end if;

  if source_parent is distinct from target_parent_id then
    update public."Folder"
    set "parentId" = target_parent_id, "updatedAt" = now()
    where "id" = target_item_id and "userId" = target_user_id;

    with ranked as (
      select "id", row_number() over (order by "sortOrder", "name", "id") - 1 as position
      from public."Folder"
      where "userId" = target_user_id
        and "parentId" is not distinct from source_parent
        and "id" <> target_item_id
    )
    update public."Folder" as folder
    set "sortOrder" = ranked.position::integer
    from ranked where ranked."id" = folder."id";
  end if;

  for position_index in 1..cardinality(ordered_ids) loop
    update public."Folder"
    set "sortOrder" = position_index - 1
    where "id" = ordered_ids[position_index] and "userId" = target_user_id;
  end loop;
  before_position := array_position(ordered_ids, target_item_id);

  return jsonb_build_object('kind', 'folder', 'id', target_item_id,
    'parentId', target_parent_id, 'sortOrder', before_position - 1);
end;
$$;

revoke all on function public.assign_nota_sidebar_order() from public, anon, authenticated;
revoke all on function public.reorder_nota_sidebar_item(text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.reorder_nota_sidebar_item(text, text, text, text, text, text) to service_role;

commit;
