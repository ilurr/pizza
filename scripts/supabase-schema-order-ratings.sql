-- Order ratings (customer): one food score for the whole order + one driver/chef score.
-- Stored on public.orders.rating (JSONB). No separate column required for driver.
--
-- Recommended shape (written by the app):
--   {
--     "foodScore": 1-5,      -- overall food for all items on this order
--     "driverScore": 1-5,    -- chef / delivery
--     "score": 1-5,          -- legacy alias for foodScore (kept in sync)
--     "ratedAt": "<iso8601>"
--   }
--
-- If your database was created before `rating` existed, add the column:

alter table public.orders
    add column if not exists rating jsonb;

comment on column public.orders.rating is
    'Customer ratings JSON: foodScore (whole order), driverScore, optional ratedAt. Legacy numeric rating maps to food.';

-- Optional RLS example (uncomment when using auth.uid() as customer_id):
-- create policy "Customers update own order rating"
--   on public.orders for update
--   using (auth.uid()::text = customer_id)
--   with check (auth.uid()::text = customer_id);
