-- Lets both people in a DM see deletes/inserts live.
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'mw_messages') then
    alter publication supabase_realtime add table public.mw_messages;
  end if;
end $$;
