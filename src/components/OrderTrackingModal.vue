<script setup lang="ts">
import { useLeaflet } from '@/composables/useLeaflet';
import { useTrackingService } from '@/composables/useTrackingService';
import NotificationService from '@/service/NotificationService.js';
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

const emit = defineEmits(['update:visible']);

const orderStore = useOrderStore();

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
const proximityNotified = ref(false);

// Computed properties
const isVisible = computed({
	get: () => props.visible,
	set: (value) => emit('update:visible', value)
});

const orderCanBeTracked = computed(() => {
	return ['waiting', 'on_delivery'].includes(currentOrder.value?.status);
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

// Sample driver data consistent with OrderNow.vue structure
const sampleDrivers = [
	{
		id: 1,
		name: 'Cak Gilang',
		rating: 4.8,
		phone: '081234567888',
		avatar: 'https://voyee.id/assets/foto_seller/2024_06_17_18_28_06_1718623686_35496cf2d62376ca0ef0.jpg'
	},
	{
		id: 2,
		name: 'Pak Agus',
		rating: 4.8,
		phone: '081234567899',
		avatar: 'https://voyee.id/assets/foto_seller/2024_06_17_18_28_06_1718623686_35496cf2d62376ca0ef0.jpg'
	},
	{
		id: 3,
		name: 'Cak Bram',
		rating: 4.9,
		phone: '081234567777',
		avatar: 'https://voyee.id/assets/foto_seller/2024_06_17_18_27_00_1718623620_0961d218aa38beb0aa77.jpg'
	}
];

// Sample pizza order data for when no real order is provided
const sampleOrder = {
	id: 'order_sample_001',
	orderNumber: 'PZ-2024-006',
	customerName: 'John Doe',
	orderDate: new Date().toISOString(),
	status: 'on_delivery',
	items: [
		{
			id: 'pizza002',
			name: 'Pepperoni Supreme',
			quantity: 1,
			price: 75000,
			total: 75000
		},
		{
			id: 'pizza001',
			name: 'Margherita Classic',
			quantity: 2,
			price: 45000,
			total: 90000
		},
		{
			id: 'drink001',
			name: 'Coca Cola',
			quantity: 2,
			price: 12000,
			total: 24000
		}
	],
	subtotal: 189000,
	discount: 0,
	total: 189000,
	paymentMethod: 'QRIS',
	notes: 'Extra spicy sauce, no onions'
};

// Use sample order if no real order provided
const currentOrder = computed(() => {
	return props.order || sampleOrder;
});

const driverInfo = computed(() => {
	// Use driver data from order store if available
	if (orderStore.selectedDriver) {
		return {
			name: orderStore.selectedDriver.name,
			avatar: orderStore.selectedDriver.avatar,
			phone: orderStore.selectedDriver.phone,
			rating: orderStore.selectedDriver.rating
		};
	}

	// Use sample driver (Pak Agus) as fallback with complete data structure
	const defaultDriver = sampleDrivers.find(driver => driver.name === 'Pak Agus') || sampleDrivers[1];
	return {
		name: defaultDriver.name,
		avatar: defaultDriver.avatar,
		phone: defaultDriver.phone,
		rating: defaultDriver.rating
	};
});

const estimatedArrival = computed(() => {
	if (!driverPosition.value || !userPosition.value) {
		// Provide fallback data while positions are being loaded
		return {
			distance: '2.5',
			minutes: 15,
			time: new Date(Date.now() + 15 * 60000).toLocaleTimeString('id-ID', {
				hour: '2-digit',
				minute: '2-digit'
			})
		};
	}

	const distance = calculateDistance(
		driverPosition.value.lat,
		driverPosition.value.lng,
		userPosition.value.lat,
		userPosition.value.lng
	);

	// Estimate 2 minutes per km
	const estimatedMinutes = Math.ceil(distance * 2);
	const arrivalTime = new Date();
	arrivalTime.setMinutes(arrivalTime.getMinutes() + estimatedMinutes);

	return {
		distance: distance.toFixed(1),
		minutes: estimatedMinutes,
		time: arrivalTime.toLocaleTimeString('id-ID', {
			hour: '2-digit',
			minute: '2-digit'
		})
	};
});

// Methods
const initializeMap = async () => {
	if (!mapContainer.value) return;

	try {
		// Get user location first
		await getLocation();

		if (!userPosition.value) {
			console.error('Unable to get user location');
			return;
		}

		// Clean up existing map
		if (map.value) {
			map.value.remove();
			map.value = null;
		}

		// Create map using global Leaflet composable
		map.value = await createMap(
			mapContainer.value,
			[userPosition.value.lat, userPosition.value.lng],
			15
		);

		// Add user marker
		await addMarker(map.value, userPosition.value.lat, userPosition.value.lng, {
			icon: await createUserMarkerIcon(),
			popup: 'Your Location'
		});

		// Simulate driver position and add marker
		updateDriverPosition();

		if (driverPosition.value) {
			await addDriverMarker();
		}

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
		// Update driver position
		updateDriverPosition();

		// Update map if driver position changed
		if (map.value && driverPosition.value) {
			// Clear existing markers and routes
			await clearMarkers(map.value);
			await clearRoutes(map.value);

			// Re-add markers
			await addMarker(map.value, userPosition.value.lat, userPosition.value.lng, {
				icon: await createUserMarkerIcon(),
				popup: 'Your Location'
			});

			await addDriverMarker();
		}

		// Check proximity and send notification
		checkProximity();

	} catch (error) {
		console.error('Error refreshing tracking:', error);
	} finally {
		setTimeout(() => {
			refreshing.value = false;
		}, 1000);
	}
};

const checkProximity = () => {
	if (!userPosition.value || !driverPosition.value || proximityNotified.value) return;

	const distance = calculateDistance(
		driverPosition.value.lat,
		driverPosition.value.lng,
		userPosition.value.lat,
		userPosition.value.lng
	);

	// Notify when driver is within 500 meters
	if (distance <= 0.5) {
		proximityNotified.value = true;

		NotificationService.create({
			title: 'Driver Almost Arrived!',
			message: `${driverInfo.value.name} is nearby. Please prepare to meet the driver.`,
			type: 'delivery_update',
			data: {
				orderId: props.order.id,
				driverDistance: distance
			}
		});
	}
};

const closeModal = () => {
	isVisible.value = false;
};

// Lifecycle
watch(() => props.visible, (newVal) => {
	if (newVal && props.order && orderCanBeTracked.value) {
		setTimeout(() => {
			initializeMap();
		}, 300); // Wait for modal to render
	}
});

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
								<p>📍 {{ estimatedArrival.distance }} km away</p>
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
							<!-- Chef has arrived -->
							<p v-if="estimatedArrival.minutes <= 1" class="font-sm text-sm mb-1">
								🎉 Yay! Your chef is here! Time to grab your delicious pizza!
							</p>
							<!-- Chef is near (under 3 minutes) -->
							<p v-else-if="estimatedArrival.minutes < 3" class="font-sm text-sm mb-1">
								🔥 Almost there! Your chef is nearby - get ready for some amazing pizza!
							</p>
							<!-- Normal arrival time -->
							<p v-else class="font-sm text-sm mb-1">Your chef is on the way! Arriving in: <span
									class="inline-block bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-semibold">{{
										estimatedArrival.minutes }} mins</span></p>
						</div>
						<!-- Call button when arrived, Refresh button otherwise -->
						<Button v-if="estimatedArrival.minutes <= 1" icon="pi pi-phone" rounded size="small" severity="success"
							:onclick="`tel:${driverInfo.phone}`" label="Call" title="Call driver" />
						<Button v-else icon="pi pi-refresh" outlined rounded size="small" @click="refreshTracking"
							:loading="refreshing" label="Refresh" title="Refresh tracking" />
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
						~{{ estimatedArrival.minutes }} minutes • {{ estimatedArrival.distance }} km away
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
						<p class="font-medium text-gray-900 dark:text-white">Rp{{ currentOrder.subtotal.toLocaleString('id-ID') }}</p>
					</div>
					
					<!-- Discount (if applicable) -->
					<div v-if="currentOrder.discount && currentOrder.discount > 0" class="flex justify-between items-center pt-1">
						<div>
							<p class="font-medium text-gray-900 dark:text-white mb-0">Discount</p>
							<p v-if="currentOrder.promoCode" class="text-xs text-blue-600 dark:text-blue-400">{{ currentOrder.promoCode }} - {{ currentOrder.promoTitle }}</p>
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