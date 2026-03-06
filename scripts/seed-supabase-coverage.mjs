/**
 * One-off seed script: seed coverage areas into Supabase.
 * Run: npm run seed:supabase:coverage
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

// Load .env from project root
const envPath = join(rootDir, '.env');
if (existsSync(envPath)) {
    const envContent = readFileSync(envPath, 'utf8');
    for (const line of envContent.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eq = trimmed.indexOf('=');
        if (eq <= 0) continue;
        const k = trimmed.slice(0, eq).trim();
        let value = trimmed.slice(eq + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        process.env[k] = value;
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
    process.exit(1);
}

// Inline coverage areas (matches LocationApiService.mockCoverageAreas)
const coverageAreas = [
    {
        id: 'surabaya',
        city: 'Surabaya',
        province: 'Jawa Timur',
        country: 'Indonesia',
        active: true,
        bounds: {
            southwest: { lat: -7.3549, lng: 112.6094 },
            northeast: { lat: -7.1554, lng: 112.8375 }
        },
        center: { lat: -7.2575, lng: 112.7521 },
        polygon: [
            [-7.1554, 112.6094],
            [-7.1554, 112.8375],
            [-7.3549, 112.8375],
            [-7.3549, 112.6094],
            [-7.1554, 112.6094]
        ],
        deliveryFee: 5000,
        minimumOrder: 50000,
        estimatedDeliveryTime: 30,
        maxDeliveryRadius: 15,
        timezone: 'Asia/Jakarta',
        currency: 'IDR'
    },
    {
        id: 'tangerang_selatan',
        city: 'Tangerang Selatan',
        province: 'Banten',
        country: 'Indonesia',
        active: true,
        bounds: {
            southwest: { lat: -6.3676, lng: 106.6924 },
            northeast: { lat: -6.184, lng: 106.8304 }
        },
        center: { lat: -6.2758, lng: 106.7614 },
        polygon: [
            [-6.184, 106.6924],
            [-6.184, 106.8304],
            [-6.3676, 106.8304],
            [-6.3676, 106.6924],
            [-6.184, 106.6924]
        ],
        deliveryFee: 8000,
        minimumOrder: 75000,
        estimatedDeliveryTime: 35,
        maxDeliveryRadius: 20,
        timezone: 'Asia/Jakarta',
        currency: 'IDR'
    }
];

function areaToRow(area) {
    return {
        id: area.id,
        city: area.city,
        province: area.province,
        country: area.country,
        active: area.active ?? true,
        bounds_southwest_lat: area.bounds?.southwest?.lat,
        bounds_southwest_lng: area.bounds?.southwest?.lng,
        bounds_northeast_lat: area.bounds?.northeast?.lat,
        bounds_northeast_lng: area.bounds?.northeast?.lng,
        center_lat: area.center?.lat,
        center_lng: area.center?.lng,
        polygon: area.polygon || [],
        delivery_fee: area.deliveryFee ?? 0,
        minimum_order: area.minimumOrder ?? 0,
        estimated_delivery_time: area.estimatedDeliveryTime,
        max_delivery_radius: area.maxDeliveryRadius,
        timezone: area.timezone,
        currency: area.currency,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    };
}

async function main() {
    const supabase = createClient(url, key);
    const rows = coverageAreas.map(areaToRow);

    const { error } = await supabase.from('coverage_areas').upsert(rows, { onConflict: 'id' });
    if (error) {
        console.error('Seed coverage_areas failed:', error.message);
        process.exit(1);
    }

    console.log(`Seeded ${rows.length} coverage_areas into Supabase.`);
}

main();

