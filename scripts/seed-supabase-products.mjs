/**
 * One-off seed script: load sample pizzas + beverages from src/data into Supabase.
 * Run: npm run seed:supabase:products
 *
 * RLS: If the tables have Row Level Security enabled, use the service role key so
 * the seed bypasses RLS. In .env add SUPABASE_SERVICE_ROLE_KEY (Dashboard → Settings → API).
 * Never use the service role key in frontend code.
 *
 * Prerequisite: Create tables in Supabase (see scripts/supabase-schema-products.sql).
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

// Load .env from project root so npm run seed:supabase:products works without passing vars
const envPath = join(rootDir, '.env');
if (existsSync(envPath)) {
    const envContent = readFileSync(envPath, 'utf8');
    for (const line of envContent.split('\n')) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
            const eq = trimmed.indexOf('=');
            if (eq > 0) {
                const k = trimmed.slice(0, eq).trim();
                let value = trimmed.slice(eq + 1).trim();
                if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                    value = value.slice(1, -1);
                }
                process.env[k] = value;
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

function pizzaToRow(pizza) {
    return {
        id: pizza.id,
        name: pizza.name,
        description: pizza.description,
        category: pizza.category,
        price: pizza.price ?? 0,
        image: pizza.image,
        ingredients: pizza.ingredients || [],
        sizes: pizza.sizes || [],
        available: pizza.available ?? true,
        popular: pizza.popular ?? false,
        rating: pizza.rating,
        cooking_time: pizza.cookingTime,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    };
}

function beverageToRow(beverage) {
    return {
        id: beverage.id,
        name: beverage.name,
        description: beverage.description,
        category: beverage.category,
        price: beverage.price ?? 0,
        image: beverage.image,
        sizes: beverage.sizes || [],
        available: beverage.available ?? true,
        type: beverage.type,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    };
}

async function main() {
    const pizzasPath = join(__dirname, '../src/data/pizzas.json');
    const beveragesPath = join(__dirname, '../src/data/beverages.json');

    const pizzas = JSON.parse(readFileSync(pizzasPath, 'utf8'));
    const beverages = JSON.parse(readFileSync(beveragesPath, 'utf8'));

    const pizzaRows = pizzas.map(pizzaToRow);
    const beverageRows = beverages.map(beverageToRow);

    const supabase = createClient(url, key);

    const pizzasRes = await supabase.from('pizzas').upsert(pizzaRows, { onConflict: 'id' });
    if (pizzasRes.error) {
        console.error('Seed pizzas failed:', pizzasRes.error.message);
        process.exit(1);
    }

    const beveragesRes = await supabase.from('beverages').upsert(beverageRows, { onConflict: 'id' });
    if (beveragesRes.error) {
        console.error('Seed beverages failed:', beveragesRes.error.message);
        process.exit(1);
    }

    console.log(`Seeded ${pizzaRows.length} pizzas and ${beverageRows.length} beverages into Supabase.`);
}

main();
