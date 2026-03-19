-- Run this in Supabase SQL Editor to create product price history table.
-- This table stores every product price change (pizza/beverage) with audit metadata.

create table if not exists public.product_price_history (
    id bigint generated always as identity primary key,
    product_type text not null check (product_type in ('pizza', 'beverage')),
    product_id text not null,
    old_price numeric not null default 0,
    new_price numeric not null default 0,
    change_reason text,
    effective_from timestamptz not null default now(),
    changed_by text,
    created_at timestamptz not null default now()
);

create index if not exists product_price_history_product_idx
    on public.product_price_history (product_type, product_id, effective_from desc);

create index if not exists product_price_history_changed_by_idx
    on public.product_price_history (changed_by, created_at desc);

-- Optional baseline backfill (safe to run multiple times due to NOT EXISTS guard)
insert into public.product_price_history (
    product_type, product_id, old_price, new_price, change_reason, effective_from, changed_by
)
select
    'pizza',
    p.id,
    coalesce(p.price, 0),
    coalesce(p.price, 0),
    'initial_import',
    coalesce(p.updated_at, p.created_at, now()),
    'system'
from public.pizzas p
where not exists (
    select 1
    from public.product_price_history h
    where h.product_type = 'pizza'
      and h.product_id = p.id
      and h.change_reason = 'initial_import'
);

insert into public.product_price_history (
    product_type, product_id, old_price, new_price, change_reason, effective_from, changed_by
)
select
    'beverage',
    b.id,
    coalesce(b.price, 0),
    coalesce(b.price, 0),
    'initial_import',
    coalesce(b.updated_at, b.created_at, now()),
    'system'
from public.beverages b
where not exists (
    select 1
    from public.product_price_history h
    where h.product_type = 'beverage'
      and h.product_id = b.id
      and h.change_reason = 'initial_import'
);

