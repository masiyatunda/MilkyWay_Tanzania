-- MilkyWay group chats: settings, roles, removal/blocking, leave and delete.
-- Idempotent. All functions check auth.uid() themselves and are executable by authenticated users only.
alter table public.mw_dm_groups add column if not exists caption text not null default '';
alter table public.mw_dm_groups add column if not exists description text not null default '';

create table if not exists public.mw_dm_group_blocks (
  group_id uuid not null references public.mw_dm_groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  blocked_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key(group_id, user_id)
);
alter table public.mw_dm_group_blocks enable row level security;
drop policy if exists mw_dm_group_blocks_read on public.mw_dm_group_blocks;
create policy mw_dm_group_blocks_read on public.mw_dm_group_blocks for select to authenticated
  using (public.mw_dm_is_group_admin(mw_dm_group_blocks.group_id, auth.uid()));

-- Creates a group, makes the caller admin and adds the initial members in one transaction.
create or replace function public.mw_group_create(p_name text, p_caption text, p_description text, p_members uuid[])
returns uuid language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); gid uuid; n text := btrim(coalesce(p_name, ''));
begin
  if me is null then raise exception 'Sign in first.' using errcode = '28000'; end if;
  if char_length(n) < 1 or char_length(n) > 70 then raise exception 'Group name must be 1-70 characters.' using errcode = '22023'; end if;
  insert into public.mw_dm_groups(name, caption, description, created_by)
    values (n, left(btrim(coalesce(p_caption, '')), 120), left(btrim(coalesce(p_description, '')), 1000), me)
    returning id into gid;
  insert into public.mw_dm_group_members(group_id, user_id, role) values (gid, me, 'admin');
  insert into public.mw_dm_group_members(group_id, user_id, role)
    select gid, u.id, 'member' from auth.users u
    where u.id = any(coalesce(p_members, '{}'::uuid[])) and u.id <> me
      and not exists (select 1 from public.mw_blocks b where (b.blocker_id = me and b.blocked_id = u.id) or (b.blocker_id = u.id and b.blocked_id = me))
    limit 255
    on conflict do nothing;
  return gid;
end $$;

create or replace function public.mw_group_update(p_group uuid, p_name text, p_caption text, p_description text)
returns void language plpgsql security definer set search_path = public as $$
declare n text := btrim(coalesce(p_name, ''));
begin
  if auth.uid() is null then raise exception 'Sign in first.' using errcode = '28000'; end if;
  if not public.mw_dm_is_group_admin(p_group, auth.uid()) then raise exception 'Only admins can edit the group.' using errcode = '42501'; end if;
  if char_length(n) < 1 or char_length(n) > 70 then raise exception 'Group name must be 1-70 characters.' using errcode = '22023'; end if;
  update public.mw_dm_groups set name = n, caption = left(btrim(coalesce(p_caption, '')), 120), description = left(btrim(coalesce(p_description, '')), 1000)
    where id = p_group;
end $$;

-- Returns the number of people actually added (blocked, already-member and mw_blocks pairs are skipped).
create or replace function public.mw_group_add_members(p_group uuid, p_users uuid[])
returns integer language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); room integer; added integer := 0;
begin
  if me is null then raise exception 'Sign in first.' using errcode = '28000'; end if;
  if not public.mw_dm_is_group_admin(p_group, me) then raise exception 'Only admins can add members.' using errcode = '42501'; end if;
  select 256 - count(*) into room from public.mw_dm_group_members where group_id = p_group;
  if room <= 0 then raise exception 'This group is full.' using errcode = '22023'; end if;
  with ins as (
    insert into public.mw_dm_group_members(group_id, user_id, role)
    select p_group, u.id, 'member' from auth.users u
    where u.id = any(coalesce(p_users, '{}'::uuid[]))
      and not exists (select 1 from public.mw_dm_group_blocks g where g.group_id = p_group and g.user_id = u.id)
      and not exists (select 1 from public.mw_blocks b where (b.blocker_id = me and b.blocked_id = u.id) or (b.blocker_id = u.id and b.blocked_id = me))
    limit room
    on conflict do nothing
    returning 1)
  select count(*) into added from ins;
  return added;
end $$;

create or replace function public.mw_group_set_role(p_group uuid, p_user uuid, p_role text)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); creator uuid;
begin
  if me is null then raise exception 'Sign in first.' using errcode = '28000'; end if;
  if p_role not in ('admin', 'member') then raise exception 'Invalid role.' using errcode = '22023'; end if;
  if not public.mw_dm_is_group_admin(p_group, me) then raise exception 'Only admins can change roles.' using errcode = '42501'; end if;
  select created_by into creator from public.mw_dm_groups where id = p_group;
  if p_role = 'member' and p_user = creator and me <> creator then raise exception 'The creator cannot be demoted.' using errcode = '42501'; end if;
  if p_role = 'member' and p_user = me and not exists (select 1 from public.mw_dm_group_members where group_id = p_group and user_id <> me and role = 'admin') then
    raise exception 'Promote another admin first.' using errcode = '22023';
  end if;
  update public.mw_dm_group_members set role = p_role where group_id = p_group and user_id = p_user;
  if not found then raise exception 'Not a member.' using errcode = '22023'; end if;
end $$;

create or replace function public.mw_group_remove_member(p_group uuid, p_user uuid, p_block boolean)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); creator uuid;
begin
  if me is null then raise exception 'Sign in first.' using errcode = '28000'; end if;
  if not public.mw_dm_is_group_admin(p_group, me) then raise exception 'Only admins can remove members.' using errcode = '42501'; end if;
  if p_user = me then raise exception 'Use leave instead.' using errcode = '22023'; end if;
  select created_by into creator from public.mw_dm_groups where id = p_group;
  if p_user = creator then raise exception 'The creator cannot be removed.' using errcode = '42501'; end if;
  delete from public.mw_dm_group_members where group_id = p_group and user_id = p_user;
  if coalesce(p_block, false) then
    insert into public.mw_dm_group_blocks(group_id, user_id, blocked_by) values (p_group, p_user, me) on conflict do nothing;
  end if;
end $$;

create or replace function public.mw_group_unblock(p_group uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Sign in first.' using errcode = '28000'; end if;
  if not public.mw_dm_is_group_admin(p_group, auth.uid()) then raise exception 'Only admins can unblock.' using errcode = '42501'; end if;
  delete from public.mw_dm_group_blocks where group_id = p_group and user_id = p_user;
end $$;

-- Leaves the group; if the last admin leaves, the longest-standing member is promoted. An empty group is deleted.
create or replace function public.mw_group_leave(p_group uuid)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); was_admin boolean; successor uuid;
begin
  if me is null then raise exception 'Sign in first.' using errcode = '28000'; end if;
  select role = 'admin' into was_admin from public.mw_dm_group_members where group_id = p_group and user_id = me;
  if was_admin is null then raise exception 'You are not in this group.' using errcode = '42501'; end if;
  delete from public.mw_dm_group_members where group_id = p_group and user_id = me;
  if was_admin and not exists (select 1 from public.mw_dm_group_members where group_id = p_group and role = 'admin') then
    select user_id into successor from public.mw_dm_group_members where group_id = p_group order by joined_at, user_id limit 1;
    if successor is not null then
      update public.mw_dm_group_members set role = 'admin' where group_id = p_group and user_id = successor;
    end if;
  end if;
  if not exists (select 1 from public.mw_dm_group_members where group_id = p_group) then
    delete from public.mw_dm_groups where id = p_group;
  end if;
end $$;

create or replace function public.mw_group_delete(p_group uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Sign in first.' using errcode = '28000'; end if;
  if not (public.mw_dm_is_group_admin(p_group, auth.uid()) or exists (select 1 from public.mw_dm_groups where id = p_group and created_by = auth.uid())) then
    raise exception 'Only admins can delete the group.' using errcode = '42501';
  end if;
  delete from public.mw_dm_groups where id = p_group;
end $$;

revoke all on function public.mw_group_create(text, text, text, uuid[]) from public, anon;
revoke all on function public.mw_group_update(uuid, text, text, text) from public, anon;
revoke all on function public.mw_group_add_members(uuid, uuid[]) from public, anon;
revoke all on function public.mw_group_set_role(uuid, uuid, text) from public, anon;
revoke all on function public.mw_group_remove_member(uuid, uuid, boolean) from public, anon;
revoke all on function public.mw_group_unblock(uuid, uuid) from public, anon;
revoke all on function public.mw_group_leave(uuid) from public, anon;
revoke all on function public.mw_group_delete(uuid) from public, anon;
grant execute on function public.mw_group_create(text, text, text, uuid[]) to authenticated;
grant execute on function public.mw_group_update(uuid, text, text, text) to authenticated;
grant execute on function public.mw_group_add_members(uuid, uuid[]) to authenticated;
grant execute on function public.mw_group_set_role(uuid, uuid, text) to authenticated;
grant execute on function public.mw_group_remove_member(uuid, uuid, boolean) to authenticated;
grant execute on function public.mw_group_unblock(uuid, uuid) to authenticated;
grant execute on function public.mw_group_leave(uuid) to authenticated;
grant execute on function public.mw_group_delete(uuid) to authenticated;

notify pgrst, 'reload schema';
