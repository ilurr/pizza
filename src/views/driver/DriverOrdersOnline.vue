<script setup>
import api from '@/services/api/index.js';
import { useDriverStore } from '@/stores/driverStore.js';
import { useUserStore } from '@/stores/userStore';
import OrderDetailDialog from '@/components/shared/OrderDetailDialog.vue';
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const userStore = useUserStore();
const driverStore = useDriverStore();
const toast = useToast();
const confirm = useConfirm();

const orders = ref([]);
const isLoading = ref(false);
const updatingId = ref(null);
const gpsInterval = ref(null);

// Order detail dialog (menu/items)
const orderDialogVisible = ref(false);
const selectedOrder = ref(null);

const activeOrders = computed(() => orders.value.filter((o) => !['delivered', 'cancelled'].includes(o.status)));
const completedOrders = computed(() => orders.value.filter((o) => o.status === 'delivered'));

const getDeviceLocation = async () => {
    try {
        if (!navigator.geolocation) return null;
        const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 60000
            });
        });
        return { lat: position.coords.latitude, lng: position.coords.longitude, source: 'gps' };
    } catch (e) {
        return null;
    }
};

const upsertDriverLocationForOrder = async (orderId, driverId) => {
    const loc = await getDeviceLocation();
    const fallback = driverStore.coverageArea?.center || { lat: -7.2575, lng: 112.7521 };
    const lat = loc?.lat ?? fallback.lat;
    const lng = loc?.lng ?? fallback.lng;
    const source = loc?.source ?? 'fallback';

    await api.orders.upsertOrderDriverLocation(orderId, driverId, { lat, lng }, source);
};

const fetchOrders = async () => {
    const driverId = userStore.user?.id;
    if (!driverId) return;
    isLoading.value = true;
    try {
        const res = await api.orders.getDriverOrders(driverId);
        orders.value = res?.success && res?.data?.orders ? res.data.orders : [];
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
        // If driver is starting "preparing", ensure driver_id/driver_info are persisted first.
        // Otherwise the order can revert on refresh.
        if (status === 'preparing') {
            const driverId = userStore.user?.id;
            if (driverId != null) {
                if (!driverStore.driverProfile || String(driverStore.driverProfile.id) !== String(driverId)) {
                    await driverStore.initializeDriver(driverId);
                }
                const d = driverStore.driverProfile;
                if (d) {
                    const driverInfo = {
                        name: d.name,
                        phone: d.phone,
                        avatar: d.avatar,
                        rating: d.rating
                    };
                    const assignRes = await api.orders.assignDriver(orderId, driverId, driverInfo);
                    if (!assignRes?.success) {
                        throw new Error(assignRes?.error?.message || assignRes?.message || 'Failed to assign driver');
                    }
                }
            }
        }

        const res = await api.orders.updateOrderStatus(orderId, status);
        if (res?.success) {
            toast.add({
                severity: 'success',
                summary: 'Status updated',
                detail: `Order is now ${status.replace('_', ' ')}`,
                life: 3000
            });

            // MVP: immediately upsert GPS for this specific order on preparing/on_delivery.
            // This is required because you can operate from `/driver/orders/online` without opening `/driver`.
            const driverId = userStore.user?.id;
            if (driverId != null && ['preparing', 'on_delivery'].includes(status)) {
                try {
                    await upsertDriverLocationForOrder(orderId, String(driverId));
                } catch (e) {
                    // Don't block status update if GPS fails.
                }
            }

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

/** Driver can cancel any non-terminal active order (e.g. can’t prepare — out of stock, or customer backs out). */
const canDriverCancelOrder = (order) => {
    const s = order?.status;
    // MVP: once the driver starts preparing, we stop allowing cancellation from this screen.
    return s && ['pending', 'assigned', 'confirmed'].includes(s);
};

const confirmCancelOrder = (order) => {
    confirm.require({
        header: 'Cancel this order?',
        message: `Order ${order.orderNumber || order.id} will be marked cancelled. Use this if you cannot fulfil it (e.g. insufficient stock).`,
        icon: 'pi pi-exclamation-triangle',
        rejectLabel: 'Keep order',
        acceptLabel: 'Yes, cancel order',
        rejectClass: 'p-button-secondary p-button-outlined',
        acceptClass: 'p-button-danger',
        accept: () => cancelOrderAsDriver(order.id)
    });
};

const openOrderDialog = (order) => {
    selectedOrder.value = order;
    orderDialogVisible.value = true;
};

const onOrderDetailUpdated = (updated) => {
    selectedOrder.value = updated;
    const idx = orders.value.findIndex((o) => o.id === updated.id);
    if (idx !== -1) orders.value[idx] = { ...orders.value[idx], ...updated };
};

const cancelOrderAsDriver = async (orderId) => {
    updatingId.value = orderId;
    try {
        const res = await api.orders.updateOrderStatus(orderId, 'cancelled', {});
        if (res?.success) {
            toast.add({
                severity: 'info',
                summary: 'Order cancelled',
                detail: 'The order status is now cancelled.',
                life: 3500
            });
            await fetchOrders();
        } else {
            toast.add({
                severity: 'error',
                summary: 'Could not cancel',
                detail: res?.error?.message || res?.message || 'Try again or contact admin.',
                life: 4500
            });
        }
    } catch (e) {
        toast.add({
            severity: 'error',
            summary: 'Error',
            detail: e?.message || 'Failed to cancel',
            life: 4000
        });
    } finally {
        updatingId.value = null;
    }
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

    // Minimal periodic GPS updates while this page is open.
    // Every 5 minutes: upsert for all active orders in preparing/on_delivery.
    gpsInterval.value = setInterval(async () => {
        const driverId = userStore.user?.id;
        if (!driverId) return;
        const targets = orders.value.filter((o) => ['preparing', 'on_delivery'].includes(o.status)).map((o) => o.id);
        if (!targets.length) return;
        await Promise.all(
            targets.map((oid) =>
                upsertDriverLocationForOrder(oid, String(driverId)).catch(() => {
                    // Ignore GPS/insert failures
                })
            )
        );
    }, 5 * 60 * 1000);
});

onUnmounted(() => {
    if (gpsInterval.value) clearInterval(gpsInterval.value);
});
</script>

<template>
    <div class="p-4">
        <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
            <p class="text-600 dark:text-400 text-sm mb-0">Handle and complete orders assigned to you until delivered.
            </p>
            <Button label="View all history" icon="pi pi-history" outlined size="small" @click="goToHistory" />
        </div>

        <div v-if="isLoading" class="flex justify-center py-8">
            <ProgressSpinner style="width: 40px; height: 40px" />
        </div>

        <template v-else>
            <!-- Active -->
            <div class="mb-6">
                <h3 class="text-lg font-semibold text-surface-900 dark:text-surface-0 mb-3">Active</h3>
                <div v-if="activeOrders.length === 0"
                    class="rounded-xl border-2 border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800/50 p-6 text-center text-600">
                    <i class="pi pi-inbox !text-4xl mb-2 block"></i>
                    <p class="mb-0">No active orders. New orders assigned to you will appear here.</p>
                </div>
                <div v-else class="space-y-3">
                    <div v-for="order in activeOrders" :key="order.id"
                        class="rounded-xl border-2 border-surface-200 dark:border-surface-700 bg-card dark:bg-card p-4">
                        <div class="flex flex-wrap items-start justify-between gap-3">
                            <div>
                                <div class="font-semibold text-surface-900 dark:text-surface-0">{{ order.orderNumber }}
                                </div>
                                <div class="text-sm text-600">{{ order.customerName }}</div>
                                <div class="text-sm text-600 mt-1">{{ formatDate(order.orderDate) }}</div>
                            </div>
                            <div class="flex items-center gap-2">
                                <Tag :value="order.status" :severity="getStatusSeverity(order.status)" />
                                <span class="font-semibold text-red-600 dark:text-red-400">{{
                                    formatCurrency(order.total) }}</span>
                            </div>
                        </div>
                        <div v-if="order.deliveryAddress?.address" class="mt-2 text-sm text-600 flex items-start gap-2">
                            <i class="pi pi-map-marker mt-0.5"></i>
                            <span>{{ order.deliveryAddress.address }}</span>
                        </div>
                        <div v-if="order.customerPhone" class="mt-2">
                            <a :href="`tel:${order.customerPhone}`" class="text-sm text-primary font-medium"> <i
                                    class="pi pi-phone mr-1"></i>{{ order.customerPhone }} </a>
                        </div>
                        <div class="mt-3 pt-3 border-t border-surface-200 dark:border-surface-700 flex flex-wrap gap-2">
                            <Button v-if="getNextAction(order)" :label="getNextAction(order).label"
                                :icon="getNextAction(order).icon" size="small" :loading="updatingId === order.id"
                                :disabled="updatingId !== null || driverStore.isProcessingOrder"
                                :severity="order.status === 'on_delivery' ? 'success' : 'primary'"
                                class="flex-1 min-w-[8rem]"
                                @click="updateStatus(order.id, getNextAction(order).status)" />
                            <Button
                                v-if="canDriverCancelOrder(order)"
                                label="Cancel order"
                                icon="pi pi-times-circle"
                                size="small"
                                severity="danger"
                                outlined
                                class="flex-1 min-w-[8rem]"
                                :loading="updatingId === order.id && driverStore.isProcessingOrder"
                                :disabled="updatingId !== null || driverStore.isProcessingOrder"
                                v-tooltip.top="'Cancel if you cannot process this order'"
                                @click="confirmCancelOrder(order)"
                            />
                            <Button
                                v-else
                                label="View detail"
                                icon="pi pi-eye"
                                size="small"
                                severity="secondary"
                                outlined
                                class="flex-1 min-w-[8rem]"
                                @click="openOrderDialog(order)"
                            />
                        </div>
                    </div>
                </div>
            </div>

            <!-- Completed (recent) -->
            <div>
                <h3 class="text-lg font-semibold text-surface-900 dark:text-surface-0 mb-3">Completed (recent)</h3>
                <div v-if="completedOrders.length === 0" class="text-sm text-600">No completed orders yet.</div>
                <DataTable v-else :value="completedOrders.slice(0, 5)" responsiveLayout="scroll" class="p-datatable-sm"
                    :paginator="false">
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

    <OrderDetailDialog
        v-model="orderDialogVisible"
        :order="selectedOrder"
        @order-updated="onOrderDetailUpdated"
    />
</template>
