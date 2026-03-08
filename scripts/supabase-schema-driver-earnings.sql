-- Driver earnings: daily deposit rows per product.
-- Run in Supabase SQL Editor. Report (today/week/month) = SUM(sold_items), SUM(total_earning) over date range.

create table if not exists public.driver_daily_deposits (
    id uuid primary key default gen_random_uuid(),
    driver_id text not null,
    deposit_date date not null,
    product_name text not null,
    early_stock int not null default 0,
    sold_items int not null default 0,
    online_amount numeric not null default 0,
    offline_cash_amount numeric not null default 0,
    offline_qris_amount numeric not null default 0,
    total_earning numeric not null default 0,
    created_at timestamptz default now(),
    updated_at timestamptz default now(),
    unique (driver_id, deposit_date, product_name)
);

create index if not exists idx_driver_daily_deposits_driver_date
    on public.driver_daily_deposits (driver_id, deposit_date);

comment on table public.driver_daily_deposits is 'Per-product daily deposit rows: early stock, sold, online/offline cash/qris amounts, total earning (Rp).';

-- Sample data (driver_001, today + a few past days)
insert into public.driver_daily_deposits (driver_id, deposit_date, product_name, early_stock, sold_items, online_amount, offline_cash_amount, offline_qris_amount, total_earning)
values
    ('driver_001', current_date, 'Margherita', 20, 8, 360000, 90000, 90000, 540000),
    ('driver_001', current_date, 'Pepperoni', 15, 6, 450000, 75000, 0, 525000),
    ('driver_001', current_date, 'BBQ Chicken', 18, 5, 375000, 0, 0, 375000),
    ('driver_001', current_date, 'Coca Cola', 24, 12, 72000, 36000, 36000, 144000),
    ('driver_001', current_date - 1, 'Margherita', 20, 10, 450000, 0, 0, 450000),
    ('driver_001', current_date - 1, 'Pepperoni', 15, 4, 300000, 0, 0, 300000),
    ('driver_001', current_date - 1, 'Coca Cola', 24, 8, 96000, 0, 0, 96000),
    ('driver_001', current_date - 2, 'Margherita', 20, 7, 315000, 90000, 0, 405000),
    ('driver_001', current_date - 2, 'BBQ Chicken', 18, 3, 225000, 0, 0, 225000)
on conflict (driver_id, deposit_date, product_name) do update set
    early_stock = excluded.early_stock,
    sold_items = excluded.sold_items,
    online_amount = excluded.online_amount,
    offline_cash_amount = excluded.offline_cash_amount,
    offline_qris_amount = excluded.offline_qris_amount,
    total_earning = excluded.total_earning,
    updated_at = now();
