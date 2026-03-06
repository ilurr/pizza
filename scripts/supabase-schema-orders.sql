-- Run this in Supabase SQL Editor to create the orders table before running seed-supabase.js
-- Then run: node scripts/seed-supabase.js (with env SUPABASE_URL and SUPABASE_ANON_KEY)

create table if not exists public.orders (
    id text primary key,
    order_number text not null,
    customer_id text not null,
    customer_name text,
    customer_phone text,
    customer_email text,
    order_date timestamptz not null,
    status text not null default 'pending',
    items jsonb default '[]',
    subtotal numeric not null default 0,
    delivery_fee numeric default 0,
    discount numeric default 0,
    total numeric not null default 0,
    payment_method text,
    payment_status text default 'pending',
    delivery_address jsonb default '{}',
    delivery_time timestamptz,
    estimated_delivery timestamptz,
    notes text,
    promo_code text,
    promo_title text,
    driver_id text,
    driver_info jsonb,
    rating jsonb,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- Optional: enable RLS and add policies for production
-- alter table public.orders enable row level security;
-- create policy "Users can read own orders" on public.orders for select using (auth.uid()::text = customer_id);

-- Seeding: If RLS is enabled, run the seed script with SUPABASE_SERVICE_ROLE_KEY in .env
-- (Supabase Dashboard → Settings → API → service_role). That bypasses RLS. Do not use
-- the service role key in frontend code.
