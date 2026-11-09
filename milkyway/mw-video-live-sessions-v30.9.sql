create table if not exists public.mw_video_live_sessions (
  id uuid primary key default gen_random_uuid(),
  room_name text not null unique,
  host_id uuid not null references auth.users(id) on delete cascade,
  host_name text not null default 'MilkyWay user',
  title text not null default 'Video Live',
  scope text not null default 'public' check (scope in ('public', 'followers')),
  is_live boolean not null default true,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);
create index if not exists mw_video_live_sessions_live_started_idx on public.mw_video_live_sessions (is_live, started_at desc);
alter table public.mw_video_live_sessions enable row level security;
drop policy if exists "Anyone signed in can see live sessions" on public.mw_video_live_sessions;
create policy "Anyone signed in can see live sessions" on public.mw_video_live_sessions for select to authenticated using (true);
drop policy if exists "Hosts can publish their own live session" on public.mw_video_live_sessions;
create policy "Hosts can publish their own live session" on public.mw_video_live_sessions for insert to authenticated with check (auth.uid() = host_id);
drop policy if exists "Hosts can update their own live session" on public.mw_video_live_sessions;
create policy "Hosts can update their own live session" on public.mw_video_live_sessions for update to authenticated using (auth.uid() = host_id) with check (auth.uid() = host_id);
grant select, insert, update on public.mw_video_live_sessions to authenticated;
