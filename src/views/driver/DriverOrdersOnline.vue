<script setup>
import api from '@/services/api/index.js';
import { useUserStore } from '@/stores/userStore';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const userStore = useUserStore();
const toast = useToast();

const orders = ref([]);
const isLoading = ref(false);
const updatingId = ref(null);

const activeOrders = computed(() =>
    orders.value.filter(
        (o) => !['delivered', 'cancelled'].includes(o.status)
    )
);
const completedOrders = computed(() =>
    orders.value.filter((o) => o.status === 'delivered')
);

const fetchOrders = async () => {
    const driverId = userStore.user?.id;
    if (!driverId) return;
    isLoading.value = true;
    try {
        const res = await api.orders.getDriverOrders(driverId);
        orders.value = (res?.success && res?.data?.orders) ? res.data.orders : [];
    } catch (e) {
        console.error('Failed to fetch driver orders:', e);
        orders.value = [];
    } finally {
        isLoading.value = false;
    }
};

const updateStatus = async (orderId, status) => {
    updatingId.value = orderId;
    try {
        const res = await api.orders.updateOrderStatus(orderId, status);
        if (res?.success) {
            toast.add({
                severity: 'success',
                summary: 'Status updated',
                detail: `Order is now ${status.replace('_', ' ')}`,
                life: 3000
            });
            await fetchOrders();
        } else {
            toast.add({
                severity: 'error',
                summary: 'Update failed',
                detail: res?.error?.message || 'Could not update order',
                life: 3000
            });
        }
    } catch (e) {
        toast.add({
            severity: 'error',
            summary: 'Error',
            detail: e?.message || 'Failed to update',
            life: 3000
        });
    } finally {
        updatingId.value = null;
    }
};

const getNextAction = (order) => {
    const s = order.status;
    if (s === 'assigned' || s === 'confirmed' || s === 'pending') return { label: 'Start preparing', status: 'preparing', icon: 'pi pi-play' };
    if (s === 'preparing') return { label: 'Out for delivery', status: 'on_delivery', icon: 'pi pi-truck' };
    if (s === 'on_delivery') return { label: 'Mark delivered', status: 'delivered', icon: 'pi pi-check' };
    return null;
};

const formatCurrency = (amount) => {
    if (amount == null) return '—';
    const formatted = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
    return formatted.replace(/\s/g, '');
};

const formatDate = (dateString) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' });
};

const getStatusSeverity = (status) => {
    const m = { pending: 'warn', assigned: 'info', confirmed: 'info', preparing: 'info', on_delivery: 'info', delivered: 'success', cancelled: 'danger' };
    return m[status] || 'secondary';
};

const goToHistory = () => router.push('/driver/orders');

onMounted(() => {
    fetchOrders();
});
</script>

<template>
    <div class="p-4">
        <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
            <p class="text-600 dark:text-400 text-sm mb-0">Handle and complete orders assigned to you until delivered.</p>
            <Button label="View all history" icon="pi pi-history" outlined size="small" @click="goToHistory" />
        </div>

        <div v-if="isLoading" class="flex justify-center py-8">
            <ProgressSpinner style="width: 40px; height: 40px" />
        </div>

        <template v-else>
            <!-- Active -->
            <div class="mb-6">
                <h3 class="text-lg font-semibold text-surface-900 dark:text-surface-0 mb-3">Active</h3>
                <div v-if="activeOrders.length === 0" class="rounded-xl border-2 border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800/50 p-6 text-center text-600">
                    <i class="pi pi-inbox text-4xl mb-2 block"></i>
                    <p class="mb-0">No active orders. New orders assigned to you will appear here.</p>
                </div>
                <div v-else class="space-y-3">
                    <div
                        v-for="order in activeOrders"
                        :key="order.id"
                        class="rounded-xl border-2 border-surface-200 dark:border-surface-700 bg-card dark:bg-card p-4"
                    >
                        <div class="flex flex-wrap items-start justify-between gap-3">
                            <div>
                                <div class="font-semibold text-surface-900 dark:text-surface-0">{{ order.orderNumber }}</div>
                                <div class="text-sm text-600">{{ order.customerName }}</div>
                                <div class="text-sm text-600 mt-1">{{ formatDate(order.orderDate) }}</div>
                            </div>
                            <div class="flex items-center gap-2">
                                <Tag :value="order.status" :severity="getStatusSeverity(order.status)" />
                                <span class="font-semibold text-red-600 dark:text-red-400">{{ formatCurrency(order.total) }}</span>
                            </div>
                        </div>
                        <div v-if="order.deliveryAddress?.address" class="mt-2 text-sm text-600 flex items-start gap-2">
                            <i class="pi pi-map-marker mt-0.5"></i>
                            <span>{{ order.deliveryAddress.address }}</span>
                        </div>
                        <div v-if="order.customerPhone" class="mt-2">
                            <a :href="`tel:${order.customerPhone}`" class="text-sm text-primary font-medium">
                                <i class="pi pi-phone mr-1"></i>{{ order.customerPhone }}
                            </a>
                        </div>
                        <div class="mt-3 pt-3 border-t border-surface-200 dark:border-surface-700 flex flex-wrap gap-2">
                            <Button
                                v-if="getNextAction(order)"
                                :label="getNextAction(order).label"
                                :icon="getNextAction(order).icon"
                                size="small"
                                :loading="updatingId === order.id"
                                :disabled="updatingId !== null"
                                :severity="order.status === 'on_delivery' ? 'success' : 'primary'"
                                @click="updateStatus(order.id, getNextAction(order).status)"
                            />
                        </div>
                    </div>
                </div>
            </div>

            <!-- Completed (recent) -->
            <div>
                <h3 class="text-lg font-semibold text-surface-900 dark:text-surface-0 mb-3">Completed (recent)</h3>
                <div v-if="completedOrders.length === 0" class="text-sm text-600">No completed orders yet.</div>
                <DataTable v-else :value="completedOrders.slice(0, 5)" responsiveLayout="scroll" class="p-datatable-sm" :paginator="false">
                    <Column field="orderNumber" header="Order #" />
                    <Column field="customerName" header="Customer" />
                    <Column header="Total">
                        <template #body="{ data }">{{ formatCurrency(data.total) }}</template>
                    </Column>
                    <Column header="Date">
                        <template #body="{ data }">{{ formatDate(data.orderDate) }}</template>
                    </Column>
                    <Column header="">
                        <template #body>
                            <Tag value="Delivered" severity="success" />
                        </template>
                    </Column>
                </DataTable>
            </div>
        </template>
    </div>
</template>
