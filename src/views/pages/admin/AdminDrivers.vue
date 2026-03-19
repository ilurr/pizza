<script setup lang="ts">
import api from '@/services/api/index.js';
import { computed, onMounted, ref } from 'vue';

const isLoading = ref(false);
const search = ref('');
const availabilityFilter = ref<'all' | 'online' | 'offline'>('all');
const driverRows = ref<any[]>([]);

const availabilityOptions = [
    { label: 'Semua', value: 'all' },
    { label: 'Online', value: 'online' },
    { label: 'Offline', value: 'offline' }
];

const formatDateTime = (iso: string) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' });
};

const loadDrivers = async () => {
    isLoading.value = true;
    try {
        const res = await api.drivers.listDrivers?.();
        driverRows.value = res?.success && res?.data?.drivers ? res.data.drivers : [];
    } catch (e) {
        console.error('[AdminDrivers] Failed to load drivers:', e);
        driverRows.value = [];
    } finally {
        isLoading.value = false;
    }
};

const filteredDrivers = computed(() => {
    const q = search.value.trim().toLowerCase();
    return driverRows.value.filter((d: any) => {
        if (availabilityFilter.value === 'online' && !d.isOnline) return false;
        if (availabilityFilter.value === 'offline' && d.isOnline) return false;
        if (!q) return true;
        const name = String(d.name || '').toLowerCase();
        const email = String(d.email || '').toLowerCase();
        const phone = String(d.phone || '').toLowerCase();
        return name.includes(q) || email.includes(q) || phone.includes(q);
    });
});

const summary = computed(() => {
    const total = driverRows.value.length;
    const online = driverRows.value.filter((d: any) => d.isOnline).length;
    const available = driverRows.value.filter((d: any) => d.isAvailable !== false).length;
    const avgRating = total > 0 ? driverRows.value.reduce((sum: number, d: any) => sum + Number(d.rating || 0), 0) / total : 0;
    return { total, online, available, avgRating };
});

const statusSeverity = (d: any) => {
    if (!d.isOnline) return 'secondary';
    if (d.isAvailable === false) return 'warn';
    return 'success';
};

const statusLabel = (d: any) => {
    if (!d.isOnline) return 'Offline';
    if (d.isAvailable === false) return 'Busy';
    return 'Online';
};

onMounted(() => {
    loadDrivers();
});
</script>

<template>
    <div class="card">
        <div class="flex flex-col gap-2 mb-4">
            <div class="text-2xl font-semibold">Drivers</div>
            <div class="text-sm text-surface-500">Pantau driver, status online, rating, dan area coverage.</div>
        </div>

        <!-- Summary -->
        <div class="grid grid-cols-12 gap-4 mb-4">
            <div class="col-span-12 md:col-span-3">
                <div class="rounded-xl border border-surface-200 dark:border-surface-700 p-4">
                    <div class="text-sm text-surface-500 mb-1">Total Driver</div>
                    <div class="text-2xl font-semibold">{{ summary.total }}</div>
                </div>
            </div>
            <div class="col-span-12 md:col-span-3">
                <div class="rounded-xl border border-surface-200 dark:border-surface-700 p-4">
                    <div class="text-sm text-surface-500 mb-1">Online</div>
                    <div class="text-2xl font-semibold text-green-600">{{ summary.online }}</div>
                </div>
            </div>
            <div class="col-span-12 md:col-span-3">
                <div class="rounded-xl border border-surface-200 dark:border-surface-700 p-4">
                    <div class="text-sm text-surface-500 mb-1">Available</div>
                    <div class="text-2xl font-semibold text-blue-600">{{ summary.available }}</div>
                </div>
            </div>
            <div class="col-span-12 md:col-span-3">
                <div class="rounded-xl border border-surface-200 dark:border-surface-700 p-4">
                    <div class="text-sm text-surface-500 mb-1">Avg Rating</div>
                    <div class="text-2xl font-semibold">{{ summary.avgRating.toFixed(1) }}</div>
                </div>
            </div>
        </div>

        <!-- Filters -->
        <div class="grid grid-cols-12 gap-4 mb-4">
            <div class="col-span-12 md:col-span-4">
                <label class="block text-sm font-medium mb-2">Cari Driver</label>
                <InputText v-model="search" placeholder="Nama / email / phone" class="w-full" />
            </div>
            <div class="col-span-12 md:col-span-4">
                <label class="block text-sm font-medium mb-2">Status</label>
                <Dropdown v-model="availabilityFilter" :options="availabilityOptions" optionLabel="label" optionValue="value"
                    class="w-full" />
            </div>
            <div class="col-span-12 md:col-span-4 flex items-end justify-end">
                <Button label="Refresh" icon="pi pi-sync" :loading="isLoading" @click="loadDrivers" />
            </div>
        </div>

        <!-- Table -->
        <DataTable
            :value="filteredDrivers"
            :loading="isLoading"
            paginator
            :rows="10"
            :rowsPerPageOptions="[10, 25, 50]"
            class="p-datatable-sm"
            responsiveLayout="scroll"
        >
            <template #empty>
                <div class="py-6 text-center text-surface-500">Tidak ada driver untuk filter ini.</div>
            </template>

            <Column header="Driver" style="min-width: 260px">
                <template #body="{ data }">
                    <div class="flex flex-col">
                        <div class="font-semibold">{{ data.name || '—' }}</div>
                        <div class="text-xs text-surface-500">{{ data.email || '—' }}</div>
                    </div>
                </template>
            </Column>

            <Column header="Contact" style="min-width: 150px">
                <template #body="{ data }">
                    {{ data.phone || '—' }}
                </template>
            </Column>

            <Column header="Coverage" style="min-width: 140px">
                <template #body="{ data }">
                    {{ (data.kelurahanIds || []).length }} area
                </template>
            </Column>

            <Column header="Deliveries" style="min-width: 120px">
                <template #body="{ data }">
                    {{ data.totalDeliveries ?? 0 }}
                </template>
            </Column>

            <Column header="Rating" style="min-width: 120px">
                <template #body="{ data }">
                    ⭐ {{ Number(data.rating || 0).toFixed(1) }}
                </template>
            </Column>

            <Column header="Status" style="min-width: 120px">
                <template #body="{ data }">
                    <Tag :value="statusLabel(data)" :severity="statusSeverity(data)" />
                </template>
            </Column>

            <Column header="Updated" style="min-width: 160px">
                <template #body="{ data }">
                    {{ formatDateTime(data.updatedAt) }}
                </template>
            </Column>
        </DataTable>
    </div>
</template>
