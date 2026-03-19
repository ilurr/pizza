<script setup lang="ts">
import api from '@/services/api/index.js';
import { computed, onMounted, ref, watch } from 'vue';

type Period = '7d' | '30d' | '90d' | 'custom';

const periodOptions = [
    { label: '7 hari terakhir', value: '7d' as Period },
    { label: '30 hari terakhir', value: '30d' as Period },
    { label: '90 hari terakhir', value: '90d' as Period },
    { label: 'Custom', value: 'custom' as Period }
];

const selectedPeriod = ref<Period>('30d');
const startDate = ref<Date | null>(null);
const endDate = ref<Date | null>(null);
const selectedDriverId = ref<string | null>(null);

const driverOptions = ref<{ label: string; value: string | null }[]>([{ label: 'Semua driver', value: null }]);
const isLoading = ref(false);
const orders = ref<any[]>([]);

const dateToIsoStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0).toISOString();
const dateToIsoEnd = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59).toISOString();
const normalizeToDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const keyOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const formatCurrency = (amount: number) => {
    const formatted = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount || 0);
    return formatted.replace(/\s/g, '');
};

const periodRange = computed(() => {
    const now = new Date();
    if (selectedPeriod.value === '7d') {
        const from = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
        return { from: dateToIsoStart(from), to: dateToIsoEnd(now), days: 7 };
    }
    if (selectedPeriod.value === '90d') {
        const from = new Date(now.getTime() - 89 * 24 * 60 * 60 * 1000);
        return { from: dateToIsoStart(from), to: dateToIsoEnd(now), days: 90 };
    }
    if (selectedPeriod.value === 'custom') {
        if (!startDate.value || !endDate.value) return { from: null, to: null, days: 0 };
        const start = normalizeToDay(startDate.value);
        const end = normalizeToDay(endDate.value);
        const days = Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1;
        return { from: dateToIsoStart(start), to: dateToIsoEnd(end), days: Math.max(days, 0) };
    }
    // default 30d
    const from = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);
    return { from: dateToIsoStart(from), to: dateToIsoEnd(now), days: 30 };
});

const rangeKeys = computed(() => {
    const r = periodRange.value;
    if (!r.from || !r.to || r.days <= 0) return [];
    const keys: string[] = [];
    const start = normalizeToDay(new Date(r.from));
    for (let i = 0; i < r.days; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        keys.push(keyOf(d));
    }
    return keys;
});

const loadDrivers = async () => {
    try {
        const res = await api.drivers.listDrivers?.();
        const list = res?.success && res?.data?.drivers ? res.data.drivers : [];
        const opts = list.map((d: any) => ({ label: d.name, value: String(d.id) }));
        driverOptions.value = [{ label: 'Semua driver', value: null }, ...opts];
    } catch (e) {
        console.warn('[AdminAnalytics] Failed to load drivers:', e);
        driverOptions.value = [{ label: 'Semua driver', value: null }];
    }
};

const loadOrders = async () => {
    const r = periodRange.value;
    if (selectedPeriod.value === 'custom' && (!r.from || !r.to)) return;

    isLoading.value = true;
    try {
        const res = await api.orders.getAllOrders({
            dateFrom: r.from || undefined,
            dateTo: r.to || undefined,
            driverId: selectedDriverId.value || undefined,
            limit: 5000
        });
        orders.value = res?.success && res?.data?.orders ? res.data.orders : [];
    } catch (e) {
        console.error('[AdminAnalytics] Failed to load analytics orders:', e);
        orders.value = [];
    } finally {
        isLoading.value = false;
    }
};

const deliveredOrders = computed(() => orders.value.filter((o: any) => o.status === 'delivered'));

const kpis = computed(() => {
    const delivered = deliveredOrders.value;
    const revenue = delivered.reduce((sum: number, o: any) => sum + Number(o.total || 0), 0);
    const soldItems = delivered.reduce(
        (sum: number, o: any) => sum + (o.items || []).reduce((s: number, it: any) => s + Number(it.quantity || 0), 0),
        0
    );
    const avgOrderValue = delivered.length ? revenue / delivered.length : 0;
    return { revenue, soldItems, deliveredCount: delivered.length, avgOrderValue };
});

const statusChartData = computed(() => {
    const counts: Record<string, number> = {
        pending: 0,
        assigned: 0,
        preparing: 0,
        on_delivery: 0,
        delivered: 0,
        cancelled: 0
    };
    for (const o of orders.value) {
        const s = String(o.status || '');
        if (s in counts) counts[s] += 1;
    }
    return {
        labels: ['Pending', 'Assigned', 'Preparing', 'On Delivery', 'Delivered', 'Cancelled'],
        datasets: [
            {
                data: [counts.pending, counts.assigned, counts.preparing, counts.on_delivery, counts.delivered, counts.cancelled],
                backgroundColor: ['#F59E0B', '#6366F1', '#3B82F6', '#06B6D4', '#22C55E', '#EF4444']
            }
        ]
    };
});

const trendChartData = computed(() => {
    const keys = rangeKeys.value;
    const revenueByDay: Record<string, number> = {};
    for (const k of keys) revenueByDay[k] = 0;

    for (const o of deliveredOrders.value) {
        const k = keyOf(new Date(o.orderDate || o.createdAt || Date.now()));
        if (!(k in revenueByDay)) continue;
        revenueByDay[k] += Number(o.total || 0);
    }

    return {
        labels: keys.map((k) => k.split('-').reverse().join('/')),
        datasets: [
            {
                label: 'Omset',
                data: keys.map((k) => revenueByDay[k] || 0),
                borderColor: '#60A5FA',
                backgroundColor: 'rgba(96,165,250,0.15)',
                fill: true,
                tension: 0.35,
                pointRadius: 2
            }
        ]
    };
});

const topDrivers = computed(() => {
    const map: Record<string, { name: string; revenue: number; orders: number }> = {};
    for (const o of deliveredOrders.value) {
        const id = String(o.driverId || 'unknown');
        const name = o.driverInfo?.name || 'Unknown';
        if (!map[id]) map[id] = { name, revenue: 0, orders: 0 };
        map[id].revenue += Number(o.total || 0);
        map[id].orders += 1;
    }
    return Object.values(map)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);
});

const chartOptions = {
    maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom' } }
};

watch([selectedPeriod, startDate, endDate, selectedDriverId], () => loadOrders());

onMounted(async () => {
    await loadDrivers();
    await loadOrders();
});
</script>

<template>
    <div class="card">
        <div class="flex flex-col gap-2 mb-4">
            <div class="text-2xl font-semibold">Analytics</div>
            <div class="text-sm text-surface-500">Ringkasan performa order, omset, status order, dan top driver.</div>
        </div>

        <div class="grid grid-cols-12 gap-4 mb-4">
            <div class="col-span-12 md:col-span-3">
                <label class="block text-sm font-medium mb-2">Periode</label>
                <Dropdown v-model="selectedPeriod" :options="periodOptions" optionLabel="label" optionValue="value" class="w-full" />
            </div>
            <div class="col-span-12 md:col-span-3">
                <label class="block text-sm font-medium mb-2">Tanggal Mulai</label>
                <Calendar v-model="startDate" dateFormat="dd/mm/yy" placeholder="dd/mm/yy" :disabled="selectedPeriod !== 'custom'" class="w-full" />
            </div>
            <div class="col-span-12 md:col-span-3">
                <label class="block text-sm font-medium mb-2">Tanggal Akhir</label>
                <Calendar v-model="endDate" dateFormat="dd/mm/yy" placeholder="dd/mm/yy" :disabled="selectedPeriod !== 'custom'" class="w-full" />
            </div>
            <div class="col-span-12 md:col-span-3">
                <label class="block text-sm font-medium mb-2">Driver</label>
                <Dropdown v-model="selectedDriverId" :options="driverOptions" optionLabel="label" optionValue="value" class="w-full" />
            </div>
        </div>

        <!-- KPI cards -->
        <div class="grid grid-cols-12 gap-4 mb-4">
            <div class="col-span-12 md:col-span-3">
                <div class="rounded-xl border border-surface-200 dark:border-surface-700 p-4">
                    <div class="text-sm text-surface-500 mb-1">Total Omset</div>
                    <div class="text-xl font-semibold">{{ formatCurrency(kpis.revenue) }}</div>
                </div>
            </div>
            <div class="col-span-12 md:col-span-3">
                <div class="rounded-xl border border-surface-200 dark:border-surface-700 p-4">
                    <div class="text-sm text-surface-500 mb-1">Items Terjual</div>
                    <div class="text-xl font-semibold">{{ kpis.soldItems }}</div>
                </div>
            </div>
            <div class="col-span-12 md:col-span-3">
                <div class="rounded-xl border border-surface-200 dark:border-surface-700 p-4">
                    <div class="text-sm text-surface-500 mb-1">Order Delivered</div>
                    <div class="text-xl font-semibold">{{ kpis.deliveredCount }}</div>
                </div>
            </div>
            <div class="col-span-12 md:col-span-3">
                <div class="rounded-xl border border-surface-200 dark:border-surface-700 p-4">
                    <div class="text-sm text-surface-500 mb-1">Avg Order Value</div>
                    <div class="text-xl font-semibold">{{ formatCurrency(kpis.avgOrderValue) }}</div>
                </div>
            </div>
        </div>

        <div class="grid grid-cols-12 gap-4">
            <div class="col-span-12 lg:col-span-8">
                <div class="rounded-xl border border-surface-200 dark:border-surface-700 p-4 h-[360px]">
                    <div class="font-semibold mb-2">Trend Omset Harian</div>
                    <Chart v-if="!isLoading" type="line" :data="trendChartData" :options="{ ...chartOptions, plugins: { legend: { position: 'top' } } }" />
                    <div v-else class="h-full flex items-center justify-center text-surface-500">Loading...</div>
                </div>
            </div>
            <div class="col-span-12 lg:col-span-4">
                <div class="rounded-xl border border-surface-200 dark:border-surface-700 p-4 h-[360px]">
                    <div class="font-semibold mb-2">Distribusi Status Order</div>
                    <Chart v-if="!isLoading" type="doughnut" :data="statusChartData" :options="chartOptions" />
                    <div v-else class="h-full flex items-center justify-center text-surface-500">Loading...</div>
                </div>
            </div>
        </div>

        <div class="rounded-xl border border-surface-200 dark:border-surface-700 p-4 mt-4">
            <div class="font-semibold mb-3">Top Driver by Revenue</div>
            <DataTable :value="topDrivers" class="p-datatable-sm" responsiveLayout="scroll">
                <template #empty>
                    <div class="py-4 text-center text-surface-500">Belum ada data delivered untuk periode ini.</div>
                </template>
                <Column header="#" style="width: 60px">
                    <template #body="{ index }">{{ index + 1 }}</template>
                </Column>
                <Column field="name" header="Driver" />
                <Column header="Revenue">
                    <template #body="{ data }">{{ formatCurrency(data.revenue) }}</template>
                </Column>
                <Column field="orders" header="Delivered Orders" />
            </DataTable>
        </div>
    </div>
</template>
