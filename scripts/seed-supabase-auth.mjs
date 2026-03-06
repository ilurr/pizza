/**
 * One-off seed script: seed demo auth users into Supabase.
 * Run: npm run seed:supabase:auth
 *
 * This is dummy auth only: passwords are stored in plain text and checked client-side.
 * Real production auth should live in your own API or Supabase Auth with proper hashing.
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

function userToRow(user) {
    return {
        id: user.id,
        username: user.username,
        email: user.email,
        password: user.password,
        fullname: user.fullname,
        avatar: user.avatar,
        role_type: user.role?.type || 'customer',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    };
}

async function main() {
    // Inline demo users (previously in src/data/authUsers.json)
    const users = [
        {
            id: 1,
            username: 'bram',
            email: 'bram@papapizza.com',
            password: 'Bram123',
            fullname: 'Bram - Driver',
            avatar: 'https://voyee.id/assets/foto_seller/2024_06_17_18_28_06_1718623686_35496cf2d62376ca0ef0.jpg',
            role: { type: 'drivers' }
        },
        {
            id: 2,
            username: 'admin',
            email: 'admin@papapizza.com',
            password: 'Admin123',
            fullname: 'Admin - Super Admin',
            avatar: '',
            role: { type: 'admin' }
        },
        {
            id: 3,
            username: 'customer',
            email: 'customer@papapizza.com',
            password: 'Customer123',
            fullname: 'Customer - Pizza Lover',
            avatar: '',
            role: { type: 'customer' }
        },
        {
            id: 4,
            username: 'mitra',
            email: 'mitra@papapizza.com',
            password: 'Mitra123',
            fullname: 'Mitra - Partner',
            avatar: '',
            role: { type: 'mitra' }
        }
    ];
    const rows = users.map(userToRow);

    const supabase = createClient(url, key);

    const { error } = await supabase.from('app_users').upsert(rows, { onConflict: 'id' });
    if (error) {
        console.error('Seed app_users failed:', error.message);
        process.exit(1);
    }

    console.log(`Seeded ${rows.length} app_users into Supabase.`);
}

main();

