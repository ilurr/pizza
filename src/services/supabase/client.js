/**
 * Supabase client for trial data source.
 * Only created when VITE_DATA_SOURCE=supabase; not loaded when using real API.
 */
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL || '';
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

let _client = null;

export function getSupabaseClient() {
    if (import.meta.env.VITE_DATA_SOURCE !== 'supabase') {
        return null;
    }
    if (!url || !anonKey) {
        console.warn('Supabase: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are required when VITE_DATA_SOURCE=supabase');
        return null;
    }
    if (!_client) {
        _client = createClient(url, anonKey);
    }
    return _client;
}

export default getSupabaseClient;
