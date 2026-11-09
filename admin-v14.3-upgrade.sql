-- Masiyatunda V14.3 Admin Control Center Upgrade
-- Run after business-portal-v14.sql and arts-media-v13.3.sql
create extension if not exists pgcrypto;

-- Artist directory / verification
create table if not exists public.artist_profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  email text,
  phone text,
  location text,
  bio text,
  photo_url text,
  verified boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.artist_profiles enable row level security;
drop policy if exists artist_profiles_public_read on public.artist_profiles;
drop policy if exists artist_profiles_admin_all on public.artist_profiles;
create policy artist_profiles_admin_all on public.artist_profiles for all to authenticated using (public.mw_is_admin()) with check (public.mw_is_admin());

-- Public artist directory exposes only safe profile fields; private contact fields stay admin-only.
create or replace function public.get_public_artist_profiles(p_artist_id uuid default null)
returns table(id uuid,name text,category text,location text,bio text,photo_url text,verified boolean,created_at timestamptz)
language sql security definer set search_path=public as $$
  select id,name,category,location,bio,photo_url,verified,created_at
  from public.artist_profiles
  where active=true and (p_artist_id is null or id=p_artist_id)
  order by created_at desc;
$$;
revoke all on function public.get_public_artist_profiles(uuid) from public;
grant execute on function public.get_public_artist_profiles(uuid) to anon, authenticated;
create index if not exists idx_artist_profiles_created on public.artist_profiles(created_at desc);
create index if not exists idx_artist_profiles_category on public.artist_profiles(category);
create index if not exists idx_artist_profiles_verified on public.artist_profiles(verified,active);

-- Admin audit trail
create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_email text,
  action text not null,
  details text,
  created_at timestamptz not null default now()
);
alter table public.admin_audit_logs enable row level security;
drop policy if exists admin_audit_admin_all on public.admin_audit_logs;
create policy admin_audit_admin_read on public.admin_audit_logs for select to authenticated using (public.mw_is_admin());
create policy admin_audit_admin_insert on public.admin_audit_logs for insert to authenticated with check (public.mw_is_admin());
create index if not exists idx_admin_audit_created on public.admin_audit_logs(created_at desc);

-- Optional admin role directory for future multi-admin expansion
create table if not exists public.admin_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'content_manager' check(role in ('super_admin','arts_manager','content_manager','crm_manager','project_manager','support_manager')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.admin_roles enable row level security;
drop policy if exists admin_roles_admin_all on public.admin_roles;
create policy admin_roles_admin_all on public.admin_roles for all to authenticated using (public.mw_is_admin()) with check (public.mw_is_admin());

-- Keep timestamps current
create or replace function public.mw_set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end; $$;
drop trigger if exists artist_profiles_updated_at on public.artist_profiles;
create trigger artist_profiles_updated_at before update on public.artist_profiles for each row execute function public.mw_set_updated_at();
drop trigger if exists admin_roles_updated_at on public.admin_roles;
create trigger admin_roles_updated_at before update on public.admin_roles for each row execute function public.mw_set_updated_at();

notify pgrst,'reload schema';


-- V14.4 security, artist-chat and artist-gallery linkage
alter table public.arts_gallery add column if not exists artist_id uuid references public.artist_profiles(id) on delete set null;
create index if not exists idx_arts_gallery_artist_id on public.arts_gallery(artist_id, created_at desc);
alter table public.chat_messages add column if not exists artist_id uuid references public.artist_profiles(id) on delete set null;
create index if not exists idx_chat_messages_artist_id on public.chat_messages(artist_id, created_at desc);
notify pgrst,'reload schema';
