-- MilkyWay Follow / Following: bind public.follows to the app's follow rows.
-- Follows are stored in public.mw_follows (follower_id, following_id). Where no table named follows exists, this adds
-- public.follows as a view over mw_follows, so .from('follows') reads, inserts and deletes the same rows. The view runs
-- with the caller's rights (security_invoker), so mw_follows' row level security still applies: anyone can read
-- follows, and a signed-in user can only add or remove their own follow, never follow themselves.
-- Inserts through the view still fire the follow notification trigger on mw_follows.
do $$
begin
  if to_regclass('public.follows') is null then
    create view public.follows with (security_invoker = true) as
      select * from public.mw_follows;
  end if;
end $$;

-- Where follows is its own table, give it the same rules as mw_follows.
do $$
begin
  if exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
             where n.nspname = 'public' and c.relname = 'follows' and c.relkind = 'r') then
    alter table public.follows enable row level security;
    drop policy if exists follows_read on public.follows;
    create policy follows_read on public.follows for select using (true);
    drop policy if exists follows_insert on public.follows;
    create policy follows_insert on public.follows for insert to authenticated
      with check (follower_id = auth.uid() and follower_id <> following_id);
    drop policy if exists follows_delete on public.follows;
    create policy follows_delete on public.follows for delete to authenticated using (follower_id = auth.uid());
  end if;
end $$;

grant select on public.follows to anon, authenticated;
grant insert, delete on public.follows to authenticated;

notify pgrst, 'reload schema';
