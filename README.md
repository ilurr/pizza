Sakai is an application template for Vue based on the [create-vue](https://github.com/vuejs/create-vue), the recommended way to start a Vite-powered Vue projects.

Visit the [documentation](https://sakai.primevue.org/documentation) to get started.

### Data source (Supabase vs real API)

Set `VITE_DATA_SOURCE=supabase` for trial (Supabase DB) or `VITE_DATA_SOURCE=api` for production (real API). One env change; no code edits. See `.env.example` for `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

**Seed Supabase (orders):** Create the `orders` table in Supabase using `scripts/supabase-schema-orders.sql`, then run:

```bash
VITE_SUPABASE_URL=... VITE_SUPABASE_ANON_KEY=... npm run seed:supabase
```

**Seed Supabase (products):** Create the `pizzas` and `beverages` tables using `scripts/supabase-schema-products.sql`, then run:

```bash
npm run seed:supabase:products
```
