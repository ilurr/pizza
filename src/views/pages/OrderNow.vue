<script setup lang="ts">
import FloatingCart from '@/components/FloatingCart.vue';
import OrderProgressStepper from '@/components/OrderProgressStepper.vue';
import PizzaCard from '@/components/PizzaCard.vue';
import AppTopbar from '@/layout/AppTopbar.vue';
import { ProductService } from '@/service/ProductService.js';
import api from '@/services/api/index.js';
import { useCartStore } from '@/stores/cartStore.js';
import { useOrderStore } from '@/stores/orderStore.js';
import { useUserStore } from '@/stores/userStore';
import { useToast } from 'primevue/usetoast';
import { computed, defineAsyncComponent, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

const CartModal = defineAsyncComponent(() => import('@/components/CartModal.vue'));
const LocationPickerModal = defineAsyncComponent(() => import('@/components/LocationPickerModal.vue'));
const ProductDetailModal = defineAsyncComponent(() => import('@/components/ProductDetailModal.vue'));

const router = useRouter();
const cartStore = useCartStore();
const orderStore = useOrderStore();
const userStore = useUserStore();
const toast = useToast();

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
        // Kelurahan-based: show drivers who cover this area (user chooses; not nearest by GPS)
        const byKelurahan = location?.kelurahanId;
        const res = byKelurahan ? await api.drivers.getAvailableDriversByKelurahan(location.kelurahanId) : await api.drivers.getAvailableDrivers({ lat: location.lat, lng: location.lng }, 15);
        const list = res && res.success && res.data && res.data.drivers ? res.data.drivers : [];
        const kelurahanName = location?.kelurahanName || res?.data?.kelurahanName;
        const availableDrivers = list.map((d) => ({
            id: d.id,
            name: d.name,
            rating: d.rating,
            phone: d.phone,
            avatar: d.avatar,
            isAvailable: d.isAvailable !== false,
            unavailableReason: d.isAvailable === false ? 'Temporarily closed' : null,
            areaLabel: kelurahanName ? `Delivers from ${kelurahanName}` : null
        }));
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

const isSubmittingOrder = ref(false);

const handleCheckout = async () => {
    if (cartStore.isEmpty) {
        toast.add({ severity: 'warn', summary: 'Cart empty', detail: 'Add items before checkout.', life: 3000 });
        return;
    }
    if (!orderStore.userLocation) {
        toast.add({ severity: 'warn', summary: 'Location required', detail: 'Please select your delivery location.', life: 3000 });
        return;
    }
    if (!orderStore.selectedDriver) {
        toast.add({ severity: 'warn', summary: 'Driver required', detail: 'Please select a chef.', life: 3000 });
        return;
    }

    orderStore.setCurrentStep('checkout');
    isSubmittingOrder.value = true;
    cartModalVisible.value = false;

    const location = orderStore.userLocation;
    const driver = orderStore.selectedDriver;
    const items = cartStore.items.map((i) => ({
        id: i.id,
        name: i.name,
        price: i.price,
        quantity: i.quantity
    }));
    const subtotal = cartStore.totalPrice;
    const discount = cartStore.discountAmount ?? 0;
    const total = cartStore.finalTotal;

    const orderData = {
        customerId: userStore.user?.id ?? 'guest_user',
        customerName: userStore.user?.fullname ?? 'Guest',
        customerEmail: userStore.user?.email ?? '',
        customerPhone: userStore.user?.phone ?? '',
        items,
        subtotal,
        deliveryFee: 0,
        discount,
        total,
        paymentMethod: 'QRIS',
        deliveryAddress: {
            address: location.address,
            coordinates: { lat: location.lat, lng: location.lng },
            kelurahanId: location.kelurahanId,
            kelurahanName: location.kelurahanName
        },
        estimatedDelivery: new Date(Date.now() + 45 * 60000).toISOString(),
        notes: '',
        driverId: driver?.id ?? null,
        driverInfo: driver ? { name: driver.name, phone: driver.phone, avatar: driver.avatar, rating: driver.rating } : null,
        promoCode: cartStore.appliedPromo?.code ?? null,
        promoTitle: cartStore.appliedPromo?.title ?? null
    };

    try {
        const res = await api.orders.createOrder(orderData);
        if (res?.success && res.data?.order) {
            toast.add({
                severity: 'success',
                summary: 'Order placed',
                detail: `Order ${res.data.order.orderNumber} created. You can track it in My Orders.`,
                life: 5000
            });
            cartStore.clearCart();
            orderStore.resetOrder();
            router.push('/order/my');
        } else {
            toast.add({
                severity: 'error',
                summary: 'Order failed',
                detail: res?.error?.message ?? 'Could not create order. Try again.',
                life: 5000
            });
        }
    } catch (e) {
        console.error('Create order error:', e);
        toast.add({
            severity: 'error',
            summary: 'Error',
            detail: e?.message ?? 'Failed to place order. Try again.',
            life: 5000
        });
    } finally {
        isSubmittingOrder.value = false;
    }
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
            <div class="relative lg:max-w-screen-lg mx-auto pt-16 md:pt-16 md:px-4 mb-32">
                <div class="relative p-4 lg:p-0">
                    <!-- Order Progress -->
                    <div class="mb-6">
                        <OrderProgressStepper @edit-location="showLocationPicker" @edit-driver="changeChef" @reset-order="handleResetOrder" />
                    </div>

                    <!-- Welcome Section -->
                    <div class="text-center mb-8" v-if="!userLocation">
                        <ImageWithSkeleton src="/src/assets/images/Orders.svg" wrapperClass="relative mx-auto aspect-square mb-4 md:rounded-xl" width="180px" height="180px" />

                        <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-4">Order Pizza Now! 🍕</h1>

                        <p class="text-gray-600 dark:text-gray-300 mb-6">Tell us where you are and we'll find the nearest pizza chef on wheels!</p>
                        <Button label="Select Your Location" icon="pi pi-map-marker" size="large" @click="showLocationPicker" />
                    </div>

                    <!-- Loading State -->
                    <div v-if="isLoading" class="text-center py-12">
                        <ProgressSpinner class="!w-12 !h-12" />
                        <p class="text-gray-600 dark:text-gray-300 mt-4">Searching for nearby pizza chefs...</p>
                    </div>

                    <!-- Driver Selection -->
                    <div v-if="showDriverList && !isLoading" class="mb-8">
                        <!-- No Drivers Found -->
                        <div v-if="availableDrivers.length === 0" class="text-center py-12">
                            <i class="pi pi-map-marker !text-6xl text-gray-300 mb-4"></i>
                            <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">No Chefs in Your Area</h2>
                            <p class="text-gray-600 dark:text-gray-300 mb-6">No pizza chefs cover your area right now. Try a different address or check back later.</p>
                            <div class="space-y-3">
                                <Button label="Try Different Location" icon="pi pi-refresh" @click="showLocationPicker" />
                                <p class="text-sm text-gray-500">Try expanding your search area or check back later</p>
                            </div>
                        </div>

                        <!-- Available Drivers -->
                        <div v-else>
                            <div class="text-center mb-6">
                                <h2 class="text-2xl font-bold text-gray-900 dark:text-white !mt-8 mb-2">Chefs Who Deliver to Your Area</h2>
                                <p class="text-gray-600 dark:text-gray-300 mb-6">Choose your preferred chef</p>
                            </div>

                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div
                                    v-for="driver in availableDrivers"
                                    :key="driver.id"
                                    :class="[
                                        'border rounded-lg p-4 transition-all',
                                        driver.isAvailable !== false ? 'border-gray-200 dark:border-gray-700 hover:shadow-lg cursor-pointer hover:border-primary-300' : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 opacity-75'
                                    ]"
                                    @click="driver.isAvailable !== false ? selectDriver(driver) : null"
                                >
                                    <div class="flex items-center">
                                        <div class="relative">
                                            <ImageWithSkeleton :src="driver.avatar" wrapperClass="relative aspect-square rounded-full" width="45px" height="45px" />
                                            <div v-if="driver.isAvailable === false" class="absolute inset-0 bg-gray-500 bg-opacity-50 rounded-full flex items-center justify-center">
                                                <i class="pi pi-lock text-white text-sm"></i>
                                            </div>
                                        </div>
                                        <div class="ml-3 flex-1">
                                            <h3 class="font-semibold text-xl mb-1" :class="[driver.isAvailable !== false ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400']">
                                                {{ driver.name }}
                                            </h3>
                                            <div v-if="driver.isAvailable !== false" class="text-sm text-gray-600 dark:text-gray-400">
                                                <p>{{ driver.areaLabel || 'Delivers to your area' }}</p>
                                            </div>
                                            <div v-else class="text-sm text-red-600 dark:text-red-400">
                                                <p>{{ driver.unavailableReason || 'Currently unavailable' }}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- All Drivers Unavailable Message -->
                            <div v-if="availableDrivers.length > 0 && availableDrivers.every((d) => d.isAvailable === false)" class="text-center mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                                <i class="pi pi-exclamation-triangle text-yellow-600 dark:text-yellow-400 mb-2"></i>
                                <p class="text-yellow-800 dark:text-yellow-200 font-medium mb-0">All chefs in your area are temporarily unavailable</p>
                                <p class="text-yellow-700 dark:text-yellow-300 text-sm mb-0">Try again later or pick a different location</p>
                                <Button label="Refresh" icon="pi pi-refresh" loadingIcon="pi pi-spinner animate-spin" size="small" severity="warning" class="mt-3" :loading="isLoading" @click="searchNearbyDrivers(userLocation)" />
                            </div>
                        </div>
                    </div>

                    <!-- Menu Section -->
                    <div v-if="selectedDriver && pizzas.length > 0" class="mb-8">
                        <h2 class="text-surface-900 dark:text-surface-0 text-xl font-bold mb-4 text-left w-full px-2">🤤 What should we order today?</h2>
                        <div class="flex flex-wrap gap-6">
                            <PizzaCard v-for="pizza in pizzas" :key="pizza.id" :pizza="pizza" :show-actions="true" @add-to-cart="addToCart" @show-detail="showPizzaDetail" />
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Location Picker Modal -->
        <LocationPickerModal :visible="locationModalVisible" @update:visible="(value) => (locationModalVisible = value)" @location-selected="handleLocationSelected" />

        <!-- Product Detail Modal -->
        <ProductDetailModal :visible="modalVisible" :pizza="selectedPizza" :show-actions="true" @update:visible="(value) => (modalVisible = value)" @add-to-cart="addToCart" />

        <!-- Floating Cart -->
        <FloatingCart :visible="selectedDriver !== null" @show-cart="showCartModal" />

        <!-- Cart Modal -->
        <CartModal :visible="cartModalVisible" @update:visible="(value) => (cartModalVisible = value)" @checkout="handleCheckout" />
    </div>
</template>

<style scoped>
.landing-wrapper {
    min-height: 100vh;
}
</style>
