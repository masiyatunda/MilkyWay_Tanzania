-- MASIYATUNDA V14 BUSINESS PORTAL
create extension if not exists pgcrypto;

-- Admin gate. Add more admin emails here if needed.
create or replace function public.mw_is_admin() returns boolean
language sql stable security definer set search_path=public,auth
as $$ select coalesce((auth.jwt()->>'email') in ('masiyatunda@gmail.com'), false); $$;

-- Stage 2 security hardening: only signed-in users need the owner-check RPC.
REVOKE ALL ON FUNCTION public.mw_is_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mw_is_admin() FROM anon;
GRANT EXECUTE ON FUNCTION public.mw_is_admin() TO authenticated;

-- Customer profile
create table if not exists public.customer_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  company_name text,
  phone text,
  country text default 'Tanzania',
  city text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.customer_profiles enable row level security;
drop policy if exists customer_profiles_self on public.customer_profiles;
drop policy if exists customer_profiles_admin on public.customer_profiles;
create policy customer_profiles_self on public.customer_profiles for all to authenticated using (id=auth.uid()) with check (id=auth.uid());
create policy customer_profiles_admin on public.customer_profiles for all to authenticated using (public.mw_is_admin()) with check (public.mw_is_admin());

-- Link existing job requests to signed-in customers
alter table public.job_requests add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table public.job_requests add column if not exists priority text not null default 'normal';
alter table public.job_requests add column if not exists assigned_to text;
alter table public.job_requests add column if not exists internal_notes text;
create index if not exists idx_job_requests_user_id on public.job_requests(user_id);

-- Keep public request creation, but allow customer/admin views.
drop policy if exists job_requests_customer_select on public.job_requests;
drop policy if exists job_requests_admin_all on public.job_requests;
create policy job_requests_customer_select on public.job_requests for select to authenticated using (user_id=auth.uid() or public.mw_is_admin());
create policy job_requests_admin_all on public.job_requests for all to authenticated using (public.mw_is_admin()) with check (public.mw_is_admin());

-- Quotes
create table if not exists public.customer_quotes (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid references public.job_requests(id) on delete set null,
  quote_number text not null unique,
  status text not null default 'draft' check(status in ('draft','sent','accepted','declined','expired')),
  currency text not null default 'TZS',
  subtotal numeric(14,2) not null default 0,
  tax numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  valid_until date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.customer_quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.customer_quotes(id) on delete cascade,
  description text not null,
  quantity numeric(12,2) not null default 1,
  unit_price numeric(14,2) not null default 0,
  amount numeric(14,2) generated always as (quantity * unit_price) stored
);
alter table public.customer_quotes enable row level security;
alter table public.customer_quote_items enable row level security;
drop policy if exists quotes_customer_select on public.customer_quotes;
drop policy if exists quotes_admin_all on public.customer_quotes;
drop policy if exists quote_items_customer_select on public.customer_quote_items;
drop policy if exists quote_items_admin_all on public.customer_quote_items;
create policy quotes_customer_select on public.customer_quotes for select to authenticated using (customer_id=auth.uid() or public.mw_is_admin());
create policy quotes_admin_all on public.customer_quotes for all to authenticated using (public.mw_is_admin()) with check (public.mw_is_admin());
create policy quote_items_customer_select on public.customer_quote_items for select to authenticated using (exists(select 1 from public.customer_quotes q where q.id=quote_id and (q.customer_id=auth.uid() or public.mw_is_admin())));
create policy quote_items_admin_all on public.customer_quote_items for all to authenticated using (public.mw_is_admin()) with check (public.mw_is_admin());
create index if not exists idx_quotes_customer on public.customer_quotes(customer_id,created_at desc);
create index if not exists idx_quote_items_quote on public.customer_quote_items(quote_id);

-- Project progress visible to the customer
create table if not exists public.project_updates (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.job_requests(id) on delete cascade,
  status text not null,
  title text not null,
  description text,
  progress integer not null default 0 check(progress between 0 and 100),
  created_at timestamptz not null default now()
);
alter table public.project_updates enable row level security;
drop policy if exists project_updates_customer_select on public.project_updates;
drop policy if exists project_updates_admin_all on public.project_updates;
create policy project_updates_customer_select on public.project_updates for select to authenticated using (exists(select 1 from public.job_requests r where r.id=request_id and (r.user_id=auth.uid() or public.mw_is_admin())));
create policy project_updates_admin_all on public.project_updates for all to authenticated using (public.mw_is_admin()) with check (public.mw_is_admin());
create index if not exists idx_project_updates_request on public.project_updates(request_id,created_at desc);

-- Customer documents
create table if not exists public.customer_documents (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid references public.job_requests(id) on delete set null,
  title text not null,
  document_url text not null,
  document_type text default 'document',
  created_at timestamptz not null default now()
);
alter table public.customer_documents enable row level security;
drop policy if exists documents_customer_select on public.customer_documents;
drop policy if exists documents_admin_all on public.customer_documents;
create policy documents_customer_select on public.customer_documents for select to authenticated using (customer_id=auth.uid() or public.mw_is_admin());
create policy documents_admin_all on public.customer_documents for all to authenticated using (public.mw_is_admin()) with check (public.mw_is_admin());

-- Customer portal messages, separate from public Sanaa/general chat.
create table if not exists public.customer_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null,
  customer_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid references public.job_requests(id) on delete set null,
  message text not null check(char_length(message) between 1 and 4000),
  is_from_admin boolean not null default false,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.customer_messages enable row level security;
drop policy if exists customer_messages_self on public.customer_messages;
drop policy if exists customer_messages_admin on public.customer_messages;
create policy customer_messages_self on public.customer_messages for all to authenticated using (customer_id=auth.uid()) with check (customer_id=auth.uid() and is_from_admin=false);
create policy customer_messages_admin on public.customer_messages for all to authenticated using (public.mw_is_admin()) with check (public.mw_is_admin());
create index if not exists idx_customer_messages_thread on public.customer_messages(thread_id,created_at);

-- Notifications
create table if not exists public.customer_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null default 'general',
  title text not null,
  body text,
  link text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.customer_notifications enable row level security;
drop policy if exists customer_notifications_self on public.customer_notifications;
drop policy if exists customer_notifications_admin on public.customer_notifications;
create policy customer_notifications_self on public.customer_notifications for select to authenticated using (user_id=auth.uid());
create policy customer_notifications_update on public.customer_notifications for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy customer_notifications_admin on public.customer_notifications for all to authenticated using (public.mw_is_admin()) with check (public.mw_is_admin());
create index if not exists idx_customer_notifications_user on public.customer_notifications(user_id,created_at desc);

-- Careers
create table if not exists public.careers (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  department text,
  location text,
  employment_type text default 'Full-time',
  description text,
  requirements text,
  closing_date date,
  published boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.job_applications (
  id uuid primary key default gen_random_uuid(),
  career_id uuid not null references public.careers(id) on delete cascade,
  applicant_id uuid references auth.users(id) on delete set null,
  full_name text not null,
  email text not null,
  phone text,
  cover_note text,
  cv_url text,
  status text not null default 'new',
  created_at timestamptz not null default now()
);
alter table public.careers enable row level security;
alter table public.job_applications enable row level security;
drop policy if exists careers_public_read on public.careers;
drop policy if exists careers_admin_all on public.careers;
drop policy if exists applications_self_insert on public.job_applications;
drop policy if exists applications_admin_all on public.job_applications;
create policy careers_public_read on public.careers for select to anon,authenticated using (published=true);
create policy careers_admin_all on public.careers for all to authenticated using (public.mw_is_admin()) with check (public.mw_is_admin());
create policy applications_self_insert on public.job_applications for insert to anon,authenticated with check (true);
create policy applications_admin_all on public.job_applications for all to authenticated using (public.mw_is_admin()) with check (public.mw_is_admin());

-- Useful indexes
create index if not exists idx_job_requests_status on public.job_requests(status,created_at desc);
create index if not exists idx_job_requests_email on public.job_requests(email);

notify pgrst,'reload schema';
