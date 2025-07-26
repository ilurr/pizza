import { logout } from '@/utils/auth';
import { useConfirm } from 'primevue/useconfirm';
import { useRouter } from 'vue-router';

export function useAuth() {
    const router = useRouter();
    const confirm = useConfirm();

    const goToLogin = (returnUrl?: string) => {
        // Use provided returnUrl or current route
        const redirectPath = returnUrl || router.currentRoute.value.fullPath;
        
        router.push({
            path: '/auth/login',
            query: { redirect: redirectPath }
        });
    };

    const goToSignUp = (returnUrl?: string) => {
        // Use provided returnUrl or current route
        const redirectPath = returnUrl || router.currentRoute.value.fullPath;
        
        router.push({
            path: '/auth/signup',
            query: { redirect: redirectPath }
        });
    };

    const confirmLogout = (redirectTo: string = '/auth/login') => {
        confirm.require({
            message: 'Are you sure you want to logout?',
            header: 'Logout',
            rejectLabel: 'Cancel',
            acceptLabel: 'Yes, Logout',
            rejectClass: 'p-button-danger',
            acceptClass: 'p-button-secondary p-button-outlined',
            accept: () => {
                logout();
                router.push(redirectTo);
            },
            reject: () => {
                // User cancelled, do nothing
            }
        });
    };

    return {
        goToLogin,
        goToSignUp,
        confirmLogout
    };
}