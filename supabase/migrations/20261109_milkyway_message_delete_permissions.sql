-- Keep direct and group message deletion available only to the message sender.
begin;

alter table public.mw_messages enable row level security;
alter table public.mw_dm_group_messages enable row level security;

grant delete on public.mw_messages, public.mw_dm_group_messages to authenticated;

drop policy if exists mw_messages_delete_sender on public.mw_messages;
create policy mw_messages_delete_sender on public.mw_messages
for delete to authenticated using (sender_id = auth.uid());

drop policy if exists mw_dm_group_messages_delete on public.mw_dm_group_messages;
create policy mw_dm_group_messages_delete on public.mw_dm_group_messages
for delete to authenticated using (sender_id = auth.uid());

commit;
notify pgrst, 'reload schema';
