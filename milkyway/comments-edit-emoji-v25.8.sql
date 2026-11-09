-- MilkyWay V25.8: allow authenticated users to edit only their own comments (Echoes).
alter table public.mw_echoes enable row level security;
drop policy if exists mw_echoes_update on public.mw_echoes;
create policy mw_echoes_update on public.mw_echoes for update to authenticated
using (user_id = auth.uid()::text)
with check (user_id = auth.uid()::text);
