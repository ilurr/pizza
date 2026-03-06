# Data & API Strategy — Dummy Data and Real API Readiness

This doc describes how dummy/static data is organized and how to switch to real APIs with minimal changes.

---

## 1. Goals

- **Single place for all mock/dummy data** so you can edit and review in one go.
- **Single “gate” for data access** so switching mock → real API touches as few files as possible.
- **Same response shapes** in mock and real API so components don’t need to change when the backend is ready.

---

## 2. Where Data Lives

### 2.1 Central mock data (`src/data/`)

| File | Used for | Consumed by |
|------|----------|-------------|
| `pizzas.json` | Pizza catalog | ProductsApiService, ProductService (via API) |
| `beverages.json` | Beverage catalog | ProductsApiService, ProductService (via API) |
| `orders.json` | Order list / history | OrdersApiService, ProductService (via API) |
| `coverageAreas.json` | Map coverage (cities, bounds, polygons) | LocationPickerModal, LocationApiService |
| `authUsers.json` | Static login users (dev only) | `utils/auth.ts` |
| `drivers.json` | Driver list for “Order Now” + driver app | DriverApiService, OrderNow (via API) |
| `index.js` | Re-exports all above | Any code that needs “all mock data” |

**Rule:** All dummy/static data for the app lives under `src/data/`. No big inline arrays in components, stores, or API services.

### 2.2 Single data gate: API layer

- **All “fetch” data goes through `src/services/api/`** (ProductsApiService, OrdersApiService, DriverApiService, LocationApiService, etc.).
- Each service:
  - **Mock mode** (`VITE_USE_MOCK_API=true`): reads from `src/data/*.json` (or data returned by helpers that use that data), returns a **consistent response shape**.
  - **Real mode** (`VITE_USE_MOCK_API=false`): calls the real backend; response shape should match the mock so UI code does not need to change.

So when the API is ready:

1. Set `VITE_USE_MOCK_API=false` (and correct `VITE_API_BASE_URL` etc.).
2. Ensure backend endpoints and response shapes match what the services expect (see README in `src/services/api/`).
3. No changes in views/components beyond any you already did for the facade (see below).

---

## 3. How views get data (no duplicate paths)

### 3.1 Products, menu, orders

- **Before:** Some views used `ProductService.getPizzas()` / `getOrders()` (reading JSON directly), while the API layer had its own mock using the same JSON. Two paths for the same data.
- **After:**  
  - **ProductService** is a **thin facade**: it calls `api.products.getPizzas()`, `api.products.getBeverages()`, `api.orders.getUserOrders()`, etc., and returns the same shape views already use (e.g. `response.data.pizzas`).  
  - So: Landing, Menu, OrderNow, MyOrders, useActiveOrders keep using **ProductService**; the actual source is always the API layer (mock or real).  
  - Mock data is still only in `src/data/` and is used **only inside** the API services.

### 3.2 Drivers (“Order Now” chef list)

- **Before:** OrderNow had an inline `allDrivers` array and its own “no drivers / all unavailable” logic.
- **After:** OrderNow calls `api.drivers.getAvailableDrivers(location)` (or a shortcut). Mock driver list lives in `src/data/drivers.json` and is used only inside DriverApiService. The view only maps the API response to the card shape (name, distance, avatar, etc.) if needed.

### 3.3 Location / coverage

- **Before:** LocationPickerModal had an inline `coverageAreas` array.
- **After:** Coverage data lives in `src/data/coverageAreas.json`. LocationPickerModal (and LocationApiService if it needs it) import from there. No inline coverage arrays.

### 3.4 Auth (static users for dev)

- **Before:** Static users were an inline array in `utils/auth.ts`.
- **After:** Static users live in `src/data/authUsers.json`. `auth.ts` imports them. When using Supabase or real API, change `auth.ts` to call Supabase Auth (or your backend login) and map the response; the rest of the app keeps using the same `token` / `user` in localStorage and userStore.

---

## 4. Response shapes (contract for real API)

Backend should return the same structure as the mock so the UI does not need conditionals.

- **Products**
  - `getPizzas()` → `{ success, data: { pizzas, total, filters } }`; each pizza: `id`, `name`, `description`, `category`, `price`, `image`, `available`, `popular`, etc.
  - `getBeverages()` → `{ success, data: { beverages, total, filters } }`.
  - `getMenu()` → `{ success, data: { pizzas, beverages } }`.
- **Orders**
  - `getUserOrders(userId)` → `{ success, data: { orders, total, page, limit, totalPages } }`; each order has `id`, `orderNumber`, `status`, `items`, `total`, `deliveryAddress`, etc.  
  - **Note:** `ProductService.getOrders()` currently calls `getUserOrders('guest_user')`. When using a real API, pass the logged-in user id (e.g. from `userStore`) from the views that call `getOrders()`, or add `getOrders(userId)` and use it in MyOrders / useActiveOrders.
  - `createOrder(payload)` → `{ success, data: { order, message } }`.
- **Drivers**
  - `getAvailableDrivers(location)` → `{ success, data: { drivers, searchLocation, searchRadius, total } }`; each driver has `id`, `name`, `rating`, `currentLocation`, `avatar`, `isOnline`, `isAvailable`, etc. OrderNow can map to card shape (e.g. add `distance`, `estimatedTime`) from this.
- **Location**
  - Coverage: same structure as `coverageAreas.json` (city, bounds, polygon).
  - Geocode: same as current LocationApiService mock responses.

Keeping these shapes in the real API (or adding a thin adapter in the service) keeps “adjustment” to config and backend, not to every component.

---

## 4a. Supabase trial (no custom API)

- **Data source:** Set `VITE_DATA_SOURCE=supabase` for trial or `VITE_DATA_SOURCE=api` for real backend. One env switch; no code changes. See `.env.example`.
- **Env:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (required when `VITE_DATA_SOURCE=supabase`).
- **Orders (Phase 1):** OrdersApiService reads/writes Supabase `orders` table when data source is supabase. Same response shapes.
- **Seed:** Run `npm run seed:supabase` after creating the `orders` table (see `scripts/supabase-schema-orders.sql`). Sample data from `src/data/orders.json` is inserted once.
- **Products (Phase 2):** ProductsApiService reads Supabase `pizzas` + `beverages` tables when data source is supabase. Same response shapes.
- **Seed products:** Run `npm run seed:supabase:products` after creating tables (see `scripts/supabase-schema-products.sql`).
- **RLS:** For trial, RLS can be disabled or permissive; tighten for production.

---

## 5. Checklist when real API is ready

1. **Env:** Set `VITE_DATA_SOURCE=api`, set `VITE_API_BASE_URL`. For trial, use `VITE_DATA_SOURCE=supabase` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
2. **Backend:** Implement endpoints that match the response shapes above (see `src/services/api/README.md` and each `*ApiService.js`).
3. **Auth:** In `utils/auth.ts`, replace static login with Supabase Auth or real login endpoint; keep same `localStorage` and userStore usage.
4. **No view changes** for products, orders, drivers, location if you kept the facade and single gate; only API service internals (mock branch vs real HTTP) and env.

---

## 6. File layout summary

```
src/data/
├── index.js              # Re-exports all mock data
├── pizzas.json
├── beverages.json
├── orders.json
├── coverageAreas.json    # Map coverage (LocationPicker + LocationApi)
├── authUsers.json        # Static login users (auth.ts)
└── drivers.json          # Drivers for Order Now + driver app

src/services/api/         # Single gate: mock uses data/*, real uses HTTP
├── index.js
├── ApiClient.js
├── ProductsApiService.js # uses data/pizzas, beverages
├── OrdersApiService.js   # uses data/orders
├── DriverApiService.js   # uses data/drivers (and driver mocks if needed)
├── LocationApiService.js# uses data/coverageAreas (and addresses if needed)
└── ...

src/service/
├── ProductService.js     # Facade: calls api.products / api.orders, same return shape
├── NotificationService.js
└── PaymentService.js
```

Views and composables use either:

- **ProductService** (getPizzas, getBeverages, getOrders) for products/orders, or  
- **api** (or shortcuts) directly for drivers, location, etc.

All dummy data is under `src/data/`; when the API is ready, you only adjust env and the API layer (and auth for login).
