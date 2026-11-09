-- MILKYWAY PLATFORM V10 — SAFE UPGRADE
-- Run this entire file in the same Supabase project.
-- Email verification is intentionally NOT required by the app. Keep Supabase Email provider enabled and Email Confirmations OFF.
create extension if not exists pgcrypto;

-- Core profile fields.
alter table if exists public.mw_profiles add column if not exists is_banned boolean not null default false;
alter table if exists public.mw_profiles add column if not exists suspended_until timestamptz;
alter table if exists public.mw_profiles add column if not exists last_seen_at timestamptz;

-- Messages: unread state and safer participant rules.
alter table if exists public.mw_messages add column if not exists read_at timestamptz;

-- Account deletion requests: actual auth.users deletion must be performed server-side by an administrator/Edge Function.
create table if not exists public.mw_account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check(status in ('pending','approved','completed','rejected')),
  reason text default '',
  created_at timestamptz not null default now(),
  processed_at timestamptz
);
alter table public.mw_account_deletion_requests enable row level security;
drop policy if exists mw_delete_request_insert on public.mw_account_deletion_requests;
create policy mw_delete_request_insert on public.mw_account_deletion_requests for insert to authenticated with check(user_id=auth.uid());
drop policy if exists mw_delete_request_read_owner on public.mw_account_deletion_requests;
create policy mw_delete_request_read_owner on public.mw_account_deletion_requests for select to authenticated using(user_id=auth.uid());
drop policy if exists mw_delete_request_admin on public.mw_account_deletion_requests;
create policy mw_delete_request_admin on public.mw_account_deletion_requests for all to authenticated using(exists(select 1 from public.mw_profiles p where p.id=auth.uid() and p.is_admin=true)) with check(exists(select 1 from public.mw_profiles p where p.id=auth.uid() and p.is_admin=true));

-- Safe UUID migration for legacy text IDs. If legacy rows contain non-UUID values, leave them untouched rather than breaking the database.
do $$
begin
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='mw_posts' and column_name='author_id' and data_type='text')
     and not exists(select 1 from public.mw_posts where author_id is not null and author_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') then
    alter table public.mw_posts alter column author_id type uuid using author_id::uuid;
  end if;
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='mw_signals' and column_name='user_id' and data_type='text')
     and not exists(select 1 from public.mw_signals where user_id is not null and user_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') then
    alter table public.mw_signals alter column user_id type uuid using user_id::uuid;
  end if;
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='mw_echoes' and column_name='user_id' and data_type='text')
     and not exists(select 1 from public.mw_echoes where user_id is not null and user_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') then
    alter table public.mw_echoes alter column user_id type uuid using user_id::uuid;
  end if;
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='mw_saves' and column_name='user_id' and data_type='text')
     and not exists(select 1 from public.mw_saves where user_id is not null and user_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') then
    alter table public.mw_saves alter column user_id type uuid using user_id::uuid;
  end if;
end $$;

-- Add referential integrity after conversion where possible.
do $$
begin
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='mw_posts' and column_name='author_id' and data_type='uuid') then
    begin alter table public.mw_posts add constraint mw_posts_author_fk foreign key(author_id) references auth.users(id) on delete cascade; exception when duplicate_object then null; end;
  end if;
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='mw_signals' and column_name='user_id' and data_type='uuid') then
    begin alter table public.mw_signals add constraint mw_signals_user_fk foreign key(user_id) references auth.users(id) on delete cascade; exception when duplicate_object then null; end;
  end if;
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='mw_echoes' and column_name='user_id' and data_type='uuid') then
    begin alter table public.mw_echoes add constraint mw_echoes_user_fk foreign key(user_id) references auth.users(id) on delete cascade; exception when duplicate_object then null; end;
  end if;
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='mw_saves' and column_name='user_id' and data_type='uuid') then
    begin alter table public.mw_saves add constraint mw_saves_user_fk foreign key(user_id) references auth.users(id) on delete cascade; exception when duplicate_object then null; end;
  end if;
end $$;

-- Security: users cannot write while banned/suspended; they can still read public content.
drop policy if exists mw_posts_insert on public.mw_posts;
create policy mw_posts_insert on public.mw_posts for insert to authenticated with check(author_id=auth.uid() and exists(select 1 from public.mw_profiles p where p.id=auth.uid() and p.is_banned=false and (p.suspended_until is null or p.suspended_until<=now())));
drop policy if exists mw_posts_update on public.mw_posts;
create policy mw_posts_update on public.mw_posts for update to authenticated using(author_id=auth.uid() and exists(select 1 from public.mw_profiles p where p.id=auth.uid() and p.is_banned=false and (p.suspended_until is null or p.suspended_until<=now()))) with check(author_id=auth.uid());
drop policy if exists mw_posts_delete on public.mw_posts;
create policy mw_posts_delete on public.mw_posts for delete to authenticated using(author_id=auth.uid());

-- Messages: both participants must be valid; sender cannot message a blocker/blockee.
drop policy if exists mw_messages_send on public.mw_messages;
create policy mw_messages_send on public.mw_messages for insert to authenticated with check(
  sender_id=auth.uid()
  and exists(select 1 from public.mw_profiles p where p.id=auth.uid() and p.is_banned=false and (p.suspended_until is null or p.suspended_until<=now()))
  and not exists(select 1 from public.mw_blocks b where (b.blocker_id=auth.uid() and b.blocked_id=receiver_id) or (b.blocker_id=receiver_id and b.blocked_id=auth.uid()))
);
drop policy if exists mw_messages_update_read on public.mw_messages;
create policy mw_messages_update_read on public.mw_messages for update to authenticated using(receiver_id=auth.uid()) with check(receiver_id=auth.uid());

grant select,insert,update on public.mw_messages to authenticated;

-- Admin moderation helpers.
create index if not exists mw_profiles_last_seen_idx on public.mw_profiles(last_seen_at desc);
create index if not exists mw_delete_requests_status_idx on public.mw_account_deletion_requests(status,created_at desc);
create index if not exists mw_messages_receiver_unread_idx on public.mw_messages(receiver_id,read_at,created_at desc);
create index if not exists mw_messages_pair_idx on public.mw_messages(sender_id,receiver_id,created_at desc);

-- Rate limiting for basic anti-spam. These limits are intentionally conservative.
create table if not exists public.mw_rate_limits (
  key text primary key,
  window_started_at timestamptz not null default now(),
  hits integer not null default 0
);
create or replace function public.mw_rate_limit(p_key text,p_limit integer,p_window_seconds integer)
returns void language plpgsql security definer set search_path=public as $$
declare r public.mw_rate_limits%rowtype;
begin
  select * into r from public.mw_rate_limits where key=p_key for update;
  if not found then insert into public.mw_rate_limits(key,window_started_at,hits) values(p_key,now(),1); return; end if;
  if extract(epoch from (now()-r.window_started_at)) >= p_window_seconds then update public.mw_rate_limits set window_started_at=now(),hits=1 where key=p_key; return; end if;
  if r.hits >= p_limit then raise exception 'Rate limit exceeded. Jaribu tena baadaye.'; end if;
  update public.mw_rate_limits set hits=hits+1 where key=p_key;
end $$;

create or replace function public.mw_rl_posts() returns trigger language plpgsql security definer set search_path=public as $$ begin perform public.mw_rate_limit('post:'||auth.uid()::text,10,60); return new; end $$;
drop trigger if exists mw_rl_posts_trg on public.mw_posts;
create trigger mw_rl_posts_trg before insert on public.mw_posts for each row execute function public.mw_rl_posts();

create or replace function public.mw_rl_reports() returns trigger language plpgsql security definer set search_path=public as $$ begin perform public.mw_rate_limit('report:'||auth.uid()::text,5,300); return new; end $$;
drop trigger if exists mw_rl_reports_trg on public.mw_reports;
create trigger mw_rl_reports_trg before insert on public.mw_reports for each row execute function public.mw_rl_reports();

create or replace function public.mw_rl_messages() returns trigger language plpgsql security definer set search_path=public as $$ begin perform public.mw_rate_limit('message:'||auth.uid()::text,30,60); return new; end $$;
drop trigger if exists mw_rl_messages_trg on public.mw_messages;
create trigger mw_rl_messages_trg before insert on public.mw_messages for each row execute function public.mw_rl_messages();

-- Keep last-seen timestamp current when a profile is updated.
create or replace function public.mw_set_last_seen() returns trigger language plpgsql as $$ begin new.last_seen_at=now(); new.updated_at=now(); return new; end $$;
drop trigger if exists mw_profiles_last_seen_trg on public.mw_profiles;
create trigger mw_profiles_last_seen_trg before update on public.mw_profiles for each row execute function public.mw_set_last_seen();



-- STORIES: 24-hour media posts.
create table if not exists public.mw_stories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null default 'Msafiri',
  caption text,
  media_url text not null,
  media_type text not null check(media_type in ('image','video')),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  created_at timestamptz not null default now()
);
alter table public.mw_stories enable row level security;
drop policy if exists mw_stories_select on public.mw_stories;
create policy mw_stories_select on public.mw_stories for select using(expires_at>now());
drop policy if exists mw_stories_insert on public.mw_stories;
create policy mw_stories_insert on public.mw_stories for insert to authenticated with check(user_id=auth.uid() and exists(select 1 from public.mw_profiles p where p.id=auth.uid() and p.is_banned=false and (p.suspended_until is null or p.suspended_until<=now())));
drop policy if exists mw_stories_delete on public.mw_stories;
create policy mw_stories_delete on public.mw_stories for delete to authenticated using(user_id=auth.uid());
create index if not exists mw_stories_active_idx on public.mw_stories(expires_at desc,created_at desc);
create index if not exists mw_stories_user_idx on public.mw_stories(user_id,created_at desc);

create or replace function public.mw_rl_stories() returns trigger language plpgsql security definer set search_path=public as $$ begin perform public.mw_rate_limit('story:'||auth.uid()::text,20,3600); return new; end $$;
drop trigger if exists mw_rl_stories_trg on public.mw_stories;
create trigger mw_rl_stories_trg before insert on public.mw_stories for each row execute function public.mw_rl_stories();

-- Refresh schema cache.
notify pgrst,'reload schema';

-- FOLLOW NOTIFICATIONS HARDENING (V12)
-- Ensures following and follow notifications exist even when only this migration is run.
create table if not exists public.mw_follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  following_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(follower_id,following_id),
  check(follower_id <> following_id)
);

create table if not exists public.mw_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  type text not null check(type in ('follow','signal','echo','system')),
  post_id uuid references public.mw_posts(id) on delete cascade,
  message text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.mw_follows enable row level security;
alter table public.mw_notifications enable row level security;

drop policy if exists mw_follows_read on public.mw_follows;
create policy mw_follows_read on public.mw_follows for select using(true);
drop policy if exists mw_follows_insert on public.mw_follows;
create policy mw_follows_insert on public.mw_follows for insert to authenticated with check(follower_id=auth.uid() and follower_id<>following_id);
drop policy if exists mw_follows_delete on public.mw_follows;
create policy mw_follows_delete on public.mw_follows for delete to authenticated using(follower_id=auth.uid());

drop policy if exists mw_notifications_read on public.mw_notifications;
create policy mw_notifications_read on public.mw_notifications for select to authenticated using(recipient_id=auth.uid());
drop policy if exists mw_notifications_update on public.mw_notifications;
create policy mw_notifications_update on public.mw_notifications for update to authenticated using(recipient_id=auth.uid()) with check(recipient_id=auth.uid());

grant select,insert,delete on public.mw_follows to authenticated;
grant select,update on public.mw_notifications to authenticated;

create or replace function public.mw_notify_follow()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  insert into public.mw_notifications(recipient_id,actor_id,type,message)
  values(new.following_id,new.follower_id,'follow','Mtu mpya amekufuata.');
  return new;
end;
$$;

drop trigger if exists mw_follow_notification on public.mw_follows;
create trigger mw_follow_notification
after insert on public.mw_follows
for each row execute function public.mw_notify_follow();

create index if not exists mw_follows_following_idx on public.mw_follows(following_id);
create index if not exists mw_notifications_recipient_idx on public.mw_notifications(recipient_id,created_at desc);

notify pgrst,'reload schema';

-- MILKYWAY V12 COMPLETION: privacy + notification preferences.
alter table if exists public.mw_profiles add column if not exists is_private boolean not null default false;
alter table if exists public.mw_profiles add column if not exists allow_messages text not null default 'everyone';
alter table if exists public.mw_profiles add column if not exists notify_follow boolean not null default true;
alter table if exists public.mw_profiles add column if not exists notify_echo boolean not null default true;
alter table if exists public.mw_profiles add column if not exists notify_signal boolean not null default true;
alter table if exists public.mw_profiles drop constraint if exists mw_profiles_allow_messages_check;
alter table if exists public.mw_profiles add constraint mw_profiles_allow_messages_check check(allow_messages in ('everyone','followers','nobody'));

create or replace function public.mw_notify_follow()
returns trigger language plpgsql security definer set search_path=public as $$
declare enabled boolean;
begin
  select coalesce(notify_follow,true) into enabled from public.mw_profiles where id=new.following_id;
  if enabled then
    insert into public.mw_notifications(recipient_id,actor_id,type,message)
    values(new.following_id,new.follower_id,'follow','Mtu mpya amekufuata.');
  end if;
  return new;
end; $$;

drop trigger if exists mw_follow_notification on public.mw_follows;
create trigger mw_follow_notification after insert on public.mw_follows for each row execute function public.mw_notify_follow();

create or replace function public.mw_notify_echo()
returns trigger language plpgsql security definer set search_path=public as $$
declare owner_id uuid; enabled boolean;
begin
  select author_id::uuid into owner_id from public.mw_posts where id=new.post_id;
  select coalesce(notify_echo,true) into enabled from public.mw_profiles where id=owner_id;
  if owner_id is not null and owner_id <> new.user_id::uuid and enabled then
    insert into public.mw_notifications(recipient_id,actor_id,type,post_id,message)
    values(owner_id,new.user_id::uuid,'echo',new.post_id,'Mtu ametoa Echo kwenye post yako.');
  end if;
  return new;
end; $$;

drop trigger if exists mw_echo_notification on public.mw_echoes;
create trigger mw_echo_notification after insert on public.mw_echoes for each row execute function public.mw_notify_echo();

create or replace function public.mw_notify_signal()
returns trigger language plpgsql security definer set search_path=public as $$
declare owner_id uuid; enabled boolean;
begin
  select author_id::uuid into owner_id from public.mw_posts where id=new.post_id;
  select coalesce(notify_signal,true) into enabled from public.mw_profiles where id=owner_id;
  if owner_id is not null and owner_id <> new.user_id::uuid and enabled then
    insert into public.mw_notifications(recipient_id,actor_id,type,post_id,message)
    values(owner_id,new.user_id::uuid,'signal',new.post_id,'Mtu ameweka Signal kwenye post yako.');
  end if;
  return new;
end; $$;

drop trigger if exists mw_signal_notification on public.mw_signals;
create trigger mw_signal_notification after insert on public.mw_signals for each row execute function public.mw_notify_signal();

-- Message privacy: sender must be allowed by receiver's profile settings.
drop policy if exists mw_messages_send on public.mw_messages;
create policy mw_messages_send on public.mw_messages for insert to authenticated with check(
  sender_id=auth.uid()
  and exists(select 1 from public.mw_profiles p where p.id=auth.uid() and p.is_banned=false and (p.suspended_until is null or p.suspended_until<=now()))
  and exists(select 1 from public.mw_profiles r where r.id=receiver_id and r.allow_messages<>'nobody' and (r.allow_messages='everyone' or exists(select 1 from public.mw_follows f where f.follower_id=auth.uid() and f.following_id=receiver_id)))
  and not exists(select 1 from public.mw_blocks b where (b.blocker_id=auth.uid() and b.blocked_id=receiver_id) or (b.blocker_id=receiver_id and b.blocked_id=auth.uid()))
);

create index if not exists mw_profiles_privacy_idx on public.mw_profiles(is_private,allow_messages);
notify pgrst,'reload schema';


-- Stage 2 security hardening: the limiter is trigger-internal, not a client RPC.
REVOKE ALL ON FUNCTION public.mw_rate_limit(text, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mw_rate_limit(text, integer, integer) FROM anon;
REVOKE ALL ON FUNCTION public.mw_rate_limit(text, integer, integer) FROM authenticated;
