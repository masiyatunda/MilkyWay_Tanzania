-- Co-host Live rooms: settings, guest requests (members) and chat. Real publish rights are granted by the
-- Render handler through LiveKit; these rows only drive the UI. Everything is idempotent.

create table if not exists public.mw_live_room_settings (
  room_name text primary key,
  host_id uuid not null,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.mw_live_room_members (
  room_name text not null,
  user_id uuid not null,
  name text not null default 'MilkyWay user',
  avatar text not null default '',
  state text not null default 'viewer' check (state in ('viewer', 'pending', 'speaker')),
  host_muted boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (room_name, user_id)
);

create table if not exists public.mw_live_room_messages (
  id uuid primary key,
  room_name text not null,
  user_id uuid not null,
  name text not null default 'MilkyWay user',
  avatar text not null default '',
  kind text not null default 'chat',
  body text not null,
  deleted boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists mw_live_room_messages_room_idx on public.mw_live_room_messages (room_name, created_at desc);

alter table public.mw_live_room_settings enable row level security;
alter table public.mw_live_room_members enable row level security;
alter table public.mw_live_room_messages enable row level security;

create or replace function public.mw_is_live_host(room text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.mw_video_live_sessions s where s.room_name = room and s.host_id = auth.uid());
$$;
grant execute on function public.mw_is_live_host(text) to authenticated;

drop policy if exists mw_live_settings_read on public.mw_live_room_settings;
create policy mw_live_settings_read on public.mw_live_room_settings for select to authenticated using (true);
drop policy if exists mw_live_settings_host on public.mw_live_room_settings;
create policy mw_live_settings_host on public.mw_live_room_settings for all to authenticated
  using (public.mw_is_live_host(room_name)) with check (public.mw_is_live_host(room_name) and host_id = auth.uid());

drop policy if exists mw_live_members_read on public.mw_live_room_members;
create policy mw_live_members_read on public.mw_live_room_members for select to authenticated using (true);
drop policy if exists mw_live_members_self on public.mw_live_room_members;
-- A guest can write their own row as viewer or pending; speaker is only allowed when the host chose direct admission.
create policy mw_live_members_self on public.mw_live_room_members for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and (state in ('viewer', 'pending') or exists (
    select 1 from public.mw_live_room_settings s where s.room_name = mw_live_room_members.room_name and s.settings ->> 'admission' = 'direct')));
drop policy if exists mw_live_members_host on public.mw_live_room_members;
create policy mw_live_members_host on public.mw_live_room_members for all to authenticated
  using (public.mw_is_live_host(room_name)) with check (public.mw_is_live_host(room_name));

drop policy if exists mw_live_messages_read on public.mw_live_room_messages;
create policy mw_live_messages_read on public.mw_live_room_messages for select to authenticated using (true);
drop policy if exists mw_live_messages_insert on public.mw_live_room_messages;
create policy mw_live_messages_insert on public.mw_live_room_messages for insert to authenticated with check (user_id = auth.uid());
drop policy if exists mw_live_messages_host on public.mw_live_room_messages;
create policy mw_live_messages_host on public.mw_live_room_messages for update to authenticated
  using (public.mw_is_live_host(room_name)) with check (public.mw_is_live_host(room_name));
