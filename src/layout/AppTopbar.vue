<script setup>
import brandConfig from '@/brand/brandConfig.ts';
import UserAvatar from '@/components/shared/UserAvatar.vue';
import { useAuth } from '@/composables/useAuth';
import { useRoles } from '@/composables/useRoles';
import { ROLES } from '@/constants/roles.js';
import { useLayout } from '@/layout/composables/layout';
import NotificationService from '@/service/NotificationService.js';
import { useUserStore } from '@/stores/userStore';
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const { toggleMenu, toggleDarkMode, isDarkTheme } = useLayout();

// funtion for auth
const userStore = useUserStore();
const router = useRouter();
const route = useRoute();
const { confirmLogout } = useAuth();
const { canAccessDashboard } = useRoles();

const props = defineProps({
    admin: {
        type: Boolean,
        default: false
    },
    variant: {
        type: String,
        default: 'default' // 'default', 'container', 'page-header'
    },
    pageTitle: {
        type: String,
        default: ''
    },
    showNotificationActions: {
        type: Boolean,
        default: false
    },
    notificationStats: {
        type: Object,
        default: () => ({ total: 0, unread: 0 })
    }
});

const emit = defineEmits(['back', 'mark-all-read', 'clear-all']);

const classes = computed(() => {
    return {
        'lg:!max-w-full': props.admin === true
    };
});

const isDashboardRoute = computed(() => {
    return route.path.startsWith('/dashboard');
});

/** Logo link by role: user -> /, driver -> /driver, superadmin/mitra -> /dashboard */
const logoLink = computed(() => {
    const role = userStore.role;
    if (role === ROLES.DRIVER) return '/driver';
    if (role === ROLES.SUPERADMIN || role === ROLES.MITRA) return '/dashboard';
    return '/';
});

// Role-based computed properties are now handled by useRoles composable

const handleLogout = () => {
    confirmLogout('/auth/login');
};

const goBack = () => {
    emit('back');
};

const notificationCount = ref(0);

// Update notification count
const updateNotificationCount = () => {
    const notifications = NotificationService.getStoredNotifications();
    notificationCount.value = notifications.filter((n) => !n.read).length;
};

// Go to notifications page
const goToNotifications = () => {
    if (isDashboardRoute.value) {
        router.push('/dashboard/notifications');
    } else {
        router.push('/notifications');
    }
};

// Setup notification listeners
const setupNotificationListeners = () => {
    NotificationService.on('payment_update', () => {
        updateNotificationCount();
    });
};

// Cleanup
const cleanup = () => {
    NotificationService.off('payment_update', () => { });
};

// Check user data on mount (in case of refresh)
onMounted(() => {
    updateNotificationCount();
    setupNotificationListeners();
});

// Notification actions menu
const notificationMenu = ref();
const notificationMenuItems = computed(() => [
    {
        label: 'Mark All Read',
        icon: 'pi pi-check',
        command: () => emit('mark-all-read'),
        disabled: props.notificationStats.unread === 0
    },
    {
        separator: true
    },
    {
        label: 'Clear All',
        icon: 'pi pi-trash',
        command: () => emit('clear-all'),
        disabled: props.notificationStats.total === 0,
        class: 'text-red-600'
    }
]);

const toggleNotificationMenu = (event) => {
    notificationMenu.value.toggle(event);
};

onUnmounted(() => {
    cleanup();
});
</script>

<template>
    <div class="layout-topbar">
        <div
            :class="['relative flex items-center justify-between w-full lg:max-w-screen-lg lg:px-4 mx-auto lg:!max-w-full', classes]">
            <!-- Page Header Variant -->
            <div v-if="variant === 'page-header'" class="layout-topbar-logo-container">
                <div class="flex items-center">
                    <Button severity="contrast" icon="pi pi-arrow-left" text size="large" class="text-primary -ml-4"
                        @click="goBack" />
                    <h1 class="text-xl m-0 ml-0 font-bold text-gray-900 dark:text-white">{{ pageTitle }}</h1>
                </div>
            </div>

            <!-- Page Header Actions -->
            <div v-if="variant === 'page-header' && showNotificationActions" class="layout-topbar-actions">
                <Button severity="contrast" icon="pi pi-ellipsis-v" text @click="toggleNotificationMenu"
                    aria-haspopup="true" aria-controls="notification_actions_menu" />
                <Menu ref="notificationMenu" id="notification_actions_menu" popup :model="notificationMenuItems"
                    class="!min-w-40" />
            </div>

            <!-- Default/Container Variant -->
            <div v-if="variant !== 'page-header'" class="layout-topbar-logo-container">
                <button class="layout-menu-button layout-topbar-action" @click="toggleMenu"
                    v-if="canAccessDashboard && isDashboardRoute">
                    <i class="pi pi-bars"></i>
                </button>

                <router-link :to="logoLink" class="layout-topbar-logo">
                    <div class="flex justify-center items-center w-10">
                        <img :src="brandConfig.logos.circle" :alt="brandConfig.shortName" />
                    </div>
                    <span class="hidden lg:block">{{ brandConfig.shortName }}</span>
                </router-link>
            </div>

            <div v-if="variant !== 'page-header'" class="layout-topbar-actions">
                <button class="layout-menu-button layout-topbar-action" @click="goToNotifications">
                    <OverlayBadge severity="primary"
                        :value="notificationCount > 0 ? notificationCount.toString() : null">
                        <i class="pi pi-bell" />
                    </OverlayBadge>
                </button>

                <button class="layout-topbar-menu-button layout-topbar-action"
                    v-styleclass="{ selector: '@next', enterFromClass: 'hidden', enterActiveClass: 'animate-scalein', leaveToClass: 'hidden', leaveActiveClass: 'animate-fadeout', hideOnOutsideClick: true }"
                    v-if="canAccessDashboard">
                    <UserAvatar :avatar="userStore.user?.avatar || ''"
                        :name="userStore.user?.fullname || userStore.user?.username || ''" size="small" />
                </button>

                <div class="layout-topbar-menu hidden">
                    <div class="layout-topbar-menu-content">
                        <!-- Navigation Shortcuts -->
                        <router-link to="/"
                            v-if="canAccessDashboard && !isDashboardRoute && (userStore.role === ROLES.SUPERADMIN || userStore.role === ROLES.MITRA)">
                            <button type="button" class="layout-topbar-action">
                                <i class="pi pi-home"></i>
                                <span>Home</span>
                            </button>
                        </router-link>

                        <!-- Dashboard (admin/mitra) -->
                        <router-link to="/dashboard"
                            v-if="canAccessDashboard && !isDashboardRoute && (userStore.role === ROLES.SUPERADMIN || userStore.role === ROLES.MITRA)">
                            <button type="button" class="layout-topbar-action">
                                <i class="pi pi-th-large"></i>
                                <span>Dashboard</span>
                            </button>
                        </router-link>

                        <!-- Driver Dashboard -->
                        <router-link to="/driver"
                            v-if="userStore.role === ROLES.DRIVER && !route.path.startsWith('/driver')">
                            <button type="button" class="layout-topbar-action">
                                <i class="pi pi-home"></i>
                                <span>Dashboard</span>
                            </button>
                        </router-link>

                        <!-- Settings -->
                        <button type="button" class="layout-topbar-action" @click="toggleDarkMode" title="Theme Mode"
                            aria-label="Theme Mode">
                            <i :class="['pi', { 'pi-moon': isDarkTheme, 'pi-sun': !isDarkTheme }]"></i>
                            <span>{{ isDarkTheme ? 'Dark Mode' : 'Light Mode' }}</span>
                        </button>

                        <!-- User Actions -->
                        <router-link v-if="userStore.user" to="/dashboard/profile">
                            <button type="button" class="layout-topbar-action">
                                <i class="pi pi-user"></i>
                                <span>Profile</span>
                            </button>
                        </router-link>

                        <!-- Logout -->
                        <button type="button" class="layout-topbar-action" @click="handleLogout" title="Logout"
                            aria-label="Logout" v-if="userStore.user">
                            <i class="pi pi-sign-out"></i>
                            <span>Logout</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Confirmation Dialog -->
    <ConfirmDialog />
</template>
