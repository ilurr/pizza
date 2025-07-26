<script setup>
import { useDriverStore } from '@/stores/driverStore.js';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, ref } from 'vue';

const driverStore = useDriverStore();
const toast = useToast();

const selectedTab = ref('pending');

// Methods
const acceptOrder = async (orderId) => {
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

const formatTime = (dateString) => {
    return new Date(dateString).toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit'
    });
};

const formatCurrency = (amount) => {
    const formatted = new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(amount);
    return formatted.replace(/\s/g, ''); // Remove spaces
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

const getNextStatusAction = (status) => {
    const actions = {
        'accepted': { label: 'Start Journey', status: 'en_route', icon: 'pi pi-arrow-right' },
        'en_route': { label: 'Mark Arrived', status: 'arrived', icon: 'pi pi-map-marker' },
        'arrived': { label: 'Start Cooking', status: 'cooking', icon: 'pi pi-play' },
        'cooking': { label: 'Pizza Ready', status: 'ready', icon: 'pi pi-check' },
        'ready': { label: 'Mark Delivered', status: 'delivered', icon: 'pi pi-verified' }
    };
    return actions[status];
};

// Lifecycle
onMounted(async () => {
    // Driver should already be initialized by DriverMain.vue
    // Just ensure we have fresh data
    if (!driverStore.isInitialized) {
        await driverStore.initializeDriver('driver_001');
    } else {
        await driverStore.loadOrders();
    }
});
</script>

<template>
    <div class="grid">
        <div class="col-12">
            <div class="card">
                <h3>Order Management</h3>
                <p class="text-600">Manage your order requests and track active deliveries</p>
                
                <TabView v-model:activeIndex="selectedTab" @tab-change="(e) => selectedTab = e.index === 0 ? 'pending' : 'active'">
                    <TabPanel header="Pending Requests">
                        <template #header>
                            <div class="flex align-items-center gap-2">
                                <i class="pi pi-clock"></i>
                                <span>Pending Requests</span>
                                <Badge v-if="driverStore.ordersRequiringAction.length > 0" 
                                       :value="driverStore.ordersRequiringAction.length" 
                                       severity="warning" />
                            </div>
                        </template>

                        <div v-if="driverStore.ordersRequiringAction.length === 0" class="text-center py-6 text-600">
                            <i class="pi pi-inbox text-4xl mb-3 block"></i>
                            <p class="text-lg mb-2">No pending requests</p>
                            <p class="text-sm">{{ driverStore.isOnline ? 'Waiting for new orders...' : 'Go online to receive orders' }}</p>
                        </div>

                        <div v-else class="grid">
                            <div v-for="order in driverStore.ordersRequiringAction" 
                                 :key="order.id" 
                                 class="col-12 lg:col-6">
                                <div class="card bg-yellow-50 border-left-3 border-yellow-500">
                                    <!-- Order Header -->
                                    <div class="flex justify-content-between align-items-start mb-3">
                                        <div>
                                            <h4 class="text-lg font-semibold mb-1">{{ order.orderNumber }}</h4>
                                            <p class="text-600 mb-1">{{ order.customerName }}</p>
                                            <small class="text-500">{{ formatTime(order.requestedAt) }}</small>
                                        </div>
                                        <div class="text-right">
                                            <div class="text-2xl font-bold text-green-600">{{ formatCurrency(order.total) }}</div>
                                            <small class="text-600">{{ order.distance }}km away</small>
                                        </div>
                                    </div>

                                    <!-- Order Items -->
                                    <div class="mb-3">
                                        <h6 class="text-sm font-medium text-700 mb-2">Order Items:</h6>
                                        <div class="pl-3">
                                            <div v-for="item in order.items" :key="item.name" class="text-sm mb-1">
                                                {{ item.quantity }}× {{ item.name }}
                                            </div>
                                        </div>
                                    </div>

                                    <!-- Delivery Details -->
                                    <div class="mb-4 p-3 bg-white border-round">
                                        <div class="flex align-items-start gap-2 mb-2">
                                            <i class="pi pi-map-marker text-blue-500 mt-1"></i>
                                            <div class="flex-1">
                                                <div class="font-medium text-sm">{{ order.deliveryLocation.address }}</div>
                                                <div class="text-xs text-600">Est. cooking time: {{ order.estimatedCookingTime }} mins</div>
                                            </div>
                                        </div>
                                        <div v-if="order.notes" class="flex align-items-start gap-2">
                                            <i class="pi pi-comment text-blue-500 mt-1"></i>
                                            <small class="text-600">{{ order.notes }}</small>
                                        </div>
                                    </div>

                                    <!-- Action Buttons -->
                                    <div class="flex gap-2">
                                        <Button 
                                            label="Accept Order" 
                                            icon="pi pi-check"
                                            @click="acceptOrder(order.id)"
                                            :loading="driverStore.isProcessingOrder"
                                            :disabled="driverStore.isProcessingOrder"
                                            severity="success"
                                            class="flex-1"
                                        />
                                        <Button 
                                            label="Reject" 
                                            icon="pi pi-times"
                                            @click="rejectOrder(order.id)"
                                            :loading="driverStore.isProcessingOrder"
                                            :disabled="driverStore.isProcessingOrder"
                                            severity="danger"
                                            outlined
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </TabPanel>

                    <TabPanel header="Active Orders">
                        <template #header>
                            <div class="flex align-items-center gap-2">
                                <i class="pi pi-truck"></i>
                                <span>Active Orders</span>
                                <Badge v-if="driverStore.activeOrders.length > 0" 
                                       :value="driverStore.activeOrders.length" 
                                       severity="info" />
                            </div>
                        </template>

                        <div v-if="driverStore.activeOrders.length === 0" class="text-center py-6 text-600">
                            <i class="pi pi-car text-4xl mb-3 block"></i>
                            <p class="text-lg mb-2">No active orders</p>
                            <p class="text-sm">Accept orders to start cooking and delivering</p>
                        </div>

                        <div v-else>
                            <DataTable :value="driverStore.activeOrders" responsiveLayout="scroll" class="p-datatable-sm">
                                <Column field="orderNumber" header="Order #" style="min-width: 8rem" />
                                <Column field="customerName" header="Customer" style="min-width: 10rem" />
                                <Column header="Status" style="min-width: 8rem">
                                    <template #body="{ data }">
                                        <Tag :value="data.status" :severity="getOrderStatusColor(data.status)" />
                                    </template>
                                </Column>
                                <Column header="Total" style="min-width: 8rem">
                                    <template #body="{ data }">
                                        <span class="font-semibold">{{ formatCurrency(data.total) }}</span>
                                    </template>
                                </Column>
                                <Column header="Contact" style="min-width: 8rem">
                                    <template #body="{ data }">
                                        <Button 
                                            icon="pi pi-phone" 
                                            :onclick="`tel:${data.customerPhone}`"
                                            severity="success"
                                            outlined
                                            size="small"
                                            rounded
                                        />
                                    </template>
                                </Column>
                                <Column header="Actions" style="min-width: 12rem">
                                    <template #body="{ data }">
                                        <div class="flex gap-1" v-if="getNextStatusAction(data.status)">
                                            <Button 
                                                :label="getNextStatusAction(data.status).label"
                                                :icon="getNextStatusAction(data.status).icon"
                                                @click="updateOrderStatus(data.id, getNextStatusAction(data.status).status)"
                                                size="small"
                                                :severity="data.status === 'ready' ? 'success' : 'info'"
                                            />
                                        </div>
                                        <div v-else class="text-center">
                                            <Tag value="Completed" severity="success" />
                                        </div>
                                    </template>
                                </Column>
                            </DataTable>
                        </div>
                    </TabPanel>
                </TabView>
            </div>
        </div>
    </div>
</template>

<style scoped>
.border-left-3 {
    border-left: 3px solid;
}
</style>