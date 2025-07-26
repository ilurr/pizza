<script setup>
import logo from '@/assets/images/LogoCircleRedSVG.svg';
import { useAuth } from '@/composables/useAuth';
import { useAvatar } from '@/composables/useAvatar';
import { useRoles } from '@/composables/useRoles';
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
		default: false,
	},
	variant: {
		type: String,
		default: 'default', // 'default', 'container', 'page-header'
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
		'lg:!px-10': props.admin === true
	};
});

const isDashboardRoute = computed(() => {
	return route.path.startsWith('/dashboard');
});

// Role-based computed properties are now handled by useRoles composable

const handleLogout = () => {
	confirmLogout('/auth/login');
};

const goBack = () => {
	emit('back');
};

// Use shared avatar composable
const { userInitials, bgColor } = useAvatar(computed(() => userStore.user?.username));

const notificationCount = ref(0);

// Update notification count
const updateNotificationCount = () => {
	const notifications = NotificationService.getStoredNotifications();
	notificationCount.value = notifications.filter(n => !n.read).length;
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
	<div :class="['layout-topbar lg:px-80', classes]">
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
			<Button severity="contrast" icon="pi pi-ellipsis-v" text @click="toggleNotificationMenu" aria-haspopup="true"
				aria-controls="notification_actions_menu" />
			<Menu ref="notificationMenu" id="notification_actions_menu" popup :model="notificationMenuItems"
				class="!min-w-40" />
		</div>

		<!-- Default/Container Variant -->
		<div v-if="variant !== 'page-header'" class="layout-topbar-logo-container">

			<button class="layout-menu-button layout-topbar-action" @click="toggleMenu"
				v-if="canAccessDashboard && isDashboardRoute">
				<i class="pi pi-bars"></i>
			</button>

			<router-link :to="isDashboardRoute ? '/dashboard' : '/'" class="layout-topbar-logo">
				<div class="flex justify-center items-center w-10">
					<img :src="logo" alt="" />
				</div>
				<span class="hidden lg:block">Panggil Papa <em>Pizza</em></span>
			</router-link>
		</div>

		<div v-if="variant !== 'page-header'" class="layout-topbar-actions">

			<button class="layout-menu-button layout-topbar-action" @click="goToNotifications">
				<OverlayBadge severity="primary" :value="notificationCount > 0 ? notificationCount.toString() : null">
					<i class="pi pi-bell" />
				</OverlayBadge>
			</button>

			<button class="layout-topbar-menu-button layout-topbar-action"
				v-styleclass="{ selector: '@next', enterFromClass: 'hidden', enterActiveClass: 'animate-scalein', leaveToClass: 'hidden', leaveActiveClass: 'animate-fadeout', hideOnOutsideClick: true }"
				v-if="canAccessDashboard">
				<Avatar v-if="userStore.user?.avatar" :image="userStore.user.avatar" size="small" shape="circle" />
				<Avatar v-else :label=userInitials size="small" shape="circle" :style="{ backgroundColor: bgColor }" />
			</button>

			<div class="layout-topbar-menu hidden">
				<div class="layout-topbar-menu-content">
					<!-- Navigation Shortcuts -->
					<router-link to="/" v-if="canAccessDashboard && isDashboardRoute">
						<button type="button" class="layout-topbar-action">
							<i class="pi pi-home"></i>
							<span>Home</span>
						</button>
					</router-link>
					<router-link to="/dashboard" v-if="canAccessDashboard && !isDashboardRoute">
						<button type="button" class="layout-topbar-action">
							<i class="pi pi-th-large"></i>
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
					<button type="button" class="layout-topbar-action" @click="handleLogout" title="Logout" aria-label="Logout"
						v-if="userStore.user">
						<i class="pi pi-sign-out"></i>
						<span>Logout</span>
					</button>
				</div>
			</div>

		</div>
	</div>

	<!-- Confirmation Dialog -->
	<ConfirmDialog />
</template>
