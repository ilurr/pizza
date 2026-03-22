-- Links sellable menu items (product_id text = pizzas.id etc.) to stock_products for deduction.
-- MVP: use product_id '__default_pizza__' for all pizzas / custom pizzas (one portion = same BOM).
-- '__default_beverage__' has no rows by default → beverages deduct nothing from chef stock.
--
-- Run after scripts/supabase-schema-driver-stock.sql (needs stock_products + driver_stock).

create table if not exists public.product_stock_recipe (
    id uuid primary key default gen_random_uuid(),
    product_id text not null,
    stock_product_id uuid not null references public.stock_products (id) on delete cascade,
    quantity numeric not null default 1 check (quantity > 0),
    created_at timestamptz default now(),
    unique (product_id, stock_product_id)
);

create index if not exists idx_product_stock_recipe_product on public.product_stock_recipe (product_id);

comment on table public.product_stock_recipe is 'BOM: stock consumed per 1 sold unit. Custom pizzas use __default_pizza__ until per-menu recipes exist.';

-- Idempotent stock deduction when order moves to preparing (driver accept)
alter table public.orders add column if not exists stock_deducted_at timestamptz;

comment on column public.orders.stock_deducted_at is 'Set when driver stock was deducted for this order (preparing); prevents double deduction.';

-- MVP default: one "portion" deducts 1 unit each of flour, sauce, mozzarella (tune quantities later).
-- Uses same UUIDs as scripts/supabase-schema-driver-stock.sql seed.
insert into public.product_stock_recipe (product_id, stock_product_id, quantity)
values
    ('__default_pizza__', 'a0000001-0001-0000-0000-000000000001', 1), -- Pizza Flour
    ('__default_pizza__', 'a0000001-0001-0000-0000-000000000002', 1), -- Tomato Sauce
    ('__default_pizza__', 'a0000001-0001-0000-0000-000000000004', 1) -- Mozzarella
on conflict (product_id, stock_product_id) do update set quantity = excluded.quantity;
