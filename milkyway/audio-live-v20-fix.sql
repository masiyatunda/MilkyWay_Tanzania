-- MilkyWay Audio Live V20 migration/fix
-- Run once in Supabase SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.mw_audio_live_rooms (
 id uuid primary key default gen_random_uuid(), host_id uuid not null references auth.users(id) on delete cascade, host_name text not null default 'Msafiri', title text not null, audience_scope text not null default 'public' check(audience_scope in ('public','followers')), status text not null default 'live' check(status in ('live','ended')), listener_count integer not null default 0, created_at timestamptz not null default now(), ended_at timestamptz
);
create table if not exists public.mw_audio_live_participants (id uuid primary key default gen_random_uuid(), room_id uuid not null references public.mw_audio_live_rooms(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade, role text not null check(role in ('host','listener')), active boolean not null default true, joined_at timestamptz not null default now(), left_at timestamptz, unique(room_id,user_id));
create table if not exists public.mw_audio_live_signals (id uuid primary key default gen_random_uuid(), room_id uuid not null references public.mw_audio_live_rooms(id) on delete cascade, sender_id uuid not null references auth.users(id) on delete cascade, receiver_id uuid not null references auth.users(id) on delete cascade, kind text not null check(kind in ('join','offer','answer','ice')), payload jsonb not null default '{}'::jsonb, created_at timestamptz not null default now());
create table if not exists public.mw_audio_live_chat (id uuid primary key default gen_random_uuid(), room_id uuid not null references public.mw_audio_live_rooms(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade, display_name text not null default 'Msafiri', message text not null check(char_length(message) between 1 and 500), created_at timestamptz not null default now());

-- End older duplicate live rooms, keeping only the newest live room per host.
with ranked as (select id, row_number() over(partition by host_id order by created_at desc) rn from public.mw_audio_live_rooms where status='live')
update public.mw_audio_live_rooms r set status='ended', ended_at=coalesce(ended_at,now()) from ranked x where r.id=x.id and x.rn>1;

create unique index if not exists ux_mw_audio_live_one_live_per_host on public.mw_audio_live_rooms(host_id) where status='live';
create index if not exists idx_mw_audio_live_rooms_status_created on public.mw_audio_live_rooms(status,created_at desc);
create index if not exists idx_mw_audio_live_live_participants on public.mw_audio_live_participants(room_id,active);
create index if not exists idx_mw_audio_live_signals_receiver on public.mw_audio_live_signals(room_id,receiver_id,created_at);
create index if not exists idx_mw_audio_live_chat_room_created on public.mw_audio_live_chat(room_id,created_at);

alter table public.mw_audio_live_rooms enable row level security;
alter table public.mw_audio_live_participants enable row level security;
alter table public.mw_audio_live_signals enable row level security;
alter table public.mw_audio_live_chat enable row level security;

drop policy if exists mw_v20_rooms_select on public.mw_audio_live_rooms;
create policy mw_v20_rooms_select on public.mw_audio_live_rooms for select to authenticated using (true);
drop policy if exists mw_v20_rooms_insert on public.mw_audio_live_rooms;
create policy mw_v20_rooms_insert on public.mw_audio_live_rooms for insert to authenticated with check(host_id=auth.uid());
drop policy if exists mw_v20_rooms_update on public.mw_audio_live_rooms;
create policy mw_v20_rooms_update on public.mw_audio_live_rooms for update to authenticated using(host_id=auth.uid()) with check(host_id=auth.uid());
drop policy if exists mw_v20_rooms_delete on public.mw_audio_live_rooms;
create policy mw_v20_rooms_delete on public.mw_audio_live_rooms for delete to authenticated using(host_id=auth.uid());

drop policy if exists mw_v20_participants_select on public.mw_audio_live_participants;
create policy mw_v20_participants_select on public.mw_audio_live_participants for select to authenticated using(true);
drop policy if exists mw_v20_participants_insert on public.mw_audio_live_participants;
create policy mw_v20_participants_insert on public.mw_audio_live_participants for insert to authenticated with check(user_id=auth.uid());
drop policy if exists mw_v20_participants_update on public.mw_audio_live_participants;
create policy mw_v20_participants_update on public.mw_audio_live_participants for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());

drop policy if exists mw_v20_signals_select on public.mw_audio_live_signals;
create policy mw_v20_signals_select on public.mw_audio_live_signals for select to authenticated using(sender_id=auth.uid() or receiver_id=auth.uid());
drop policy if exists mw_v20_signals_insert on public.mw_audio_live_signals;
create policy mw_v20_signals_insert on public.mw_audio_live_signals for insert to authenticated with check(sender_id=auth.uid());

drop policy if exists mw_v20_chat_select on public.mw_audio_live_chat;
create policy mw_v20_chat_select on public.mw_audio_live_chat for select to authenticated using(true);
drop policy if exists mw_v20_chat_insert on public.mw_audio_live_chat;
create policy mw_v20_chat_insert on public.mw_audio_live_chat for insert to authenticated with check(user_id=auth.uid());
