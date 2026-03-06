/**
 * One-off seed script: load sample orders from src/data/orders.json into Supabase.
 * Run: npm run seed:supabase (loads .env from project root automatically).
 *
 * RLS: If the orders table has Row Level Security enabled, use the service role key
 * so the seed bypasses RLS. In .env add SUPABASE_SERVICE_ROLE_KEY (from Supabase
 * Dashboard → Settings → API). Never use the service role key in frontend code.
 *
 * Prerequisite: Create the `orders` table in Supabase (see scripts/supabase-schema-orders.sql).
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

// Load .env from project root so npm run seed:supabase works without passing vars
const envPath = join(rootDir, '.env');
if (existsSync(envPath)) {
    const envContent = readFileSync(envPath, 'utf8');
    for (const line of envContent.split('\n')) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
            const eq = trimmed.indexOf('=');
            if (eq > 0) {
                const key = trimmed.slice(0, eq).trim();
                let value = trimmed.slice(eq + 1).trim();
                if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
                process.env[key] = value;
            }
        }
    }
}

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!url) {
    console.error('Missing VITE_SUPABASE_URL (or SUPABASE_URL).');
    process.exit(1);
}
const key = serviceRoleKey || anonKey;
if (!key) {
    console.error('Missing SUPABASE_SERVICE_ROLE_KEY or VITE_SUPABASE_ANON_KEY (or SUPABASE_ANON_KEY).');
    console.error('For seeding with RLS enabled, set SUPABASE_SERVICE_ROLE_KEY in .env (Supabase Dashboard → Settings → API).');
    process.exit(1);
}

function orderToRow(order) {
    return {
        id: order.id,
        order_number: order.orderNumber,
        customer_id: String(order.customerId || 'guest_user'),
        customer_name: order.customerName,
        customer_phone: order.customerPhone,
        customer_email: order.customerEmail,
        order_date: order.orderDate,
        status: order.status,
        items: order.items || [],
        subtotal: order.subtotal,
        delivery_fee: order.deliveryFee ?? 0,
        discount: order.discount ?? 0,
        total: order.total,
        payment_method: order.paymentMethod,
        payment_status: order.paymentStatus || 'pending',
        delivery_address: order.deliveryAddress || {},
        delivery_time: order.deliveryTime,
        estimated_delivery: order.estimatedDelivery,
        notes: order.notes,
        promo_code: order.promoCode,
        promo_title: order.promoTitle,
        driver_id: order.driverId,
        driver_info: order.driverInfo,
        rating: order.rating,
        created_at: order.createdAt || new Date().toISOString(),
        updated_at: order.updatedAt || new Date().toISOString()
    };
}

async function main() {
    const ordersPath = join(__dirname, '../src/data/orders.json');
    const raw = readFileSync(ordersPath, 'utf8');
    const orders = JSON.parse(raw);
    const rows = orders.map(orderToRow);

    const supabase = createClient(url, key);

    const { error } = await supabase.from('orders').upsert(rows, { onConflict: 'id' });
    if (error) {
        console.error('Seed failed:', error.message);
        process.exit(1);
    }
    console.log(`Seeded ${rows.length} orders into Supabase.`);
}

main();
