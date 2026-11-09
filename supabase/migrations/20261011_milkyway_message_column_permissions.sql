begin;
revoke update on public.mw_messages from anon, authenticated;
grant update (read_at) on public.mw_messages to authenticated;
drop policy if exists mw_messages_update_read on public.mw_messages;
create policy mw_messages_update_read on public.mw_messages
for update to authenticated
using (receiver_id = auth.uid())
with check (receiver_id = auth.uid());
notify pgrst, 'reload schema';
commit;
