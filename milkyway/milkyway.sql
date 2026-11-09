-- MilkyWay Platform v4
-- Run this entire file in Supabase SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.mw_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Msafiri',
  username text unique,
  bio text default '',
  avatar_url text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mw_posts (
  id uuid primary key default gen_random_uuid(),
  author_id text not null,
  author_name text,
  caption text,
  media_url text,
  media_type text check (media_type in ('image','video') or media_type is null),
  created_at timestamptz not null default now()
);

create table if not exists public.mw_signals (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.mw_posts(id) on delete cascade,
  user_id text not null,
  kind text not null check (kind in ('light','truth','freedom')),
  created_at timestamptz not null default now(),
  unique(post_id,user_id,kind)
);

create table if not exists public.mw_echoes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.mw_posts(id) on delete cascade,
  user_id text not null,
  author_name text,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);

create table if not exists public.mw_saves (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.mw_posts(id) on delete cascade,
  user_id text not null,
  created_at timestamptz not null default now(),
  unique(post_id,user_id)
);

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

create table if not exists public.mw_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(blocker_id,blocked_id),
  check(blocker_id <> blocked_id)
);

create table if not exists public.mw_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  post_id uuid references public.mw_posts(id) on delete cascade,
  reported_user_id uuid references auth.users(id) on delete cascade,
  reason text not null,
  details text default '',
  status text not null default 'open' check(status in ('open','reviewing','resolved','dismissed')),
  created_at timestamptz not null default now()
);

-- Profiles for new Auth users.
create or replace function public.mw_handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.mw_profiles(id,display_name)
  values(new.id, coalesce(nullif(new.raw_user_meta_data->>'display_name',''), split_part(new.email,'@',1), 'Msafiri'))
  on conflict(id) do nothing;
  return new;
end;
$$;

drop trigger if exists mw_on_auth_user_created on auth.users;
create trigger mw_on_auth_user_created
after insert on auth.users
for each row execute function public.mw_handle_new_user();

-- Backfill profiles for accounts that already exist.
insert into public.mw_profiles(id,display_name)
select id, coalesce(nullif(raw_user_meta_data->>'display_name',''), split_part(email,'@',1), 'Msafiri')
from auth.users
on conflict(id) do nothing;

create or replace function public.mw_touch_profile()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;
drop trigger if exists mw_profiles_touch on public.mw_profiles;
create trigger mw_profiles_touch before update on public.mw_profiles for each row execute function public.mw_touch_profile();

-- Notification triggers.
create or replace function public.mw_notify_follow()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.mw_notifications(recipient_id,actor_id,type,message)
  values(new.following_id,new.follower_id,'follow','Mtu mpya amekufuata.');
  return new;
end; $$;
drop trigger if exists mw_follow_notification on public.mw_follows;
create trigger mw_follow_notification after insert on public.mw_follows for each row execute function public.mw_notify_follow();

create or replace function public.mw_notify_echo()
returns trigger language plpgsql security definer set search_path=public as $$
declare owner_id uuid;
begin
  select author_id::uuid into owner_id from public.mw_posts where id=new.post_id;
  if owner_id is not null and owner_id <> new.user_id::uuid then
    insert into public.mw_notifications(recipient_id,actor_id,type,post_id,message)
    values(owner_id,new.user_id::uuid,'echo',new.post_id,'Mtu ametoa Echo kwenye post yako.');
  end if;
  return new;
end; $$;
drop trigger if exists mw_echo_notification on public.mw_echoes;
create trigger mw_echo_notification after insert on public.mw_echoes for each row execute function public.mw_notify_echo();

create or replace function public.mw_notify_signal()
returns trigger language plpgsql security definer set search_path=public as $$
declare owner_id uuid;
begin
  select author_id::uuid into owner_id from public.mw_posts where id=new.post_id;
  if owner_id is not null and owner_id <> new.user_id::uuid then
    insert into public.mw_notifications(recipient_id,actor_id,type,post_id,message)
    values(owner_id,new.user_id::uuid,'signal',new.post_id,'Mtu ameweka Signal kwenye post yako.');
  end if;
  return new;
end; $$;
drop trigger if exists mw_signal_notification on public.mw_signals;
create trigger mw_signal_notification after insert on public.mw_signals for each row execute function public.mw_notify_signal();

-- RLS.
alter table public.mw_profiles enable row level security;
alter table public.mw_posts enable row level security;
alter table public.mw_signals enable row level security;
alter table public.mw_echoes enable row level security;
alter table public.mw_saves enable row level security;
alter table public.mw_follows enable row level security;
alter table public.mw_notifications enable row level security;
alter table public.mw_blocks enable row level security;
alter table public.mw_reports enable row level security;

drop policy if exists mw_profiles_read on public.mw_profiles;
create policy mw_profiles_read on public.mw_profiles for select using(true);
drop policy if exists mw_profiles_update on public.mw_profiles;
create policy mw_profiles_update on public.mw_profiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid());

-- Public feed, authenticated authoring.
drop policy if exists mw_posts_read on public.mw_posts;
create policy mw_posts_read on public.mw_posts for select using(true);
drop policy if exists mw_posts_insert on public.mw_posts;
create policy mw_posts_insert on public.mw_posts for insert to authenticated with check(author_id=auth.uid()::text);
drop policy if exists mw_posts_update on public.mw_posts;
create policy mw_posts_update on public.mw_posts for update to authenticated using(author_id=auth.uid()::text) with check(author_id=auth.uid()::text);
drop policy if exists mw_posts_delete on public.mw_posts;
create policy mw_posts_delete on public.mw_posts for delete to authenticated using(author_id=auth.uid()::text);

drop policy if exists mw_signals_read on public.mw_signals;
create policy mw_signals_read on public.mw_signals for select using(true);
drop policy if exists mw_signals_insert on public.mw_signals;
create policy mw_signals_insert on public.mw_signals for insert to authenticated with check(user_id=auth.uid()::text);
drop policy if exists mw_signals_delete on public.mw_signals;
create policy mw_signals_delete on public.mw_signals for delete to authenticated using(user_id=auth.uid()::text);

drop policy if exists mw_echoes_read on public.mw_echoes;
create policy mw_echoes_read on public.mw_echoes for select using(true);
drop policy if exists mw_echoes_insert on public.mw_echoes;
create policy mw_echoes_insert on public.mw_echoes for insert to authenticated with check(user_id=auth.uid()::text);
drop policy if exists mw_echoes_delete on public.mw_echoes;
create policy mw_echoes_delete on public.mw_echoes for delete to authenticated using(user_id=auth.uid()::text);

drop policy if exists mw_saves_owner on public.mw_saves;
create policy mw_saves_owner on public.mw_saves for all to authenticated using(user_id=auth.uid()::text) with check(user_id=auth.uid()::text);

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

drop policy if exists mw_blocks_all on public.mw_blocks;
create policy mw_blocks_all on public.mw_blocks for all to authenticated using(blocker_id=auth.uid()) with check(blocker_id=auth.uid() and blocker_id<>blocked_id);

drop policy if exists mw_reports_insert on public.mw_reports;
create policy mw_reports_insert on public.mw_reports for insert to authenticated with check(reporter_id=auth.uid());
drop policy if exists mw_reports_read_admin on public.mw_reports;
create policy mw_reports_read_admin on public.mw_reports for select to authenticated using(exists(select 1 from public.mw_profiles p where p.id=auth.uid() and p.is_admin=true));
drop policy if exists mw_reports_update_admin on public.mw_reports;
create policy mw_reports_update_admin on public.mw_reports for update to authenticated using(exists(select 1 from public.mw_profiles p where p.id=auth.uid() and p.is_admin=true)) with check(exists(select 1 from public.mw_profiles p where p.id=auth.uid() and p.is_admin=true));

-- Storage policies for the existing public 'portfolio' bucket.
drop policy if exists mw_media_upload on storage.objects;
create policy mw_media_upload on storage.objects for insert to authenticated with check(bucket_id='portfolio' and name like 'milkyway/%' and (storage.foldername(name))[1]='milkyway' and (storage.foldername(name))[2]=auth.uid()::text);
drop policy if exists mw_media_update on storage.objects;
create policy mw_media_update on storage.objects for update to authenticated using(bucket_id='portfolio' and owner_id=auth.uid()::text and name like 'milkyway/%') with check(bucket_id='portfolio' and owner_id=auth.uid()::text and name like 'milkyway/%');
drop policy if exists mw_media_delete on storage.objects;
create policy mw_media_delete on storage.objects for delete to authenticated using(bucket_id='portfolio' and owner_id=auth.uid()::text and name like 'milkyway/%');

drop policy if exists mw_avatar_upload on storage.objects;
create policy mw_avatar_upload on storage.objects for insert to authenticated with check(bucket_id='portfolio' and name like 'milkyway-avatars/%' and (storage.foldername(name))[1]='milkyway-avatars' and (storage.foldername(name))[2]=auth.uid()::text);

-- Indexes.
create index if not exists mw_posts_created_at_idx on public.mw_posts(created_at desc);
create index if not exists mw_posts_author_idx on public.mw_posts(author_id);
create index if not exists mw_signals_post_idx on public.mw_signals(post_id);
create index if not exists mw_echoes_post_idx on public.mw_echoes(post_id);
create index if not exists mw_saves_user_idx on public.mw_saves(user_id);
create index if not exists mw_follows_following_idx on public.mw_follows(following_id);
create index if not exists mw_notifications_recipient_idx on public.mw_notifications(recipient_id,created_at desc);
create index if not exists mw_blocks_blocked_idx on public.mw_blocks(blocked_id);
create index if not exists mw_reports_status_idx on public.mw_reports(status,created_at desc);

notify pgrst,'reload schema';
