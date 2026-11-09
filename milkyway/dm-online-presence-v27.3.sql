-- MilkyWay V27.3: DM online/offline presence
-- Run once in Supabase SQL Editor.
create table if not exists public.mw_user_presence (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_seen_at timestamptz not null default now()
);

alter table public.mw_user_presence enable row level security;

-- Each signed-in user can publish/update only their own heartbeat.
drop policy if exists "presence_insert_own" on public.mw_user_presence;
create policy "presence_insert_own" on public.mw_user_presence
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "presence_update_own" on public.mw_user_presence;
create policy "presence_update_own" on public.mw_user_presence
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Signed-in users can read last-seen status to display DM presence.
drop policy if exists "presence_read_authenticated" on public.mw_user_presence;
create policy "presence_read_authenticated" on public.mw_user_presence
  for select to authenticated using (true);

grant select, insert, update on public.mw_user_presence to authenticated;
