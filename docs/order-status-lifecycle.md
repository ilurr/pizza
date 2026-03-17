# Order status types and lifecycle

Order status is stored in the `orders.status` column. The app uses **six statuses** only.

---

## Status values (simplified set)

| Status         | Description |
|----------------|-------------|
| **pending**    | Order just created (after Pay Now / checkout). Waiting for chef/driver to pick it up. |
| **assigned**   | A driver/chef has been assigned. Ready to be started (replaces legacy “confirmed”). |
| **preparing**  | Chef is preparing the food. |
| **on_delivery**| Driver is on the way to the customer. |
| **delivered**  | Order completed; handed to the customer. Final success state. |
| **cancelled**  | Order was cancelled. Terminal state. |

**Backward compatibility:** The driver app still treats **confirmed** in the same way as **assigned** (e.g. “Start preparing” from pending/assigned/confirmed). New orders are never created with `confirmed` or `waiting`; only the six above are used.

---

## Progress flow

```
  [Customer places order]
           │
           ▼
      pending ──────────────────────────────────────────┐
           │                                             │
  [Driver assigned]                                      │
           │                                             │
           ▼                                             │
      assigned                                            │
           │                                             │
  [Driver: “Start preparing”]                             │
           │                                             │
           ▼                                             │
      preparing                                           │
           │                                             │
  [Driver: “Out for delivery”]                            │
           │                                             │
           ▼                                             │
   on_delivery                                            │
           │                                             │
  [Driver: “Mark delivered”]                              │
           │                                             ▼
           ▼                                    cancelled (any time before delivered)
    delivered
```

- **createOrder**: sets `status: 'pending'`.
- **assignDriver**: sets `status: 'assigned'`.
- Driver app: **pending** / **assigned** (and legacy **confirmed**) → **preparing** → **on_delivery** → **delivered**.
- **cancelOrder**: sets `status: 'cancelled'` (only if not delivered/cancelled).

---

## Where each status is used

- **createOrder** (Supabase): `status: 'pending'`.
- **assignDriver**: `status: 'assigned'`.
- **DriverOrdersOnline**: next action from `pending`/`assigned`/`confirmed` → `preparing` → `on_delivery` → `delivered` (confirmed kept for old data).
- **getOrderTracking**: steps use **assigned** (label “Order Confirmed”), not confirmed.
- **MyOrders / useActiveOrders / OrderList**: “in progress” = `pending`, `assigned`, `preparing`, `on_delivery`.
- **OrderTrackingModal**: trackable = same four statuses.
- **getOrderStats**: `ordersByStatus` uses `assigned` (no `confirmed`).
- **cancelOrder**: only when status is not `delivered` or `cancelled`.
