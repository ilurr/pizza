<script setup lang="ts">
import CartModal from '@/components/CartModal.vue';
import FloatingCart from '@/components/FloatingCart.vue';
import LocationPickerModal from '@/components/LocationPickerModal.vue';
import OrderProgressStepper from '@/components/OrderProgressStepper.vue';
import PizzaCard from '@/components/PizzaCard.vue';
import ProductDetailModal from '@/components/ProductDetailModal.vue';
import AppTopbar from '@/layout/AppTopbar.vue';
import { ProductService } from '@/service/ProductService.js';
import { useCartStore } from '@/stores/cartStore.js';
import { useOrderStore } from '@/stores/orderStore.js';
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const cartStore = useCartStore();
const orderStore = useOrderStore();

const pizzas = ref([]);
const modalVisible = ref(false);
const selectedPizza = ref(null);
const locationModalVisible = ref(false);
const cartModalVisible = ref(false);
const showProgressDetails = ref(false);

// Computed properties from store
const userLocation = computed(() => orderStore.userLocation);
const availableDrivers = computed(() => orderStore.availableDrivers);
const selectedDriver = computed(() => orderStore.selectedDriver);
const showDriverList = computed(() => orderStore.showDriverList);
const isLoading = ref(false);

const showLocationPicker = () => {
	locationModalVisible.value = true;
};

const handleLocationSelected = (location) => {
	orderStore.setUserLocation(location);
	locationModalVisible.value = false;
	searchNearbyDrivers(location);
};

const searchNearbyDrivers = async (location) => {
	isLoading.value = true;
	try {
		// Simulate API call to find nearby drivers
		await new Promise(resolve => setTimeout(resolve, 2000));

		// Mock driver data - simulate different scenarios
		const allDrivers = [
			{
				id: 1,
				name: 'Cak Gilang',
				rating: 4.8,
				distance: 0.5,
				estimatedTime: '5-10 min',
				phone: '081234567888',
				avatar: 'https://voyee.id/assets/foto_seller/2024_06_17_18_28_06_1718623686_35496cf2d62376ca0ef0.jpg',
				isAvailable: true,
				unavailableReason: null
			},
			{
				id: 2,
				name: 'Pak Agus',
				rating: 4.8,
				distance: 0.3,
				estimatedTime: '3-8 min',
				phone: '081234567899',
				avatar: 'https://voyee.id/assets/foto_seller/2024_06_17_18_28_06_1718623686_35496cf2d62376ca0ef0.jpg',
				isAvailable: true,
				unavailableReason: null
			},
			{
				id: 3,
				name: 'Cak Bram',
				rating: 4.9,
				distance: 0.8,
				estimatedTime: '8-12 min',
				phone: '081234567777',
				avatar: 'https://voyee.id/assets/foto_seller/2024_06_17_18_27_00_1718623620_0961d218aa38beb0aa77.jpg',
				isAvailable: true,
				unavailableReason: null
			}
		];

		// Simulate different scenarios based on location or random chance
		const scenarios = {
			noDrivers: Math.random() < 0.2, // 20% chance no drivers found
			allUnavailable: Math.random() < 0.3 // 30% chance all drivers unavailable
		};

		let availableDrivers = [];

		if (scenarios.noDrivers) {
			// No drivers found scenario
			availableDrivers = [];
		} else if (scenarios.allUnavailable) {
			// All drivers temporarily unavailable
			availableDrivers = allDrivers.map(driver => ({
				...driver,
				isAvailable: false,
				unavailableReason: driver.unavailableReason || 'Temporarily closed'
			}));
		} else {
			// Normal scenario with some available drivers
			availableDrivers = allDrivers;
		}

		orderStore.setAvailableDrivers(availableDrivers);
	} catch (error) {
		console.error('Error searching drivers:', error);
		orderStore.setAvailableDrivers([]);
	} finally {
		isLoading.value = false;
	}
};

const selectDriver = (driver) => {
	orderStore.selectDriver(driver);
	loadMenu();
};

const loadMenu = async () => {
	try {
		const allPizzas = await ProductService.getPizzas();
		// Sort pizzas: available ones first, unavailable ones last
		pizzas.value = allPizzas.sort((a, b) => {
			if (a.available === b.available) return 0;
			return a.available ? -1 : 1;
		});
	} catch (error) {
		console.error('Error loading menu:', error);
	}
};

const showPizzaDetail = (pizza) => {
	selectedPizza.value = pizza;
	modalVisible.value = true;
};

const addToCart = (pizza, quantity = 1) => {
	cartStore.addToCart(pizza, quantity);
	console.log('Added to cart:', pizza.name, 'Quantity:', quantity);
};

const showCartModal = () => {
	cartModalVisible.value = true;
};

const handleCheckout = () => {
	orderStore.setCurrentStep('checkout');
	// TODO: Implement checkout logic
	console.log('Proceeding to checkout with items:', cartStore.items);
	alert('Checkout functionality will be implemented next!');
};


const changeChef = () => {
	orderStore.resetDriver();
};

const handleResetOrder = () => {
	orderStore.resetOrder();
	cartStore.clearCart();
	showLocationPicker();
};

const resumeOrderIfNeeded = () => {
	// Check if order is stale
	if (orderStore.isOrderStale()) {
		orderStore.resetOrder();
		showLocationPicker();
		return;
	}

	// Resume order based on current state
	if (orderStore.hasInProgressOrder) {
		orderStore.resumeOrder();

		// Load menu if we have a selected driver
		if (orderStore.selectedDriver) {
			loadMenu();
		}
	} else {
		// Fresh start
		orderStore.initializeOrder();
		showLocationPicker();
	}
};

const goBack = () => {
	router.push('/');
};

onMounted(() => {
	resumeOrderIfNeeded();
});
</script>

<template>
	<div class="bg-white dark:bg-neutral-900">
		<div class="landing-wrapper overflow-hidden">
			<app-topbar variant="page-header" page-title="Order Now" @back="goBack"></app-topbar>
			<div class="relative lg:mx-80 mx-auto pt-16 md:pt-16 mb-32">

				<div class="relative p-4 md:p-0">
					<!-- Order Progress -->
					<div class="mb-6">
						<OrderProgressStepper @edit-location="showLocationPicker" @edit-driver="changeChef"
							@reset-order="handleResetOrder" />
					</div>

					<!-- Welcome Section -->
					<div class="text-center mb-8" v-if="!userLocation">
						<ImageWithSkeleton src="/src/assets/images/Orders.svg"
							wrapperClass="relative mx-auto aspect-square mb-4 md:rounded-xl" width="180px" height="180px" />

						<h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-4">
							Order Pizza Now! 🍕
						</h1>

						<p class="text-gray-600 dark:text-gray-300 mb-6">
							Tell us where you are and we'll find the nearest pizza chef on wheels!
						</p>
						<Button label="Select Your Location" icon="pi pi-map-marker" size="large" @click="showLocationPicker" />
					</div>

					<!-- Loading State -->
					<div v-if="isLoading" class="text-center py-12">
						<ProgressSpinner class="!w-12 !h-12" />
						<p class="text-gray-600 dark:text-gray-300 mt-4">
							Searching for nearby pizza chefs...
						</p>
					</div>

					<!-- Driver Selection -->
					<div v-if="showDriverList && !isLoading" class="mb-8">
						<!-- No Drivers Found -->
						<div v-if="availableDrivers.length === 0" class="text-center py-12">
							<i class="pi pi-map-marker !text-6xl text-gray-300 mb-4"></i>
							<h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">
								No Pizza Chefs Found Nearby
							</h2>
							<p class="text-gray-600 dark:text-gray-300 mb-6">
								Sorry, there are no pizza chefs available in your area right now.
							</p>
							<div class="space-y-3">
								<Button label="Try Different Location" icon="pi pi-refresh" @click="showLocationPicker" />
								<p class="text-sm text-gray-500">
									Try expanding your search area or check back later
								</p>
							</div>
						</div>

						<!-- Available Drivers -->
						<div v-else>
							<div class="text-center mb-6">
								<h2 class="text-2xl font-bold text-gray-900 dark:text-white !mt-8 mb-2">
									Pizza Chefs Near You
								</h2>
								<p class="text-gray-600 dark:text-gray-300 mb-6">
									Choose your preferred chef
								</p>
							</div>

							<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
								<div v-for="driver in availableDrivers" :key="driver.id" :class="[
									'border rounded-lg p-4 transition-all',
									driver.isAvailable !== false
										? 'border-gray-200 dark:border-gray-700 hover:shadow-lg cursor-pointer hover:border-primary-300'
										: 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 opacity-75'
								]" @click="driver.isAvailable !== false ? selectDriver(driver) : null">
									<div class="flex items-center">
										<div class="relative">
											<ImageWithSkeleton :src="driver.avatar" wrapperClass="relative aspect-square rounded-full"
												width="45px" height="45px" />
											<div v-if="driver.isAvailable === false"
												class="absolute inset-0 bg-gray-500 bg-opacity-50 rounded-full flex items-center justify-center">
												<i class="pi pi-lock text-white text-sm"></i>
											</div>
										</div>
										<div class="ml-3 flex-1">
											<h3 class="font-semibold text-xl mb-1" :class="[
												driver.isAvailable !== false
													? 'text-gray-900 dark:text-white'
													: 'text-gray-500 dark:text-gray-400'
											]">
												{{ driver.name }}
											</h3>
											<div v-if="driver.isAvailable !== false" class="text-sm text-gray-600 dark:text-gray-400">
												<p>📍 {{ driver.distance }} km away • ⏱️ Queue: 2</p>
											</div>
											<div v-else class="text-sm text-red-600 dark:text-red-400">
												<p>{{ driver.unavailableReason || 'Currently unavailable' }}</p>
											</div>
										</div>
									</div>
								</div>
							</div>

							<!-- All Drivers Unavailable Message -->
							<div v-if="availableDrivers.length > 0 && availableDrivers.every(d => d.isAvailable === false)"
								class="text-center mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
								<i class="pi pi-exclamation-triangle text-yellow-600 dark:text-yellow-400 mb-2"></i>
								<p class="text-yellow-800 dark:text-yellow-200 font-medium mb-0">
									All nearby chefs are temporarily unavailable
								</p>
								<p class="text-yellow-700 dark:text-yellow-300 text-sm mb-0">
									Please try again later or select a different location
								</p>
								<Button label="Refresh" icon="pi pi-refresh" size="small" severity="warning" class="mt-3"
									@click="searchNearbyDrivers(userLocation)" />
							</div>
						</div>
					</div>


					<!-- Menu Section -->
					<div v-if="selectedDriver && pizzas.length > 0" class="mb-8">
						<h2 class="text-surface-900 dark:text-surface-0 text-xl font-bold mb-4 text-left w-full px-2">
							🤤 What should we order today?
						</h2>
						<div class="flex flex-wrap gap-6">
							<PizzaCard v-for="pizza in pizzas" :key="pizza.id" :pizza="pizza" :show-actions="true"
								@add-to-cart="addToCart" @show-detail="showPizzaDetail" />
						</div>
					</div>
				</div>

			</div>
		</div>

		<!-- Location Picker Modal -->
		<LocationPickerModal :visible="locationModalVisible" @update:visible="(value) => locationModalVisible = value"
			@location-selected="handleLocationSelected" />

		<!-- Product Detail Modal -->
		<ProductDetailModal :visible="modalVisible" :pizza="selectedPizza" :show-actions="true"
			@update:visible="(value) => modalVisible = value" @add-to-cart="addToCart" />

		<!-- Floating Cart -->
		<FloatingCart :visible="selectedDriver !== null" @show-cart="showCartModal" />

		<!-- Cart Modal -->
		<CartModal :visible="cartModalVisible" @update:visible="(value) => cartModalVisible = value"
			@checkout="handleCheckout" />
	</div>
</template>

<style scoped>
.landing-wrapper {
	min-height: 100vh;
}
</style>