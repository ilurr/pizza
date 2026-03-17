# Drivers from users table (Supabase)

Drivers are **users with `role_type = 'drivers'`**. The only extra table is **driver_kelurahan** (which kelurahan each driver serves). No new columns on app_users, no driver_profiles table.

## Tables

| Table | Purpose |
|-------|--------|
| **app_users** | All users. Filter `role_type = 'drivers'` for drivers. No extra columns. |
| **driver_kelurahan** | Coverage: which kelurahan each driver serves (max 4). `driver_id` = `app_users.id`, `kelurahan_id` = `kelurahan.id`. |

## Script order

1. `supabase-schema-auth.sql` (app_users)
2. `supabase-schema-kelurahan.sql` (kelurahan)
3. `supabase-schema-drivers-from-users.sql` (driver_kelurahan table + sample driver users + sample coverage)

## Sample data

- **app_users**: 3 driver rows (id 5, 6, 7) with role_type `drivers` (fullname, avatar, etc.).
- **driver_kelurahan**: (5 → kel_001,002,003; 6 → kel_001,002,004; 7 → kel_001,003,004).

## API behaviour

- **DriverApiService** with `dataSource === 'supabase'`:
  - **getDriverProfile(driverId)** – `driverId` = app_users.id (integer, e.g. 5). Reads app_users + driver_kelurahan. No vehicle/location/rating in DB; defaults in code.
  - **getAvailableDriversByKelurahan(kelurahanId)** – returns users with `role_type = 'drivers'` who have that kelurahan in driver_kelurahan.
  - **getNearbyDrivers(driverId)** – returns other users with `role_type = 'drivers'`.
- **driver_stock**, **driver_daily_confirmations**, **driver_stock_exchanges**, **driver_daily_deposits**: `driver_id` is stored as **text** = `String(app_users.id)` (e.g. `"5"`). When the logged-in driver has id 5, the API uses `"5"` for these tables. Seed or migrate driver_stock so driver_id is `"5"`, `"6"`, `"7"` if you use these drivers.
