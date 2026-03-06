-- Run this in Supabase SQL Editor to create products tables before seeding.
-- Then seed with: npm run seed:supabase:products

create table if not exists public.pizzas (
    id text primary key,
    name text not null,
    description text,
    category text,
    price numeric not null default 0,
    image text,
    ingredients jsonb default '[]'::jsonb,
    sizes jsonb default '[]'::jsonb,
    available boolean not null default true,
    popular boolean not null default false,
    rating numeric,
    cooking_time integer,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

create index if not exists pizzas_category_idx on public.pizzas (category);
create index if not exists pizzas_available_idx on public.pizzas (available);
create index if not exists pizzas_popular_idx on public.pizzas (popular);
create index if not exists pizzas_price_idx on public.pizzas (price);

create table if not exists public.beverages (
    id text primary key,
    name text not null,
    description text,
    category text,
    price numeric not null default 0,
    image text,
    sizes jsonb default '[]'::jsonb,
    available boolean not null default true,
    type text,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

create index if not exists beverages_category_idx on public.beverages (category);
create index if not exists beverages_available_idx on public.beverages (available);
create index if not exists beverages_price_idx on public.beverages (price);

-- Trial note:
-- - If you disabled RLS for local testing, you can do the same for these tables:
--   alter table public.pizzas disable row level security;
--   alter table public.beverages disable row level security;
-- - If you enable RLS, you must create SELECT policies for anon so the frontend can read.
