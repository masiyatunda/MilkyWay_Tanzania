begin;
grant delete on public.mw_messages to authenticated;
drop policy if exists mw_messages_delete_sender on public.mw_messages;
create policy mw_messages_delete_sender on public.mw_messages
for delete to authenticated using (sender_id = auth.uid());
commit;
notify pgrst, 'reload schema';
