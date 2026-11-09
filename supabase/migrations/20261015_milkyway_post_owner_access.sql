-- MilkyWay: owners always see their own posts; only owners can edit or delete them.
-- Run once in the Supabase dashboard → SQL Editor (project wpclkhgizbvxuvbhbwzs). Safe to run again.
begin;

-- Gallery self-view fix: mw_profile_posts_visible() needs a matching mw_profiles row, so an owner whose profile row was
-- missing, renamed or blocked by a stale check could not read their own posts. The author now always reads their own rows,
-- and everyone else still goes through the private-account / block rules.
drop policy if exists mw_posts_read on public.mw_posts;
create policy mw_posts_read on public.mw_posts for select to anon, authenticated
using ((auth.uid() is not null and author_id::text = auth.uid()::text) or public.mw_profile_posts_visible(author_id::text));

-- Edit: only the author, and only while the account is not banned or suspended.
drop policy if exists mw_posts_update on public.mw_posts;
create policy mw_posts_update on public.mw_posts for update to authenticated
using (author_id::text = auth.uid()::text and exists (
  select 1 from public.mw_profiles p where p.id::text = auth.uid()::text
    and not coalesce((to_jsonb(p)->>'is_banned')::boolean, false)
    and (to_jsonb(p)->>'suspended_until' is null or (to_jsonb(p)->>'suspended_until')::timestamptz <= now())))
with check (author_id::text = auth.uid()::text);

-- Delete: only the author.
drop policy if exists mw_posts_delete on public.mw_posts;
create policy mw_posts_delete on public.mw_posts for delete to authenticated
using (author_id::text = auth.uid()::text);

commit;
notify pgrst, 'reload schema';
