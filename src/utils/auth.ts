import { useUserStore } from '@/stores/userStore';
import authUsersData from '@/data/authUsers.json';

const API_URL = 'http://localhost:1337/api'; // Change to your Strapi URL

export interface User {
    id: number;
    username: string;
    email: string;
}

export function isAuthenticated(): boolean {
    return !!localStorage.getItem('token');
}

export async function login(identifier: string, password: string): Promise<User> {
    try {
        // TODO: Rollback to axios strapi login later
        // const response = await axios.post(`${API_URL}/auth/local?populate=*`, {
        //     identifier,
        //     password
        // });
        // const { jwt, user } = response.data;

        // Static login sample data (from src/data/authUsers.json)
        const staticUsers = authUsersData as Array<{
            id: number;
            username: string;
            email: string;
            password: string;
            role: { type: string };
        }>;

        const foundUser = staticUsers.find((u) => (u.email === identifier || u.username === identifier) && u.password === password);

        if (!foundUser) {
            throw new Error('Invalid credentials');
        }

        // Structure user data to match expected API response
        const user = {
            id: foundUser.id,
            username: foundUser.username,
            email: foundUser.email,
            role: foundUser.role
        };

        const jwt = 'static-jwt-token';
        // end: static login

        localStorage.setItem('token', jwt);
        localStorage.setItem('user', JSON.stringify(user));

        // Set user data directly in store for static login
        const userStore = useUserStore();
        // await userStore.fetchUser();

        // static
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
