// stores/userStore.ts
import { isAuthenticated } from '@/utils/auth';
import axios from 'axios';
import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useUserStore = defineStore('user', () => {
    const user = ref(null);
    const role = ref(null); // Store role separately

    const fetchUser = async () => {
        if (!isAuthenticated()) return; // Prevent API call if not logged in

        try {
            const response = await axios.get('http://localhost:1337/api/users/me?populate=role', {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            user.value = response.data;
            role.value = response.data.role?.type; // Get role type
        } catch (error) {
            console.error('Error fetching user:', error);
        }
    };

    return { user, role, fetchUser };
});
