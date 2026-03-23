<script setup lang="ts">
import OrderDetailDialog from '@/components/shared/OrderDetailDialog.vue';
import api from '@/services/api/index.js';
import { computed, onMounted, ref, watch } from 'vue';

type Status = 'all' | 'pending' | 'assigned' | 'preparing' | 'on_delivery' | 'delivered' | 'cancelled';

const statusOptions = [
    { label: 'Semua status', value: 'all' as Status },
    { label: 'Pending', value: 'pending' as Status },
    { label: 'Assigned', value: 'assigned' as Status },
    { label: 'Preparing', value: 'preparing' as Status },
    { label: 'On delivery', value: 'on_delivery' as Status },
    { label: 'Delivered', value: 'delivered' as Status },
    { label: 'Cancelled', value: 'cancelled' as Status }
];

const driverOptions = ref<{ label: string; value: string | null }[]>([{ label: 'Semua driver', value: null }]);

const selectedStatus = ref<Status>('all');
const selectedDriverId = ref<string | null>(null);
const startDate = ref<Date | null>(null);
const endDate = ref<Date | null>(null);
const search = ref('');

const isLoading = ref(false);
const orders = ref<any[]>([]);
const orderDialogVisible = ref(false);
const selectedOrder = ref<any | null>(null);

const formatCurrency = (amount: number) => {
    const formatted = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount || 0);
    return formatted.replace(/\s/g, '');
};

const formatDateTime = (iso: string) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' });
};

const dateToIsoStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0).toISOString();
const dateToIsoEnd = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59).toISOString();

const filteredOrders = computed(() => {
    const q = search.value.trim().toLowerCase();
    if (!q) return orders.value;
    return orders.value.filter((o: any) => {
        const orderNumber = String(o.orderNumber || '').toLowerCase();
        const customerName = String(o.customerName || '').toLowerCase();
        const customerPhone = String(o.customerPhone || '').toLowerCase();
        return orderNumber.includes(q) || customerName.includes(q) || customerPhone.includes(q);
    });
});

const loadDrivers = async () => {
    try {
        const res = await api.drivers.listDrivers?.();
        const list = res?.success && res?.data?.drivers ? res.data.drivers : [];
        const opts = list.map((d: any) => ({ label: d.name, value: String(d.id) }));
        driverOptions.value = [{ label: 'Semua driver', value: null }, ...opts];
    } catch (e) {
        console.warn('[AdminOrders] Failed to load drivers:', e);
        driverOptions.value = [{ label: 'Semua driver', value: null }];
    }
};

const loadOrders = async () => {
    isLoading.value = true;
    try {
        const res = await api.orders.getAllOrders({
            status: selectedStatus.value === 'all' ? undefined : selectedStatus.value,
            driverId: selectedDriverId.value || undefined,
            dateFrom: startDate.value ? dateToIsoStart(startDate.value) : undefined,
            dateTo: endDate.value ? dateToIsoEnd(endDate.value) : undefined,
            limit: 2000
        });
        orders.value = res?.success && res?.data?.orders ? res.data.orders : [];
    } catch (e) {
        console.error('[AdminOrders] Failed to load orders:', e);
        orders.value = [];
    } finally {
        isLoading.value = false;
    }
};

const resetFilters = () => {
    selectedStatus.value = 'all';
    selectedDriverId.value = null;
    startDate.value = null;
    endDate.value = null;
    search.value = '';
};

const statusSeverity = (s: string) => {
    const m: Record<string, string> = {
        pending: 'warn',
        assigned: 'info',
        preparing: 'info',
        on_delivery: 'info',
        delivered: 'success',
        cancelled: 'danger'
    };
    return m[s] || 'secondary';
};

const openOrderDialog = (order: any) => {
    selectedOrder.value = order;
    orderDialogVisible.value = true;
};

const onOrderDetailUpdated = (order: any) => {
    selectedOrder.value = order;
    const idx = orders.value.findIndex((o: any) => o.id === order.id);
    if (idx !== -1) {
        orders.value[idx] = { ...orders.value[idx], ...order };
    }
};

watch([selectedStatus, selectedDriverId, startDate, endDate], () => loadOrders());

onMounted(async () => {
    await loadDrivers();
    await loadOrders();
});
</script>

<template>
    <div class="card">
        <div class="flex flex-col gap-2 mb-4">
            <div class="text-2xl font-semibold">Orders</div>
            <div class="text-sm text-surface-500">Kelola dan pantau semua order (delivery & walk-in).</div>
        </div>

        <!-- Filters -->
        <div class="grid grid-cols-12 gap-4 mb-4">
            <div class="col-span-12 md:col-span-3">
                <label class="block text-sm font-medium mb-2">Status</label>
                <Select v-model="selectedStatus" :options="statusOptions" optionLabel="label" optionValue="value" class="w-full" />
            </div>
            <div class="col-span-12 md:col-span-3">
                <label class="block text-sm font-medium mb-2">Driver</label>
                <Select v-model="selectedDriverId" :options="driverOptions" optionLabel="label" optionValue="value" class="w-full" />
            </div>
            <div class="col-span-12 md:col-span-3">
                <label class="block text-sm font-medium mb-2">Tanggal Mulai</label>
                <DatePicker v-model="startDate" dateFormat="dd/mm/yy" placeholder="dd/mm/yy" class="w-full" />
            </div>
            <div class="col-span-12 md:col-span-3">
                <label class="block text-sm font-medium mb-2">Tanggal Akhir</label>
                <DatePicker v-model="endDate" dateFormat="dd/mm/yy" placeholder="dd/mm/yy" class="w-full" />
            </div>
            <div class="col-span-12 md:col-span-6">
                <label class="block text-sm font-medium mb-2">Cari</label>
                <InputText v-model="search" placeholder="Cari order number / customer / phone" class="w-full" />
            </div>
            <div class="col-span-12 md:col-span-6 flex items-end justify-end gap-2">
                <Button label="Reset" icon="pi pi-refresh" outlined @click="resetFilters" />
                <Button label="Refresh" icon="pi pi-sync" @click="loadOrders" :loading="isLoading" />
            </div>
        </div>

        <!-- Table -->
        <DataTable
            :value="filteredOrders"
            :loading="isLoading"
            paginator
            :rows="10"
            :rowsPerPageOptions="[10, 25, 50]"
            class="p-datatable-sm"
            responsiveLayout="scroll"
        >
            <template #empty>
                <div class="py-6 text-center text-surface-500">Tidak ada order untuk filter ini.</div>
            </template>

            <Column header="#" style="width: 60px">
                <template #body="{ index }">
                    {{ index + 1 }}
                </template>
            </Column>

            <Column header="Order" style="min-width: 180px">
                <template #body="{ data }">
                    <div class="flex flex-col">
                        <div class="font-semibold">{{ data.orderNumber || data.id }}</div>
                        <div class="text-xs text-surface-500">{{ formatDateTime(data.orderDate) }}</div>
                    </div>
                </template>
            </Column>

            <Column header="Customer" style="min-width: 220px">
                <template #body="{ data }">
                    <div class="flex flex-col">
                        <div class="font-medium">{{ data.customerName || '—' }}</div>
                        <div class="text-xs text-surface-500">{{ data.customerPhone || data.customerEmail || '—' }}</div>
                    </div>
                </template>
            </Column>

            <Column header="Driver" style="min-width: 180px">
                <template #body="{ data }">
                    <div class="flex flex-col">
                        <div class="font-medium">{{ data.driverInfo?.name || '—' }}</div>
                        <div class="text-xs text-surface-500">{{ data.driverInfo?.phone || '—' }}</div>
                    </div>
                </template>
            </Column>

            <Column header="Items" style="width: 90px">
                <template #body="{ data }">
                    {{ (data.items || []).reduce((sum, it) => sum + Number(it.quantity || 0), 0) }}
                </template>
            </Column>

            <Column header="Total" style="min-width: 140px">
                <template #body="{ data }">
                    <div class="font-semibold">{{ formatCurrency(Number(data.total || 0)) }}</div>
                    <div class="text-xs text-surface-500">Pay: {{ data.paymentStatus || 'pending' }}</div>
                </template>
            </Column>

            <Column header="Status" style="min-width: 140px">
                <template #body="{ data }">
                    <Tag :value="data.status" :severity="statusSeverity(data.status)" />
                </template>
            </Column>

            <Column header="Action" style="width: 90px">
                <template #body="{ data }">
                    <Button
                        icon="pi pi-eye"
                        text
                        rounded
                        severity="secondary"
                        v-tooltip.top="'View order details'"
                        @click="openOrderDialog(data)"
                    />
                </template>
            </Column>
        </DataTable>

        <OrderDetailDialog v-model="orderDialogVisible" :order="selectedOrder" @order-updated="onOrderDetailUpdated" />
    </div>
</template>
