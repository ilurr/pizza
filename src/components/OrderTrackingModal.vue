<script setup lang="ts">
import api from '@/services/api/index.js';
import StarRating from '@/components/StarRating.vue';
import { useLeaflet } from '@/composables/useLeaflet';
import { useTrackingService } from '@/composables/useTrackingService';
import { useOrderStore } from '@/stores/orderStore.js';
import { computed, onUnmounted, ref, watch } from 'vue';

const props = defineProps({
	visible: {
		type: Boolean,
		default: false
	},
	order: {
		type: Object,
		required: false,
		default: null
	}
});

const emit = defineEmits(['update:visible', 'rate']);

const selectedFoodRating = ref(0);
const selectedDriverRating = ref(0);

const orderStore = useOrderStore();

const tracking = ref<any | null>(null);
const trackingLoading = ref(false);

const {
	userPosition,
	driverPosition,
	isLoading,
	getLocation,
	updateDriverPosition,
	simulateDriverNear,
	simulateDriverArrived,
	simulateDriverNormal
} = useTrackingService();

const {
	createMap,
	addMarker,
	clearMarkers,
	clearRoutes,
	fitBounds,
	calculateDistance,
	getCurrentLocation,
	drawRoute
} = useLeaflet();

const map = ref<any>(null);
const mapContainer = ref<HTMLElement | null>(null);
const refreshing = ref(false);

// Computed properties
const isVisible = computed({
	get: () => props.visible,
	set: (value) => emit('update:visible', value)
});

const orderCanBeTracked = computed(() => {
	const status = tracking.value?.currentStatus || currentOrder.value?.status;
	return ['pending', 'assigned', 'preparing', 'on_delivery'].includes(status);
});

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

const currentOrder = computed(() => {
	return props.order || null;
});

const driverInfo = computed(() => {
	// Prefer driver info from tracking (Supabase orders.driver_info)
	if (tracking.value?.driverInfo) {
		return tracking.value.driverInfo;
	}

	// Fallback: driver data from order (if any)
	if (currentOrder.value?.driverInfo) {
		return currentOrder.value.driverInfo;
	}

	// Fallback: driver selected during ordering
	if (orderStore.selectedDriver) {
		return {
			name: orderStore.selectedDriver.name,
			avatar: orderStore.selectedDriver.avatar,
			phone: orderStore.selectedDriver.phone,
			rating: orderStore.selectedDriver.rating
		};
	}

	return null;
});

const estimatedArrival = computed(() => {
	const eta = tracking.value?.estimatedDelivery;
	if (!eta) return null;
	const now = new Date();
	const etaDate = new Date(eta);
	const diffMs = etaDate.getTime() - now.getTime();
	const minutes = Math.max(0, Math.round(diffMs / 60000));
	return {
		minutes,
		time: etaDate.toLocaleTimeString('id-ID', {
			hour: '2-digit',
			minute: '2-digit'
		})
	};
});

// Methods
const loadTracking = async () => {
	if (!currentOrder.value?.id) {
		tracking.value = null;
		return;
	}
	trackingLoading.value = true;
	try {
		const res = await api.orders.getOrderTracking(currentOrder.value.id);
		tracking.value = res?.success ? res.data : null;
	} catch (error) {
		console.error('Failed to load order tracking:', error);
		tracking.value = null;
	} finally {
		trackingLoading.value = false;
	}
};

const initializeMap = async () => {
	if (!mapContainer.value) return;

	try {
		// Clean up existing map
		if (map.value) {
			map.value.remove();
			map.value = null;
		}

		// Create a basic map centered on a default city (fallback until we have precise coords)
		map.value = await createMap(mapContainer.value, [-7.2575, 112.7521], 13);

	} catch (error) {
		console.error('Error initializing map:', error);
	}
};

const createUserMarkerIcon = async () => {
	const { createMarkerIcon } = useLeaflet();
	return await createMarkerIcon({
		color: '#3b82f6',
		size: 20
	});
};

const createDriverMarkerIcon = async () => {
	const { createMarkerIcon } = useLeaflet();
	return await createMarkerIcon({
		color: '#ef4444',
		size: 20
	});
};

const addDriverMarker = async () => {
	if (!map.value || !driverPosition.value) return;

	const driverMarker = await addMarker(map.value, driverPosition.value.lat, driverPosition.value.lng, {
		icon: await createDriverMarkerIcon(),
		popup: `Driver: ${driverInfo.value.name}`
	});

	// Fit map to show both markers
	const userMarker = await addMarker(map.value, userPosition.value.lat, userPosition.value.lng, {
		icon: await createUserMarkerIcon()
	});

	// Draw route between driver and user
	try {
		const routeResult = await drawRoute(
			map.value,
			driverPosition.value.lat,
			driverPosition.value.lng,
			userPosition.value.lat,
			userPosition.value.lng,
			{
				color: '#059669',
				weight: 4,
				opacity: 0.7
			}
		);

		// If routing service fails, draw a straight line as fallback
		if (!routeResult) {
			console.log('Using straight line fallback for route');
			const { drawStraightLine } = useLeaflet();
			await drawStraightLine(
				map.value,
				driverPosition.value.lat,
				driverPosition.value.lng,
				userPosition.value.lat,
				userPosition.value.lng,
				{
					color: '#059669',
					weight: 3,
					opacity: 0.6,
					dashArray: '10, 5'
				}
			);
		}
	} catch (error) {
		console.warn('Route drawing failed, using straight line:', error);
		const { drawStraightLine } = useLeaflet();
		await drawStraightLine(
			map.value,
			driverPosition.value.lat,
			driverPosition.value.lng,
			userPosition.value.lat,
			userPosition.value.lng,
			{
				color: '#059669',
				weight: 3,
				opacity: 0.6,
				dashArray: '10, 5'
			}
		);
	}

	await fitBounds(map.value, [userMarker, driverMarker]);
};

const refreshTracking = async () => {
	refreshing.value = true;

	try {
		await loadTracking();
	} catch (error) {
		console.error('Error refreshing tracking:', error);
	} finally {
		setTimeout(() => {
			refreshing.value = false;
		}, 1000);
	}
};

const closeModal = () => {
	isVisible.value = false;
};

const foodScore = (order: any) => order?.rating?.foodScore ?? order?.rating?.score ?? 0;
const driverScore = (order: any) => order?.rating?.driverScore ?? 0;

const onRateFood = (score: number) => {
	selectedFoodRating.value = score;
	emit('rate', { orderId: props.order?.id, type: 'food', score });
};

const onRateDriver = (score: number) => {
	selectedDriverRating.value = score;
	emit('rate', { orderId: props.order?.id, type: 'driver', score });
};

const hasFoodRating = (order: any) => (foodScore(order) || selectedFoodRating.value) > 0;
const hasDriverRating = (order: any) => (driverScore(order) || selectedDriverRating.value) > 0;

// Lifecycle
watch(
	() => props.visible,
	(newVal) => {
		if (newVal && props.order) {
			selectedFoodRating.value = foodScore(props.order);
			selectedDriverRating.value = driverScore(props.order);
			loadTracking();
			if (orderCanBeTracked.value) {
				setTimeout(() => {
					initializeMap();
				}, 300); // Wait for modal to render
			}
		}
	}
);

watch(
	() => props.order,
	(order) => {
		if (order) {
			selectedFoodRating.value = foodScore(order);
			selectedDriverRating.value = driverScore(order);
			loadTracking();
		} else {
			tracking.value = null;
		}
	},
	{ immediate: true }
);

onUnmounted(() => {
	if (map.value) {
		map.value.remove();
		map.value = null;
	}
});
</script>

<template>
	<Dialog v-model:visible="isVisible" modal :header="orderCanBeTracked ? 'Track Your Order' : 'Order Details'"
		:style="{ width: '90vw', maxWidth: '600px' }" class="order-tracking-modal dialog-flex-end" :closable="true"
		position="center">

		<div v-if="!currentOrder" class="text-center p-6">
			<i class="pi pi-exclamation-triangle text-4xl text-yellow-500 mb-4"></i>
			<h3 class="text-lg font-semibold mb-2">No Order Available</h3>
			<p class="text-gray-600">Unable to load order information.</p>
		</div>

		<div v-else>
			<!-- Order Summary -->
			<!-- <div class="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
				<div class="flex items-center justify-between mb-2">
					<h3 class="font-semibold text-lg">Order #{{ order.orderNumber }}</h3>
					<Tag :value="order.status"
						:severity="order.status === 'delivered' ? 'success' : order.status === 'cancelled' ? 'danger' : order.status === 'preparing' ? 'info' : 'warning'" />
				</div>
				<p class="text-sm text-gray-600 dark:text-gray-400 mb-1">{{ formatDate(order.orderDate) }} • {{
					formatTime(order.orderDate) }}</p>
				<p class="text-sm text-gray-600 dark:text-gray-400">{{ order.customerName }}</p>
				<p class="font-bold text-lg text-green-600 mt-2">Total: Rp{{ order.total.toLocaleString('id-ID') }}</p>
			</div> -->

			<!-- Tracking Section (only for trackable orders) -->
			<div v-if="orderCanBeTracked">
				<!-- <h4 class="font-semibold text-lg mb-3 text-gray-800 dark:text-white">Live Tracking</h4> -->

				<!-- Driver Info -->
				<div
					class="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-4 mb-6">
					<!-- <div class="flex items-center justify-between mb-3">
						<h4 class="font-medium text-lg text-gray-900 dark:text-white mb-0">Your Chef</h4>
						<Button icon="pi pi-refresh" outlined rounded size="small" @click="refreshTracking" :loading="refreshing"
							label="Refresh" title="Refresh tracking" />
					</div> -->
					<div class="flex items-center gap-3">
						<ImageWithSkeleton :src="driverInfo.avatar" wrapperClass="relative aspect-square rounded-full" width="45px"
							height="45px" />
						<!-- <div class="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-semibold">
							{{ driverInfo.name.charAt(0) }}
						</div> -->
						<div class="flex-1">
							<p class="font-medium text-lg mb-0">{{ driverInfo.name }}</p>
							<div v-if="estimatedArrival" class="text-sm text-gray-600 dark:text-gray-400">
								<p>Estimated arrival: {{ estimatedArrival.time }}</p>
							</div>

							<!-- <div class="flex items-center gap-1">
								<i class="pi pi-star-fill text-yellow-500 text-xs"></i>
								<span class="text-sm">{{ driverInfo.rating }}</span>
							</div> -->
						</div>
						<!-- <Button icon="pi pi-phone" text size="small" severity="success" :onclick="`tel:${driverInfo.phone}`" /> -->
					</div>
					<div class="flex items-center gap-3 mt-4 pt-4 border-t">
						<div class="flex-1">
							<p v-if="estimatedArrival" class="font-sm text-sm mb-1">
								Your chef is on the way! Estimated arrival:
								<span
									class="inline-block bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-semibold"
								>
									{{ estimatedArrival.time }} ({{ estimatedArrival.minutes }} mins)
								</span>
							</p>
							<p v-else class="font-sm text-sm mb-1">
								Your chef is on the way. Estimated time will appear here once available.
							</p>
						</div>
						<Button
							v-if="driverInfo?.phone"
							icon="pi pi-phone"
							rounded
							size="small"
							severity="success"
							:onclick="`tel:${driverInfo.phone}`"
							label="Call"
							title="Call driver"
						/>
						<Button
							icon="pi pi-refresh"
							outlined
							rounded
							size="small"
							@click="refreshTracking"
							:loading="refreshing || trackingLoading"
							label="Refresh"
							title="Refresh tracking"
						/>
					</div>
				</div>

				<!-- ETA Info -->
				<!-- <div v-if="estimatedArrival"
					class="mb-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
					<div class="flex items-center gap-2 mb-2">
						<i class="pi pi-clock text-green-600"></i>
						<span class="font-medium text-green-800 dark:text-green-200">Estimated Arrival</span>
					</div>
					<p class="text-lg font-semibold text-green-800 dark:text-green-200">{{ estimatedArrival.time }}</p>
					<p class="text-sm text-green-600 dark:text-green-300">
						~{{ estimatedArrival.minutes }} minutes
					</p>
				</div> -->

				<!-- Map Container -->
				<div class="relative">
					<div ref="mapContainer" class="w-full h-64 bg-gray-100 dark:bg-gray-800 rounded-lg"
						style="min-height: 256px;">
					</div>
					<div v-if="isLoading" class="absolute inset-0 flex items-center justify-center bg-gray-100/80 rounded-lg">
						<ProgressSpinner style="width: 30px; height: 30px" />
					</div>
				</div>

				<!-- Debug: Driver State Simulation -->
				<!-- <div class="mt-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
					<p class="text-sm font-medium mb-2">Test Driver States:</p>
					<div class="flex gap-2">
						<Button label="Normal" outlined size="small" @click="simulateDriverNormal" />
						<Button label="Near" outlined size="small" @click="simulateDriverNear" />
						<Button label="Arrived" outlined size="small" @click="simulateDriverArrived" />
					</div>
				</div> -->

				<!-- Legend -->
				<!-- <div class="flex justify-center gap-4 mt-4 text-sm">
					<div class="flex items-center gap-2">
						<div class="w-3 h-3 bg-blue-500 rounded-full"></div>
						<span>Your Location</span>
					</div>
					<div class="flex items-center gap-2">
						<div class="w-3 h-3 bg-red-500 rounded-full"></div>
						<span>Driver Location</span>
					</div>
					<div class="flex items-center gap-2">
						<div class="w-4 h-1 rounded" style="background-color: #059669;"></div>
						<span>Route</span>
					</div>
				</div> -->
			</div>

			<!-- Status Info for Non-Trackable Orders -->
			<div v-else
				class="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
				<div class="flex items-center gap-2 mb-2">
					<i class="pi pi-info-circle text-blue-600"></i>
					<span class="font-medium text-blue-800 dark:text-blue-200">Order Status</span>
				</div>
				<p v-if="order.status === 'preparing'" class="text-blue-800 dark:text-blue-200">
					Your order is being prepared in the kitchen. Tracking will be available once it's ready for delivery.
				</p>
				<p v-else-if="order.status === 'delivered'" class="text-blue-800 dark:text-blue-200">
					Your order was delivered on {{ formatDate(order.deliveryTime || order.orderDate) }} at {{
						formatTime(order.deliveryTime || order.orderDate) }}.
				</p>
				<p v-else-if="order.status === 'cancelled'" class="text-blue-800 dark:text-blue-200">
					This order was cancelled. Please contact support if you have any questions.
				</p>
				<p v-else class="text-blue-800 dark:text-blue-200">
					Order status: {{ order.status }}
				</p>
			</div>

			<!-- Rating Section (delivered orders only) -->
			<div v-if="currentOrder.status === 'delivered'" class="mt-6">
				<h4 class="font-semibold mb-3 text-gray-900 dark:text-white text-lg">Rating</h4>
				<div class="space-y-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
					<div class="relative space-y-4">
						<div class="flex items-center justify-between gap-2">
							<div class="font-medium text-gray-900 dark:text-white mb-0">Rate the food</div>
							<div v-if="hasFoodRating(order)" class="flex items-center gap-2 text-gray-700 dark:text-gray-300">
								<span class="text-sm">{{ foodScore(order) || selectedFoodRating }}/5</span>
								<StarRating :model-value="foodScore(order) || selectedFoodRating" readonly size="xl" />
							</div>
							<div v-else class="flex items-center gap-2">
								<StarRating :model-value="selectedFoodRating" size="xl" @update:model-value="onRateFood" />
							</div>
						</div>
						<div class="flex items-center justify-between gap-2">
							<div class="font-medium text-gray-900 dark:text-white mb-0">Rate the chef</div>
							<div v-if="hasDriverRating(order)" class="flex items-center gap-2 text-gray-700 dark:text-gray-300">
								<span class="text-sm">{{ driverScore(order) || selectedDriverRating }}/5</span>
								<StarRating :model-value="driverScore(order) || selectedDriverRating" readonly size="xl" />
							</div>
							<div v-else class="flex items-center gap-2">
								<StarRating :model-value="selectedDriverRating" size="xl" @update:model-value="onRateDriver" />
							</div>
						</div>
					</div>
				</div>
			</div>

			<!-- Order Items Detail -->
			<div class="mt-6">
				<h4 class="font-semibold mb-3 text-gray-900 dark:text-white text-lg">Order Items</h4>
				<div class="space-y-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
					<div class="relative">
						<div v-for="item in currentOrder.items" :key="item.id"
							class="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700 first:pt-0 last:border-b-0">
							<div class="flex-1">
								<p class="font-medium text-gray-900 dark:text-white mb-0">{{ item.name }}</p>
								<p class="text-sm text-gray-500 dark:text-gray-400">{{ item.quantity }} × Rp{{
									item.price.toLocaleString('id-ID') }}</p>
							</div>
							<p class="font-medium text-gray-900 dark:text-white">Rp{{ item.total.toLocaleString('id-ID') }}</p>
						</div>
					</div>
					<!-- Subtotal -->
					<div class="flex justify-between items-center pt-2 border-t border-gray-200 dark:border-gray-700">
						<p class="font-medium text-gray-900 dark:text-white mb-0">Subtotal</p>
						<p class="font-medium text-gray-900 dark:text-white">Rp{{ currentOrder.subtotal.toLocaleString('id-ID') }}
						</p>
					</div>

					<!-- Discount (if applicable) -->
					<div v-if="currentOrder.discount && currentOrder.discount > 0" class="flex justify-between items-center pt-1">
						<div>
							<p class="font-medium text-gray-900 dark:text-white mb-0">Discount</p>
							<p v-if="currentOrder.promoCode" class="text-xs text-blue-600 dark:text-blue-400">{{
								currentOrder.promoCode }} - {{ currentOrder.promoTitle }}</p>
						</div>
						<p class="font-medium text-red-600">-Rp{{ currentOrder.discount.toLocaleString('id-ID') }}</p>
					</div>

					<!-- Total -->
					<div class="flex justify-between items-center pt-2 border-t border-gray-200 dark:border-gray-700">
						<p class="font-semibold text-lg text-gray-900 dark:text-white mb-0">Total Amount</p>
						<p class="font-bold text-lg text-green-600">Rp{{ currentOrder.total.toLocaleString('id-ID') }}</p>
					</div>
					<div class="flex justify-between items-center pt-2 border-t border-gray-200 dark:border-gray-700">
						<p class="font-medium text-gray-900 dark:text-white mb-0">Payment Method</p>
						<p class="text-gray-600 dark:text-gray-400">{{ currentOrder.paymentMethod }}</p>
					</div>
					<!-- <div v-if="currentOrder.notes" class="pt-2 border-t border-gray-200 dark:border-gray-700">
						<p class="text-sm text-gray-600 dark:text-gray-400">
							<i class="pi pi-info-circle mr-1"></i>{{ currentOrder.notes }}
						</p>
					</div> -->
				</div>
			</div>

		</div>

		<template #footer>
			<div class="flex justify-end">
				<Button label="Close" text @click="closeModal" />
			</div>
		</template>
	</Dialog>
</template>

<style scoped>
.order-tracking-modal :deep(.p-dialog-content) {
	padding: 1rem;
}

:deep(.custom-marker) {
	background: transparent !important;
	border: none !important;
}
</style>