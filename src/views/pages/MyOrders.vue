<script setup lang="ts">
import imageSrc from '@/assets/images/Orders.svg';
import FloatingMenu from '@/components/landing/FloatingMenu.vue';
import OrderList from '@/components/OrderList.vue';
import { useActiveOrders } from '@/composables/useActiveOrders';
import { useAuth } from '@/composables/useAuth';
import AppTopbar from '@/layout/AppTopbar.vue';
import { ProductService } from '@/service/ProductService.js';
import { useUserStore } from '@/stores/userStore';
import { isAuthenticated } from '@/utils/auth';
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const userStore = useUserStore();
const { goToLogin } = useAuth();
const { fetchActiveOrders } = useActiveOrders();

const activeTab = ref("1"); // "1" for "On Progress", "0" for "History"
const orderHistory = ref([]);
const onProgressOrders = ref([]);
// Start loading when authenticated so we don't flash empty state before fetch
const isLoading = ref(isAuthenticated());

// Empty states for authenticated users (no orders)
const historyEmptyState = {
	title: 'No Order History',
	message: "You haven't completed any orders yet.",
	iconType: 'image' as const,
	imageSrc: imageSrc
};

const onProgressEmptyState = {
	title: 'No Active Orders',
	message: "You don't have any orders in progress right now.",
	iconType: 'image' as const,
	imageSrc: imageSrc
};

// Empty states for unauthenticated users (login required)
const loginRequiredHistoryState = {
	title: 'No Order History',
	message: "Sign in to check out all your previous pizza orders!",
	iconType: 'image' as const,
	imageSrc: imageSrc,
	showLoginButton: true
};

const loginRequiredProgressState = {
	title: 'No Active Orders',
	message: "Sign in to see your current orders and track when they'll arrive!",
	iconType: 'image' as const,
	imageSrc: imageSrc,
	showLoginButton: true
};

const goBack = () => {
	router.push('/');
};


// Computed properties for dynamic empty states
const currentHistoryEmptyState = computed(() => {
	return isAuthenticated() ? historyEmptyState : loginRequiredHistoryState;
});

const currentProgressEmptyState = computed(() => {
	return isAuthenticated() ? onProgressEmptyState : loginRequiredProgressState;
});

const loadUserOrders = async () => {
	if (!isAuthenticated()) {
		console.log('User not authenticated, skipping order fetch');
		return;
	}

	isLoading.value = true;
	try {
		// Ensure user data is loaded
		if (!userStore.user) {
			await userStore.fetchUser();
		}

		// Only fetch orders for this account — never mix in guest_user / walk-in orders
		const userId = userStore.user?.id;
		if (userId == null || String(userId) === '') {
			orderHistory.value = [];
			onProgressOrders.value = [];
			return;
		}
		const orders = await ProductService.getOrders(String(userId));

		// Filter orders for history (delivered, cancelled)
		orderHistory.value = orders.filter(order =>
			order.status === 'delivered' || order.status === 'cancelled'
		);
		// Filter orders for on progress (pending, assigned, preparing, on_delivery)
		onProgressOrders.value = orders.filter(order =>
			['pending', 'assigned', 'preparing', 'on_delivery'].includes(order.status)
		);

		// Auto-switch to "On Progress" tab if there are active orders
		if (onProgressOrders.value.length > 0) {
			activeTab.value = "1"; // On Progress tab
		} else {
			activeTab.value = "0"; // History tab
		}
	} catch (error) {
		console.error('Error loading orders:', error);
	} finally {
		isLoading.value = false;
	}
};

onMounted(async () => {
	await loadUserOrders();
	// Refresh active orders for the badge
	await fetchActiveOrders();
});
</script>

<template>
	<div class="bg-white dark:bg-neutral-900">
		<div class="landing-wrapper overflow-hidden">
			<app-topbar variant="page-header" page-title="My Orders" @back="goBack"></app-topbar>
			<FloatingMenu />
			<div class="relative lg:max-w-screen-lg mx-auto pt-16 md:pt-16 md:px-4 mb-32">

				<!-- PrimeVue Tabs -->
				<Tabs v-model:value="activeTab">

					<TabList>
						<Tab value="0">History</Tab>
						<Tab value="1">On Progress</Tab>
					</TabList>

					<TabPanels>
						<!-- History Tab Panel -->
						<TabPanel value="0">
							<OrderList :orders="orderHistory" :empty-state="currentHistoryEmptyState" :show-tracking="false"
								:loading="isLoading" @login-required="goToLogin" />
						</TabPanel>

						<!-- On Progress Tab Panel -->
						<TabPanel value="1">
							<OrderList :orders="onProgressOrders" :empty-state="currentProgressEmptyState" :show-tracking="true"
								:loading="isLoading" @login-required="goToLogin" />
						</TabPanel>
					</TabPanels>
				</Tabs>
			</div>
		</div>
	</div>
</template>
