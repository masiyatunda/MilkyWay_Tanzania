-- MilkyWay account API (api/milkyway-account.js): preferences, private account details, suspensions and appeals,
-- advertising, story views, post watermarks and live-history archiving.
-- Idempotent. Every function checks auth.uid() itself; administrator checks use public.mw_is_admin().
begin;

create extension if not exists pgcrypto;

-- Profile columns used by the privacy settings (already present on most projects).
alter table if exists public.mw_profiles add column if not exists is_private boolean not null default false;
alter table if exists public.mw_profiles add column if not exists allow_messages text not null default 'everyone';
alter table if exists public.mw_profiles add column if not exists notify_follow boolean not null default true;
alter table if exists public.mw_profiles add column if not exists is_banned boolean not null default false;

-- ---------------------------------------------------------------------------
-- Preferences
-- ---------------------------------------------------------------------------
create table if not exists public.mw_user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  notify_echo boolean not null default true,
  notify_signal boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.mw_user_preferences enable row level security;
drop policy if exists mw_user_preferences_owner on public.mw_user_preferences;
create policy mw_user_preferences_owner on public.mw_user_preferences for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.mw_get_preferences()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare me uuid := auth.uid(); result jsonb;
begin
  if me is null then raise exception 'Sign in first.' using errcode = '28000'; end if;
  select jsonb_build_object(
    'isPrivate', coalesce(p.is_private, false),
    'allowMessages', coalesce(p.allow_messages, 'everyone'),
    'notifyFollow', coalesce(p.notify_follow, true),
    'notifyEcho', coalesce(u.notify_echo, true),
    'notifySignal', coalesce(u.notify_signal, true))
  into result
  from (select me as id) m
  left join public.mw_profiles p on p.id = m.id
  left join public.mw_user_preferences u on u.user_id = m.id;
  return result;
end $$;

create or replace function public.mw_set_preferences(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); rule text; result jsonb;
begin
  if me is null then raise exception 'Sign in first.' using errcode = '28000'; end if;
  p := coalesce(p, '{}'::jsonb);
  rule := p->>'allowMessages';
  if rule is not null and rule not in ('everyone', 'followers', 'nobody') then
    raise exception 'Invalid message setting.' using errcode = '22023';
  end if;
  insert into public.mw_profiles(id) values (me) on conflict (id) do nothing;
  update public.mw_profiles set
    is_private = coalesce((p->>'isPrivate')::boolean, is_private),
    allow_messages = coalesce(rule, allow_messages),
    notify_follow = coalesce((p->>'notifyFollow')::boolean, notify_follow)
  where id = me;
  insert into public.mw_user_preferences(user_id, notify_echo, notify_signal)
  values (me, coalesce((p->>'notifyEcho')::boolean, true), coalesce((p->>'notifySignal')::boolean, true))
  on conflict (user_id) do update set
    notify_echo = coalesce((p->>'notifyEcho')::boolean, public.mw_user_preferences.notify_echo),
    notify_signal = coalesce((p->>'notifySignal')::boolean, public.mw_user_preferences.notify_signal),
    updated_at = now();
  result := public.mw_get_preferences();
  -- Mirror to the account metadata, which the client falls back to when this endpoint is unavailable.
  begin
    update auth.users
    set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('mw_preferences', result)
    where id = me;
  exception when others then null;
  end;
  return result;
end $$;

-- Public privacy flags for a list of accounts (no signed-in user needed).
create or replace function public.mw_privacy_flags(p_ids uuid[])
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(p.id::text, jsonb_build_object(
    'private', coalesce(p.is_private, false),
    'messages', coalesce(p.allow_messages, 'everyone'),
    'receipts', true)), '{}'::jsonb)
  from public.mw_profiles p
  where p.id = any(coalesce(p_ids, '{}'::uuid[]));
$$;

-- ---------------------------------------------------------------------------
-- Private account details: phone, country, date of birth, gender
-- ---------------------------------------------------------------------------
create table if not exists public.mw_account_private (
  user_id uuid primary key references auth.users(id) on delete cascade,
  phone text,
  phone_digits text,
  country text check (country is null or country ~ '^[A-Z]{2}$'),
  birth_date date,
  gender text check (gender is null or gender in ('male', 'female', 'other')),
  updated_at timestamptz not null default now()
);
create unique index if not exists mw_account_private_phone_idx on public.mw_account_private(phone_digits) where phone_digits is not null;
alter table public.mw_account_private enable row level security;
drop policy if exists mw_account_private_owner on public.mw_account_private;
create policy mw_account_private_owner on public.mw_account_private for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Exact lookup only: numbers are never listed. Matches the full digits, or the last nine digits for local formats.
create or replace function public.mw_find_accounts_by_phone(p_digits text)
returns uuid[] language plpgsql stable security definer set search_path = public as $$
declare me uuid := auth.uid(); d text := regexp_replace(coalesce(p_digits, ''), '\D', '', 'g'); found uuid[];
begin
  if me is null then raise exception 'Sign in first.' using errcode = '28000'; end if;
  if length(d) < 8 or length(d) > 15 then return '{}'::uuid[]; end if;
  select coalesce(array_agg(a.user_id), '{}'::uuid[]) into found from (
    select ap.user_id from public.mw_account_private ap
    where ap.phone_digits is not null and ap.user_id <> me
      and (ap.phone_digits = d or (length(d) >= 9 and length(ap.phone_digits) >= 9 and right(ap.phone_digits, 9) = right(d, 9)))
      and not exists (select 1 from public.mw_blocks b
        where (b.blocker_id = me and b.blocked_id = ap.user_id) or (b.blocker_id = ap.user_id and b.blocked_id = me))
    limit 5) a;
  return found;
end $$;

-- ---------------------------------------------------------------------------
-- Suspensions and appeals
-- ---------------------------------------------------------------------------
create table if not exists public.mw_suspensions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  reason text not null default '',
  suspended_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.mw_suspensions enable row level security;
drop policy if exists mw_suspensions_read on public.mw_suspensions;
create policy mw_suspensions_read on public.mw_suspensions for select to authenticated
  using (user_id = auth.uid() or public.mw_is_admin());

create table if not exists public.mw_suspension_appeals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  message text not null check (char_length(message) between 1 and 1000),
  reason text not null default '',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_note text not null default '',
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null
);
create index if not exists mw_suspension_appeals_user_idx on public.mw_suspension_appeals(user_id, created_at desc);
create index if not exists mw_suspension_appeals_status_idx on public.mw_suspension_appeals(status, created_at desc);
create unique index if not exists mw_suspension_appeals_one_pending_idx on public.mw_suspension_appeals(user_id) where status = 'pending';
alter table public.mw_suspension_appeals enable row level security;
drop policy if exists mw_suspension_appeals_read on public.mw_suspension_appeals;
create policy mw_suspension_appeals_read on public.mw_suspension_appeals for select to authenticated
  using (user_id = auth.uid() or public.mw_is_admin());

create or replace function public.mw_account_status()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare me uuid := auth.uid(); s public.mw_suspensions%rowtype; a public.mw_suspension_appeals%rowtype;
  is_suspended boolean; has_appeal boolean;
begin
  if me is null then raise exception 'Sign in first.' using errcode = '28000'; end if;
  select * into s from public.mw_suspensions where user_id = me;
  is_suspended := found;
  select * into a from public.mw_suspension_appeals where user_id = me order by created_at desc limit 1;
  has_appeal := found;
  return jsonb_build_object(
    'suspended', is_suspended,
    'reason', case when is_suspended then s.reason else '' end,
    'owner', public.mw_is_admin(),
    'appeal', case when is_suspended and has_appeal and a.created_at >= s.created_at
      then jsonb_build_object('status', a.status, 'adminNote', a.admin_note) else null end);
end $$;

create or replace function public.mw_submit_appeal(p_message text)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); m text := btrim(coalesce(p_message, '')); reason_text text;
begin
  if me is null then raise exception 'Sign in first.' using errcode = '28000'; end if;
  if char_length(m) < 1 or char_length(m) > 1000 then raise exception 'Write your appeal (up to 1000 characters).' using errcode = '22023'; end if;
  select reason into reason_text from public.mw_suspensions where user_id = me;
  if not found then raise exception 'This account is not suspended.' using errcode = '22023'; end if;
  if exists (select 1 from public.mw_suspension_appeals where user_id = me and status = 'pending') then
    raise exception 'Your appeal is already waiting for review.' using errcode = '22023';
  end if;
  insert into public.mw_suspension_appeals(user_id, message, reason) values (me, m, coalesce(reason_text, ''));
end $$;

create or replace function public.mw_admin_users(p_offset integer, p_q text, p_suspended boolean)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare me uuid := auth.uid(); q text := nullif(btrim(coalesce(p_q, '')), ''); result jsonb;
begin
  if not public.mw_is_admin() then raise exception 'Not allowed.' using errcode = '42501'; end if;
  if q is not null then q := '%' || replace(replace(replace(q, '\', '\\'), '%', '\%'), '_', '\_') || '%'; end if;
  with base as (
    select p.id, p.display_name, p.username, p.avatar_url, p.created_at,
      s.reason, s.created_at as suspended_at, (s.user_id is not null) as suspended,
      exists (select 1 from public.mw_suspension_appeals a where a.user_id = p.id and a.status = 'pending') as appeal_pending
    from public.mw_profiles p
    left join public.mw_suspensions s on s.user_id = p.id
    where (q is null or p.display_name ilike q or p.username ilike q)
      and (not coalesce(p_suspended, false) or s.user_id is not null)
  ), page as (
    select * from base order by created_at desc, id offset greatest(coalesce(p_offset, 0), 0) limit 25
  )
  select jsonb_build_object(
    'total', (select count(*) from base),
    'suspendedTotal', (select count(*) from public.mw_suspensions),
    'users', coalesce((select jsonb_agg(jsonb_build_object(
      'id', id, 'name', display_name, 'username', username, 'avatar', avatar_url, 'createdAt', created_at,
      'status', case when suspended then 'suspended' else 'active' end,
      'reason', coalesce(reason, ''), 'suspendedAt', suspended_at,
      'self', id = me, 'appealPending', appeal_pending) order by created_at desc, id) from page), '[]'::jsonb))
  into result;
  return result;
end $$;

create or replace function public.mw_admin_suspend(p_user uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.mw_is_admin() then raise exception 'Not allowed.' using errcode = '42501'; end if;
  if p_user is null or p_user = auth.uid() then raise exception 'You cannot suspend this account.' using errcode = '22023'; end if;
  if not exists (select 1 from auth.users where id = p_user) then raise exception 'Account not found.' using errcode = '22023'; end if;
  insert into public.mw_suspensions(user_id, reason, suspended_by)
  values (p_user, left(btrim(coalesce(p_reason, '')), 300), auth.uid())
  on conflict (user_id) do update set reason = excluded.reason, suspended_by = excluded.suspended_by, created_at = now();
  update public.mw_profiles set is_banned = true where id = p_user;
end $$;

create or replace function public.mw_admin_restore(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.mw_is_admin() then raise exception 'Not allowed.' using errcode = '42501'; end if;
  delete from public.mw_suspensions where user_id = p_user;
  update public.mw_profiles set is_banned = false where id = p_user;
  update public.mw_suspension_appeals
    set status = 'approved', resolved_at = now(), resolved_by = auth.uid()
    where user_id = p_user and status = 'pending';
end $$;

create or replace function public.mw_admin_resolve_appeal(p_id uuid, p_decision text, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare target uuid; note_text text := left(btrim(coalesce(p_note, '')), 500);
begin
  if not public.mw_is_admin() then raise exception 'Not allowed.' using errcode = '42501'; end if;
  if p_decision not in ('approve', 'reject') then raise exception 'Invalid decision.' using errcode = '22023'; end if;
  select user_id into target from public.mw_suspension_appeals where id = p_id and status = 'pending';
  if not found then raise exception 'Appeal not found or already reviewed.' using errcode = '22023'; end if;
  if p_decision = 'approve' then
    delete from public.mw_suspensions where user_id = target;
    update public.mw_profiles set is_banned = false where id = target;
  end if;
  update public.mw_suspension_appeals
    set status = case when p_decision = 'approve' then 'approved' else 'rejected' end,
        admin_note = note_text, resolved_at = now(), resolved_by = auth.uid()
    where id = p_id;
end $$;

create or replace function public.mw_admin_appeals(p_status text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare wanted text := case when p_status in ('approved', 'rejected') then p_status else 'pending' end; result jsonb;
begin
  if not public.mw_is_admin() then raise exception 'Not allowed.' using errcode = '42501'; end if;
  select jsonb_build_object(
    'pendingTotal', (select count(*) from public.mw_suspension_appeals where status = 'pending'),
    'appeals', coalesce((select jsonb_agg(jsonb_build_object(
      'id', a.id, 'userId', a.user_id, 'name', p.display_name, 'username', p.username, 'status', a.status,
      'message', a.message, 'reason', a.reason, 'suspended', s.user_id is not null,
      'createdAt', a.created_at, 'resolvedAt', a.resolved_at, 'adminNote', a.admin_note) order by a.created_at desc)
      from (select * from public.mw_suspension_appeals where status = wanted order by created_at desc limit 100) a
      left join public.mw_profiles p on p.id = a.user_id
      left join public.mw_suspensions s on s.user_id = a.user_id), '[]'::jsonb))
  into result;
  return result;
end $$;

-- ---------------------------------------------------------------------------
-- Advertising
-- ---------------------------------------------------------------------------
create table if not exists public.mw_ad_campaigns (
  id uuid primary key default gen_random_uuid(),
  business text not null check (char_length(business) between 1 and 100),
  title text not null default '',
  description text not null default '',
  media_url text not null,
  media_type text not null default 'image' check (media_type in ('image', 'video')),
  destination text not null default '',
  cta_label text not null default '',
  audience text not null default 'all' check (audience in ('all', 'members')),
  frequency integer not null default 6 check (frequency between 3 and 20),
  dismiss_days integer not null default 7 check (dismiss_days between 1 and 365),
  status text not null default 'draft' check (status in ('draft', 'approved', 'paused')),
  placement text not null default 'feed' check (placement in ('feed', 'banner', 'video')),
  skip_after integer not null default 5 check (skip_after between 0 and 60),
  paid boolean not null default false,
  amount_paid numeric not null default 0 check (amount_paid >= 0),
  currency text not null default 'TZS',
  payment_ref text not null default '',
  starts_at timestamptz,
  ends_at timestamptz,
  target_languages text not null default '',
  target_countries text not null default '',
  impressions bigint not null default 0,
  clicks bigint not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists mw_ad_campaigns_status_idx on public.mw_ad_campaigns(status, paid, created_at desc);
alter table public.mw_ad_campaigns enable row level security;
drop policy if exists mw_ad_campaigns_admin on public.mw_ad_campaigns;
create policy mw_ad_campaigns_admin on public.mw_ad_campaigns for all to authenticated
  using (public.mw_is_admin()) with check (public.mw_is_admin());
grant select, insert, update, delete on public.mw_ad_campaigns to authenticated;

create table if not exists public.mw_ad_dismissals (
  user_id uuid not null references auth.users(id) on delete cascade,
  campaign_id uuid not null references public.mw_ad_campaigns(id) on delete cascade,
  dismissed_until timestamptz not null,
  primary key (user_id, campaign_id)
);
alter table public.mw_ad_dismissals enable row level security;
drop policy if exists mw_ad_dismissals_owner on public.mw_ad_dismissals;
create policy mw_ad_dismissals_owner on public.mw_ad_dismissals for select to authenticated using (user_id = auth.uid());

-- Campaigns that are approved, paid and inside their schedule, for the viewer's language and country.
create or replace function public.mw_active_ads(p_lang text, p_country text)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id, 'business', c.business, 'title', c.title, 'description', c.description,
    'mediaUrl', c.media_url, 'mediaType', c.media_type, 'destination', c.destination, 'ctaLabel', c.cta_label,
    'audience', c.audience, 'frequency', c.frequency, 'dismissDays', c.dismiss_days, 'status', c.status,
    'placement', c.placement, 'skipAfter', c.skip_after, 'startsAt', c.starts_at, 'endsAt', c.ends_at)
    order by c.created_at desc), '[]'::jsonb)
  from (
    select * from public.mw_ad_campaigns c
    where c.status = 'approved' and c.paid
      and (c.starts_at is null or c.starts_at <= now())
      and (c.ends_at is null or c.ends_at > now())
      and (c.audience = 'all' or auth.uid() is not null)
      and (c.target_languages = '' or lower(coalesce(p_lang, '')) = any(string_to_array(lower(replace(c.target_languages, ' ', '')), ',')))
      and (c.target_countries = '' or upper(coalesce(p_country, '')) = any(string_to_array(upper(replace(c.target_countries, ' ', '')), ',')))
      and not exists (select 1 from public.mw_ad_dismissals d
        where d.user_id = auth.uid() and d.campaign_id = c.id and d.dismissed_until > now())
    order by c.created_at desc limit 20
  ) c;
$$;

create or replace function public.mw_ad_event(p_id uuid, p_type text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_type = 'impression' then
    update public.mw_ad_campaigns set impressions = impressions + 1 where id = p_id and status = 'approved' and paid;
  elsif p_type = 'click' then
    update public.mw_ad_campaigns set clicks = clicks + 1 where id = p_id and status = 'approved' and paid;
  else
    raise exception 'Invalid event.' using errcode = '22023';
  end if;
end $$;

create or replace function public.mw_dismiss_ad(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); days integer;
begin
  if me is null then raise exception 'Sign in first.' using errcode = '28000'; end if;
  select dismiss_days into days from public.mw_ad_campaigns where id = p_id;
  if not found then return; end if;
  insert into public.mw_ad_dismissals(user_id, campaign_id, dismissed_until)
  values (me, p_id, now() + make_interval(days => days))
  on conflict (user_id, campaign_id) do update set dismissed_until = excluded.dismissed_until;
end $$;

-- ---------------------------------------------------------------------------
-- Story views, post watermarks, live-history archive
-- ---------------------------------------------------------------------------
create table if not exists public.mw_story_views (
  user_id uuid not null references auth.users(id) on delete cascade,
  story_id uuid not null,
  viewed_at timestamptz not null default now(),
  primary key (user_id, story_id)
);
alter table public.mw_story_views enable row level security;
drop policy if exists mw_story_views_owner on public.mw_story_views;
create policy mw_story_views_owner on public.mw_story_views for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.mw_post_watermarks (
  post_id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.mw_post_watermarks enable row level security;
drop policy if exists mw_post_watermarks_read on public.mw_post_watermarks;
create policy mw_post_watermarks_read on public.mw_post_watermarks for select to anon, authenticated using (true);
drop policy if exists mw_post_watermarks_insert on public.mw_post_watermarks;
create policy mw_post_watermarks_insert on public.mw_post_watermarks for insert to authenticated
  with check (owner_id = auth.uid() and exists (select 1 from public.mw_posts p where p.id = post_id and p.author_id::text = auth.uid()::text));
drop policy if exists mw_post_watermarks_delete on public.mw_post_watermarks;
create policy mw_post_watermarks_delete on public.mw_post_watermarks for delete to authenticated using (owner_id = auth.uid());

create table if not exists public.mw_live_history_archive (
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null check (source in ('audio', 'video')),
  session_id uuid not null,
  archived_at timestamptz not null default now(),
  primary key (user_id, source, session_id)
);
alter table public.mw_live_history_archive enable row level security;
drop policy if exists mw_live_history_archive_owner on public.mw_live_history_archive;
create policy mw_live_history_archive_owner on public.mw_live_history_archive for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Files the signed-in user uploaded (profile photos and message attachments).
create or replace function public.mw_my_files()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare me uuid := auth.uid(); result jsonb;
begin
  if me is null then raise exception 'Sign in first.' using errcode = '28000'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('key', o.name, 'name', regexp_replace(o.name, '^.*/', ''),
    'purpose', case when o.name like 'milkyway-avatars/%' or o.name like 'avatars/%' then 'avatar' else 'message' end)
    order by o.created_at desc), '[]'::jsonb)
  into result
  from (
    select name, created_at from storage.objects
    where bucket_id = 'portfolio' and owner_id = me::text
      and (name like 'milkyway/' || me::text || '/%' or name like 'milkyway-avatars/' || me::text || '/%' or name like 'avatars/' || me::text || '/%')
      and name not like '%/campaigns/%' and name not like '%.poster.jpg'
    order by created_at desc limit 200
  ) o;
  return result;
end $$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
revoke all on function public.mw_get_preferences() from public;
revoke all on function public.mw_set_preferences(jsonb) from public;
revoke all on function public.mw_privacy_flags(uuid[]) from public;
revoke all on function public.mw_find_accounts_by_phone(text) from public;
revoke all on function public.mw_account_status() from public;
revoke all on function public.mw_submit_appeal(text) from public;
revoke all on function public.mw_admin_users(integer, text, boolean) from public;
revoke all on function public.mw_admin_suspend(uuid, text) from public;
revoke all on function public.mw_admin_restore(uuid) from public;
revoke all on function public.mw_admin_resolve_appeal(uuid, text, text) from public;
revoke all on function public.mw_admin_appeals(text) from public;
revoke all on function public.mw_active_ads(text, text) from public;
revoke all on function public.mw_ad_event(uuid, text) from public;
revoke all on function public.mw_dismiss_ad(uuid) from public;
revoke all on function public.mw_my_files() from public;

grant execute on function public.mw_get_preferences() to authenticated;
grant execute on function public.mw_set_preferences(jsonb) to authenticated;
grant execute on function public.mw_privacy_flags(uuid[]) to anon, authenticated;
grant execute on function public.mw_find_accounts_by_phone(text) to authenticated;
grant execute on function public.mw_account_status() to authenticated;
grant execute on function public.mw_submit_appeal(text) to authenticated;
grant execute on function public.mw_admin_users(integer, text, boolean) to authenticated;
grant execute on function public.mw_admin_suspend(uuid, text) to authenticated;
grant execute on function public.mw_admin_restore(uuid) to authenticated;
grant execute on function public.mw_admin_resolve_appeal(uuid, text, text) to authenticated;
grant execute on function public.mw_admin_appeals(text) to authenticated;
grant execute on function public.mw_active_ads(text, text) to anon, authenticated;
grant execute on function public.mw_ad_event(uuid, text) to anon, authenticated;
grant execute on function public.mw_dismiss_ad(uuid) to authenticated;
grant execute on function public.mw_my_files() to authenticated;

grant select, insert, update, delete on public.mw_user_preferences, public.mw_account_private, public.mw_story_views, public.mw_live_history_archive to authenticated;
grant select on public.mw_suspensions, public.mw_suspension_appeals, public.mw_ad_dismissals to authenticated;
grant select on public.mw_post_watermarks to anon;
grant select, insert, delete on public.mw_post_watermarks to authenticated;

commit;
notify pgrst, 'reload schema';
