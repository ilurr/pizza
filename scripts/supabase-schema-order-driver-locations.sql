-- Order-level driver GPS for customer tracking (1 row per order).
-- Run in Supabase SQL Editor.

create table if not exists public.order_driver_locations (
    order_id text primary key references public.orders(id) on delete cascade,
    driver_id text not null,
    lat double precision not null,
    lng double precision not null,
    source text not null default 'gps',
    updated_at timestamptz not null default now()
);

create index if not exists idx_order_driver_locations_driver_id on public.order_driver_locations (driver_id);
create index if not exists idx_order_driver_locations_updated_at on public.order_driver_locations (updated_at);

-- RLS (row level security)
-- This project may keep RLS disabled for MVP (per your instruction).
-- If you enable RLS later, add appropriate policies for:
-- - drivers upserting their active orders
-- - customers reading their own order tracking rows

