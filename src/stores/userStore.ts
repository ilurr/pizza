// stores/userStore.ts
import { isAuthenticated } from '@/utils/auth';
import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useUserStore = defineStore('user', () => {
    const user = ref<any | null>(null);
    const role = ref<string | null>(null); // Store role separately

    const fetchUser = async () => {
        if (!isAuthenticated()) {
            user.value = null;
            role.value = null;
            return;
        }

        // Bootstrap user state from localStorage (set by utils/auth.login)
        const stored = localStorage.getItem('user');
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                user.value = parsed;
                // Support both { role: { type } } and flat { role: string }
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const anyParsed: any = parsed;
                role.value = anyParsed.role?.type ?? anyParsed.role ?? null;
            } catch (e) {
                console.error('Failed to parse stored user:', e);
                user.value = null;
                role.value = null;
            }
        } else {
            user.value = null;
            role.value = null;
        }
    };

    return { user, role, fetchUser };
});
