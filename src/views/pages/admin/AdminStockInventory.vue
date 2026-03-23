<script setup lang="ts">
import { ADMIN_PANEL_ROLES } from '@/constants/roles.js';
import api from '@/services/api/index.js';
import { useUserStore } from '@/stores/userStore';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, ref, watch } from 'vue';

const userStore = useUserStore();
const toast = useToast();

const canView = computed(() => ADMIN_PANEL_ROLES.includes(userStore.role as (typeof ADMIN_PANEL_ROLES)[number]));

const isLoading = ref(false);
const isLoadingDrivers = ref(false);
const stockRows = ref<any[]>([]);
const metrics = ref({ totalRows: 0, criticalRows: 0, driverCount: 0 });

// Lock after driver confirms opening stock for the day (MVP: once opening confirmed, admin can't edit/restock)
const lockedDriverById = ref<Record<string, boolean>>({});

function localDayKey() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toLocaleDateString('en-CA');
}

const isLockedDriver = (driverId: any) => {
    const id = driverId == null ? '' : String(driverId);
    return !!lockedDriverById.value[id];
};

const driverOptions = ref<{ label: string; value: string | null }[]>([{ label: 'All drivers', value: null }]);
const selectedDriverId = ref<string | null>(null);

const typeOptions = [
    { label: 'All types', value: null as string | null },
    { label: 'Base', value: 'base' },
    { label: 'Topping', value: 'topping' }
];
const selectedType = ref<string | null>(null);
const criticalOnly = ref(false);

const restockDialog = ref(false);
const selectedRestockItem = ref<any | null>(null);
const restockQuantity = ref(0);

const exchangeHistoryModal = ref(false);
const exchangeHistory = ref<any[]>([]);
const isLoadingExchanges = ref(false);

// Admin exchange (between drivers)
const exchangeModal = ref(false);
const exchangeFromDriver = ref<string | null>(null);
const exchangeToDriver = ref<string | null>(null);
const exchangeFromProducts = ref<any[]>([]);
const exchangeProduct = ref<any | null>(null);
const exchangeQuantity = ref<number>(1);
const exchangeMessage = ref<string>('');
const isSubmittingExchange = ref(false);
const isInitializingStock = ref(false);

const getStockPercentage = (item: any) =>
    item.maxCapacity ? Math.round((item.currentStock / item.maxCapacity) * 100) : 0;

const getStockSeverity = (item: any) => {
    const p = getStockPercentage(item);
    if (p <= 20) return 'danger';
    if (p <= 40) return 'warn';
    return 'success';
};

const loadDrivers = async () => {
    isLoadingDrivers.value = true;
    try {
        const res = await api.drivers.listDrivers?.();
        const list = res?.success && res?.data?.drivers ? res.data.drivers : [];
        const opts = list.map((d: any) => ({
            label: d.name || d.username || String(d.id),
            value: String(d.id)
        }));
        driverOptions.value = [{ label: 'All drivers', value: null }, ...opts];
    } catch (e) {
        console.warn('[AdminStockInventory] Failed to load drivers:', e);
        driverOptions.value = [{ label: 'All drivers', value: null }];
    } finally {
        isLoadingDrivers.value = false;
    }
};

const loadStock = async () => {
    if (!canView.value) return;
    isLoading.value = true;
    try {
        const res = await api.drivers.getAllDriversStock({
            driverId: selectedDriverId.value || undefined,
            type: (selectedType.value as 'base' | 'topping' | undefined) || undefined,
            critical: criticalOnly.value || undefined
        });
        if (res?.success && res.data) {
            stockRows.value = res.data.rows || [];
            metrics.value = res.data.metrics || { totalRows: 0, criticalRows: 0, driverCount: 0 };
        } else {
            stockRows.value = [];
            metrics.value = { totalRows: 0, criticalRows: 0, driverCount: 0 };
        }
    } catch (e) {
        console.error('[AdminStockInventory] Failed to load stock:', e);
        stockRows.value = [];
    } finally {
        isLoading.value = false;
    }
};

watch([selectedDriverId, selectedType, criticalOnly], () => loadStock());

const hydrateLocksForLoadedRows = async () => {
    try {
        const dateKey = localDayKey();
        const driverIds = [...new Set((stockRows.value || []).map((r) => String(r.driverId)))].filter(Boolean);
        if (!driverIds.length) {
            lockedDriverById.value = {};
            return;
        }

        const map: Record<string, boolean> = {};
        await Promise.all(
            driverIds.map(async (did) => {
                try {
                    const res = await api.drivers.getDriverDailyConfirmationStatus(did, { stockDate: dateKey });
                    map[did] = !!(res?.success && res?.data?.confirmed);
                } catch {
                    map[did] = false;
                }
            })
        );
        lockedDriverById.value = map;
    } catch {
        lockedDriverById.value = {};
    }
};

watch(stockRows, () => {
    if (stockRows.value?.length) hydrateLocksForLoadedRows();
});

const initializeMissingIngredients = async () => {
    if (!selectedDriverId.value) {
        toast.add({
            severity: 'warn',
            summary: 'Select a driver',
            detail: 'Choose a driver before initializing stock rows.',
            life: 3500
        });
        return;
    }
    if (isLockedDriver(selectedDriverId.value)) {
        toast.add({
            severity: 'warn',
            summary: 'Locked',
            detail: 'Opening stock is already confirmed; initialization is not allowed.',
            life: 3500
        });
        return;
    }

    isInitializingStock.value = true;
    try {
        await api.drivers.initializeDriverStock(selectedDriverId.value, {
            type: (selectedType.value as 'base' | 'topping' | null) || undefined,
            initialQuantity: 0
        });
        await loadStock();
        toast.add({
            severity: 'success',
            summary: 'Initialized',
            detail: 'Missing ingredient rows were created (quantity 0).',
            life: 3000
        });
    } catch (e: any) {
        console.error('[AdminStockInventory] initializeDriverStock failed:', e);
        toast.add({
            severity: 'error',
            summary: 'Failed',
            detail: e?.message || 'Initialization failed',
            life: 4000
        });
    } finally {
        isInitializingStock.value = false;
    }
};

const stockStats = computed(() => [
    {
        title: 'Drivers (filtered)',
        value: metrics.value.driverCount,
        icon: 'pi pi-users',
        color: 'blue',
        subtitle: 'With stock rows'
    },
    {
        title: 'Stock rows',
        value: metrics.value.totalRows,
        icon: 'pi pi-list',
        color: 'purple',
        subtitle: 'Total items per driver'
    },
    {
        title: 'Critical',
        value: metrics.value.criticalRows,
        icon: 'pi pi-exclamation-triangle',
        color: 'orange',
        subtitle: 'Below threshold'
    }
]);

const updateStockQuantity = async (row: any, newQuantity: number) => {
    if (newQuantity == null || newQuantity < 0) return;
    const prev = Number(row?.currentStock ?? 0);
    const next = Number(newQuantity);
    // InputNumber often re-emits on blur even when the user didn't change the value — skip redundant API calls
    if (next === prev) return;
    if (isLockedDriver(row?.driverId)) {
        toast.add({
            severity: 'warn',
            summary: 'Locked',
            detail: `${row.driverName}: opening stock is confirmed; quantity cannot be edited.`,
            life: 3500
        });
        return;
    }
    try {
        const res = await api.drivers.updateStockQuantity(row.driverId, row.productId, newQuantity);
        if (res?.success) {
            row.currentStock = newQuantity;
            row.isLow = newQuantity <= row.criticalLevel;
            toast.add({
                severity: 'success',
                summary: 'Stock updated',
                detail: `${row.driverName} · ${row.name}: ${newQuantity} ${row.unit}`,
                life: 3000
            });
            await loadStock();
        }
    } catch (e: any) {
        toast.add({
            severity: 'error',
            summary: 'Failed',
            detail: e?.message || 'Update failed',
            life: 3500
        });
    }
};

const openRestockDialog = (row: any) => {
    if (isLockedDriver(row?.driverId)) {
        toast.add({
            severity: 'warn',
            summary: 'Locked',
            detail: `${row.driverName}: opening stock is already confirmed.`,
            life: 3500
        });
        return;
    }
    selectedRestockItem.value = row;
    restockQuantity.value = Math.max(1, row.maxCapacity - row.currentStock);
    restockDialog.value = true;
};

const confirmRestock = () => {
    const row = selectedRestockItem.value;
    if (!row || restockQuantity.value <= 0) return;
    const newQty = Math.min(row.currentStock + restockQuantity.value, row.maxCapacity);
    updateStockQuantity(row, newQty);
    restockDialog.value = false;
    selectedRestockItem.value = null;
    restockQuantity.value = 0;
};

const openExchangeHistoryModal = async () => {
    exchangeHistoryModal.value = true;
    isLoadingExchanges.value = true;
    exchangeHistory.value = [];
    try {
        const res = await api.drivers.getAllStockExchanges(300);
        exchangeHistory.value = res?.success && res.data?.exchanges ? res.data.exchanges : [];
    } catch {
        exchangeHistory.value = [];
    } finally {
        isLoadingExchanges.value = false;
    }
};

const loadExchangeProductsFromDriver = async () => {
    exchangeFromProducts.value = [];
    exchangeProduct.value = null;
    exchangeQuantity.value = 1;
    if (!exchangeFromDriver.value) return;

    try {
        const res = await api.drivers.getDriverStock(exchangeFromDriver.value);
        const list = res?.success && res?.data?.stock ? res.data.stock : [];
        exchangeFromProducts.value = list.filter((i: any) => Number(i.currentStock ?? 0) > 0);
    } catch (e) {
        console.warn('[AdminStockInventory] Failed to load exchange products:', e);
        exchangeFromProducts.value = [];
    }
};

const openExchangeModal = async () => {
    exchangeModal.value = true;
    exchangeMessage.value = '';
    exchangeFromDriver.value = selectedDriverId.value;
    exchangeToDriver.value = null;
    await loadExchangeProductsFromDriver();
};

watch(exchangeFromDriver, async () => {
    if (exchangeModal.value) {
        await loadExchangeProductsFromDriver();
    }
});

const submitExchange = async () => {
    if (!exchangeFromDriver.value || !exchangeToDriver.value || !exchangeProduct.value || exchangeQuantity.value <= 0) {
        toast.add({
            severity: 'warn',
            summary: 'Invalid',
            detail: 'Select source driver, destination driver, product, and quantity.',
            life: 3000
        });
        return;
    }
    if (String(exchangeFromDriver.value) === String(exchangeToDriver.value)) {
        toast.add({
            severity: 'warn',
            summary: 'Invalid',
            detail: 'Source and destination driver must be different.',
            life: 3000
        });
        return;
    }
    if (exchangeQuantity.value > Number(exchangeProduct.value.currentStock ?? 0)) {
        toast.add({
            severity: 'warn',
            summary: 'Invalid',
            detail: "Quantity exceeds the source driver's available stock.",
            life: 3000
        });
        return;
    }

    isSubmittingExchange.value = true;
    try {
        const res = await api.drivers.createDriverStockExchange(
            exchangeFromDriver.value,
            exchangeToDriver.value,
            exchangeProduct.value.name,
            exchangeProduct.value.type || 'base',
            exchangeQuantity.value,
            exchangeProduct.value.unit,
            exchangeMessage.value || null
        );
        if (res?.success) {
            toast.add({
                severity: 'success',
                summary: 'Exchange recorded',
                detail: `Moved ${exchangeQuantity.value} ${exchangeProduct.value.unit} of ${exchangeProduct.value.name}.`,
                life: 3000
            });
            exchangeModal.value = false;
            await loadStock();
        } else {
            toast.add({
                severity: 'error',
                summary: 'Failed',
                detail: res?.error?.message || 'Exchange failed',
                life: 3500
            });
        }
    } catch (e: any) {
        toast.add({
            severity: 'error',
            summary: 'Error',
            detail: e?.message || 'Exchange failed',
            life: 3500
        });
    } finally {
        isSubmittingExchange.value = false;
    }
};

const formatDate = (dateStr: string) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' });
};

onMounted(async () => {
    await loadDrivers();
    await loadStock();
});
</script>

<template>
    <div v-if="!canView" class="card">
        <div class="text-surface-500">You do not have access to this page.</div>
    </div>

    <div v-else class="card">
        <div class="flex flex-col gap-2 mb-4">
            <div class="text-2xl font-semibold">Stock Inventory</div>
            <div class="text-sm text-surface-500">
                Admins set and restock inventory (evening or early morning) to match physical counts. Drivers complete
                <strong>opening stock check-in</strong> in the app; after that they only change stock via
                <strong>exchange</strong> between drivers.
            </div>
        </div>

        <div class="grid grid-cols-12 gap-4 mb-4">
            <div class="col-span-12 md:col-span-3">
                <label class="block text-sm font-medium mb-2">Driver</label>
                <Select v-model="selectedDriverId" :options="driverOptions" optionLabel="label" optionValue="value"
                    placeholder="Select driver" class="w-full" :loading="isLoadingDrivers" />
            </div>
            <div class="col-span-12 md:col-span-3">
                <label class="block text-sm font-medium mb-2">Type</label>
                <Select v-model="selectedType" :options="typeOptions" optionLabel="label" optionValue="value"
                    class="w-full" />
            </div>
            <div class="col-span-12 md:col-span-3 flex items-end">
                <div class="flex items-center gap-2 pb-2">
                    <Checkbox v-model="criticalOnly" inputId="crit-only" binary />
                    <label for="crit-only" class="text-sm">Critical stock only</label>
                </div>
            </div>
            <div class="col-span-12 md:col-span-3 flex items-end gap-2">
            </div>
            <div class="col-span-12 md:col-span-8 flex gap-2">
                <Button label="Exchange history" icon="pi pi-history" outlined @click="openExchangeHistoryModal" />
                <Button label="Exchange" icon="pi pi-arrow-right-arrow-left" outlined @click="openExchangeModal" />
                <Button label="Initialize missing ingredients" icon="pi pi-plus-circle" outlined
                    :loading="isInitializingStock" :disabled="isLockedDriver(selectedDriverId) || !selectedDriverId"
                    @click="initializeMissingIngredients" />
            </div>
            <div class="col-span-12 md:col-span-4 flex items-end justify-end gap-2">
                <Button label="Refresh" icon="pi pi-sync" outlined :loading="isLoading" @click="loadStock" />
            </div>
        </div>

        <div class="grid grid-cols-12 gap-4 mb-6">
            <div v-for="stat in stockStats" :key="stat.title" class="col-span-12 md:col-span-4">
                <div class="rounded-xl border border-surface-200 dark:border-surface-700 p-4 h-full">
                    <div class="flex items-center gap-3">
                        <span class="flex items-center justify-center w-12 h-12 rounded-xl" :class="{
                            'bg-blue-100 dark:bg-blue-900/30 text-blue-600': stat.color === 'blue',
                            'bg-purple-100 dark:bg-purple-900/30 text-purple-600': stat.color === 'purple',
                            'bg-orange-100 dark:bg-orange-900/30 text-orange-600': stat.color === 'orange'
                        }">
                            <i :class="stat.icon" class="!text-xl" />
                        </span>
                        <div class="min-w-0">
                            <div class="text-sm text-surface-500">{{ stat.subtitle }}</div>
                            <div class="text-2xl font-semibold">{{ stat.value }}</div>
                            <div class="text-sm font-medium text-surface-700 dark:text-surface-300">{{ stat.title }}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <DataTable :value="stockRows" :loading="isLoading" paginator :rows="15" :rowsPerPageOptions="[15, 30, 50]"
            class="p-datatable-sm" responsiveLayout="scroll" sortMode="multiple">
            <template #empty>
                <div class="py-6 text-center text-surface-500">No stock data for the current filters.</div>
            </template>

            <Column header="#" style="width: 56px">
                <template #body="{ index }">
                    {{ index + 1 }}
                </template>
            </Column>

            <Column field="driverName" header="Driver" sortable style="min-width: 160px" />

            <Column field="name" header="Item" sortable style="min-width: 160px">
                <template #body="{ data }">
                    <div class="flex items-center gap-2">
                        <span class="font-medium">{{ data.name }}</span>
                        <Tag v-if="data.isLow" value="Low" severity="danger" size="small" />
                    </div>
                </template>
            </Column>

            <Column field="type" header="Type" sortable style="min-width: 100px">
                <template #body="{ data }">
                    <Tag :value="data.type" :severity="data.type === 'topping' ? 'info' : 'secondary'" />
                </template>
            </Column>

            <Column header="Quantity" style="min-width: 140px">
                <template #body="{ data }">
                    <div class="flex items-center gap-2">
                        <InputNumber :model-value="data.currentStock" :min="0" :max="data.maxCapacity"
                            :disabled="isLockedDriver(data.driverId)" size="small"
                            @update:model-value="(v) => updateStockQuantity(data, v ?? 0)" />
                        <span class="text-sm text-surface-500">{{ data.unit }}</span>
                    </div>
                </template>
            </Column>

            <Column header="Capacity" style="min-width: 160px">
                <template #body="{ data }">
                    <div class="text-sm font-medium">{{ data.currentStock }} / {{ data.maxCapacity }}</div>
                    <ProgressBar :value="getStockPercentage(data)" class="mt-1" :severity="getStockSeverity(data)" />
                </template>
            </Column>

            <Column header="Actions" style="width: 88px">
                <template #body="{ data }">
                    <div class="flex items-center gap-1 justify-end">
                        <Button v-if="!isLockedDriver(data.driverId)" icon="pi pi-plus" severity="success" outlined
                            size="small" v-tooltip.top="'Restock'" @click="openRestockDialog(data)" />
                        <span v-else v-tooltip.top="'Opening stock confirmed — restock disabled'" class="inline-flex">
                            <Button icon="pi pi-lock" severity="secondary" outlined size="small" disabled />
                        </span>
                    </div>
                </template>
            </Column>
        </DataTable>

        <Dialog v-model:visible="restockDialog" header="Restock" modal class="w-full max-w-md">
            <div v-if="selectedRestockItem" class="flex flex-col gap-4">
                <div>
                    <div class="text-sm text-surface-500">{{ selectedRestockItem.driverName }}</div>
                    <div class="text-lg font-semibold">{{ selectedRestockItem.name }}</div>
                    <small class="text-surface-500">Current: {{ selectedRestockItem.currentStock }} {{
                        selectedRestockItem.unit
                    }}</small>
                </div>
                <div>
                    <label class="block font-medium mb-2">Add quantity</label>
                    <InputNumber v-model="restockQuantity" :min="1"
                        :max="selectedRestockItem.maxCapacity - selectedRestockItem.currentStock" class="w-full" />
                    <small class="text-surface-500">Max: {{ selectedRestockItem.maxCapacity }} {{
                        selectedRestockItem.unit
                    }}</small>
                </div>
            </div>
            <template #footer>
                <Button label="Cancel" outlined @click="restockDialog = false" />
                <Button label="Confirm" @click="confirmRestock" />
            </template>
        </Dialog>

        <Dialog v-model:visible="exchangeModal" header="Exchange stock between drivers" modal class="w-full max-w-md">
            <div class="flex flex-col gap-4">
                <div>
                    <label class="block text-sm font-medium mb-2">From driver</label>
                    <select v-model="exchangeFromDriver"
                        class="w-full p-2 border border-surface-300 dark:border-surface-600 rounded bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-0">
                        <option :value="null">Select driver</option>
                        <option v-for="d in driverOptions.filter((x) => x.value != null)" :key="d.value"
                            :value="d.value">
                            {{ d.label }}
                        </option>
                    </select>
                </div>

                <div>
                    <label class="block text-sm font-medium mb-2">To driver</label>
                    <select v-model="exchangeToDriver"
                        class="w-full p-2 border border-surface-300 dark:border-surface-600 rounded bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-0">
                        <option :value="null">Select driver</option>
                        <option
                            v-for="d in driverOptions.filter((x) => x.value != null && String(x.value) !== String(exchangeFromDriver))"
                            :key="d.value" :value="d.value">
                            {{ d.label }}
                        </option>
                    </select>
                </div>

                <div>
                    <label class="block text-sm font-medium mb-2">Product</label>
                    <select v-model="exchangeProduct"
                        class="w-full p-2 border border-surface-300 dark:border-surface-600 rounded bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-0"
                        :disabled="!exchangeFromDriver">
                        <option :value="null">Select product</option>
                        <option v-for="p in exchangeFromProducts" :key="p.productId || p.id" :value="p">
                            {{ p.name }} ({{ p.currentStock }} {{ p.unit }})
                        </option>
                    </select>
                </div>

                <div v-if="exchangeProduct">
                    <label class="block text-sm font-medium mb-2">Quantity</label>
                    <InputNumber v-model="exchangeQuantity" :min="1" :max="exchangeProduct.currentStock" fluid />
                </div>

                <div>
                    <label class="block text-sm font-medium mb-2">Message (optional)</label>
                    <input v-model="exchangeMessage" type="text" placeholder="e.g. Thanks for the swap"
                        class="w-full p-2 border border-surface-300 dark:border-surface-600 rounded bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-0" />
                </div>
            </div>

            <template #footer>
                <Button label="Cancel" outlined @click="exchangeModal = false" />
                <Button label="Send" :loading="isSubmittingExchange" @click="submitExchange" />
            </template>
        </Dialog>

        <Dialog v-model:visible="exchangeHistoryModal" header="Exchange history (all drivers)" modal
            class="w-full max-w-lg">
            <div v-if="isLoadingExchanges" class="py-8 flex justify-center">
                <ProgressSpinner style="width: 40px; height: 40px" />
            </div>
            <ul v-else class="list-none p-0 m-0 space-y-3 max-h-96 overflow-y-auto">
                <li v-for="ex in exchangeHistory" :key="ex.id"
                    class="py-2 border-b border-surface-200 dark:border-surface-700">
                    <div class="text-xs text-surface-500">{{ formatDate(ex.createdAt) }}</div>
                    <div class="font-medium">
                        {{ ex.fromDriverId }} → {{ ex.toDriverId }} · {{ ex.productName }} ({{ ex.quantity }} {{ ex.unit
                        }})
                    </div>
                    <div v-if="ex.message" class="text-sm text-surface-500">{{ ex.message }}</div>
                </li>
                <li v-if="exchangeHistory.length === 0" class="text-center text-surface-500 py-4">No exchanges yet.</li>
            </ul>
        </Dialog>
    </div>
</template>
