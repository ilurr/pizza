<script setup lang="ts">
import CardListSkeleton from '@/components/CardListSkeleton.vue';
import { defineAsyncComponent, ref } from 'vue';

const OrderTrackingModal = defineAsyncComponent(() => import('@/components/OrderTrackingModal.vue'));

const hasRating = (order: any) => {
	const r = order?.rating;
	if (!r) return false;
	return (r.foodScore ?? r.score ?? 0) > 0 || (r.driverScore ?? 0) > 0;
};

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
	loading?: boolean;
}

defineProps<Props>();

const trackingModalVisible = ref(false);
const selectedOrder = ref(null);

const getStatusColor = (status: string) => {
	switch (status) {
		case 'delivered':
			return 'bg-green-200 text-green-800';
		case 'preparing':
			return 'bg-blue-200 text-blue-800';
		case 'waiting':
			return 'bg-orange-200 text-orange-800';
		case 'on_delivery':
			return 'bg-yellow-200 text-yellow-800';
		case 'cancelled':
			return 'bg-red-200 text-red-800';
		default:
			return 'bg-gray-200 text-gray-800';
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
		<!-- Loading State -->
		<CardListSkeleton v-if="loading" :count="3" />

		<!-- Empty State -->
		<div v-else-if="orders.length === 0" class="text-center py-8">
			<div class="mb-4">
				<i v-if="emptyState.iconType === 'icon'" :class="emptyState.iconClass"></i>
				<img v-else-if="emptyState.iconType === 'image'" :src="emptyState.imageSrc" :alt="emptyState.title"
					loading="lazy" class="w-64 h-64 mx-auto">
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
						<p class="font-bold text-base text-gray-900 mb-2">Rp{{ order.total.toLocaleString('id-ID') }}</p>
						<!-- On-progress tracking CTA -->
						<Button v-if="showTracking && canTrackOrder(order.status)" label="Track your Chef" rounded size="small"
							icon="pi pi-map-marker" iconPos="left" severity="success" @click.stop="openTracking(order)" />
						<!-- History rating CTA: button (not yet rated) -->
						<Button v-else-if="!showTracking && order.status === 'delivered' && !hasRating(order)" label="Add Rating"
							severity="primary" icon="pi pi-star" iconPos="left" rounded size="small"
							@click.stop="openTracking(order)" />
						<!-- Status pill (delivery status, including delivered/rated orders) -->
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