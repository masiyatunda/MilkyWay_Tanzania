
-- MilkyWay direct messages. Run after platform.sql
create table if not exists public.mw_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  receiver_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now(),
  check (sender_id <> receiver_id)
);

alter table public.mw_messages enable row level security;

drop policy if exists mw_messages_read on public.mw_messages;
create policy mw_messages_read on public.mw_messages
for select to authenticated
using (sender_id = auth.uid() or receiver_id = auth.uid());

drop policy if exists mw_messages_send on public.mw_messages;
create policy mw_messages_send on public.mw_messages
for insert to authenticated
with check (sender_id = auth.uid());

grant select, insert on public.mw_messages to authenticated;
notify pgrst, 'reload schema';
