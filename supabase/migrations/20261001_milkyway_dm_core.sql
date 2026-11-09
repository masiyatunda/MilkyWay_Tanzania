-- MilkyWay DM core: direct messages, groups, calls, per-user message hiding ("Delete for me") and message editing.
-- Idempotent. It sorts before every other DM/group migration on purpose: they alter these tables, so a database that never
-- ran milkyway/dm-groups-calls-v25.sql failed with "Could not find the table 'public.mw_dm_group_members' in the schema cache".

create table if not exists public.mw_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  receiver_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 12000),
  created_at timestamptz not null default now(),
  check (sender_id <> receiver_id)
);
alter table public.mw_messages add column if not exists read_at timestamptz;
alter table public.mw_messages add column if not exists edited_at timestamptz;
alter table public.mw_messages add column if not exists encryption_version integer not null default 0;
alter table public.mw_messages enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'mw_messages' and cmd = 'SELECT') then
    create policy mw_messages_read on public.mw_messages for select to authenticated using (sender_id = auth.uid() or receiver_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'mw_messages' and cmd = 'INSERT') then
    create policy mw_messages_send on public.mw_messages for insert to authenticated with check (sender_id = auth.uid());
  end if;
end $$;
grant select, insert on public.mw_messages to authenticated;
create index if not exists mw_messages_pair_idx on public.mw_messages (sender_id, receiver_id, created_at desc);
create index if not exists mw_messages_receiver_idx on public.mw_messages (receiver_id, created_at desc);

create table if not exists public.mw_dm_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 70),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table if not exists public.mw_dm_group_members (
  group_id uuid not null references public.mw_dm_groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create table if not exists public.mw_dm_group_messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.mw_dm_groups(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
alter table public.mw_dm_group_messages add column if not exists edited_at timestamptz;
create table if not exists public.mw_dm_calls (
  id uuid primary key default gen_random_uuid(),
  caller_id uuid not null references auth.users(id) on delete cascade,
  callee_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'ringing' check (status in ('ringing', 'accepted', 'ended', 'declined')),
  offer jsonb, answer jsonb,
  created_at timestamptz not null default now(), ended_at timestamptz,
  check (caller_id <> callee_id)
);
create table if not exists public.mw_dm_call_signals (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references public.mw_dm_calls(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('candidate')),
  payload jsonb not null, created_at timestamptz not null default now()
);
-- "Delete for me": the row stays for the other person, and is filtered out of this user's view only.
create table if not exists public.mw_message_hides (
  user_id uuid not null references auth.users(id) on delete cascade,
  message_id uuid not null,
  scope text not null default 'dm' check (scope in ('dm', 'group')),
  created_at timestamptz not null default now(),
  primary key (user_id, message_id)
);

create or replace function public.mw_dm_is_group_member(gid uuid, uid uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.mw_dm_group_members where group_id = gid and user_id = uid)
$$;
create or replace function public.mw_dm_is_group_admin(gid uuid, uid uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.mw_dm_group_members where group_id = gid and user_id = uid and role = 'admin')
$$;
revoke all on function public.mw_dm_is_group_member(uuid, uuid) from public;
revoke all on function public.mw_dm_is_group_admin(uuid, uuid) from public;
grant execute on function public.mw_dm_is_group_member(uuid, uuid) to authenticated;
grant execute on function public.mw_dm_is_group_admin(uuid, uuid) to authenticated;

-- Edits go through a function because direct UPDATE on mw_messages is limited to read_at.
create or replace function public.mw_message_edit(p_id uuid, p_group boolean, p_body text) returns void language plpgsql security definer set search_path = public as $$
declare
  v_body text := btrim(coalesce(p_body, ''));
  v_rows integer;
begin
  if auth.uid() is null then raise exception 'Sign in first.' using errcode = '28000'; end if;
  if char_length(v_body) < 1 or char_length(v_body) > case when p_group then 4000 else 12000 end then
    raise exception 'Message length is not allowed.' using errcode = '22023';
  end if;
  if p_group then
    update public.mw_dm_group_messages set body = v_body, edited_at = now() where id = p_id and sender_id = auth.uid();
  else
    update public.mw_messages set body = v_body, edited_at = now() where id = p_id and sender_id = auth.uid();
  end if;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then raise exception 'Message not found or not yours to edit.' using errcode = 'P0002'; end if;
end $$;
revoke all on function public.mw_message_edit(uuid, boolean, text) from public, anon;
grant execute on function public.mw_message_edit(uuid, boolean, text) to authenticated;

alter table public.mw_dm_groups enable row level security;
alter table public.mw_dm_group_members enable row level security;
alter table public.mw_dm_group_messages enable row level security;
alter table public.mw_dm_calls enable row level security;
alter table public.mw_dm_call_signals enable row level security;
alter table public.mw_message_hides enable row level security;

drop policy if exists mw_dm_groups_read on public.mw_dm_groups;
create policy mw_dm_groups_read on public.mw_dm_groups for select to authenticated using (created_by = auth.uid() or public.mw_dm_is_group_member(mw_dm_groups.id, auth.uid()));
drop policy if exists mw_dm_groups_create on public.mw_dm_groups;
create policy mw_dm_groups_create on public.mw_dm_groups for insert to authenticated with check (created_by = auth.uid());
drop policy if exists mw_dm_members_read on public.mw_dm_group_members;
create policy mw_dm_members_read on public.mw_dm_group_members for select to authenticated using (public.mw_dm_is_group_member(mw_dm_group_members.group_id, auth.uid()));
drop policy if exists mw_dm_members_add on public.mw_dm_group_members;
create policy mw_dm_members_add on public.mw_dm_group_members for insert to authenticated with check (user_id = auth.uid() or public.mw_dm_is_group_admin(mw_dm_group_members.group_id, auth.uid()));
drop policy if exists mw_dm_group_messages_read on public.mw_dm_group_messages;
create policy mw_dm_group_messages_read on public.mw_dm_group_messages for select to authenticated using (public.mw_dm_is_group_member(mw_dm_group_messages.group_id, auth.uid()));
drop policy if exists mw_dm_group_messages_send on public.mw_dm_group_messages;
create policy mw_dm_group_messages_send on public.mw_dm_group_messages for insert to authenticated with check (sender_id = auth.uid() and public.mw_dm_is_group_member(mw_dm_group_messages.group_id, auth.uid()));
drop policy if exists mw_dm_group_messages_delete on public.mw_dm_group_messages;
create policy mw_dm_group_messages_delete on public.mw_dm_group_messages for delete to authenticated using (sender_id = auth.uid());
drop policy if exists mw_dm_calls_read on public.mw_dm_calls;
create policy mw_dm_calls_read on public.mw_dm_calls for select to authenticated using (caller_id = auth.uid() or callee_id = auth.uid());
drop policy if exists mw_dm_calls_create on public.mw_dm_calls;
create policy mw_dm_calls_create on public.mw_dm_calls for insert to authenticated with check (caller_id = auth.uid());
drop policy if exists mw_dm_calls_update on public.mw_dm_calls;
create policy mw_dm_calls_update on public.mw_dm_calls for update to authenticated using (caller_id = auth.uid() or callee_id = auth.uid()) with check (caller_id = auth.uid() or callee_id = auth.uid());
drop policy if exists mw_dm_signals_read on public.mw_dm_call_signals;
create policy mw_dm_signals_read on public.mw_dm_call_signals for select to authenticated using (exists (select 1 from public.mw_dm_calls c where c.id = call_id and (c.caller_id = auth.uid() or c.callee_id = auth.uid())));
drop policy if exists mw_dm_signals_send on public.mw_dm_call_signals;
create policy mw_dm_signals_send on public.mw_dm_call_signals for insert to authenticated with check (sender_id = auth.uid() and exists (select 1 from public.mw_dm_calls c where c.id = call_id and (c.caller_id = auth.uid() or c.callee_id = auth.uid())));
drop policy if exists mw_message_hides_own on public.mw_message_hides;
create policy mw_message_hides_own on public.mw_message_hides for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert, update, delete on public.mw_dm_groups, public.mw_dm_group_members, public.mw_dm_group_messages, public.mw_dm_calls, public.mw_dm_call_signals to authenticated;
grant select, insert, delete on public.mw_message_hides to authenticated;

create index if not exists mw_dm_group_messages_timeline_idx on public.mw_dm_group_messages (group_id, created_at desc);
create index if not exists mw_dm_group_members_user_idx on public.mw_dm_group_members (user_id);
create index if not exists mw_dm_calls_incoming_idx on public.mw_dm_calls (callee_id, status, created_at desc);
create index if not exists mw_message_hides_user_idx on public.mw_message_hides (user_id, created_at desc);

do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['mw_messages', 'mw_dm_group_messages', 'mw_dm_calls'] loop
      if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;

notify pgrst, 'reload schema';
