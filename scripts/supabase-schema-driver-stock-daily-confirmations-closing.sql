-- Add end-of-day (closing) confirmation snapshot to daily confirmation table.

alter table public.driver_daily_confirmations
    add column if not exists closing_confirmed_at timestamptz;

alter table public.driver_daily_confirmations
    add column if not exists closing_items jsonb not null default '[]'::jsonb;

