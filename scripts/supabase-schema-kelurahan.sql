-- Kelurahan table for driver coverage (resolve user map position → kelurahan by nearest center).
-- Run in Supabase SQL Editor.

-- Table: one row per kelurahan; center (lat, lng) used for "nearest center" resolution.
create table if not exists public.kelurahan (
    id text primary key,
    name text not null,
    city text not null,
    province text,
    center_lat double precision not null,
    center_lng double precision not null,
    active boolean not null default true,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

comment on table public.kelurahan is 'Kelurahan list for coverage: user position is resolved to the kelurahan whose center is nearest.';
comment on column public.kelurahan.center_lat is 'Center latitude for distance calculation.';
comment on column public.kelurahan.center_lng is 'Center longitude for distance calculation.';

create index if not exists idx_kelurahan_city on public.kelurahan (city);
create index if not exists idx_kelurahan_active on public.kelurahan (active) where active = true;

-- Sample data (Surabaya & Tangerang Selatan) – matches app mock; replace with your real list.
insert into public.kelurahan (id, name, city, province, center_lat, center_lng, active) values
    ('kel_001', 'Gubeng', 'Surabaya', 'Jawa Timur', -7.2652, 112.7519, true),
    ('kel_002', 'Wonokromo', 'Surabaya', 'Jawa Timur', -7.2951, 112.7214, true),
    ('kel_003', 'Darmo', 'Surabaya', 'Jawa Timur', -7.2575, 112.7521, true),
    ('kel_004', 'Pondok Aren', 'Tangerang Selatan', 'Banten', -6.2654, 106.699, true),
    ('kel_005', 'Bintaro', 'Tangerang Selatan', 'Banten', -6.2758, 106.7614, true)
on conflict (id) do update set
    name = excluded.name,
    city = excluded.city,
    province = excluded.province,
    center_lat = excluded.center_lat,
    center_lng = excluded.center_lng,
    active = excluded.active,
    updated_at = now();
