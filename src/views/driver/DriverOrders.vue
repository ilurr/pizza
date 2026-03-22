<script setup>
import api from '@/services/api/index.js';
import { useUserStore } from '@/stores/userStore';
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const userStore = useUserStore();

const orders = ref([]);
const isLoading = ref(false);
const filterType = ref('all'); // 'all' | 'app' | 'walk-in' when we have offline

const filteredOrders = computed(() => {
    let list = orders.value;
    if (filterType.value === 'app') list = list.filter((o) => o.orderType !== 'walk-in');
    if (filterType.value === 'walk-in') list = list.filter((o) => o.orderType === 'walk-in');
    return list;
});

const fetchOrders = async () => {
    const driverId = userStore.user?.id;
    if (!driverId) return;
    isLoading.value = true;
    try {
        const res = await api.orders.getDriverOrders(driverId);
        const list = res?.success && res?.data?.orders ? res.data.orders : [];
        // Mark as app orders (from driver_id). When we have offline orders API, merge and set orderType.
        orders.value = list.map((o) => ({ ...o, orderType: 'app' }));
    } catch (e) {
        console.error('Failed to fetch orders:', e);
        orders.value = [];
    } finally {
        isLoading.value = false;
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

const goToOnline = () => router.push('/driver/orders/online');

onMounted(() => {
    fetchOrders();
});
</script>

<template>
    <div class="p-4">
        <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
            <p class="text-600 dark:text-400 text-sm mb-0">All transactions (walk-in and app orders).</p>
            <Button label="Delivery" icon="pi pi-truck" outlined size="small" @click="goToOnline" />
        </div>

        <div class="flex flex-wrap gap-2 mb-4">
            <Button :label="'All'" :severity="filterType === 'all' ? 'primary' : 'secondary'" size="small" outlined @click="filterType = 'all'" />
            <Button label="App" :severity="filterType === 'app' ? 'primary' : 'secondary'" size="small" outlined @click="filterType = 'app'" />
            <Button label="Walk-in" :severity="filterType === 'walk-in' ? 'primary' : 'secondary'" size="small" outlined @click="filterType = 'walk-in'" />
        </div>

        <div v-if="isLoading" class="flex justify-center py-8">
            <ProgressSpinner style="width: 40px; height: 40px" />
        </div>

        <div v-else-if="filteredOrders.length === 0" class="rounded-xl border-2 border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800/50 p-8 text-center text-600">
            <i class="pi pi-inbox text-4xl mb-3 block"></i>
            <p class="text-lg mb-0">No orders yet</p>
        </div>

        <DataTable
            v-else
            :value="filteredOrders"
            responsiveLayout="scroll"
            class="p-datatable-sm rounded-lg border-2 border-surface-200 dark:border-surface-700"
            :paginator="true"
            :rows="10"
            :rowsPerPageOptions="[5, 10, 20]"
            paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink CurrentPageReport RowsPerPageDropdown"
            currentPageReportTemplate="Showing {first} to {last} of {totalRecords}"
        >
            <Column field="orderNumber" header="Order #" style="min-width: 8rem" />
            <Column field="customerName" header="Customer" style="min-width: 10rem" />
            <Column header="Type" style="min-width: 6rem">
                <template #body="{ data }">
                    <Tag :value="data.orderType === 'walk-in' ? 'Walk-in' : 'App'" :severity="data.orderType === 'walk-in' ? 'orange' : 'info'" />
                </template>
            </Column>
            <Column header="Status" style="min-width: 7rem">
                <template #body="{ data }">
                    <Tag :value="data.status" :severity="getStatusSeverity(data.status)" />
                </template>
            </Column>
            <Column header="Total" style="min-width: 8rem">
                <template #body="{ data }">
                    <span class="font-semibold">{{ formatCurrency(data.total) }}</span>
                </template>
            </Column>
            <Column header="Date" style="min-width: 10rem">
                <template #body="{ data }">{{ formatDate(data.orderDate) }}</template>
            </Column>
        </DataTable>
    </div>
</template>
