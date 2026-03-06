-- Run this in Supabase SQL Editor to create the app_users table before seeding.
-- Then seed with: npm run seed:supabase:auth

create table if not exists public.app_users (
    id integer primary key,
    username text not null,
    email text not null unique,
    password text not null,
    fullname text,
    avatar text,
    role_type text not null,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

create index if not exists app_users_username_idx on public.app_users (username);
create index if not exists app_users_role_type_idx on public.app_users (role_type);

-- Trial note:
-- - For this dummy auth, you can keep RLS disabled or very permissive,
--   since the real auth system will live in your own API.
--   alter table public.app_users disable row level security;

