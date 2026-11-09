begin;

create table if not exists public.mw_notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  live_enabled boolean not null default true,
  sound_enabled boolean not null default true,
  language text not null default 'en' check (char_length(language) between 2 and 12),
  updated_at timestamptz not null default now()
);

create table if not exists public.mw_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null check (char_length(endpoint) between 10 and 2048),
  p256dh text not null check (char_length(p256dh) <= 256),
  auth text not null check (char_length(auth) <= 256),
  created_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

create table if not exists public.mw_live_alerts (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users(id) on delete cascade,
  host_id uuid not null references auth.users(id) on delete cascade,
  room_name text not null,
  host_name text,
  title text,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  unique (recipient_id, room_name)
);
create index if not exists mw_live_alerts_recipient_idx on public.mw_live_alerts (recipient_id, created_at desc);

alter table public.mw_notification_preferences enable row level security;
alter table public.mw_push_subscriptions enable row level security;
alter table public.mw_live_alerts enable row level security;

drop policy if exists mw_notification_preferences_owner on public.mw_notification_preferences;
create policy mw_notification_preferences_owner on public.mw_notification_preferences for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists mw_push_subscriptions_owner on public.mw_push_subscriptions;
create policy mw_push_subscriptions_owner on public.mw_push_subscriptions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists mw_live_alerts_read on public.mw_live_alerts;
create policy mw_live_alerts_read on public.mw_live_alerts for select to authenticated using (recipient_id = auth.uid());
drop policy if exists mw_live_alerts_mark_read on public.mw_live_alerts;
create policy mw_live_alerts_mark_read on public.mw_live_alerts for update to authenticated
  using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());
drop policy if exists mw_live_alerts_delete on public.mw_live_alerts;
create policy mw_live_alerts_delete on public.mw_live_alerts for delete to authenticated using (recipient_id = auth.uid());

revoke all on public.mw_notification_preferences, public.mw_push_subscriptions, public.mw_live_alerts from anon, authenticated;
grant select, insert, update, delete on public.mw_notification_preferences, public.mw_push_subscriptions to authenticated;
grant select, delete on public.mw_live_alerts to authenticated;
grant update (read_at) on public.mw_live_alerts to authenticated;

-- Alerts are only ever created here, and only by the owner of a live room.
create or replace function public.mw_live_announce(p_room text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := auth.uid();
  live record;
  cursor_id uuid := null;
  batch_ids uuid[];
  added integer;
  total integer := 0;
begin
  if me is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  select s.host_id, s.host_name, s.title into live
  from public.mw_video_live_sessions s
  where s.room_name = p_room and s.host_id = me and s.is_live
  limit 1;
  if not found then raise exception 'Not allowed.' using errcode = '42501'; end if;
  loop
    select coalesce(array_agg(r.recipient_id order by r.recipient_id), '{}') into batch_ids
    from public.mw_live_notification_recipients(me, cursor_id) r;
    exit when coalesce(array_length(batch_ids, 1), 0) = 0;
    insert into public.mw_live_alerts (recipient_id, host_id, room_name, host_name, title)
    select t.id, me, p_room, live.host_name, live.title
    from unnest(batch_ids) as t(id)
    where coalesce((select pref.live_enabled from public.mw_notification_preferences pref where pref.user_id = t.id), true)
    on conflict (recipient_id, room_name) do nothing;
    get diagnostics added = row_count;
    total := total + added;
    cursor_id := batch_ids[array_length(batch_ids, 1)];
    exit when array_length(batch_ids, 1) < 500;
  end loop;
  return jsonb_build_object('complete', true, 'notified', total);
end;
$$;
revoke all on function public.mw_live_announce(text) from public;
grant execute on function public.mw_live_announce(text) to authenticated;

commit;
