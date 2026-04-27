-- PING: Supabase/Postgres schema for Next.js + Vercel
-- Run in Supabase SQL Editor (or: supabase db push) on project https://xxx.supabase.co
-- Service role (server-only) bypasses RLS; public API uses Next Route Handlers with service role.

-- extensions
create extension if not exists pgcrypto;

-- enums
do $$ begin
  create type public.fund_status as enum ('pending', 'success', 'failed', 'skipped');
exception when duplicate_object then null;
end $$;

-- admins
create table if not exists public.admins (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  password text not null,
  role text not null default 'editor',
  created_at timestamptz not null default now()
);

-- hotspots
create table if not exists public.hotspots (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  lat double precision not null,
  lng double precision not null,
  prize double precision,
  start_date timestamptz not null,
  end_date timestamptz not null,
  active boolean not null default true,
  image_url text,
  private_key text,
  claim_status text not null default 'unclaimed',
  claimed_by text,
  claimed_at timestamptz,
  tweet_url text,
  queue_position int not null default 0,
  location_name text,
  share_token text unique,
  prize_private_key_enc text,
  prize_public_key text,
  prize_amount_lamports bigint not null default 0,
  fund_status public.fund_status not null default 'pending',
  fund_tx_sig text,
  funded_at timestamptz,
  wallet_created_at timestamptz,
  hint1 text,
  hint2 text,
  hint3 text,
  hint1_price_usd double precision,
  hint2_price_usd double precision,
  hint3_price_usd double precision,
  first_hint_free boolean not null default false,
  claim_type text not null default 'nfc',
  proximity_radius double precision,
  proximity_check_history jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_hotspots_active_created on public.hotspots (active, created_at desc);
create index if not exists idx_hotspots_claim on public.hotspots (claim_status);
create index if not exists idx_hotspots_active_claim on public.hotspots (active, claim_status);

-- treasury transfer log
create table if not exists public.treasury_transfer_logs (
  id uuid primary key default gen_random_uuid(),
  hotspot_id uuid not null references public.hotspots(id) on delete cascade,
  lamports bigint not null,
  type text not null,
  tx_sig text,
  status text not null,
  created_at timestamptz not null default now(),
  unique (hotspot_id, type)
);
create index if not exists idx_treasury_logs_hotspot on public.treasury_transfer_logs (hotspot_id);

-- admin logs
create table if not exists public.admin_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id text not null,
  username text,
  action text not null,
  entity text not null,
  entity_id text not null,
  details text,
  "timestamp" timestamptz not null default now()
);

-- hint purchases
create table if not exists public.hint_purchases (
  id uuid primary key default gen_random_uuid(),
  hotspot_id uuid not null references public.hotspots(id) on delete cascade,
  wallet_address text not null,
  hint_level int not null,
  paid_amount double precision not null,
  paid_usd double precision not null,
  tx_signature text,
  created_at timestamptz not null default now(),
  unique (wallet_address, hotspot_id, hint_level)
);
create index if not exists idx_hint_purchases_wallet on public.hint_purchases (wallet_address, hotspot_id);
create index if not exists idx_hint_purchases_hotspot on public.hint_purchases (hotspot_id);

-- hint settings singleton
create table if not exists public.hint_settings (
  id text primary key default 'singleton' check (id = 'singleton'),
  treasury_wallet text not null default '',
  burn_wallet text not null default '',
  ping_token_mint text not null default '',
  buy_button_url text not null default '',
  pump_fun_url text not null default '',
  pump_fun_enabled boolean not null default false,
  x_username text not null default '',
  x_enabled boolean not null default false,
  instagram_username text not null default '',
  instagram_enabled boolean not null default false,
  tiktok_username text not null default '',
  tiktok_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

-- push subscriptions (user_id: optional admin id as text, matching legacy app)
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_id text,
  user_type text not null,
  created_at timestamptz not null default now(),
  last_used timestamptz not null default now()
);
create index if not exists idx_push_user_type on public.push_subscriptions (user_type);
create index if not exists idx_push_user_id on public.push_subscriptions (user_id);

-- RLS: block direct client access; Next.js server uses service role (bypasses RLS)
alter table public.admins enable row level security;
alter table public.hotspots enable row level security;
alter table public.treasury_transfer_logs enable row level security;
alter table public.admin_logs enable row level security;
alter table public.hint_purchases enable row level security;
alter table public.hint_settings enable row level security;
alter table public.push_subscriptions enable row level security;

alter table public.claim_rate_limit enable row level security;

-- no policies: anon/auth cannot read/write; service_role bypasses RLS

-- In-memory claim map replacement for serverless: one key per IP+hotspot per hour
create table if not exists public.claim_rate_limit (
  key text primary key,
  count int not null default 0,
  reset_at timestamptz not null
);

comment on table public.hotspots is 'NFC / proximity hunt hotspots; accessed via Vercel API only (service role)';
