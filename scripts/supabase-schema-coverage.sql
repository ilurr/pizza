-- Run this in Supabase SQL Editor to create coverage_areas table before seeding.
-- Then seed with: npm run seed:supabase:coverage

create table if not exists public.coverage_areas (
    id text primary key,
    city text not null,
    province text,
    country text,
    active boolean not null default true,
    bounds_southwest_lat numeric,
    bounds_southwest_lng numeric,
    bounds_northeast_lat numeric,
    bounds_northeast_lng numeric,
    center_lat numeric,
    center_lng numeric,
    polygon jsonb default '[]'::jsonb,
    delivery_fee numeric default 0,
    minimum_order numeric default 0,
    estimated_delivery_time integer,
    max_delivery_radius numeric,
    timezone text,
    currency text,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

create index if not exists coverage_areas_city_idx on public.coverage_areas (city);
create index if not exists coverage_areas_active_idx on public.coverage_areas (active);

-- Trial note:
-- - For this dummy coverage table, you can keep RLS disabled or permissive:
--   alter table public.coverage_areas disable row level security;

