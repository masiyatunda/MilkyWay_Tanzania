-- MilkyWay V15: End-to-End Encrypted Messaging
-- Client-side encryption: ECDH P-256 + HKDF-SHA256 + AES-256-GCM.
-- Supabase stores public identity keys + ciphertext only.

create table if not exists public.mw_e2e_keys (
  user_id uuid primary key references auth.users(id) on delete cascade,
  public_jwk jsonb not null,
  key_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.mw_e2e_keys enable row level security;
drop policy if exists mw_e2e_keys_read on public.mw_e2e_keys;
create policy mw_e2e_keys_read on public.mw_e2e_keys for select to authenticated using (true);
drop policy if exists mw_e2e_keys_insert on public.mw_e2e_keys;
create policy mw_e2e_keys_insert on public.mw_e2e_keys for insert to authenticated with check (user_id = auth.uid());
drop policy if exists mw_e2e_keys_update on public.mw_e2e_keys;
create policy mw_e2e_keys_update on public.mw_e2e_keys for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update on public.mw_e2e_keys to authenticated;

alter table public.mw_messages add column if not exists encryption_version integer not null default 0;

-- Encrypted envelopes are larger than plaintext; expand the legacy 1..1000 body constraint.
alter table public.mw_messages drop constraint if exists mw_messages_body_check;
alter table public.mw_messages add constraint mw_messages_body_check check (char_length(body) between 1 and 12000);
create index if not exists mw_messages_e2e_idx on public.mw_messages(receiver_id,encryption_version,created_at desc);

-- New E2E messages must use encryption_version=1. Legacy rows remain readable only to the existing RLS participants.
drop policy if exists mw_messages_send on public.mw_messages;
create policy mw_messages_send on public.mw_messages for insert to authenticated
with check (sender_id = auth.uid() and (encryption_version = 1 or encryption_version is null));

grant select, insert, update on public.mw_messages to authenticated;
notify pgrst, 'reload schema';
