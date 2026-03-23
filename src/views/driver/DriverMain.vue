<script setup>
import DriverEndOfDayStockConfirmModal from '@/components/driver/DriverEndOfDayStockConfirmModal.vue';
import OrderDetailDialog from '@/components/shared/OrderDetailDialog.vue';
import UserAvatar from '@/components/shared/UserAvatar.vue';
import { useDriverDailyCloseDay } from '@/composables/useDriverDailyCloseDay.js';
import { useDriverMorningStockPrompt } from '@/composables/useDriverMorningStockPrompt.js';
import api from '@/services/api/index.js';
import { useDriverStore } from '@/stores/driverStore.js';
import { useUserStore } from '@/stores/userStore';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';

const driverStore = useDriverStore();
const userStore = useUserStore();
const morningStockPrompt = useDriverMorningStockPrompt();
const toast = useToast();
const router = useRouter();

const driverIdForCloseDay = computed(() =>
    userStore.user?.id != null && String(userStore.user.id) !== '' ? String(userStore.user.id) : ''
);
const { canShowCloseDay, refresh: refreshCloseDayEligibility } = useDriverDailyCloseDay(driverIdForCloseDay);
const closingModalVisible = ref(false);

const refreshInterval = ref(null);
const recentOrders = ref([]);
const isLoadingRecentOrders = ref(false);
const orderDialogVisible = ref(false);
const selectedOrder = ref(null);
const driverRating = ref(null);
const todayEarnings = ref(0);
const coverageKelurahan = ref([]);

const coverageLabel = computed(() => {
    if (!coverageKelurahan.value.length) return '—';
    return coverageKelurahan.value.map((k) => k.name).join(', ');
});

// Computed properties
const statusColor = computed(() => {
    return driverStore.isOnline ? 'success' : 'danger';
});

const statusText = computed(() => {
    return driverStore.isOnline ? 'Available' : 'Closed';
});

// Auto-determine if driver is busy from active orders
const isBusy = computed(() => {
    return driverStore.activeOrders.length > 0;
});

const formatCurrency = (amount) => {
    const formatted = new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(amount);
    return formatted.replace(/\s/g, ''); // Remove spaces
};

const getStatusSeverity = (status) => {
    const m = {
        pending: 'warn',
        assigned: 'info',
        confirmed: 'info',
        preparing: 'info',
        on_delivery: 'info',
        delivered: 'success',
        cancelled: 'danger'
    };
    return m[status] || 'secondary';
};

const openOrderDialog = (order) => {
    selectedOrder.value = order;
    orderDialogVisible.value = true;
};

const onOrderDetailUpdated = (order) => {
    selectedOrder.value = order;
    const idx = recentOrders.value.findIndex((o) => o.id === order.id);
    if (idx !== -1) {
        recentOrders.value[idx] = { ...recentOrders.value[idx], ...order };
    }
};

// Quick stats: shortcuts (navigate or open Close day after morning check-in)
const quickStats = computed(() => {
    const list = [
        {
            title: 'Walk-in',
            value: 'Cashier',
            icon: 'pi pi-money-bill',
            color: 'green',
            subtitle: 'Counter sales',
            path: '/driver/order/offline'
        },
        {
            title: 'Delivery',
            value: 'Delivery',
            icon: 'pi pi-truck',
            color: 'blue',
            subtitle: 'From the app',
            path: '/driver/orders/online'
        },
        {
            title: 'Inventory',
            value: 'Stock',
            icon: 'pi pi-box',
            color: 'orange',
            subtitle: 'Manage inventory',
            path: '/driver/stock'
        },
        {
            title: 'Total earned',
            value: todayEarnings.value ?? 0,
            icon: 'pi pi-wallet',
            color: 'purple',
            subtitle: "Today's Earnings",
            isCurrency: true,
            path: '/driver/earnings'
        }
    ];
    if (canShowCloseDay.value) {
        list.push({
            title: 'Close day',
            value: 'End shift',
            icon: 'pi pi-lock',
            color: 'red',
            subtitle: 'Stock & sales',
            action: 'close-day'
        });
    }
    return list;
});

const onQuickStatClick = (stat) => {
    if (stat.action === 'close-day') {
        closingModalVisible.value = true;
        return;
    }
    if (stat.path) router.push(stat.path);
};

const onCloseDayConfirmed = async () => {
    closingModalVisible.value = false;
    await refreshCloseDayEligibility();
    await fetchTodayEarnings();
};

// Methods
const toggleOnlineStatus = async () => {
    const wasOffline = !driverStore.isOnline;
    const result = await driverStore.toggleOnlineStatus();
    if (!result.success) {
        toast.add({
            severity: 'error',
            summary: 'Could not update status',
            detail: result.error || 'Try again',
            life: 4000
        });
        return;
    }
    if (driverStore.isOnline) {
        await driverStore.updateLocation();
        toast.add({
            severity: 'success',
            summary: 'You are now online',
            detail: 'You will start receiving order requests',
            life: 3000
        });
        if (wasOffline) {
            await morningStockPrompt.promptIfUnconfirmedForToday();
        }
    } else {
        toast.add({
            severity: 'info',
            summary: 'You are now offline',
            detail: 'You will not receive new order requests',
            life: 3000
        });
    }
};

const fetchRecentOrders = async () => {
    const driverId = userStore.user?.id;
    if (!driverId) {
        recentOrders.value = [];
        return;
    }
    isLoadingRecentOrders.value = true;
    try {
        const res = await api.orders.getDriverOrders(driverId);
        const list = res?.success && res?.data?.orders ? res.data.orders : [];
        recentOrders.value = list.slice(0, 5);
    } catch (e) {
        console.error('Failed to fetch driver orders:', e);
        recentOrders.value = [];
    } finally {
        isLoadingRecentOrders.value = false;
    }
};

const fetchTodayEarnings = async () => {
    const driverId = userStore.user?.id;
    if (!driverId) {
        todayEarnings.value = 0;
        return;
    }
    try {
        const res = await api.drivers.getDriverEarnings(driverId, 'today');
        if (res?.success && res.data?.report) {
            todayEarnings.value = res.data.report.totalEarnings ?? 0;
        } else {
            todayEarnings.value = 0;
        }
    } catch (e) {
        console.error('Failed to load today earnings:', e);
        todayEarnings.value = 0;
    }
};

const fetchDriverRating = async () => {
    const driverId = userStore.user?.id;
    if (!driverId) {
        driverRating.value = null;
        return;
    }
    try {
        const res = await api.orders.getDriverOrders(driverId);
        const orders = res?.success && res?.data?.orders ? res.data.orders : [];
        const withRating = orders.filter((o) => o.status === 'delivered' && o.rating != null && o.rating !== '');
        const values = withRating
            .map((o) => {
                const r = o.rating;
                if (typeof r === 'number' && !Number.isNaN(r)) return r;
                if (r && typeof r === 'object') return r.driverScore ?? r.score ?? r.foodScore ?? null;
                return null;
            })
            .filter((v) => v != null && !Number.isNaN(v));
        driverRating.value = values.length ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10 : null;
    } catch (e) {
        console.error('Failed to fetch driver rating:', e);
        driverRating.value = null;
    }
};

const refreshData = async () => {
    await Promise.all([
        driverStore.loadOrders(),
        driverStore.updateLocation(),
        fetchRecentOrders(),
        fetchDriverRating(),
        refreshCloseDayEligibility()
    ]);
};

const formatTime = (dateString) => {
    return new Date(dateString).toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit'
    });
};

const fetchCoverageKelurahan = async () => {
    try {
        const id = userStore.user?.id;
        if (!id) return;
        const res = await api.drivers.getDriverKelurahan(id);
        if (res?.success && res.data?.kelurahan) {
            coverageKelurahan.value = res.data.kelurahan;
        } else {
            coverageKelurahan.value = [];
        }
    } catch (error) {
        console.error('Failed to load driver kelurahan:', error);
        coverageKelurahan.value = [];
    }
};

// Lifecycle
onMounted(async () => {
    const id = userStore.user?.id != null && String(userStore.user.id) !== '' ? String(userStore.user.id) : null;
    if (id) await driverStore.initializeDriver(id);
    await Promise.all([fetchRecentOrders(), fetchDriverRating(), fetchTodayEarnings(), fetchCoverageKelurahan(), refreshCloseDayEligibility()]);

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
    <div class="relative p-4 lg:p-0">
        <!-- Header with Driver Status -->
        <h3 class="text-surface-900 dark:text-surface-0 text-xl font-bold !mt-2 mb-4 text-left px-2">👋 Welcome back,
            Chef!</h3>
        <div
            class="relative z-50 bg-white dark:bg-neutral-800 rounded-lg shadow-lg border border-gray-200 dark:border-transparent p-4 mb-8">
            <div class="flex flex-col gap-4 items-center">
                <div class="flex items-center gap-4 w-full">
                    <div class="flex items-center gap-4">
                        <UserAvatar :avatar="userStore.user?.avatar || ''"
                            :name="userStore.user?.fullname || userStore.user?.username || ''" size="xlarge" />
                        <div>
                            <div class="font-medium text-xl text-gray-900 dark:text-white mb-1 truncate">{{
                                userStore.user?.fullname || userStore.user?.username || 'Driver' }}</div>
                            <div class="flex items-center gap-2">
                                <Tag :value="statusText" :severity="statusColor" />
                                <!-- <Tag v-if="driverStore.isOnline && isBusy" value="Cooking" severity="warn" /> -->
                                <!-- <span class="text-sm text-600">
																	{{ driverStore.driverProfile?.vehicleInfo?.model }} - {{ driverStore.driverProfile?.vehicleInfo?.plate }}
															</span> -->
                            </div>
                        </div>
                    </div>

                    <div class="flex gap-3 ml-auto items-center">
                        <!-- Online/Offline Toggle Switch -->
                        <div class="flex items-center gap-2">
                            <!-- <span class="text-sm text-600">{{ driverStore.isOnline ? 'Online' : 'Offline' }}</span> -->
                            <!-- <ToggleButton v-model="driverStore.isOnline" onLabel="ON" offLabel="OFF" size="large" class="min-w-24"
							@change="toggleOnlineStatus" /> -->
                            <Button :label="driverStore.isOnline ? 'ON' : 'OFF'" rounded
                                :severity="driverStore.isOnline ? 'success' : 'danger'" @click="toggleOnlineStatus"
                                :icon="driverStore.isOnline ? 'pi pi-face-smile' : 'pi pi-power-off'" />
                            <!-- <Button :label="driverStore.isAvailable ? 'Set Busy' : 'Set Available'"
							:severity="driverStore.isAvailable ? 'warn' : 'info'" @click="toggleAvailability" outlined
							:disabled="!driverStore.isOnline" :icon="driverStore.isAvailable ? 'pi pi-pause' : 'pi pi-check'" /> -->
                        </div>
                        <!-- <Button label="Refresh" icon="pi pi-refresh" @click="refreshData" :loading="driverStore.isLoadingOrders" outlined size="small" /> -->
                    </div>
                </div>
                <div class="relative text-base/6 w-full pt-4 border-t">
                    Your coverage area:
                    <br />
                    <strong>{{ coverageLabel }}</strong>
                </div>
                <div class="flex items-center justify-between text-base/6 w-full">
                    <div class="inline-flex items-center gap-1">Your overall rating:</div>
                    <div class="inline-flex items-center">
                        <i v-for="n in 5" :key="n" class="pi pi-star-fill text-yellow-500"
                            :class="{ 'is-filled': n <= Math.round(driverRating) }"></i>
                        <span class="ml-2">{{ driverRating != null ? driverRating : '—' }}/5</span>
                    </div>
                </div>
            </div>
        </div>

        <!-- Quick Stats (shortcuts) -->
        <div class="grid grid-cols-2 gap-4 w-full mb-8">
            <button v-for="(stat, index) in quickStats" :key="stat.title" type="button"
                class="rounded-xl border-2 bg-white dark:bg-neutral-800 border-surface-200 dark:border-surface-700 overflow-hidden transition-shadow hover:shadow-sm block w-full text-left cursor-pointer font-sans p-0"
                :class="{ 'col-span-2': quickStats.length % 2 === 1 && index === quickStats.length - 1 }"
                @click="onQuickStatClick(stat)">
                <div class="p-5 md:py-5 md:px-6 flex flex-col md:flex-row items-center text-center gap-3 md:gap-6">
                    <span class="flex items-center justify-center w-14 h-14 rounded-2xl shrink-0" :class="{
                        'bg-orange-200/60 dark:bg-orange-700/40': stat.color === 'orange',
                        'bg-blue-200/60 dark:bg-blue-700/40': stat.color === 'blue',
                        'bg-green-200/60 dark:bg-green-700/40': stat.color === 'green',
                        'bg-purple-200/60 dark:bg-purple-700/40': stat.color === 'purple',
                        'bg-red-200/60 dark:bg-red-700/40': stat.color === 'red'
                    }">
                        <i :class="[
                            stat.icon,
                            '!text-2xl shrink-0',
                            stat.color === 'orange' && 'text-orange-500',
                            stat.color === 'blue' && 'text-blue-500',
                            stat.color === 'green' && 'text-green-500',
                            stat.color === 'purple' && 'text-purple-500',
                            stat.color === 'red' && 'text-red-500'
                        ]"></i>
                    </span>
                    <div class="min-w-0 w-full md:w-auto md:text-left md:flex-1">
                        <div class="text-600 dark:text-400 mb-0.5 md:hidden">{{ stat.title }}</div>
                        <div class="text-2xl font-bold text-900 dark:text-white truncate">
                            {{ stat.isCurrency ? formatCurrency(stat.value) : stat.value }}
                        </div>
                        <div class="text-900 dark:text-white font-medium text-sm mt-1">{{ stat.subtitle }}</div>
                    </div>
                </div>
            </button>
        </div>

        <DriverEndOfDayStockConfirmModal v-model="closingModalVisible" :driver-id="driverIdForCloseDay"
            @confirmed="onCloseDayConfirmed" />

        <OrderDetailDialog v-model="orderDialogVisible" :order="selectedOrder" @order-updated="onOrderDetailUpdated" />

        <!-- Recent Activity -->
        <div class="flex items-center justify-between mb-4">
            <h2 class="text-surface-900 dark:text-surface-0 text-xl font-bold mb-0 text-left">Recent Orders</h2>
            <router-link to="/driver/orders" class="text-papa-red hover:text-red-700 font-medium"> View All →
            </router-link>
        </div>
        <div
            class="relative w-full rounded-lg border-2 border-surface-200 dark:border-surface-700 bg-card dark:bg-card overflow-hidden transition-shadow hover:shadow-md mb-8">
            <DataTable v-if="isLoadingRecentOrders || recentOrders.length > 0" :value="recentOrders"
                :loading="isLoadingRecentOrders" responsiveLayout="scroll" :paginator="false" class="p-datatable-sm">
                <Column header="Order #" style="min-width: 8rem">
                    <template #body="{ data }">
                        <span class="font-medium">{{ data.orderNumber || data.id }}</span>
                    </template>
                </Column>
                <Column header="Customer" style="min-width: 10rem">
                    <template #body="{ data }">
                        <div class="font-medium">{{ data.customerName || '—' }}</div>
                        <div v-if="data.customerPhone" class="text-xs text-surface-500">{{ data.customerPhone }}</div>
                    </template>
                </Column>
                <Column header="Status" style="min-width: 7rem">
                    <template #body="{ data }">
                        <Tag :value="data.status" :severity="getStatusSeverity(data.status)" />
                    </template>
                </Column>
                <Column header="Total" style="min-width: 8rem">
                    <template #body="{ data }">
                        <span class="font-semibold">{{ formatCurrency(Number(data.total || 0)) }}</span>
                    </template>
                </Column>
                <Column header="Actions" style="width: 5rem">
                    <template #body="{ data }">
                        <Button icon="pi pi-eye" text rounded severity="secondary" v-tooltip.top="'View order details'"
                            @click="openOrderDialog(data)" />
                    </template>
                </Column>
            </DataTable>

            <div v-else class="text-center py-8 text-600">
                <i class="pi pi-inbox !text-4xl mb-1 block"></i>
                <p class="text-lg mb-2">No orders yet</p>
                <!-- <p class="text-sm">{{ driverStore.isOnline ? 'Waiting for new orders...' : 'Go online to receive orders' }}</p> -->
            </div>
        </div>
    </div>
</template>

<style scoped>
.card {
    background: var(--surface-card);
    border-radius: 10px;
    box-shadow:
        0 1px 3px rgba(0, 0, 0, 0.12),
        0 1px 2px rgba(0, 0, 0, 0.24);
}

.performance-card {
    padding: 1.25rem 1.5rem;
}

.performance-rating__label {
    display: block;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-color-secondary);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin-bottom: 0.75rem;
}

.performance-rating__value {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
}

.performance-rating__number {
    font-size: 2.25rem;
    font-weight: 700;
    color: var(--primary-color);
    line-height: 1;
}

.performance-rating__stars {
    display: flex;
    align-items: center;
    gap: 0.2rem;
}

.performance-rating__stars .pi {
    font-size: 1.1rem;
    color: var(--surface-300);
}

.performance-rating__stars .pi.is-filled {
    color: #eab308;
}

.performance-rating__empty {
    font-size: 2rem;
    font-weight: 600;
    color: var(--surface-400);
}

.performance-rating__hint {
    font-size: 0.8125rem;
    color: var(--text-color-secondary);
}
</style>
