# Panggil Papa Pizza — Frontend Documentation

Deep-dive documentation of the Vue.js pizza ordering app: architecture, visuals, transactions, and important logic for future adjustments.

---

## 1. Project Overview

- **App name:** Panggil Papa Pizza (Sakai Vue template)
- **Stack:** Vue 3, Vite 5, Vue Router 4, Pinia (persisted), PrimeVue 4 (Lara preset), Tailwind + PrimeUI, Axios, Leaflet/vue3-leaflet
- **Purpose:** Pizza ordering with location → chef (driver) selection → menu → cart → payment (Xendit). Separate driver dashboard for “pizza chefs on wheels.”

---

## 2. Architecture

### 2.1 Entry & App Shell

| File | Role |
|------|------|
| `index.html` | Mounts `#app`, loads `src/main.js` |
| `main.js` | Creates app, Pinia + `pinia-plugin-persistedstate`, Router, PrimeVue (Lara + red primary), Toast + Confirmation, `@/assets/styles.scss`, mounts `App.vue` |
| `App.vue` | Shows `SplashScreen` until finished, then `<router-view />`; global `<Toast />`; on mount calls `userStore.fetchUser()` |

### 2.2 Router (`src/router/index.js`)

- **History:** `createWebHistory()`; scrolls to top on navigation.
- **Guards:**
  - `meta.requiresAuth` → if not authenticated, redirect to `/auth/login`.
  - `meta.roles` → if user role not in list, redirect to `/auth/access`.

**Route summary:**

| Path | Auth | Roles | Component |
|------|------|-------|-----------|
| `/` | No | — | Landing |
| `/dashboard` (layout) | Yes | — | Dashboard, NotificationsNew, ProfileNew |
| `/driver` (layout) | Yes | drivers, superadmin | DriverMain, DriverOrders, DriverStock, DriverEarnings, DriverExchange, ProfileNew |
| `/order/my` | No | — | MyOrders |
| `/menu` | No | — | Menu |
| `/order/now` | Yes | — | OrderNow |
| `/payment-summary` | No | — | PaymentSummary |
| `/notifications`, `/profile`, `/profile-new` | Yes | — | NotificationsNew, Profile, ProfileNew |
| `/auth/login`, `/auth/signup`, `/auth/forgot-password`, `/auth/access`, `/auth/error` | No | — | Auth pages |

**Important:** `/order/my` and `/payment-summary` are not behind auth; guard only checks `meta.requiresAuth`.

### 2.3 State (Pinia Stores)

| Store | File | Persist | Purpose |
|-------|------|---------|--------|
| **user** | `stores/userStore.ts` | No | `user`, `role`; `fetchUser()` calls Strapi `GET /users/me?populate=role` (or stays null with static login). |
| **cart** | `stores/cartStore.js` | No | `items`, `appliedPromo`, `promoDiscount`; totals, promo validation, add/remove/update/clear. |
| **order** | `stores/orderStore.js` | Yes (`localStorage`, key `pizza-order-state`) | Order flow: `currentStep` (location → driver → menu → checkout), `completedSteps`, `userLocation`, `availableDrivers`, `selectedDriver`, timestamps. Used to resume order and detect stale (>30 min). |
| **driver** | `stores/driverStore.js` | No | Driver app: profile, online/available, pending/active/completed orders, coverage, stats. Mock data + geolocation. |

**Order store step flow:**  
`location` → set location → auto `driver` → select driver → auto `menu` → user can go to `checkout`. Steps and location/driver are persisted so returning to OrderNow resumes or offers “stale” reset.

### 2.4 API Layer (`src/services/api/`)

- **index.js:** Singleton `ApiClient`; aggregates all services; mock/real switch via `VITE_USE_MOCK_API`; `initialize()`, `setMockMode()`, `healthCheck()`, `batch()`, `shortcuts`.
- **ApiClient.js:** `API_CONFIG` (BASE_URL, STRAPI_URL, USE_MOCK_API, TIMEOUT); axios `apiClient` and `strapiClient`; auth interceptors (Bearer token); response interceptors (401 → clear token + redirect login, 403/404/500 log); `BaseApiService` with get/post/patch/put/delete, `mockDelay`, `createMockResponse`, `createMockError`.
- **Domain services:** ProductsApiService, OrdersApiService, DriverApiService, LocationApiService, NotificationApiService, PromoApiService; each extends `BaseApiService`, uses `useMockApi` and mock data when enabled.
- **Payments:** Wrapped in `api.payments`; implementation lives in `src/service/PaymentService.js` (not under `services/api/`). Mock uses `PaymentService.simulatePayment()`; real uses `createPayment`, `getPaymentStatus`, `handleWebhook`.

**Env (see `src/services/api/README.md`):**  
`VITE_USE_MOCK_API`, `VITE_API_BASE_URL`, `VITE_STRAPI_URL`, `VITE_XENDIT_WEBHOOK_SECRET`. No `.env` in repo; defaults in code.

### 2.5 Legacy / Feature Services (`src/service/`)

- **ProductService.js:** Facade over products/orders API; main entry points (`getPizzas`, `getBeverages`, `getMenu`, `getOrders`) call `src/services/api` services (mock or real) and fall back to JSON in `src/data` during development. Used by Landing, Menu, OrderNow, MyOrders.
- **NotificationService.js:** Event bus (`on`/`off`/`emit`); payment callback handling; `addPendingPayment`, `simulatePaymentCallback`; toasts and `payment_update` for PaymentSummary.
- **PaymentService.js:** Xendit-style API: `createPayment`, `getPaymentStatus`, `handleWebhook`, `simulatePayment`, `generateExternalId`, `formatCurrency`, `getPaymentMethods`, mock checkout URL.

---

## 3. Visual & UI Logic

### 3.1 Theming & Styles

- **PrimeVue:** Lara preset; primary overridden to red shades (e.g. 500: `#ff0009`). Dark mode: `.app-dark` selector.
- **Tailwind (`tailwind.config.js`):** PrimeUI plugin; darkMode `['selector', '[class*="app-dark"]']`; custom colors `papa-red: #E9282A`, `papa-yellow: #FFE81B`.
- **Global:** `src/assets/styles.scss`; layout SCSS under `assets/layout/` (variables, topbar, menu, footer, typography, responsive, etc.).

### 3.2 Layouts

- **Public / marketing:** No sidebar. Pages use `AppTopbar` (optional back, title) + `FloatingMenu` at bottom.
- **Dashboard / Driver:** `AppLayout.vue` with `AppTopbar` (admin), `AppSidebar`, `layout-main` (router-view), `AppFooter`, overlay/mask. Used for `/dashboard` and `/driver`.

### 3.3 Floating Menu (`components/landing/FloatingMenu.vue`)

- Fixed bottom bar (max-width 3xl, centered on desktop).
- Tabs: **Home** (`/`), **Menu** (`/menu`), **Order Now** (`/order/now`), **My Order** (`/order/my`), **Profile** (`/profile`).
- “Order Now” is a prominent red pill; “My Order” shows a badge when `useActiveOrders().hasActiveOrders` is true.
- Active state: border-top and color use `papa-red` (#ff0009).

### 3.4 Key Components

- **PizzaCard:** Product card; variants (e.g. “popular”); events `add-to-cart`, `show-detail`.
- **ProductDetailModal:** Detail view; add to cart with quantity.
- **CartModal:** Cart list, quantity controls, promo (PromoModal), subtotal/discount/final total; “Proceed to Checkout” → `router.push('/payment-summary')`.
- **FloatingCart:** Shown when cart not empty and (on OrderNow) driver selected; shows item count and total; click opens CartModal.
- **OrderProgressStepper:** Shows order steps (location, driver, menu, checkout); edit location / change chef / reset order.
- **LocationPickerModal:** Leaflet map; coverage areas (e.g. Surabaya, Tangerang Selatan); pick location; geocode; emits `location-selected`.
- **OrderList:** Lists orders; status colors; optional “Track” opens OrderTrackingModal.
- **OrderTrackingModal / OrderProgressStepper (order):** Order status and tracking (useTrackingService can simulate driver position).

### 3.5 Data Source for Products & Orders (UI)

- **Landing, Menu, OrderNow, MyOrders** use **ProductService** as a facade over the centralized `api.products` / `api.orders`. The underlying mock data still lives in `src/data/*.json`, but all main fetches now go through the API layer (with JSON only as a fallback in mock mode).

---

## 4. Transaction & Order Flow

### 4.1 Customer Order Flow

1. **Order Now (auth required)**  
   - If no order state or stale (>30 min): show “Select Your Location”.  
   - If state exists and not stale: resume (location/driver/menu).

2. **Location**  
   - User opens LocationPickerModal → picks on map (coverage checked via polygons from `coverageAreas.json`) → `orderStore.setUserLocation(location)` → `searchNearbyDrivers(location)` which calls `api.drivers.getAvailableDrivers(location)` (mock or real, via `DriverApiService`).

3. **Driver**  
   - List of “pizza chefs” (from `api.drivers.getAvailableDrivers`) → `orderStore.selectDriver(driver)` → menu loaded via `ProductService.getPizzas()` (which calls `api.products.getPizzas()` under the hood).

4. **Menu & Cart**  
   - PizzaCard add to cart → `cartStore.addToCart(pizza, quantity)`. FloatingCart appears; user can open CartModal (edit qty, promo, checkout).

5. **Checkout**  
   - In CartModal, “Proceed to Checkout” → `router.push('/payment-summary')` (no guard).

6. **Payment Summary**  
   - Reads `cartStore` and `orderStore` (address, chef, items, subtotal, discount, total).  
   - “Pay Now” → `createPaymentRequest()` (PaymentService.generateExternalId, amount, customer, items, delivery_address, chef, redirect URLs) → `PaymentService.simulatePayment(paymentData)` (or real createPayment when not mock) → open `checkout_url` in new window → NotificationService.addPendingPayment + simulatePaymentCallback (demo).  
   - On `payment_update` (e.g. PAID): after 3s, clear cart and `router.push('/order/my')`.

### 4.2 Payment & Notifications

- **PaymentService** (in `service/PaymentService.js`): real Xendit-style create/status/webhook; demo: `simulatePayment` returns mock checkout URL; `generateMockCheckoutUrl` uses external_id, amount, etc.
- **NotificationService:** Listens for payment callback (postMessage, storage); `handlePaymentCallback` → emit `payment_update`; PaymentSummary listens and redirects on PAID.
- **Payment Summary** does **not** create an order in OrdersApiService; it only creates a payment (Xendit) and reacts to payment status. Order creation (e.g. after PAID) would be backend/webhook responsibility.

### 4.3 My Orders

- **MyOrders.vue:** Tabs “History” vs “On Progress”.  
- If not authenticated: empty states with “Sign in” CTA; `goToLogin()`.  
- If authenticated: calls `ProductService.getOrders(userId)` (which forwards to `api.orders.getUserOrders(userId)` in mock/real mode), then splits results into `orderHistory` (delivered, cancelled) and `onProgressOrders` (waiting, preparing, on_delivery).  
- **useActiveOrders:** Same `ProductService.getOrders(userId)` path, then filters for active statuses; used for FloatingMenu badge and 30s polling when authenticated.

### 4.4 Driver Flow (Driver Store & Views)

- **driverStore:** `initializeDriver(driverId)` loads mock profile, coverage, pending/active/completed orders; `toggleOnlineStatus` / `toggleAvailability`; `acceptOrder` / `rejectOrder` / `updateOrderStatus` (e.g. delivered → move to completed, compute driverEarnings); geolocation for current location; coverage/distance helpers.
- Driver UI: DriverMain, DriverOrders, DriverStock, DriverEarnings, DriverExchange, ProfileNew; all under `/driver` with role guard.

---

## 5. Auth Logic

- **utils/auth.ts:**  
  - `isAuthenticated()`: true if `localStorage.getItem('token')` exists.  
  - **Login:** Static list (e.g. bram/Admin123 → drivers, admin/Admin123 → mitra); no Strapi call; sets `token` and `user` in localStorage and `userStore.user` / `userStore.role`.  
  - **Logout:** Clears token and user from localStorage and userStore.
- **userStore.fetchUser:** If authenticated, GET Strapi `/users/me?populate=role` and sets `user` and `role`. With static login, fetchUser is skipped after login (user set directly).
- **Router:** Only routes with `meta.requiresAuth` or `meta.roles` use the guard; `/order/now` requires auth; `/payment-summary` and `/order/my` do not.

---

## 6. Location & Map Logic

- **LocationPickerModal:** Loads Leaflet from CDN; defines coverage areas (polygons/bounds for Surabaya, Tangerang Selatan); on confirm, geocodes and emits `{ lat, lng, address }`.
- **LocationApiService:** In API layer: checkCoverage, getCoverageAreas, geocodeAddress, calculateDeliveryInfo, searchLocations (mock/real).
- **useLeaflet:** Composable for map usage (used by LocationPickerModal).
- **useTrackingService:** User/driver positions; simulated driver movement; distance/bearing; used for order tracking UI.

---

## 7. Composables

- **useAuth:** e.g. `goToLogin()` (router push to login).
- **useRoles:** Role checks for UI.
- **useAvatar:** Avatar URL/display.
- **useActiveOrders:** Fetches orders via ProductService, filters by active statuses; polling; `activeOrdersCount` / `hasActiveOrders` for badge.
- **useTrackingService:** Geolocation, driver position simulation, distance/bearing, travel time.
- **useLeaflet:** Map setup for modals.

---

## 8. Important Gaps & Inconsistencies (for adjustments)

1. **Dual data sources (mostly resolved):** Main flows now use **ProductService** as a facade over the API layer (`api.products` / `api.orders`), with JSON only as a mock fallback in `src/data`. Some legacy helper methods still read JSON directly, but the UI is no longer decoupled from the API layer.

2. **Payment Summary has no auth:** Anyone can open `/payment-summary`; it only checks cart empty and redirects to `/order/now` after 2s. Consider requiring auth or at least a shared secret/session for payment.

3. **Order creation:** No call to `api.orders.createOrder()` from the frontend when payment succeeds; backend/webhook should create the order and update status.

4. **Checkout from OrderNow:** OrderNow’s `handleCheckout` only sets `orderStore.setCurrentStep('checkout')` and shows an alert; actual navigation to payment is from **CartModal** “Proceed to Checkout”. So the “checkout” step in the stepper is not tied to a separate page; the real next step is opening CartModal and then going to Payment Summary.

5. **My Orders:** Uses `ProductService.getOrders(userId)` which now calls `api.orders.getUserOrders(userId)` under the hood. When wiring to a real backend, ensure `userId` corresponds to the authenticated user from your auth system.

6. **Driver list on Order Now:** Now uses `api.drivers.getAvailableDrivers(location)` via `DriverApiService`. When switching to a real backend, ensure the driver-availability endpoint matches the current mock response shape (id, name, rating, distance, avatar, etc.).

7. **Promo:** Cart applies promo via PromoApiService (validate/apply); PaymentSummary shows applied promo and discount. Ensure promo validation runs again before payment (e.g. in PaymentSummary or right before createPayment).

8. **Env:** `.env.example` now documents `VITE_USE_MOCK_API`, `VITE_API_BASE_URL`, `VITE_STRAPI_URL`, `VITE_XENDIT_WEBHOOK_SECRET`, and optional `VITE_OPENROUTESERVICE_API_KEY`, but you still need to provide real values for each environment and keep secrets out of version control.

---

## 9. File Tree (Essential)

```
src/
├── main.js
├── App.vue
├── router/index.js
├── stores/
│   ├── userStore.ts
│   ├── cartStore.js
│   ├── orderStore.js
│   └── driverStore.js
├── layout/
│   ├── AppLayout.vue
│   ├── AppSidebar.vue
│   ├── AppTopbar.vue
│   └── composables/layout.js
├── views/
│   ├── Dashboard.vue
│   ├── pages/
│   │   ├── Landing.vue
│   │   ├── Menu.vue
│   │   ├── OrderNow.vue
│   │   ├── PaymentSummary.vue
│   │   ├── MyOrders.vue
│   │   └── auth/*.vue
│   └── driver/*.vue
├── components/
│   ├── landing/FloatingMenu.vue, HeroWidget.vue
│   ├── CartModal.vue, FloatingCart.vue
│   ├── LocationPickerModal.vue
│   ├── OrderList.vue, OrderTrackingModal.vue, OrderProgressStepper.vue
│   ├── PizzaCard.vue, ProductDetailModal.vue
│   └── PromoModal.vue, EditProfileModal.vue, ...
├── services/api/
│   ├── index.js
│   ├── ApiClient.js
│   ├── *ApiService.js
│   └── README.md
├── service/
│   ├── ProductService.js
│   ├── NotificationService.js
│   └── PaymentService.js
├── composables/
│   ├── useAuth.ts, useRoles.ts, useAvatar.ts
│   ├── useActiveOrders.ts, useTrackingService.ts
│   └── useLeaflet.ts
├── utils/auth.ts, currency.js
└── data/pizzas.json, beverages.json, orders.json
```

---

## 10. Quick Reference for Adjustments

- **Switch to real API:** Set `VITE_USE_MOCK_API=false`; ensure backend matches API layer contracts (see `src/services/api/README.md`).
- **Auth:** Replace static login in `utils/auth.ts` with Strapi (or your backend) and keep using userStore + router guards.
- **Orders in UI:** Point MyOrders and useActiveOrders to `api.orders.getUserOrders(userId)` and real user id.
- **Create order on payment:** Backend creates order on Xendit webhook (PAID); frontend can refresh My Orders or poll order status.
- **Driver list:** Replace mock in OrderNow with `api.drivers.getAvailableDrivers` (or location-based endpoint).
- **Theming:** Primary and brand colors in `main.js` (PrimeVue preset) and `tailwind.config.js` (papa-red, papa-yellow).

This document should be enough to understand architecture, visuals, transactions, and where to adjust when evolving the app.
