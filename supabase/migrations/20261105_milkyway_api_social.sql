-- MilkyWay social + gallery API: post details, comment details, reposts, post audiences and documents.
-- Idempotent. Every function checks auth.uid() itself and is executable by the roles that need it only.
create extension if not exists pgcrypto;

-- Visibility of a post for the current caller: "only_me" and "followers" posts are gated by an audience row.
create table if not exists public.mw_post_audience (
  post_id uuid primary key references public.mw_posts(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  audience text not null check (audience in ('followers', 'only_me')),
  updated_at timestamptz not null default now()
);
alter table public.mw_post_audience enable row level security;
drop policy if exists mw_post_audience_owner_read on public.mw_post_audience;
create policy mw_post_audience_owner_read on public.mw_post_audience for select to authenticated using (owner_id = auth.uid());

create or replace function public.mw_post_visible(p_post uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select case a.audience
      when 'only_me' then auth.uid() is not null and a.owner_id = auth.uid()
      when 'followers' then auth.uid() is not null and (a.owner_id = auth.uid()
        or exists (select 1 from public.mw_follows f where f.follower_id = auth.uid() and f.following_id = a.owner_id))
      else true end
    from public.mw_post_audience a where a.post_id = p_post
  ), true)
$$;
grant execute on function public.mw_post_visible(uuid) to anon, authenticated;

-- Posts that are not visible to the caller disappear from every select, on top of the existing policies.
drop policy if exists mw_posts_audience_gate on public.mw_posts;
create policy mw_posts_audience_gate on public.mw_posts as restrictive for select using (public.mw_post_visible(id));

create or replace function public.mw_set_post_audience(p_post uuid, p_audience text)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'Sign in first.' using errcode = '28000'; end if;
  if p_audience not in ('everyone', 'followers', 'only_me') then raise exception 'Invalid audience.' using errcode = '22023'; end if;
  if not exists (select 1 from public.mw_posts p where p.id = p_post and p.author_id::text = me::text) then
    raise exception 'Not allowed.' using errcode = '42501';
  end if;
  if p_audience = 'everyone' then
    delete from public.mw_post_audience where post_id = p_post;
  else
    insert into public.mw_post_audience(post_id, owner_id, audience) values (p_post, me, p_audience)
    on conflict (post_id) do update set audience = excluded.audience, updated_at = now();
  end if;
end $$;
revoke all on function public.mw_set_post_audience(uuid, text) from public, anon;
grant execute on function public.mw_set_post_audience(uuid, text) to authenticated;

-- Audience rows for the given posts, with whether the caller may see each one.
create or replace function public.mw_post_audiences(p_ids uuid[])
returns table(post_id uuid, owner_id uuid, audience text, can_see boolean)
language sql stable security definer set search_path = public as $$
  select a.post_id, a.owner_id, a.audience, public.mw_post_visible(a.post_id)
  from public.mw_post_audience a where a.post_id = any(coalesce(p_ids, '{}'::uuid[])) limit 200
$$;
grant execute on function public.mw_post_audiences(uuid[]) to anon, authenticated;

create or replace function public.mw_owner_audiences(p_owner uuid)
returns table(post_id uuid, owner_id uuid, audience text, can_see boolean)
language sql stable security definer set search_path = public as $$
  select a.post_id, a.owner_id, a.audience, public.mw_post_visible(a.post_id)
  from public.mw_post_audience a where a.owner_id = p_owner order by a.updated_at desc limit 500
$$;
grant execute on function public.mw_owner_audiences(uuid) to anon, authenticated;

-- Extra photos, people tags and a place on a post.
create table if not exists public.mw_post_extras (
  post_id uuid primary key references public.mw_posts(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  location text not null default '' check (char_length(location) <= 120),
  tags jsonb not null default '[]'::jsonb,
  media jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.mw_post_extras enable row level security;
drop policy if exists mw_post_extras_read on public.mw_post_extras;
create policy mw_post_extras_read on public.mw_post_extras for select to anon, authenticated
  using (exists (select 1 from public.mw_posts p where p.id = mw_post_extras.post_id));
drop policy if exists mw_post_extras_insert on public.mw_post_extras;
create policy mw_post_extras_insert on public.mw_post_extras for insert to authenticated
  with check (owner_id = auth.uid() and exists (select 1 from public.mw_posts p where p.id = mw_post_extras.post_id and p.author_id::text = auth.uid()::text));
drop policy if exists mw_post_extras_update on public.mw_post_extras;
create policy mw_post_extras_update on public.mw_post_extras for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists mw_post_extras_delete on public.mw_post_extras;
create policy mw_post_extras_delete on public.mw_post_extras for delete to authenticated using (owner_id = auth.uid());
grant select on public.mw_post_extras to anon;
grant select, insert, update, delete on public.mw_post_extras to authenticated;

-- Replies, people tags and attachments on a comment.
create table if not exists public.mw_comment_extras (
  comment_id uuid primary key references public.mw_echoes(id) on delete cascade,
  post_id uuid not null references public.mw_posts(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  parent_id uuid references public.mw_echoes(id) on delete set null,
  tags jsonb not null default '[]'::jsonb,
  media jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
create index if not exists mw_comment_extras_post_idx on public.mw_comment_extras(post_id);
alter table public.mw_comment_extras enable row level security;
drop policy if exists mw_comment_extras_read on public.mw_comment_extras;
create policy mw_comment_extras_read on public.mw_comment_extras for select to anon, authenticated
  using (exists (select 1 from public.mw_posts p where p.id = mw_comment_extras.post_id));
drop policy if exists mw_comment_extras_insert on public.mw_comment_extras;
create policy mw_comment_extras_insert on public.mw_comment_extras for insert to authenticated
  with check (owner_id = auth.uid() and exists (select 1 from public.mw_echoes e where e.id = mw_comment_extras.comment_id and e.user_id::text = auth.uid()::text));
drop policy if exists mw_comment_extras_update on public.mw_comment_extras;
create policy mw_comment_extras_update on public.mw_comment_extras for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists mw_comment_extras_delete on public.mw_comment_extras;
create policy mw_comment_extras_delete on public.mw_comment_extras for delete to authenticated using (owner_id = auth.uid());
grant select on public.mw_comment_extras to anon;
grant select, insert, update, delete on public.mw_comment_extras to authenticated;

-- Reposts: a copy of the post in the reposter's feed, plus a pointer to the original.
create table if not exists public.mw_reposts (
  post_id uuid primary key references public.mw_posts(id) on delete cascade,
  original_post_id uuid not null references public.mw_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  original_author_id text,
  original_author_name text,
  created_at timestamptz not null default now(),
  unique (user_id, original_post_id)
);
alter table public.mw_reposts enable row level security;
drop policy if exists mw_reposts_read on public.mw_reposts;
create policy mw_reposts_read on public.mw_reposts for select to anon, authenticated
  using (exists (select 1 from public.mw_posts p where p.id = mw_reposts.post_id));
grant select on public.mw_reposts to anon, authenticated;

create or replace function public.mw_repost(p_post uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  src public.mw_posts%rowtype;
  link public.mw_reposts%rowtype;
  orig_id uuid; orig_author text; orig_name text; my_name text; nid uuid;
begin
  if me is null then raise exception 'Sign in first.' using errcode = '28000'; end if;
  select * into src from public.mw_posts where id = p_post;
  if not found or not public.mw_post_visible(src.id) then raise exception 'Post not found.' using errcode = '22023'; end if;
  if src.author_id::text = me::text then raise exception 'You cannot repost your own post.' using errcode = '22023'; end if;
  if exists (select 1 from public.mw_blocks b where (b.blocker_id = me and b.blocked_id::text = src.author_id::text) or (b.blocker_id::text = src.author_id::text and b.blocked_id = me)) then
    raise exception 'Not allowed.' using errcode = '42501';
  end if;
  select * into link from public.mw_reposts where post_id = src.id;
  if found then orig_id := link.original_post_id; orig_author := link.original_author_id; orig_name := link.original_author_name;
  else
    orig_id := src.id; orig_author := src.author_id::text;
    select coalesce(nullif(p.username, ''), p.display_name) into orig_name from public.mw_profiles p where p.id::text = src.author_id::text;
    orig_name := coalesce(orig_name, src.author_name);
  end if;
  if exists (select 1 from public.mw_reposts r where r.user_id = me and r.original_post_id = orig_id) then
    raise exception 'Already reposted.' using errcode = '23505';
  end if;
  select display_name into my_name from public.mw_profiles where id = me;
  insert into public.mw_posts(author_id, author_name, caption, media_url, media_type)
    values (me, coalesce(my_name, 'Msafiri'), src.caption, src.media_url, src.media_type) returning id into nid;
  insert into public.mw_reposts(post_id, original_post_id, user_id, original_author_id, original_author_name)
    values (nid, orig_id, me, orig_author, left(coalesce(orig_name, ''), 120));
  return nid;
end $$;
revoke all on function public.mw_repost(uuid) from public, anon;
grant execute on function public.mw_repost(uuid) to authenticated;

-- Documents (pdf, office files, text) attached to posts. The files themselves live in a private storage bucket.
create table if not exists public.mw_post_files (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 180),
  size bigint not null default 0 check (size >= 0),
  mime text not null default 'application/octet-stream',
  key text not null unique,
  created_at timestamptz not null default now()
);
create index if not exists mw_post_files_post_idx on public.mw_post_files(post_id);
create index if not exists mw_post_files_owner_idx on public.mw_post_files(owner_id, created_at desc);
alter table public.mw_post_files enable row level security;
drop policy if exists mw_post_files_read on public.mw_post_files;
create policy mw_post_files_read on public.mw_post_files for select to anon, authenticated
  using (owner_id = auth.uid() or exists (select 1 from public.mw_posts p where p.id = mw_post_files.post_id));
drop policy if exists mw_post_files_insert on public.mw_post_files;
create policy mw_post_files_insert on public.mw_post_files for insert to authenticated
  with check (owner_id = auth.uid() and key like auth.uid()::text || '/%');
drop policy if exists mw_post_files_delete on public.mw_post_files;
create policy mw_post_files_delete on public.mw_post_files for delete to authenticated using (owner_id = auth.uid());
grant select on public.mw_post_files to anon;
grant select, insert, delete on public.mw_post_files to authenticated;

insert into storage.buckets(id, name, public, file_size_limit)
values ('mw-documents', 'mw-documents', false, 20971520)
on conflict (id) do nothing;

drop policy if exists mw_documents_insert on storage.objects;
create policy mw_documents_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'mw-documents' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists mw_documents_select on storage.objects;
create policy mw_documents_select on storage.objects for select to anon, authenticated
  using (bucket_id = 'mw-documents' and exists (select 1 from public.mw_post_files f where f.key = objects.name));
drop policy if exists mw_documents_delete on storage.objects;
create policy mw_documents_delete on storage.objects for delete to authenticated
  using (bucket_id = 'mw-documents' and (storage.foldername(name))[1] = auth.uid()::text);
