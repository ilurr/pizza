-- Driver stock: base and topping only, quantities only (no Rp).
-- Run in Supabase SQL Editor.

-- Master list of stock products (base / topping)
create table if not exists public.stock_products (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    type text not null check (type in ('base', 'topping')),
    unit text not null default 'pcs'
);

-- Per-driver stock (quantity only)
create table if not exists public.driver_stock (
    id uuid primary key default gen_random_uuid(),
    driver_id text not null,
    product_id uuid not null references public.stock_products(id) on delete cascade,
    quantity int not null default 0,
    max_capacity int default 100,
    critical_level int default 5,
    updated_at timestamptz default now(),
    unique (driver_id, product_id)
);

create index if not exists idx_driver_stock_driver on public.driver_stock (driver_id);

-- Morning confirmation: snapshot of items driver confirmed they have
create table if not exists public.driver_daily_confirmations (
    id uuid primary key default gen_random_uuid(),
    driver_id text not null,
    confirmed_at timestamptz not null default now(),
    items jsonb not null default '[]',
    created_at timestamptz default now()
);

create index if not exists idx_driver_daily_confirmations_driver on public.driver_daily_confirmations (driver_id);

-- Exchange history: "Driver A sent [product] to Driver B, X items"
create table if not exists public.driver_stock_exchanges (
    id uuid primary key default gen_random_uuid(),
    from_driver_id text not null,
    to_driver_id text not null,
    product_name text not null,
    product_type text not null check (product_type in ('base', 'topping')),
    quantity int not null,
    unit text default 'pcs',
    message text,
    created_at timestamptz default now()
);

create index if not exists idx_driver_stock_exchanges_from on public.driver_stock_exchanges (from_driver_id);
create index if not exists idx_driver_stock_exchanges_to on public.driver_stock_exchanges (to_driver_id);

-- Sample stock_products (base and topping only)
insert into public.stock_products (id, name, type, unit) values
    ('a0000001-0001-0000-0000-000000000001', 'Pizza Flour', 'base', 'kg'),
    ('a0000001-0001-0000-0000-000000000002', 'Tomato Sauce', 'base', 'L'),
    ('a0000001-0001-0000-0000-000000000003', 'Olive Oil', 'base', 'L'),
    ('a0000001-0001-0000-0000-000000000004', 'Mozzarella Cheese', 'topping', 'kg'),
    ('a0000001-0001-0000-0000-000000000005', 'Pepperoni', 'topping', 'kg'),
    ('a0000001-0001-0000-0000-000000000006', 'Fresh Mushrooms', 'topping', 'kg')
on conflict (id) do update set name = excluded.name, type = excluded.type, unit = excluded.unit;

-- Sample driver_stock for driver_001
insert into public.driver_stock (driver_id, product_id, quantity, max_capacity, critical_level)
select 'driver_001', id, 15, 25, 5 from public.stock_products where name = 'Pizza Flour'
union all select 'driver_001', id, 12, 20, 4 from public.stock_products where name = 'Tomato Sauce'
union all select 'driver_001', id, 5, 8, 2 from public.stock_products where name = 'Olive Oil'
union all select 'driver_001', id, 8, 15, 3 from public.stock_products where name = 'Mozzarella Cheese'
union all select 'driver_001', id, 3, 8, 2 from public.stock_products where name = 'Pepperoni'
union all select 'driver_001', id, 2, 6, 1 from public.stock_products where name = 'Fresh Mushrooms'
on conflict (driver_id, product_id) do update set quantity = excluded.quantity, updated_at = now();

-- Sample exchange history
insert into public.driver_stock_exchanges (from_driver_id, to_driver_id, product_name, product_type, quantity, unit, message)
values
    ('driver_001', 'driver_002', 'Pepperoni', 'topping', 2, 'kg', null),
    ('driver_002', 'driver_001', 'Mozzarella Cheese', 'topping', 3, 'kg', 'Thanks for the swap');
