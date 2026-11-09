-- MilkyWay Coins wallet. Idempotent. Every mutation happens inside SECURITY DEFINER functions that check auth.uid(),
-- lock the rows involved and rely on CHECK constraints, so balances can never go negative or be spent twice.
-- Clients have SELECT-only access to their own rows; no direct insert/update/delete is granted.
-- Amounts are numeric(18,2) because gifts start at 0.1 coin and the creator share is net of the platform cut.
-- Requires public.mw_is_admin() from 20261012_milkyway_admin_access.sql.
begin;

create table if not exists public.mw_wallet_settings (
  id smallint primary key default 1 check (id = 1),
  payment_instructions text not null default '',
  lipa_number text not null default '',
  lipa_name text not null default '',
  lipa_network text not null default '',
  lipa_qr text not null default '' check (lipa_qr = '' or lipa_qr ~* '^https://'),
  coin_tzs integer not null default 1000 check (coin_tzs > 0),
  min_withdraw_coins numeric(18,2) not null default 50 check (min_withdraw_coins > 0),
  platform_cut_pct numeric(5,2) not null default 40 check (platform_cut_pct >= 0 and platform_cut_pct <= 90),
  updated_at timestamptz not null default now()
);
insert into public.mw_wallet_settings (id) values (1) on conflict (id) do nothing;

create table if not exists public.mw_wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  coins numeric(18,2) not null default 0 check (coins >= 0),
  earned numeric(18,2) not null default 0 check (earned >= 0),
  lifetime_earned numeric(18,2) not null default 0 check (lifetime_earned >= 0),
  country text check (country is null or country ~ '^[A-Z]{2}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mw_wallet_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('topup', 'gift_sent', 'gift_received', 'withdraw_reserve', 'withdraw_refund')),
  coins_delta numeric(18,2) not null default 0,
  earned_delta numeric(18,2) not null default 0,
  coins_after numeric(18,2) not null check (coins_after >= 0),
  earned_after numeric(18,2) not null check (earned_after >= 0),
  ref_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists mw_wallet_ledger_user_idx on public.mw_wallet_ledger (user_id, created_at desc);

create table if not exists public.mw_gift_catalog (
  gift_key text primary key,
  coins numeric(10,2) not null check (coins > 0),
  sort integer not null default 0,
  active boolean not null default true
);

create table if not exists public.mw_gift_events (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  receiver_id uuid not null references auth.users(id) on delete cascade,
  gift_key text not null references public.mw_gift_catalog(gift_key),
  coins numeric(18,2) not null check (coins > 0),
  earned numeric(18,2) not null check (earned >= 0),
  cut_pct numeric(5,2) not null,
  target text not null check (target in ('live', 'post', 'story')),
  room_name text,
  post_id uuid,
  story_id uuid,
  created_at timestamptz not null default now(),
  check (sender_id <> receiver_id)
);
create index if not exists mw_gift_events_sender_idx on public.mw_gift_events (sender_id, created_at desc);
create index if not exists mw_gift_events_receiver_idx on public.mw_gift_events (receiver_id, created_at desc);

create table if not exists public.mw_wallet_topups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount_tzs bigint not null check (amount_tzs between 100 and 1000000 and amount_tzs % 100 = 0),
  coins numeric(18,2) not null check (coins > 0),
  network text not null check (network in ('mpesa', 'mixx', 'airtel', 'halopesa')),
  phone text not null,
  reference text not null check (char_length(reference) between 4 and 40),
  currency text,
  local_minor bigint,
  local_digits integer,
  status text not null default 'pending' check (status in ('pending', 'approved', 'redeemed', 'rejected')),
  admin_note text,
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists mw_wallet_topups_reference_key on public.mw_wallet_topups (upper(reference));
create index if not exists mw_wallet_topups_user_idx on public.mw_wallet_topups (user_id, created_at desc);
create index if not exists mw_wallet_topups_status_idx on public.mw_wallet_topups (status, created_at desc);

create table if not exists public.mw_wallet_topup_codes (
  id uuid primary key default gen_random_uuid(),
  topup_id uuid not null unique references public.mw_wallet_topups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  code_hash text not null unique,
  code_plain text,
  coins numeric(18,2) not null check (coins > 0),
  redeemed_by uuid references auth.users(id),
  redeemed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.mw_wallet_withdrawals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  coins numeric(18,2) not null check (coins > 0),
  payout_tzs bigint not null check (payout_tzs > 0),
  cut_pct numeric(5,2) not null,
  network text not null check (network in ('mpesa', 'mixx', 'airtel', 'halopesa')),
  phone text not null,
  account_name text not null check (char_length(account_name) between 2 and 80),
  currency text,
  local_minor bigint,
  local_digits integer,
  status text not null default 'pending' check (status in ('pending', 'paid', 'rejected')),
  payout_ref text,
  admin_note text,
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists mw_wallet_withdrawals_user_idx on public.mw_wallet_withdrawals (user_id, created_at desc);
create index if not exists mw_wallet_withdrawals_status_idx on public.mw_wallet_withdrawals (status, created_at desc);
create unique index if not exists mw_wallet_withdrawals_one_pending on public.mw_wallet_withdrawals (user_id) where status = 'pending';

-- The ledger is append-only.
create or replace function public.mw_wallet_guard_ledger()
returns trigger language plpgsql set search_path = public as $$
begin
  raise exception 'The wallet ledger is append-only.';
end;
$$;
drop trigger if exists mw_wallet_ledger_append_only on public.mw_wallet_ledger;
create trigger mw_wallet_ledger_append_only
before update or delete on public.mw_wallet_ledger
for each row execute function public.mw_wallet_guard_ledger();

-- Gift catalogue: keys and prices match milkyway/gift-catalog.js (1 coin = TZS 1,000 by default).
insert into public.mw_gift_catalog (gift_key, coins, sort)
select v.k, v.c::numeric, row_number() over (order by v.c::numeric, v.k)::integer
from (values
  ('maua','0.1'),('tausi','0.2'),('kahawa','0.3'),('chai','0.4'),('embe','0.5'),('nazi','0.6'),('moyo','0.7'),('nyota','0.8'),('maputo','0.9'),('keki','1'),
  ('ngoma','1.2'),('shanga','1.4'),('kinyago','1.5'),('zeze','1.6'),('kipaza-sauti','1.8'),('gitaa','2'),('jahazi','2.2'),('tingatinga','2.5'),('kombe','2.8'),('kilimanjaro','3'),
  ('kipepeo','3.2'),('kasuku','3.5'),('kobe','3.8'),('heroe','4'),('tumbili','4.5'),('pundamilia','5'),('twiga','5.5'),('pomboo','6'),('mamba','6.5'),('kiboko','7'),
  ('nyati','7.5'),('nyangumi','8'),('tai','8.5'),('kifaru','9'),('sokwe-mtu','9.5'),('chui','10'),('simba','11'),('tembo','12'),('dainaso-rex','13.5'),('dainaso','15'),
  ('vipokea-sauti','16'),('spika','17'),('simu-ya-mkononi','18'),('kamera','19'),('kidhibiti-mchezo','20'),('simu-janja','21'),('kompyuta-mpakato','22'),('televisheni','23'),('kompyuta','24'),('simu-ya-dhahabu','25'),
  ('roboti','26'),('miwani-janja','27'),('setilaiti','28'),('darubini','29'),('akili-bandia','30'),('miwani-ya-jua','32'),('manukato','34'),('saa-ya-dhahabu','35'),('viatu','36'),('mkoba','38'),
  ('pete-ya-almasi','40'),('almasi','42'),('kitita-cha-pesa','44'),('pikipiki','45'),('gari-la-safari','46'),('gari-la-kifahari','48'),('gari-la-umeme','50'),('gari-la-mashindano','52'),('gari-la-dhahabu','54'),('limozini','55'),
  ('helikopta','56'),('boti-ya-kifahari','58'),('jumba-la-kifahari','60'),('ndege-binafsi','65'),('kisiwa-binafsi','70'),('vumbi-la-nyota','72'),('nyota-inayoanguka','74'),('mwezi-mchanga','75'),('nyota-angavu','76'),('kimondo','78'),
  ('dunia','80'),('mwanaanga','81'),('roketi','82'),('kiumbe-wa-anga','83'),('chombo-cha-anga','84'),('sayari','85'),('mwezi','86'),('jua','87'),('farasi-wa-nyota','88'),('ngao-ya-galaxy','89'),
  ('joka-la-anga','90'),('wingu-la-nyota','91'),('shimo-jeusi','92'),('jiwe-la-nyota','93'),('kasri-la-nyota','94'),('fataki-za-galaksi','95'),('galaksi','96'),('moyo-wa-galaksi','97'),('kito-cha-galaksi','98'),('taji-ya-milkyway','100')
) as v(k, c)
on conflict (gift_key) do nothing;

-- Row level security: members can read their own rows and nothing else; nothing is writable directly.
alter table public.mw_wallet_settings enable row level security;
alter table public.mw_wallets enable row level security;
alter table public.mw_wallet_ledger enable row level security;
alter table public.mw_gift_catalog enable row level security;
alter table public.mw_gift_events enable row level security;
alter table public.mw_wallet_topups enable row level security;
alter table public.mw_wallet_topup_codes enable row level security;
alter table public.mw_wallet_withdrawals enable row level security;

drop policy if exists mw_wallet_settings_read on public.mw_wallet_settings;
create policy mw_wallet_settings_read on public.mw_wallet_settings for select to authenticated using (true);
drop policy if exists mw_gift_catalog_read on public.mw_gift_catalog;
create policy mw_gift_catalog_read on public.mw_gift_catalog for select to authenticated using (true);
drop policy if exists mw_wallets_own on public.mw_wallets;
create policy mw_wallets_own on public.mw_wallets for select to authenticated using (user_id = auth.uid());
drop policy if exists mw_wallet_ledger_own on public.mw_wallet_ledger;
create policy mw_wallet_ledger_own on public.mw_wallet_ledger for select to authenticated using (user_id = auth.uid());
drop policy if exists mw_gift_events_own on public.mw_gift_events;
create policy mw_gift_events_own on public.mw_gift_events for select to authenticated using (sender_id = auth.uid() or receiver_id = auth.uid());
drop policy if exists mw_wallet_topups_own on public.mw_wallet_topups;
create policy mw_wallet_topups_own on public.mw_wallet_topups for select to authenticated using (user_id = auth.uid());
drop policy if exists mw_wallet_withdrawals_own on public.mw_wallet_withdrawals;
create policy mw_wallet_withdrawals_own on public.mw_wallet_withdrawals for select to authenticated using (user_id = auth.uid());
-- mw_wallet_topup_codes deliberately has no policy: only the admin functions read it.

revoke all on public.mw_wallet_settings, public.mw_wallets, public.mw_wallet_ledger, public.mw_gift_catalog,
  public.mw_gift_events, public.mw_wallet_topups, public.mw_wallet_topup_codes, public.mw_wallet_withdrawals
  from public, anon, authenticated;
grant select on public.mw_wallet_settings, public.mw_wallets, public.mw_wallet_ledger, public.mw_gift_catalog,
  public.mw_gift_events, public.mw_wallet_topups, public.mw_wallet_withdrawals to authenticated;

-- ---------------------------------------------------------------- internal helpers
create or replace function public.mw_wallet_uid()
returns uuid language plpgsql stable security definer set search_path = public as $$
declare u uuid := auth.uid();
begin
  if u is null then raise exception 'Sign in first.' using errcode = '28000'; end if;
  return u;
end;
$$;

create or replace function public.mw_wallet_require_admin()
returns uuid language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.mw_is_admin() then
    raise exception 'Not allowed.' using errcode = '42501';
  end if;
  return auth.uid();
end;
$$;

create or replace function public.mw_wallet_clean_phone(p text)
returns text language plpgsql immutable set search_path = public as $$
declare d text := regexp_replace(coalesce(p, ''), '\D', '', 'g');
begin
  if d ~ '^0\d{9}$' then d := '255' || substr(d, 2); end if;
  if d !~ '^\d{9,15}$' then raise exception 'Enter a valid phone number.'; end if;
  return d;
end;
$$;

-- Single place that changes balances: updates the (row-locked) wallet and appends the ledger line.
create or replace function public.mw_wallet_apply(p_user uuid, p_coins numeric, p_earned numeric, p_lifetime numeric, p_kind text, p_ref uuid)
returns public.mw_wallets language plpgsql security definer set search_path = public as $$
declare w public.mw_wallets;
begin
  insert into public.mw_wallets (user_id) values (p_user) on conflict (user_id) do nothing;
  update public.mw_wallets
     set coins = coins + p_coins, earned = earned + p_earned, lifetime_earned = lifetime_earned + p_lifetime, updated_at = now()
   where user_id = p_user
   returning * into w;
  insert into public.mw_wallet_ledger (user_id, kind, coins_delta, earned_delta, coins_after, earned_after, ref_id)
  values (p_user, p_kind, p_coins, p_earned, w.coins, w.earned, p_ref);
  return w;
end;
$$;

-- ---------------------------------------------------------------- member functions
-- Spendable coins (whole coins) for the signed-in member. Used by /api/milkyway-account?action=balance.
create or replace function public.mw_wallet_coins()
returns bigint language sql stable security definer set search_path = public as $$
  select coalesce((select floor(coins)::bigint from public.mw_wallets where user_id = auth.uid()), 0);
$$;

create or replace function public.mw_wallet_catalog()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare s public.mw_wallet_settings;
begin
  select * into s from public.mw_wallet_settings where id = 1;
  return jsonb_build_object(
    'paymentInstructions', s.payment_instructions,
    'lipa', jsonb_build_object('number', s.lipa_number, 'name', s.lipa_name, 'network', s.lipa_network, 'qr', s.lipa_qr),
    'minWithdrawCoins', s.min_withdraw_coins,
    'coinTzs', s.coin_tzs,
    'platformCutPct', s.platform_cut_pct,
    'gifts', (select coalesce(jsonb_object_agg(gift_key, coins), '{}'::jsonb) from public.mw_gift_catalog where active)
  );
end;
$$;

create or replace function public.mw_wallet_set_country(p_country text)
returns text language plpgsql security definer set search_path = public as $$
declare u uuid := public.mw_wallet_uid(); c text := upper(nullif(trim(coalesce(p_country, '')), '')); r text;
begin
  insert into public.mw_wallets (user_id) values (u) on conflict (user_id) do nothing;
  if c is not null and c ~ '^[A-Z]{2}$' then
    update public.mw_wallets set country = c, updated_at = now() where user_id = u and country is null;
  end if;
  select country into r from public.mw_wallets where user_id = u;
  return r;
end;
$$;

create or replace function public.mw_wallet_overview()
returns jsonb language plpgsql security definer set search_path = public as $$
declare u uuid := public.mw_wallet_uid(); w public.mw_wallets; s public.mw_wallet_settings;
begin
  select * into s from public.mw_wallet_settings where id = 1;
  select * into w from public.mw_wallets where user_id = u;
  return jsonb_build_object(
    'coins', coalesce(w.coins, 0),
    'earned', coalesce(w.earned, 0),
    'lifetimeEarned', coalesce(w.lifetime_earned, 0),
    'country', w.country,
    'minWithdrawCoins', s.min_withdraw_coins,
    'coinTzs', s.coin_tzs,
    'platformCutPct', s.platform_cut_pct,
    'gifts', (select coalesce(jsonb_object_agg(gift_key, coins), '{}'::jsonb) from public.mw_gift_catalog where active),
    'topups', (select coalesce(jsonb_agg(to_jsonb(x) order by x.at desc), '[]'::jsonb) from (
      select t.id, t.created_at as at, t.coins, t.amount_tzs as "amountTzs", t.network, t.status, t.admin_note as note
      from public.mw_wallet_topups t where t.user_id = u order by t.created_at desc limit 30) x),
    'withdrawals', (select coalesce(jsonb_agg(to_jsonb(x) order by x.at desc), '[]'::jsonb) from (
      select d.id, d.created_at as at, d.coins, d.network, d.status, d.payout_tzs as "payoutTzs", d.local_minor as "payoutLocalMinor",
             d.currency, d.local_digits as "localDigits", coalesce(d.admin_note, d.payout_ref) as note
      from public.mw_wallet_withdrawals d where d.user_id = u order by d.created_at desc limit 30) x),
    'received', (select coalesce(jsonb_agg(to_jsonb(x) order by x.at desc), '[]'::jsonb) from (
      select g.gift_key as gift, g.created_at as at, g.earned, g.target,
             coalesce(nullif(to_jsonb(p)->>'display_name', ''), 'Msafiri') as "from"
      from public.mw_gift_events g left join public.mw_profiles p on p.id = g.sender_id
      where g.receiver_id = u order by g.created_at desc limit 30) x)
  );
end;
$$;

create or replace function public.mw_wallet_send_gift(p_gift text, p_room text default null, p_post uuid default null, p_story uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  u uuid := public.mw_wallet_uid();
  gkey text := case when p_gift = 'taji-ya-masiyatunda' then 'taji-ya-milkyway' else p_gift end;
  price numeric; cut numeric; net numeric;
  receiver uuid; target text; raw text;
  sender_w public.mw_wallets; id uuid := gen_random_uuid();
begin
  if (case when nullif(p_room, '') is null then 0 else 1 end) + (case when p_post is null then 0 else 1 end) + (case when p_story is null then 0 else 1 end) <> 1 then
    raise exception 'Choose one place to send the gift.';
  end if;
  select coins into price from public.mw_gift_catalog where gift_key = gkey and active;
  if price is null then raise exception 'Unknown gift.'; end if;
  select platform_cut_pct into cut from public.mw_wallet_settings where id = 1;

  if nullif(p_room, '') is not null then
    target := 'live';
    select host_id into receiver from public.mw_video_live_sessions where room_name = p_room;
  elsif p_post is not null then
    target := 'post';
    select author_id::text into raw from public.mw_posts where id = p_post;
    if raw ~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' then receiver := raw::uuid; end if;
  else
    target := 'story';
    select user_id into receiver from public.mw_stories where id = p_story;
  end if;
  if receiver is null then raise exception 'Gift target not found.'; end if;
  if receiver = u then raise exception 'You cannot send a gift to yourself.'; end if;

  -- Both wallets are locked in a fixed order so concurrent gifts cannot deadlock or double-spend.
  insert into public.mw_wallets (user_id) values (u), (receiver) on conflict (user_id) do nothing;
  perform 1 from public.mw_wallets where user_id in (u, receiver) order by user_id for update;
  select * into sender_w from public.mw_wallets where user_id = u;
  if sender_w.coins < price then raise exception 'Not enough coins.'; end if;

  net := round(price * (100 - cut) / 100, 2);
  insert into public.mw_gift_events (id, sender_id, receiver_id, gift_key, coins, earned, cut_pct, target, room_name, post_id, story_id)
  values (id, u, receiver, gkey, price, net, cut, target,
          case when target = 'live' then p_room end, case when target = 'post' then p_post end, case when target = 'story' then p_story end);
  sender_w := public.mw_wallet_apply(u, -price, 0, 0, 'gift_sent', id);
  perform public.mw_wallet_apply(receiver, 0, net, net, 'gift_received', id);
  return jsonb_build_object('ok', true, 'coins', sender_w.coins, 'earned', sender_w.earned, 'gift', gkey);
end;
$$;

create or replace function public.mw_wallet_request_topup(
  p_amount_tzs bigint, p_network text, p_phone text, p_reference text,
  p_currency text default null, p_tzs_per_unit numeric default null, p_digits integer default 2)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  u uuid := public.mw_wallet_uid(); s public.mw_wallet_settings;
  ref text := upper(trim(coalesce(p_reference, ''))); phone text; coins_out numeric; loc_minor bigint; new_id uuid;
begin
  if p_amount_tzs is null or p_amount_tzs < 100 or p_amount_tzs > 1000000 or p_amount_tzs % 100 <> 0 then
    raise exception 'Enter a TZS amount from 100 to 1,000,000 in steps of 100.';
  end if;
  if p_network is null or p_network not in ('mpesa', 'mixx', 'airtel', 'halopesa') then raise exception 'Choose a mobile money network.'; end if;
  if char_length(ref) < 4 or char_length(ref) > 40 then raise exception 'Enter the payment reference from your payment message.'; end if;
  phone := public.mw_wallet_clean_phone(p_phone);
  if (select count(*) from public.mw_wallet_topups where user_id = u and status = 'pending') >= 5 then
    raise exception 'You already have several payments waiting for confirmation.';
  end if;
  select * into s from public.mw_wallet_settings where id = 1;
  coins_out := round(p_amount_tzs::numeric / s.coin_tzs, 2);
  if coins_out <= 0 then raise exception 'Amount too small.'; end if;
  if p_currency is not null and p_tzs_per_unit is not null and p_tzs_per_unit > 0 and p_digits between 0 and 4 then
    loc_minor := round(p_amount_tzs / p_tzs_per_unit * power(10, p_digits))::bigint;
  end if;
  begin
    insert into public.mw_wallet_topups (user_id, amount_tzs, coins, network, phone, reference, currency, local_minor, local_digits)
    values (u, p_amount_tzs, coins_out, p_network, phone, ref, case when loc_minor is null then null else p_currency end, loc_minor, case when loc_minor is null then null else p_digits end)
    returning id into new_id;
  exception when unique_violation then
    raise exception 'This payment reference was already submitted.';
  end;
  return jsonb_build_object('ok', true, 'id', new_id, 'coins', coins_out);
end;
$$;

create or replace function public.mw_wallet_redeem_code(p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  u uuid := public.mw_wallet_uid();
  norm text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  c public.mw_wallet_topup_codes; w public.mw_wallets;
begin
  if char_length(norm) < 8 then raise exception 'Invalid or already used code.'; end if;
  select * into c from public.mw_wallet_topup_codes
   where code_hash = encode(sha256(convert_to(norm, 'utf8')), 'hex') for update;
  if not found or c.redeemed_by is not null or c.user_id <> u then raise exception 'Invalid or already used code.'; end if;
  perform 1 from public.mw_wallet_topups where id = c.topup_id and status = 'approved' for update;
  if not found then raise exception 'Invalid or already used code.'; end if;
  update public.mw_wallet_topup_codes set redeemed_by = u, redeemed_at = now(), code_plain = null where id = c.id;
  update public.mw_wallet_topups set status = 'redeemed' where id = c.topup_id;
  insert into public.mw_wallets (user_id) values (u) on conflict (user_id) do nothing;
  perform 1 from public.mw_wallets where user_id = u for update;
  w := public.mw_wallet_apply(u, c.coins, 0, 0, 'topup', c.topup_id);
  return jsonb_build_object('ok', true, 'coins', w.coins, 'added', c.coins, 'message', 'Imekubaliwa. ' || c.coins::text || ' coins added. / ' || c.coins::text || ' coins added to your wallet.');
end;
$$;

create or replace function public.mw_wallet_request_withdrawal(
  p_coins numeric, p_network text, p_phone text, p_name text,
  p_currency text default null, p_tzs_per_unit numeric default null, p_digits integer default 2)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  u uuid := public.mw_wallet_uid(); s public.mw_wallet_settings; w public.mw_wallets;
  nm text := trim(coalesce(p_name, '')); phone text; payout bigint; loc_minor bigint; new_id uuid;
begin
  if p_coins is null or p_coins <= 0 or round(p_coins, 2) <> p_coins then raise exception 'Enter a valid number of coins.'; end if;
  if p_network is null or p_network not in ('mpesa', 'mixx', 'airtel', 'halopesa') then raise exception 'Choose a mobile money network.'; end if;
  if char_length(nm) < 2 or char_length(nm) > 80 then raise exception 'Enter the name on the mobile money account.'; end if;
  phone := public.mw_wallet_clean_phone(p_phone);
  select * into s from public.mw_wallet_settings where id = 1;
  if p_coins < s.min_withdraw_coins then raise exception 'The minimum withdrawal is % coins.', s.min_withdraw_coins::text; end if;
  insert into public.mw_wallets (user_id) values (u) on conflict (user_id) do nothing;
  select * into w from public.mw_wallets where user_id = u for update;
  if exists (select 1 from public.mw_wallet_withdrawals where user_id = u and status = 'pending') then
    raise exception 'You already have a withdrawal waiting to be paid.';
  end if;
  if w.earned < p_coins then raise exception 'You can only withdraw coins you earned from gifts.'; end if;
  payout := round(p_coins * s.coin_tzs)::bigint;
  if payout <= 0 then raise exception 'Amount too small.'; end if;
  if p_currency is not null and p_tzs_per_unit is not null and p_tzs_per_unit > 0 and p_digits between 0 and 4 then
    loc_minor := round(payout / p_tzs_per_unit * power(10, p_digits))::bigint;
  end if;
  insert into public.mw_wallet_withdrawals (user_id, coins, payout_tzs, cut_pct, network, phone, account_name, currency, local_minor, local_digits)
  values (u, p_coins, payout, s.platform_cut_pct, p_network, phone, nm, case when loc_minor is null then null else p_currency end, loc_minor, case when loc_minor is null then null else p_digits end)
  returning id into new_id;
  w := public.mw_wallet_apply(u, 0, -p_coins, 0, 'withdraw_reserve', new_id);
  return jsonb_build_object('ok', true, 'id', new_id, 'earned', w.earned, 'payoutTzs', payout);
end;
$$;

-- ---------------------------------------------------------------- admin functions
create or replace function public.mw_wallet_admin_summary()
returns jsonb language plpgsql security definer set search_path = public as $$
declare s public.mw_wallet_settings;
begin
  perform public.mw_wallet_require_admin();
  select * into s from public.mw_wallet_settings where id = 1;
  return jsonb_build_object(
    'gifts', (select count(*) from public.mw_gift_events),
    'giftsGrossTzs', (select round(coalesce(sum(coins), 0) * s.coin_tzs) from public.mw_gift_events),
    'commissionTzs', (select round(coalesce(sum(coins - earned), 0) * s.coin_tzs) from public.mw_gift_events),
    'creatorsOwedTzs', (select round((coalesce((select sum(earned) from public.mw_wallets), 0)
                          + coalesce((select sum(coins) from public.mw_wallet_withdrawals where status = 'pending'), 0)) * s.coin_tzs)),
    'companyWalletTzs', (select round(coalesce(sum(coins - earned), 0) * s.coin_tzs) from public.mw_gift_events),
    'paidOutTzs', (select coalesce(sum(payout_tzs), 0) from public.mw_wallet_withdrawals where status = 'paid'),
    'pendingWithdrawals', (select count(*) from public.mw_wallet_withdrawals where status = 'pending'),
    'pendingTopups', (select count(*) from public.mw_wallet_topups where status = 'pending'),
    'paymentInstructions', s.payment_instructions,
    'lipa', jsonb_build_object('number', s.lipa_number, 'name', s.lipa_name, 'network', s.lipa_network, 'qr', s.lipa_qr),
    'coinTzs', s.coin_tzs, 'minWithdrawCoins', s.min_withdraw_coins, 'platformCutPct', s.platform_cut_pct
  );
end;
$$;

create or replace function public.mw_wallet_admin_withdrawals(p_status text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform public.mw_wallet_require_admin();
  return jsonb_build_object('withdrawals', (select coalesce(jsonb_agg(to_jsonb(x) order by x."createdAt" desc), '[]'::jsonb) from (
    select d.id,
           coalesce(nullif(to_jsonb(p)->>'display_name', ''), 'Msafiri') as name,
           to_jsonb(p)->>'username' as username,
           d.payout_tzs as "payoutTzs", d.local_minor as "payoutLocalMinor", d.currency, d.local_digits as "localDigits",
           d.coins, d.network, d.phone, d.account_name as "accountName",
           round(d.payout_tzs / (1 - d.cut_pct / 100))::bigint as "grossTzs",
           (round(d.payout_tzs / (1 - d.cut_pct / 100))::bigint - d.payout_tzs) as "commissionTzs",
           d.created_at as "createdAt", d.payout_ref as "payoutRef", d.admin_note as "adminNote", d.status
    from public.mw_wallet_withdrawals d left join public.mw_profiles p on p.id = d.user_id
    where nullif(p_status, '') is null or d.status = p_status
    order by d.created_at desc limit 200) x));
end;
$$;

create or replace function public.mw_wallet_admin_topups(p_status text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform public.mw_wallet_require_admin();
  return jsonb_build_object('topups', (select coalesce(jsonb_agg(to_jsonb(x) order by x."createdAt" desc), '[]'::jsonb) from (
    select t.id,
           coalesce(nullif(to_jsonb(p)->>'display_name', ''), 'Msafiri') as name,
           to_jsonb(p)->>'username' as username,
           t.coins, t.amount_tzs as "amountTzs", t.local_minor as "amountLocalMinor", t.currency, t.local_digits as "localDigits",
           t.network, t.phone, t.reference, t.created_at as "createdAt", t.admin_note as "adminNote", t.status,
           case when t.status = 'approved' then c.code_plain end as "verificationCode"
    from public.mw_wallet_topups t
    left join public.mw_profiles p on p.id = t.user_id
    left join public.mw_wallet_topup_codes c on c.topup_id = t.id
    where nullif(p_status, '') is null or t.status = p_status
    order by t.created_at desc limit 200) x));
end;
$$;

create or replace function public.mw_wallet_admin_withdrawal(p_id uuid, p_decision text, p_payout_ref text default null, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare admin_id uuid := public.mw_wallet_require_admin(); d public.mw_wallet_withdrawals; ref text := nullif(trim(coalesce(p_payout_ref, '')), '');
begin
  if p_decision not in ('paid', 'reject') then raise exception 'Unknown decision.'; end if;
  select * into d from public.mw_wallet_withdrawals where id = p_id for update;
  if not found then raise exception 'Withdrawal not found.'; end if;
  if d.status <> 'pending' then raise exception 'This withdrawal was already decided.'; end if;
  if p_decision = 'paid' then
    if ref is null then raise exception 'Enter the payout transaction reference.'; end if;
    update public.mw_wallet_withdrawals
       set status = 'paid', payout_ref = left(ref, 120), admin_note = left(nullif(trim(coalesce(p_note, '')), ''), 300), decided_by = admin_id, decided_at = now()
     where id = d.id;
  else
    perform 1 from public.mw_wallets where user_id = d.user_id for update;
    perform public.mw_wallet_apply(d.user_id, 0, d.coins, 0, 'withdraw_refund', d.id);
    update public.mw_wallet_withdrawals
       set status = 'rejected', admin_note = left(nullif(trim(coalesce(p_note, '')), ''), 300), decided_by = admin_id, decided_at = now()
     where id = d.id;
  end if;
  return jsonb_build_object('ok', true, 'status', case when p_decision = 'paid' then 'paid' else 'rejected' end);
end;
$$;

create or replace function public.mw_wallet_admin_topup(p_id uuid, p_decision text, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  admin_id uuid := public.mw_wallet_require_admin(); t public.mw_wallet_topups;
  raw text; shown text;
begin
  if p_decision not in ('approve', 'reject') then raise exception 'Unknown decision.'; end if;
  select * into t from public.mw_wallet_topups where id = p_id for update;
  if not found then raise exception 'Payment not found.'; end if;
  if t.status <> 'pending' then raise exception 'This payment was already decided.'; end if;
  if p_decision = 'approve' then
    raw := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
    shown := substr(raw, 1, 4) || '-' || substr(raw, 5, 4) || '-' || substr(raw, 9, 4);
    insert into public.mw_wallet_topup_codes (topup_id, user_id, code_hash, code_plain, coins)
    values (t.id, t.user_id, encode(sha256(convert_to(raw, 'utf8')), 'hex'), shown, t.coins);
    update public.mw_wallet_topups
       set status = 'approved', admin_note = left(nullif(trim(coalesce(p_note, '')), ''), 300), decided_by = admin_id, decided_at = now()
     where id = t.id;
    return jsonb_build_object('ok', true, 'status', 'approved', 'code', shown);
  end if;
  update public.mw_wallet_topups
     set status = 'rejected', admin_note = left(nullif(trim(coalesce(p_note, '')), ''), 300), decided_by = admin_id, decided_at = now()
   where id = t.id;
  return jsonb_build_object('ok', true, 'status', 'rejected');
end;
$$;

-- Null arguments keep the current value; an empty string clears a text field.
create or replace function public.mw_wallet_admin_settings(
  p_instructions text default null, p_lipa_number text default null, p_lipa_name text default null,
  p_lipa_network text default null, p_lipa_qr text default null,
  p_coin_tzs integer default null, p_min_withdraw numeric default null, p_cut_pct numeric default null)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform public.mw_wallet_require_admin();
  if p_lipa_qr is not null and trim(p_lipa_qr) <> '' and trim(p_lipa_qr) !~* '^https://' then raise exception 'The QR image must be an https:// link.'; end if;
  update public.mw_wallet_settings set
    payment_instructions = coalesce(left(trim(p_instructions), 1000), payment_instructions),
    lipa_number = coalesce(left(trim(p_lipa_number), 40), lipa_number),
    lipa_name = coalesce(left(trim(p_lipa_name), 120), lipa_name),
    lipa_network = coalesce(left(trim(p_lipa_network), 40), lipa_network),
    lipa_qr = coalesce(left(trim(p_lipa_qr), 2000), lipa_qr),
    coin_tzs = coalesce(p_coin_tzs, coin_tzs),
    min_withdraw_coins = coalesce(p_min_withdraw, min_withdraw_coins),
    platform_cut_pct = coalesce(p_cut_pct, platform_cut_pct),
    updated_at = now()
  where id = 1;
  return jsonb_build_object('ok', true);
end;
$$;

-- ---------------------------------------------------------------- privileges
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig, p.proname
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'mw\_wallet\_%'
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
    if f.proname not in ('mw_wallet_apply', 'mw_wallet_uid', 'mw_wallet_require_admin', 'mw_wallet_clean_phone', 'mw_wallet_guard_ledger') then
      execute format('grant execute on function %s to authenticated', f.sig);
    end if;
  end loop;
end;
$$;
-- The payment details shown before sign-in are public by design.
grant execute on function public.mw_wallet_catalog() to anon;

commit;
notify pgrst, 'reload schema';
