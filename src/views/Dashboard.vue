<script setup lang="ts">
import api from '@/services/api/index.js';
import { computed, onMounted, ref, watch } from 'vue';

type Metric = 'sold' | 'revenue';
type RangePreset = '30d' | '7d' | 'today' | 'custom';

const metricOptions = [
    { label: 'Terjual', value: 'sold' as Metric },
    { label: 'Omset', value: 'revenue' as Metric }
];

const rangeOptions = [
    { label: '30 hari terakhir', value: '30d' as RangePreset },
    { label: '7 hari terakhir', value: '7d' as RangePreset },
    { label: 'Hari ini', value: 'today' as RangePreset },
    { label: 'Custom', value: 'custom' as RangePreset }
];

const selectedMetric = ref<Metric>('sold');
const selectedRange = ref<RangePreset>('30d');
const startDate = ref<Date | null>(null);
const endDate = ref<Date | null>(null);
const selectedDriverId = ref<string | null>(null);

const driverOptions = ref<{ label: string; value: string | null }[]>([
    { label: '-- Pilih Driver --', value: null }
]);

const isLoading = ref(false);
const orders = ref<any[]>([]);

const dateToIsoStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0).toISOString();
const dateToIsoEnd = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59).toISOString();

const normalizeToLocalDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

const dateKey = (d: Date) => {
    const dd = normalizeToLocalDay(d);
    return `${dd.getFullYear()}-${String(dd.getMonth() + 1).padStart(2, '0')}-${String(dd.getDate()).padStart(2, '0')}`;
};

/**
 * Pre-generate all date keys for the selected range (so the chart still shows 30 days even if there are no records).
 */
const rangeDateKeys = computed(() => {
    const today = normalizeToLocalDay(new Date());

    if (selectedRange.value === 'today') {
        return [dateKey(today)];
    }

    if (selectedRange.value === '7d') {
        const keys: string[] = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(today.getDate() - i);
            keys.push(dateKey(d));
        }
        return keys;
    }

    if (selectedRange.value === '30d') {
        const keys: string[] = [];
        for (let i = 29; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(today.getDate() - i);
            keys.push(dateKey(d));
        }
        return keys;
    }

    if (selectedRange.value === 'custom') {
        if (!startDate.value || !endDate.value) return [];
        const start = normalizeToLocalDay(startDate.value);
        const end = normalizeToLocalDay(endDate.value);
        if (start.getTime() > end.getTime()) return [];

        const keys: string[] = [];
        const d = new Date(start);
        while (d.getTime() <= end.getTime()) {
            keys.push(dateKey(d));
            d.setDate(d.getDate() + 1);
        }
        return keys;
    }

    return [];
});

const effectiveRange = computed(() => {
    const now = new Date();
    if (selectedRange.value === 'today') {
        return { from: dateToIsoStart(now), to: dateToIsoEnd(now) };
    }
    if (selectedRange.value === '7d') {
        const from = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
        return { from: dateToIsoStart(from), to: dateToIsoEnd(now) };
    }
    if (selectedRange.value === 'custom') {
        if (!startDate.value || !endDate.value) return { from: null, to: null };
        return { from: dateToIsoStart(startDate.value), to: dateToIsoEnd(endDate.value) };
    }
    // default 30d
    const from = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);
    return { from: dateToIsoStart(from), to: dateToIsoEnd(now) };
});

const formatCurrency = (amount: number) => {
    const formatted = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount || 0);
    return formatted.replace(/\s/g, '');
};

const loadDrivers = async () => {
    try {
        // Lightweight: reuse existing endpoint that returns drivers list (admin-friendly added later if needed)
        const res = await api.drivers.listDrivers?.();
        const list = res?.success && res?.data?.drivers ? res.data.drivers : [];
        const opts = list.map((d: any) => ({ label: d.name, value: String(d.id) }));
        driverOptions.value = [{ label: '-- Pilih Driver --', value: null }, ...opts];
    } catch (e) {
        console.warn('[Dashboard] Failed to load drivers list:', e);
        driverOptions.value = [{ label: '-- Pilih Driver --', value: null }];
    }
};

const loadOrders = async () => {
    const { from, to } = effectiveRange.value;
    if (selectedRange.value === 'custom' && (!from || !to)) return;

    isLoading.value = true;
    try {
        const res = await api.orders.getAllOrders({
            dateFrom: from,
            dateTo: to,
            driverId: selectedDriverId.value || undefined,
            limit: 2000
        });
        const list = res?.success && res?.data?.orders ? res.data.orders : [];
        // For sales/omset, typically only delivered orders are counted
        orders.value = list.filter((o: any) => o.status === 'delivered');
    } catch (e) {
        console.error('[Dashboard] Failed to load orders:', e);
        orders.value = [];
    } finally {
        isLoading.value = false;
    }
};

const dailySeries = computed(() => {
    const keys = rangeDateKeys.value;
    // Build bucket per date (YYYY-MM-DD), pre-filled with 0
    const buckets: Record<string, number> = {};
    for (const k of keys) buckets[k] = 0;
    for (const o of orders.value) {
        const d = new Date(o.orderDate || o.createdAt || Date.now());
        const key = dateKey(d);
        if (!(key in buckets)) continue;

        if (selectedMetric.value === 'revenue') {
            buckets[key] += Number(o.total || 0);
        } else {
            // sold = sum of quantities
            const soldQty = (o.items || []).reduce((sum: number, it: any) => sum + Number(it.quantity || 0), 0);
            buckets[key] += soldQty;
        }
    }

    return {
        labels: keys.map((k) => k.split('-').reverse().join('/')), // DD/MM/YYYY
        values: keys.map((k) => buckets[k] ?? 0)
    };
});

const lineChartData = computed(() => {
    const label = selectedMetric.value === 'revenue' ? 'Omset' : 'Terjual';
    return {
        labels: dailySeries.value.labels,
        datasets: [
            {
                label,
                data: dailySeries.value.values,
                borderColor: '#60A5FA',
                backgroundColor: 'rgba(96, 165, 250, 0.15)',
                tension: 0.35,
                fill: true,
                pointRadius: 2
            }
        ]
    };
});

const lineChartOptions = computed(() => {
    const isRevenue = selectedMetric.value === 'revenue';
    return {
        maintainAspectRatio: false,
        plugins: { legend: { display: true, position: 'top' } },
        scales: {
            y: {
                ticks: {
                    callback: (value: any) => (isRevenue ? formatCurrency(Number(value)) : String(value))
                }
            }
        }
    };
});

const todayStats = computed(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0).getTime();
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).getTime();
    const todays = orders.value.filter((o: any) => {
        const t = new Date(o.orderDate || o.createdAt || Date.now()).getTime();
        return t >= start && t <= end;
    });
    const revenue = todays.reduce((sum: number, o: any) => sum + Number(o.total || 0), 0);
    const sold = todays.reduce((sum: number, o: any) => sum + (o.items || []).reduce((s: number, it: any) => s + Number(it.quantity || 0), 0), 0);
    return { revenue, sold };
});

const todayDoughnutData = computed(() => ({
    labels: ['Terjual', 'Sisa'],
    datasets: [
        {
            data: [todayStats.value.sold, 0],
            backgroundColor: ['#F87171', '#D1D5DB']
        }
    ]
}));

const todayDoughnutOptions = computed(() => ({
    maintainAspectRatio: false,
    plugins: { legend: { position: 'right' } }
}));

watch([selectedMetric, selectedRange, startDate, endDate, selectedDriverId], () => {
    loadOrders();
});

onMounted(async () => {
    await loadDrivers();
    await loadOrders();
});
</script>

<template>
    <div class="card">
        <div class="flex flex-col gap-2 mb-4">
            <div class="text-2xl font-semibold">Riwayat Penjualan</div>
            <div class="text-sm text-surface-500">Pantau performa penjualan dan omset berdasarkan periode dan driver.</div>
        </div>

        <div class="grid grid-cols-12 gap-4 mb-4">
            <div class="col-span-12 md:col-span-3">
                <label class="block text-sm font-medium mb-2">Pilih Parameter</label>
                <Dropdown v-model="selectedMetric" :options="metricOptions" optionLabel="label" optionValue="value" class="w-full" />
            </div>
            <div class="col-span-12 md:col-span-3">
                <label class="block text-sm font-medium mb-2">Pilih Hari</label>
                <Dropdown v-model="selectedRange" :options="rangeOptions" optionLabel="label" optionValue="value" class="w-full" />
            </div>
            <div class="col-span-12 md:col-span-3">
                <label class="block text-sm font-medium mb-2">Tanggal Mulai</label>
                <Calendar v-model="startDate" dateFormat="dd/mm/yy" placeholder="dd/mm/yy"
                    :disabled="selectedRange !== 'custom'" class="w-full" />
            </div>
            <div class="col-span-12 md:col-span-3">
                <label class="block text-sm font-medium mb-2">Tanggal Akhir</label>
                <Calendar v-model="endDate" dateFormat="dd/mm/yy" placeholder="dd/mm/yy"
                    :disabled="selectedRange !== 'custom'" class="w-full" />
            </div>
            <div class="col-span-12 md:col-span-3">
                <label class="block text-sm font-medium mb-2">Driver</label>
                <Dropdown v-model="selectedDriverId" :options="driverOptions" optionLabel="label" optionValue="value" class="w-full" />
            </div>
        </div>

        <div class="mb-6">
            <div class="font-semibold mb-2">Diagram Riwayat Penjualan</div>
            <div class="h-[280px]">
                <Chart v-if="!isLoading" type="line" :data="lineChartData" :options="lineChartOptions" />
                <div v-else class="flex items-center justify-center h-full text-surface-500">Loading...</div>
            </div>
        </div>
    </div>

    <div class="grid grid-cols-12 gap-4">
        <div class="col-span-12 lg:col-span-7">
            <div class="card">
                <div class="font-semibold mb-2">Diagram Penjualan hari ini</div>
                <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                    <div class="h-[220px] md:w-[340px]">
                        <Chart
                            type="doughnut"
                            :data="todayDoughnutData"
                            :options="todayDoughnutOptions"
                        />
                    </div>
                    <div class="flex-1">
                        <div class="text-sm text-surface-500 mb-1">Total</div>
                        <div class="text-3xl font-bold mb-6">{{ todayStats.sold }}</div>

                        <div class="text-sm text-surface-500 mb-1">Total Pendapatan Hari Ini</div>
                        <div class="text-xl font-semibold mb-4">{{ formatCurrency(todayStats.revenue) }}</div>

                        <div class="text-sm text-surface-500 mb-1">Total Profit Hari Ini</div>
                        <div class="text-xl font-semibold">{{ formatCurrency(0) }}</div>
                    </div>
                </div>
            </div>
        </div>

        <div class="col-span-12 lg:col-span-5 flex flex-col gap-4">
            <div class="card">
                <div class="font-semibold mb-1">Progres Penjualan hari ini</div>
                <div class="text-sm text-surface-500">Akan diisi dari target harian (next).</div>
            </div>
            <div class="card">
                <div class="font-semibold mb-1">Sisa Stok Penjualan hari ini</div>
                <div class="text-sm text-surface-500">Akan diisi dari stok driver/base+topping (next).</div>
            </div>
        </div>
    </div>
</template>
