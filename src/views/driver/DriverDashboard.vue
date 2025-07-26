<script setup>
import { useDriverStore } from '@/stores/driverStore.js';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, onUnmounted, ref } from 'vue';

const driverStore = useDriverStore();
const toast = useToast();

const refreshInterval = ref(null);

// Computed properties
const statusColor = computed(() => {
    if (!driverStore.isOnline) return 'surface';
    return driverStore.isAvailable ? 'success' : 'warn';
});

const statusText = computed(() => {
    if (!driverStore.isOnline) return 'Offline';
    return driverStore.isAvailable ? 'Available' : 'Busy';
});

const formatCurrency = (amount) => {
    const formatted = new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(amount);
    return formatted.replace(/\s/g, ''); // Remove spaces
};

const todayEarnings = computed(() => {
    return formatCurrency(driverStore.stats.todayEarnings);
});

// Methods
const toggleOnlineStatus = async () => {
    driverStore.toggleOnlineStatus();
    
    if (driverStore.isOnline) {
        await driverStore.updateLocation();
        toast.add({
            severity: 'success',
            summary: 'You are now online',
            detail: 'You will start receiving order requests',
            life: 3000
        });
    } else {
        toast.add({
            severity: 'info',
            summary: 'You are now offline',
            detail: 'You will not receive new order requests',
            life: 3000
        });
    }
};

const toggleAvailability = () => {
    if (!driverStore.isOnline) {
        toast.add({
            severity: 'warn',
            summary: 'Go online first',
            detail: 'You need to be online to change availability',
            life: 3000
        });
        return;
    }
    
    driverStore.toggleAvailability();
    toast.add({
        severity: 'info',
        summary: `You are now ${driverStore.isAvailable ? 'available' : 'busy'}`,
        detail: driverStore.isAvailable ? 'You can receive new orders' : 'You will not receive new orders',
        life: 3000
    });
};

const acceptOrder = async (orderId) => {
    // Prevent double-clicking
    if (driverStore.isProcessingOrder) return;
    
    const result = await driverStore.acceptOrder(orderId);
    if (result.success) {
        toast.add({
            severity: 'success',
            summary: 'Order Accepted',
            detail: 'You can now start preparing for delivery',
            life: 3000
        });
    } else {
        toast.add({
            severity: 'error',
            summary: 'Failed to Accept Order',
            detail: result.error,
            life: 3000
        });
    }
};

const rejectOrder = async (orderId) => {
    // Prevent double-clicking
    if (driverStore.isProcessingOrder) return;
    
    const result = await driverStore.rejectOrder(orderId);
    if (result.success) {
        toast.add({
            severity: 'info',
            summary: 'Order Rejected',
            detail: 'The order has been returned to the queue',
            life: 3000
        });
    } else {
        toast.add({
            severity: 'error',
            summary: 'Failed to Reject Order',
            detail: result.error,
            life: 3000
        });
    }
};

const updateOrderStatus = async (orderId, status) => {
    const result = await driverStore.updateOrderStatus(orderId, status, driverStore.currentLocation);
    if (result.success) {
        const statusMessages = {
            'en_route': 'Status updated: On the way to customer',
            'arrived': 'Status updated: Arrived at location',
            'cooking': 'Status updated: Cooking pizza',
            'ready': 'Status updated: Pizza is ready',
            'delivered': 'Order completed successfully!'
        };
        
        toast.add({
            severity: 'success',
            summary: 'Status Updated',
            detail: statusMessages[status] || 'Order status updated',
            life: 3000
        });
    } else {
        toast.add({
            severity: 'error',
            summary: 'Failed to Update Status',
            detail: result.error,
            life: 3000
        });
    }
};

const refreshData = async () => {
    await driverStore.loadOrders();
    await driverStore.updateLocation();
};

const formatTime = (dateString) => {
    return new Date(dateString).toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit'
    });
};

const getOrderStatusColor = (status) => {
    const colors = {
        'pending': 'warn',
        'accepted': 'info',
        'en_route': 'info',
        'arrived': 'warn',
        'cooking': 'warn',
        'ready': 'success',
        'delivered': 'success'
    };
    return colors[status] || 'info';
};

// Lifecycle
onMounted(async () => {
    await driverStore.initializeDriver('driver_001');
    
    // Set up periodic refresh
    refreshInterval.value = setInterval(refreshData, 30000); // Every 30 seconds
});

onUnmounted(() => {
    if (refreshInterval.value) {
        clearInterval(refreshInterval.value);
    }
});
</script>

<template>
    <div class="driver-dashboard">
        <!-- Header with Status Controls -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <!-- Driver Status -->
            <Card class="shadow-lg">
                <template #content>
                    <div class="flex flex-col items-center text-center">
                        <Avatar 
                            :image="driverStore.driverProfile?.avatar" 
                            size="large" 
                            shape="circle" 
                            class="mb-3"
                        />
                        <h3 class="text-lg font-semibold mb-2">{{ driverStore.driverProfile?.name }}</h3>
                        <Tag 
                            :value="statusText" 
                            :severity="statusColor" 
                            class="mb-3"
                        />
                        <div class="flex gap-2">
                            <Button 
                                :label="driverStore.isOnline ? 'Go Offline' : 'Go Online'"
                                :severity="driverStore.isOnline ? 'danger' : 'success'"
                                @click="toggleOnlineStatus"
                                size="small"
                            />
                            <Button 
                                :label="driverStore.isAvailable ? 'Set Busy' : 'Set Available'"
                                :severity="driverStore.isAvailable ? 'warn' : 'info'"
                                @click="toggleAvailability"
                                size="small"
                                outlined
                                :disabled="!driverStore.isOnline"
                            />
                        </div>
                    </div>
                </template>
            </Card>

            <!-- Today's Stats -->
            <Card class="shadow-lg">
                <template #content>
                    <div class="text-center">
                        <h4 class="text-lg font-semibold mb-4">Today's Performance</h4>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <div class="text-2xl font-bold text-blue-600">{{ driverStore.stats.todayDeliveries }}</div>
                                <div class="text-sm text-gray-600">Deliveries</div>
                            </div>
                            <div>
                                <div class="text-2xl font-bold text-green-600">{{ todayEarnings }}</div>
                                <div class="text-sm text-gray-600">Earnings</div>
                            </div>
                        </div>
                        <div class="mt-4">
                            <div class="flex items-center justify-center gap-1">
                                <i class="pi pi-star-fill text-yellow-500"></i>
                                <span class="font-semibold">{{ driverStore.stats.rating }}</span>
                                <span class="text-sm text-gray-600">({{ driverStore.stats.totalDeliveries }} total)</span>
                            </div>
                        </div>
                    </div>
                </template>
            </Card>

            <!-- Quick Actions -->
            <Card class="shadow-lg">
                <template #content>
                    <div class="text-center">
                        <h4 class="text-lg font-semibold mb-4">Quick Actions</h4>
                        <div class="space-y-2">
                            <Button 
                                label="Refresh Orders" 
                                icon="pi pi-refresh"
                                @click="refreshData"
                                :loading="driverStore.isLoadingOrders"
                                class="w-full"
                                size="small"
                                outlined
                            />
                            <Button 
                                label="Update Location" 
                                icon="pi pi-map-marker"
                                @click="driverStore.updateLocation"
                                :loading="driverStore.isUpdatingLocation"
                                class="w-full"
                                size="small"
                                outlined
                            />
                        </div>
                        <div class="mt-4 text-xs text-gray-500">
                            <p v-if="driverStore.currentLocation">
                                Last updated: {{ formatTime(driverStore.currentLocation.timestamp) }}
                            </p>
                        </div>
                    </div>
                </template>
            </Card>
        </div>

        <!-- Orders Section -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <!-- Pending Orders (New Requests) -->
            <Card class="shadow-lg">
                <template #header>
                    <div class="flex items-center justify-between p-4 border-b">
                        <h3 class="text-xl font-semibold flex items-center gap-2">
                            <i class="pi pi-clock text-orange-500"></i>
                            New Order Requests
                        </h3>
                        <Badge 
                            :value="driverStore.ordersRequiringAction.length" 
                            severity="warning" 
                            v-if="driverStore.ordersRequiringAction.length > 0"
                        />
                    </div>
                </template>
                <template #content>
                    <div v-if="driverStore.ordersRequiringAction.length === 0" class="text-center py-8 text-gray-500">
                        <i class="pi pi-inbox text-4xl mb-4 block"></i>
                        <p>No new order requests</p>
                        <p class="text-sm">{{ driverStore.isOnline ? 'Waiting for orders...' : 'Go online to receive orders' }}</p>
                    </div>

                    <div v-else class="space-y-4">
                        <div 
                            v-for="order in driverStore.ordersRequiringAction" 
                            :key="order.id"
                            class="border rounded-lg p-4 bg-yellow-50"
                        >
                            <!-- Order Header -->
                            <div class="flex justify-between items-start mb-3">
                                <div>
                                    <h4 class="font-semibold">{{ order.orderNumber }}</h4>
                                    <p class="text-sm text-gray-600">{{ order.customerName }}</p>
                                    <p class="text-sm text-gray-600">{{ formatTime(order.requestedAt) }}</p>
                                </div>
                                <div class="text-right">
                                    <p class="font-bold text-lg">{{ formatCurrency(order.total) }}</p>
                                    <p class="text-sm text-gray-600">{{ order.distance }}km away</p>
                                </div>
                            </div>

                            <!-- Order Items -->
                            <div class="mb-3">
                                <div v-for="item in order.items" :key="item.name" class="text-sm">
                                    {{ item.quantity }}x {{ item.name }}
                                </div>
                            </div>

                            <!-- Delivery Address -->
                            <div class="mb-3 p-2 bg-white rounded border">
                                <p class="text-sm font-medium">📍 {{ order.deliveryLocation.address }}</p>
                                <p class="text-xs text-gray-600">Est. cooking time: {{ order.estimatedCookingTime }} mins</p>
                                <p v-if="order.notes" class="text-xs text-blue-600">💬 {{ order.notes }}</p>
                            </div>

                            <!-- Action Buttons -->
                            <div class="flex gap-2">
                                <Button 
                                    label="Accept" 
                                    icon="pi pi-check"
                                    @click="acceptOrder(order.id)"
                                    :loading="driverStore.isProcessingOrder"
                                    :disabled="driverStore.isProcessingOrder"
                                    severity="success"
                                    size="small"
                                    class="flex-1"
                                />
                                <Button 
                                    label="Reject" 
                                    icon="pi pi-times"
                                    @click="rejectOrder(order.id)"
                                    :loading="driverStore.isProcessingOrder"
                                    :disabled="driverStore.isProcessingOrder"
                                    severity="danger"
                                    size="small"
                                    outlined
                                    class="flex-1"
                                />
                            </div>
                        </div>
                    </div>
                </template>
            </Card>

            <!-- Active Orders -->
            <Card class="shadow-lg">
                <template #header>
                    <div class="flex items-center justify-between p-4 border-b">
                        <h3 class="text-xl font-semibold flex items-center gap-2">
                            <i class="pi pi-truck text-blue-500"></i>
                            Active Orders
                        </h3>
                        <Badge 
                            :value="driverStore.activeOrders.length" 
                            severity="info" 
                            v-if="driverStore.activeOrders.length > 0"
                        />
                    </div>
                </template>
                <template #content>
                    <div v-if="driverStore.activeOrders.length === 0" class="text-center py-8 text-gray-500">
                        <i class="pi pi-car text-4xl mb-4 block"></i>
                        <p>No active orders</p>
                        <p class="text-sm">Accept orders to start cooking and delivering</p>
                    </div>

                    <div v-else class="space-y-4">
                        <div 
                            v-for="order in driverStore.activeOrders" 
                            :key="order.id"
                            class="border rounded-lg p-4 bg-blue-50"
                        >
                            <!-- Order Header -->
                            <div class="flex justify-between items-start mb-3">
                                <div>
                                    <h4 class="font-semibold">{{ order.orderNumber }}</h4>
                                    <p class="text-sm text-gray-600">{{ order.customerName }}</p>
                                    <Tag 
                                        :value="order.status" 
                                        :severity="getOrderStatusColor(order.status)" 
                                        class="mt-1"
                                    />
                                </div>
                                <div class="text-right">
                                    <p class="font-bold text-lg">{{ formatCurrency(order.total) }}</p>
                                    <Button 
                                        icon="pi pi-phone" 
                                        :onclick="`tel:${order.customerPhone}`"
                                        size="small"
                                        outlined
                                        severity="success"
                                        class="mt-1"
                                    />
                                </div>
                            </div>

                            <!-- Delivery Address -->
                            <div class="mb-3 p-2 bg-white rounded border">
                                <p class="text-sm font-medium">📍 {{ order.deliveryLocation.address }}</p>
                                <p class="text-xs text-gray-600">Distance: {{ order.distance }}km</p>
                            </div>

                            <!-- Status Update Buttons -->
                            <div class="grid grid-cols-2 gap-2">
                                <Button 
                                    v-if="order.status === 'accepted'"
                                    label="En Route" 
                                    icon="pi pi-arrow-right"
                                    @click="updateOrderStatus(order.id, 'en_route')"
                                    size="small"
                                    severity="info"
                                />
                                <Button 
                                    v-if="order.status === 'en_route'"
                                    label="Arrived" 
                                    icon="pi pi-map-marker"
                                    @click="updateOrderStatus(order.id, 'arrived')"
                                    size="small"
                                    severity="warn"
                                />
                                <Button 
                                    v-if="order.status === 'arrived'"
                                    label="Start Cooking" 
                                    icon="pi pi-play"
                                    @click="updateOrderStatus(order.id, 'cooking')"
                                    size="small"
                                    severity="warn"
                                />
                                <Button 
                                    v-if="order.status === 'cooking'"
                                    label="Pizza Ready" 
                                    icon="pi pi-check"
                                    @click="updateOrderStatus(order.id, 'ready')"
                                    size="small"
                                    severity="success"
                                />
                                <Button 
                                    v-if="order.status === 'ready'"
                                    label="Delivered" 
                                    icon="pi pi-verified"
                                    @click="updateOrderStatus(order.id, 'delivered')"
                                    size="small"
                                    severity="success"
                                    class="col-span-2"
                                />
                            </div>
                        </div>
                    </div>
                </template>
            </Card>
        </div>
    </div>
    <Toast position="bottom-right" />
</template>

<style scoped>
.driver-dashboard {
    padding: 1rem;
    max-width: 1200px;
    margin: 0 auto;
}

@media (max-width: 768px) {
    .driver-dashboard {
        padding: 0.5rem;
    }
}
</style>