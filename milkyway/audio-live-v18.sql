-- MilkyWay Audio Live V18
-- Run once in Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.mw_audio_live_rooms (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references auth.users(id) on delete cascade,
  host_name text not null default 'Msafiri',
  title text not null,
  audience_scope text not null default 'public' check (audience_scope in ('public','followers')),
  status text not null default 'live' check (status in ('live','ended')),
  listener_count integer not null default 0,
  created_at timestamptz not null default now(),
  ended_at timestamptz
);

create table if not exists public.mw_audio_live_participants (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.mw_audio_live_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('host','listener')),
  active boolean not null default true,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  unique(room_id,user_id)
);

create table if not exists public.mw_audio_live_signals (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.mw_audio_live_rooms(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  receiver_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('join','offer','answer','ice')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.mw_audio_live_chat (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.mw_audio_live_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null default 'Msafiri',
  message text not null check (char_length(message) between 1 and 500),
  created_at timestamptz not null default now()
);

create index if not exists idx_mw_audio_live_rooms_status_created
  on public.mw_audio_live_rooms(status, created_at desc);
create index if not exists idx_mw_audio_live_rooms_host
  on public.mw_audio_live_rooms(host_id);
create index if not exists idx_mw_audio_live_participants_room_active
  on public.mw_audio_live_participants(room_id, active);
create index if not exists idx_mw_audio_live_signals_receiver
  on public.mw_audio_live_signals(room_id, receiver_id, created_at);
create index if not exists idx_mw_audio_live_chat_room_created
  on public.mw_audio_live_chat(room_id, created_at);

alter table public.mw_audio_live_rooms enable row level security;
alter table public.mw_audio_live_participants enable row level security;
alter table public.mw_audio_live_signals enable row level security;
alter table public.mw_audio_live_chat enable row level security;

-- Rooms: public can see live rooms; only the host can create/update/end their room.
drop policy if exists "mw_live_rooms_public_read" on public.mw_audio_live_rooms;
create policy "mw_live_rooms_public_read"
on public.mw_audio_live_rooms for select
using (status = 'live');

drop policy if exists "mw_live_rooms_host_insert" on public.mw_audio_live_rooms;
create policy "mw_live_rooms_host_insert"
on public.mw_audio_live_rooms for insert to authenticated
with check (host_id = auth.uid());

drop policy if exists "mw_live_rooms_host_update" on public.mw_audio_live_rooms;
create policy "mw_live_rooms_host_update"
on public.mw_audio_live_rooms for update to authenticated
using (host_id = auth.uid())
with check (host_id = auth.uid());

-- Participants: authenticated users manage only their own participant row.
drop policy if exists "mw_live_participants_read" on public.mw_audio_live_participants;
create policy "mw_live_participants_read"
on public.mw_audio_live_participants for select to authenticated
using (true);

drop policy if exists "mw_live_participants_insert_own" on public.mw_audio_live_participants;
create policy "mw_live_participants_insert_own"
on public.mw_audio_live_participants for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists "mw_live_participants_update_own" on public.mw_audio_live_participants;
create policy "mw_live_participants_update_own"
on public.mw_audio_live_participants for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- Signaling: each participant can read messages sent to/from themselves and send as themselves.
drop policy if exists "mw_live_signals_read_own" on public.mw_audio_live_signals;
create policy "mw_live_signals_read_own"
on public.mw_audio_live_signals for select to authenticated
using (sender_id = auth.uid() or receiver_id = auth.uid());

drop policy if exists "mw_live_signals_insert_own" on public.mw_audio_live_signals;
create policy "mw_live_signals_insert_own"
on public.mw_audio_live_signals for insert to authenticated
with check (sender_id = auth.uid());

-- Chat: authenticated users can read live-room chat and write as themselves.
drop policy if exists "mw_live_chat_read" on public.mw_audio_live_chat;
create policy "mw_live_chat_read"
on public.mw_audio_live_chat for select to authenticated
using (exists (
  select 1 from public.mw_audio_live_rooms r
  where r.id = room_id and r.status = 'live'
));

drop policy if exists "mw_live_chat_insert_own" on public.mw_audio_live_chat;
create policy "mw_live_chat_insert_own"
on public.mw_audio_live_chat for insert to authenticated
with check (user_id = auth.uid());

-- Optional cleanup for stale ended rooms/signals/chat.
-- Run manually or schedule it later; it is intentionally not automatic here.
-- delete from public.mw_audio_live_signals where created_at < now() - interval '1 day';
-- delete from public.mw_audio_live_chat where created_at < now() - interval '30 days';
