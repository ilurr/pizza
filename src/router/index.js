import AppLayout from '@/layout/AppLayout.vue';
import { useUserStore } from '@/stores/userStore';
import { isAuthenticated } from '@/utils/auth';
import { createRouter, createWebHistory } from 'vue-router';

const router = createRouter({
    history: createWebHistory(),
    scrollBehavior(to, from, savedPosition) {
        // Always scroll to top when navigating to a new page
        return { top: 0 };
    },
    routes: [
        {
            path: '/',
            name: 'index',
            component: () => import('@/views/pages/Landing.vue')
        },
        {
            path: '/dashboard',
            component: AppLayout,
            meta: { requiresAuth: true },
            children: [
                {
                    path: '/dashboard',
                    name: 'dashboard',
                    component: () => import('@/views/Dashboard.vue')
                },
                {
                    path: '/dashboard/notifications',
                    name: 'dashboardNotifications',
                    component: () => import('@/views/pages/NotificationsNew.vue')
                },
                {
                    path: '/dashboard/profile',
                    name: 'dashboardProfile',
                    component: () => import('@/views/pages/ProfileNew.vue')
                }
            ]
        },
        {
            path: '/driver',
            component: AppLayout,
            meta: { requiresAuth: true, roles: ['drivers', 'superadmin'] },
            children: [
                {
                    path: '/driver',
                    name: 'driverDashboard',
                    component: () => import('@/views/driver/DriverMain.vue')
                },
                {
                    path: '/driver/orders',
                    name: 'driverOrders',
                    component: () => import('@/views/driver/DriverOrders.vue')
                },
                {
                    path: '/driver/stock',
                    name: 'driverStock',
                    component: () => import('@/views/driver/DriverStock.vue')
                },
                {
                    path: '/driver/earnings',
                    name: 'driverEarnings',
                    component: () => import('@/views/driver/DriverEarnings.vue')
                },
                {
                    path: '/driver/exchange',
                    name: 'driverExchange',
                    component: () => import('@/views/driver/DriverExchange.vue')
                },
                {
                    path: '/driver/profile',
                    name: 'driverProfile',
                    component: () => import('@/views/pages/ProfileNew.vue')
                }
            ]
        },
        {
            path: '/order/my',
            name: 'order',
            // meta: { requiresAuth: true }, // Allow unauthenticated access to see layout
            component: () => import('@/views/pages/MyOrders.vue')
        },
        {
            path: '/menu',
            name: 'menu',
            component: () => import('@/views/pages/Menu.vue')
        },
        {
            path: '/order/now',
            name: 'orderNow',
            meta: { requiresAuth: true },
            component: () => import('@/views/pages/OrderNow.vue')
        },
        {
            path: '/payment-summary',
            name: 'paymentSummary',
            component: () => import('@/views/pages/PaymentSummary.vue')
        },
        {
            path: '/notifications',
            name: 'notifications',
            meta: { requiresAuth: true },
            component: () => import('@/views/pages/NotificationsNew.vue')
        },
        {
            path: '/profile',
            name: 'profile',
            meta: { requiresAuth: true },
            component: () => import('@/views/pages/Profile.vue')
        },
        {
            path: '/profile-new',
            name: 'profileNew',
            meta: { requiresAuth: true },
            component: () => import('@/views/pages/ProfileNew.vue')
        },
        {
            path: '/notfound',
            name: 'notfound',
            component: () => import('@/views/pages/NotFound.vue')
        },
        {
            path: '/auth/login',
            name: 'login',
            component: () => import('@/views/pages/auth/Login.vue')
        },
        {
            path: '/auth/signup',
            name: 'signup',
            component: () => import('@/views/pages/auth/SignUp.vue')
        },
        {
            path: '/auth/forgot-password',
            name: 'forgotPassword',
            component: () => import('@/views/pages/auth/ForgotPassword.vue')
        },
        {
            path: '/auth/access',
            name: 'accessDenied',
            component: () => import('@/views/pages/auth/Access.vue')
        },
        {
            path: '/auth/error',
            name: 'error',
            component: () => import('@/views/pages/auth/Error.vue')
        }
    ]
});

// **Navigation Guard**
router.beforeEach((to, from, next) => {
    const userStore = useUserStore();

    if (to.meta.requiresAuth && !isAuthenticated()) {
        next('/auth/login'); // Redirect unauthenticated users
    } else if (to.meta.roles && !to.meta.roles.includes(userStore.role)) {
        next('/auth/access'); // Redirect unauthorized users to home
    } else {
        next();
    }
});

export default router;
