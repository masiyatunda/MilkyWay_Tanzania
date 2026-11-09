-- MilkyWay V25: DM groups, per-message deletion, and 1:1 audio-call signaling
-- Run this file in Supabase SQL Editor after the existing MilkyWay platform migrations.
create table if not exists public.mw_dm_groups (
 id uuid primary key default gen_random_uuid(), name text not null check(char_length(name) between 1 and 70),
 created_by uuid not null references auth.users(id) on delete cascade, created_at timestamptz not null default now()
);
create table if not exists public.mw_dm_group_members (
 group_id uuid not null references public.mw_dm_groups(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 role text not null default 'member' check(role in ('admin','member')), joined_at timestamptz not null default now(),
 primary key(group_id,user_id)
);
create table if not exists public.mw_dm_group_messages (
 id uuid primary key default gen_random_uuid(), group_id uuid not null references public.mw_dm_groups(id) on delete cascade,
 sender_id uuid not null references auth.users(id) on delete cascade,
 body text not null check(char_length(body) between 1 and 4000), created_at timestamptz not null default now()
);
create table if not exists public.mw_dm_calls (
 id uuid primary key default gen_random_uuid(), caller_id uuid not null references auth.users(id) on delete cascade,
 callee_id uuid not null references auth.users(id) on delete cascade, status text not null default 'ringing' check(status in ('ringing','accepted','ended','declined')),
 offer jsonb, answer jsonb, created_at timestamptz not null default now(), ended_at timestamptz,
 check(caller_id<>callee_id)
);
create table if not exists public.mw_dm_call_signals (
 id uuid primary key default gen_random_uuid(), call_id uuid not null references public.mw_dm_calls(id) on delete cascade,
 sender_id uuid not null references auth.users(id) on delete cascade, kind text not null check(kind in ('candidate')),
 payload jsonb not null, created_at timestamptz not null default now()
);
create or replace function public.mw_dm_is_group_member(gid uuid, uid uuid) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.mw_dm_group_members where group_id=gid and user_id=uid) $$;
create or replace function public.mw_dm_is_group_admin(gid uuid, uid uuid) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.mw_dm_group_members where group_id=gid and user_id=uid and role='admin') $$;
revoke all on function public.mw_dm_is_group_member(uuid,uuid) from public;
revoke all on function public.mw_dm_is_group_admin(uuid,uuid) from public;
grant execute on function public.mw_dm_is_group_member(uuid,uuid) to authenticated;
grant execute on function public.mw_dm_is_group_admin(uuid,uuid) to authenticated;
alter table public.mw_dm_groups enable row level security;
alter table public.mw_dm_group_members enable row level security;
alter table public.mw_dm_group_messages enable row level security;
alter table public.mw_dm_calls enable row level security;
alter table public.mw_dm_call_signals enable row level security;
drop policy if exists mw_dm_groups_read on public.mw_dm_groups;
create policy mw_dm_groups_read on public.mw_dm_groups for select to authenticated using(created_by=auth.uid() or public.mw_dm_is_group_member(mw_dm_groups.id,auth.uid()));
drop policy if exists mw_dm_groups_create on public.mw_dm_groups;
create policy mw_dm_groups_create on public.mw_dm_groups for insert to authenticated with check(created_by=auth.uid());
drop policy if exists mw_dm_members_read on public.mw_dm_group_members;
create policy mw_dm_members_read on public.mw_dm_group_members for select to authenticated using(public.mw_dm_is_group_member(mw_dm_group_members.group_id,auth.uid()));
-- Members may join themselves when creating a group; group admins can invite others.
drop policy if exists mw_dm_members_add on public.mw_dm_group_members;
create policy mw_dm_members_add on public.mw_dm_group_members for insert to authenticated with check(user_id=auth.uid() or public.mw_dm_is_group_admin(mw_dm_group_members.group_id,auth.uid()));
drop policy if exists mw_dm_group_messages_read on public.mw_dm_group_messages;
create policy mw_dm_group_messages_read on public.mw_dm_group_messages for select to authenticated using(public.mw_dm_is_group_member(mw_dm_group_messages.group_id,auth.uid()));
drop policy if exists mw_dm_group_messages_send on public.mw_dm_group_messages;
create policy mw_dm_group_messages_send on public.mw_dm_group_messages for insert to authenticated with check(sender_id=auth.uid() and public.mw_dm_is_group_member(mw_dm_group_messages.group_id,auth.uid()));
drop policy if exists mw_dm_group_messages_delete on public.mw_dm_group_messages;
create policy mw_dm_group_messages_delete on public.mw_dm_group_messages for delete to authenticated using(sender_id=auth.uid());
drop policy if exists mw_dm_calls_read on public.mw_dm_calls;
create policy mw_dm_calls_read on public.mw_dm_calls for select to authenticated using(caller_id=auth.uid() or callee_id=auth.uid());
drop policy if exists mw_dm_calls_create on public.mw_dm_calls;
create policy mw_dm_calls_create on public.mw_dm_calls for insert to authenticated with check(caller_id=auth.uid());
drop policy if exists mw_dm_calls_update on public.mw_dm_calls;
create policy mw_dm_calls_update on public.mw_dm_calls for update to authenticated using(caller_id=auth.uid() or callee_id=auth.uid()) with check(caller_id=auth.uid() or callee_id=auth.uid());
drop policy if exists mw_dm_signals_read on public.mw_dm_call_signals;
create policy mw_dm_signals_read on public.mw_dm_call_signals for select to authenticated using(exists(select 1 from public.mw_dm_calls c where c.id=call_id and (c.caller_id=auth.uid() or c.callee_id=auth.uid())));
drop policy if exists mw_dm_signals_send on public.mw_dm_call_signals;
create policy mw_dm_signals_send on public.mw_dm_call_signals for insert to authenticated with check(sender_id=auth.uid() and exists(select 1 from public.mw_dm_calls c where c.id=call_id and (c.caller_id=auth.uid() or c.callee_id=auth.uid())));
-- Add message delete permission only for the sender; recipients cannot delete another user's message.
drop policy if exists mw_messages_delete_own on public.mw_messages;
create policy mw_messages_delete_own on public.mw_messages for delete to authenticated using(sender_id=auth.uid());
grant select,insert,update,delete on public.mw_dm_groups,public.mw_dm_group_members,public.mw_dm_group_messages,public.mw_dm_calls,public.mw_dm_call_signals to authenticated;
grant delete on public.mw_messages to authenticated;
create index if not exists mw_dm_group_messages_timeline_idx on public.mw_dm_group_messages(group_id,created_at desc);
create index if not exists mw_dm_calls_incoming_idx on public.mw_dm_calls(callee_id,status,created_at desc);
notify pgrst,'reload schema';
