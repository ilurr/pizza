import { getSupabaseClient } from '@/services/supabase/client.js';
import { useUserStore } from '@/stores/userStore';

export interface User {
    id: number;
    username: string;
    email: string;
    fullname?: string;
    avatar?: string;
}

export function isAuthenticated(): boolean {
    return !!localStorage.getItem('token');
}

export async function login(identifier: string, password: string): Promise<User> {
    try {
        const supabase = getSupabaseClient();
        if (!supabase) {
            throw new Error('Supabase is not configured (VITE_DATA_SOURCE must be "supabase" with URL + ANON key).');
        }

        // Look up user in Supabase app_users table (dummy auth; passwords are plain text).
        const { data: userRow, error } = await supabase.from('app_users').select('*').or(`email.eq.${identifier},username.eq.${identifier}`).maybeSingle();

        if (error) {
            throw new Error(error.message || 'Failed to contact auth server');
        }

        if (!userRow || userRow.password !== password) {
            throw new Error('Invalid credentials');
        }

        const user = {
            id: userRow.id,
            username: userRow.username,
            email: userRow.email,
            fullname: userRow.fullname,
            avatar: userRow.avatar || '',
            role: { type: userRow.role_type }
        };

        // Still use a dummy token; real auth will come from your API later.
        const jwt = 'static-jwt-token';

        localStorage.setItem('token', jwt);
        localStorage.setItem('user', JSON.stringify(user));

        // Set user data directly in store
        const userStore = useUserStore();
        userStore.user = user;
        userStore.role = user.role.type;

        return user;
    } catch (error: any) {
        console.error('Login failed:', error.response?.data?.error?.message || error.message);
        throw error;
    }
}

export function logout(): void {
    const userStore = useUserStore();
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    userStore.user = null;
    userStore.role = null;
}
