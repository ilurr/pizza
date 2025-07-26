<script setup lang="ts">
import OrderTrackingModal from '@/components/OrderTrackingModal.vue';
import { ref } from 'vue';

interface EmptyStateConfig {
	title: string;
	message: string;
	iconType: 'icon' | 'image';
	iconClass?: string;
	imageSrc?: string;
}

interface Props {
	orders: any[];
	emptyState: EmptyStateConfig;
	showTracking?: boolean;
}

defineProps<Props>();

const trackingModalVisible = ref(false);
const selectedOrder = ref(null);

const getStatusColor = (status: string) => {
	switch (status) {
		case 'delivered':
			return 'bg-green-100 text-green-800';
		case 'preparing':
			return 'bg-blue-100 text-blue-800';
		case 'waiting':
			return 'bg-orange-100 text-orange-800';
		case 'on_delivery':
			return 'bg-yellow-100 text-yellow-800';
		case 'cancelled':
			return 'bg-red-100 text-red-800';
		default:
			return 'bg-gray-100 text-gray-800';
	}
};

const formatDate = (dateString: string) => {
	return new Date(dateString).toLocaleDateString('id-ID', {
		weekday: 'long',
		year: 'numeric',
		month: 'long',
		day: 'numeric'
	});
};

const formatTime = (dateString: string) => {
	return new Date(dateString).toLocaleTimeString('id-ID', {
		hour: '2-digit',
		minute: '2-digit'
	});
};

const openTracking = (order: any) => {
	selectedOrder.value = order;
	trackingModalVisible.value = true;
};

const canTrackOrder = (status: string) => {
	return ['waiting', 'on_delivery'].includes(status);
};

const handleCardClick = (order: any) => {
	// For trackable orders, open tracking modal
	if (canTrackOrder(order.status)) {
		openTracking(order);
	}
	// For non-trackable orders, we could add other actions like viewing details
	// For now, we'll just open the tracking modal for all orders
	else {
		openTracking(order);
	}
};
</script>

<template>
	<div class="space-y-4">
		<!-- Empty State -->
		<div v-if="orders.length === 0" class="text-center py-8">
			<div class="mb-4">
				<i v-if="emptyState.iconType === 'icon'" :class="emptyState.iconClass"></i>
				<img v-else-if="emptyState.iconType === 'image'" :src="emptyState.imageSrc" :alt="emptyState.title"
					class="w-64 h-64 mx-auto">
			</div>
			<h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">{{ emptyState.title }}</h3>
			<p class="text-gray-500 dark:text-gray-400 mb-4">{{ emptyState.message }}</p>
			<router-link to="/order/now" class="flex w-full justify-center pt-4">
				<Button label="Order Now" class="w-1/2 md:w-1/3"></Button>
			</router-link>
		</div>

		<!-- Orders List -->
		<div v-else class="space-y-4">
			<div v-for="order in orders" :key="order.id"
				class="bg-white dark:bg-neutral-800 rounded-xl shadow-sm border border-gray-300 dark:border-transparent p-4 cursor-pointer transition-all duration-200 shadow-sm hover:bg-gray-50 dark:hover:bg-neutral-800"
				@click="handleCardClick(order)">

				<!-- Order Header -->
				<div class="flex justify-between items-start">
					<div>
						<h3 class="font-semibold text-gray-900 dark:text-white text-sm mb-2">{{ order.orderNumber }}</h3>
						<p class="text-sm text-gray-500 dark:text-gray-400 mb-1">{{ formatDate(order.orderDate) }} • {{
							formatTime(order.orderDate) }}</p>
						<p class="text-sm text-gray-500 dark:text-gray-400">
							{{ order.items.length }} item(s) • {{ order.paymentMethod }}
						</p>
					</div>
					<div class="text-right">
						<!-- <span :class="getStatusColor(order.status)" class="px-2 py-1 rounded-full text-xs font-medium">
							{{ order.status }}
						</span> -->
						<p class="font-bold text-base text-green-500 mb-2">Rp{{ order.total.toLocaleString('id-ID') }}</p>
						<Button v-if="canTrackOrder(order.status)" label="Track Order" outlined rounded size="small"
							severity="contrast" @click.stop="openTracking(order)" />
						<span v-else :class="getStatusColor(order.status)" class="px-2 py-1 rounded-full text-xs font-medium">
							{{ order.status }}
						</span>
					</div>
				</div>

			</div>
		</div>

		<!-- Tracking Modal -->
		<OrderTrackingModal v-model:visible="trackingModalVisible" :order="selectedOrder" />
	</div>
</template>