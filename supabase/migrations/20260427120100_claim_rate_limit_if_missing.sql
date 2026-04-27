-- Repair: if you already ran the first migration and it failed on claim_rate_limit,
-- run this once in the SQL editor (safe to re-run).
create table if not exists public.claim_rate_limit (
  key text primary key,
  count int not null default 0,
  reset_at timestamptz not null
);
alter table public.claim_rate_limit enable row level security;
