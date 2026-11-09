-- Masiyatunda V13.3: separate Sanaa & Media galleries + arts chat context
create extension if not exists pgcrypto;

create table if not exists public.arts_gallery (
  id uuid primary key default gen_random_uuid(),
  title_en text not null default '',
  title_sw text not null default '',
  description_en text,
  description_sw text,
  category text,
  media_url text not null,
  media_type text not null default 'image' check (media_type in ('image','video')),
  published boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.site_media (
  id uuid primary key default gen_random_uuid(),
  title_en text not null default '',
  title_sw text not null default '',
  description_en text,
  description_sw text,
  category text,
  media_url text not null,
  media_type text not null default 'image' check (media_type in ('image','video')),
  published boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.arts_gallery enable row level security;
alter table public.site_media enable row level security;

drop policy if exists "arts_gallery_public_read" on public.arts_gallery;
drop policy if exists "arts_gallery_auth_manage" on public.arts_gallery;
drop policy if exists "site_media_public_read" on public.site_media;
drop policy if exists "site_media_auth_manage" on public.site_media;

create policy "arts_gallery_public_read" on public.arts_gallery
for select to anon, authenticated using (published = true);
create policy "arts_gallery_auth_manage" on public.arts_gallery
for all to authenticated using (true) with check (true);

create policy "site_media_public_read" on public.site_media
for select to anon, authenticated using (published = true);
create policy "site_media_auth_manage" on public.site_media
for all to authenticated using (true) with check (true);

create index if not exists idx_arts_gallery_created_at on public.arts_gallery(created_at desc);
create index if not exists idx_arts_gallery_published on public.arts_gallery(published);
create index if not exists idx_site_media_created_at on public.site_media(created_at desc);
create index if not exists idx_site_media_published on public.site_media(published);

-- Website chat used by the public Sanaa page and Admin.
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id text not null,
  name text,
  phone text,
  message text not null check (char_length(message) between 1 and 4000),
  is_from_admin boolean not null default false,
  is_read boolean not null default false,
  language text not null default 'sw',
  context text not null default 'general',
  created_at timestamptz not null default now()
);

alter table public.chat_messages add column if not exists context text not null default 'general';
alter table public.chat_messages enable row level security;

create index if not exists idx_chat_messages_context on public.chat_messages(context);
create index if not exists idx_chat_messages_thread_created on public.chat_messages(thread_id, created_at);
create index if not exists idx_chat_messages_context_created on public.chat_messages(context, created_at desc);

-- Public visitors may send messages and read their thread; Admin/authenticated users may manage chat.
drop policy if exists chat_public_insert on public.chat_messages;
create policy chat_public_insert on public.chat_messages
for insert to anon, authenticated
with check (char_length(message) between 1 and 4000);

drop policy if exists chat_public_read on public.chat_messages;
create policy chat_public_read on public.chat_messages
for select to anon, authenticated
using (true);

drop policy if exists chat_admin_update on public.chat_messages;
create policy chat_admin_update on public.chat_messages
for update to authenticated
using (true) with check (true);

drop policy if exists chat_admin_delete on public.chat_messages;
create policy chat_admin_delete on public.chat_messages
for delete to authenticated
using (true);

grant select, insert on public.chat_messages to anon, authenticated;
grant update, delete on public.chat_messages to authenticated;

notify pgrst, 'reload schema';
