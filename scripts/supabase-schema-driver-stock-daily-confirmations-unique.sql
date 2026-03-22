-- Ensure "one daily stock confirmation per driver per local day"
-- This prevents duplicate confirmations and makes driver_daily_confirmations a stable daily history anchor.

alter table public.driver_daily_confirmations
    add column if not exists stock_date date;

-- Backfill for existing rows
update public.driver_daily_confirmations
set stock_date = (confirmed_at)::date
where stock_date is null;

alter table public.driver_daily_confirmations
    alter column stock_date set not null;

-- Enforce uniqueness for upsert and idempotency
create unique index if not exists idx_driver_daily_confirmations_driver_stock_date
    on public.driver_daily_confirmations (driver_id, stock_date);

