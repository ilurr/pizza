<script setup>
import api from '@/services/api/index.js';
import { useUserStore } from '@/stores/userStore';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, ref } from 'vue';

const userStore = useUserStore();
const toast = useToast();

const driverId = computed(() => userStore.user?.id || 'driver_001');
const stockItems = ref([]);
const isLoading = ref(false);
const restockDialog = ref(false);
const selectedRestockItem = ref(null);
const restockQuantity = ref(0);
const confirmListModal = ref(false);
const exchangeModal = ref(false);
const exchangeHistoryModal = ref(false);
const nearbyDrivers = ref([]);
const exchangeHistory = ref([]);
const exchangeProduct = ref(null);
const exchangeQuantity = ref(1);
const exchangeToDriver = ref(null);
const exchangeMessage = ref('');
const isSubmittingConfirmation = ref(false);
const isSubmittingExchange = ref(false);

const criticalStockItems = computed(() =>
    stockItems.value.filter((item) => item.currentStock <= item.criticalLevel)
);

const stockByType = computed(() => {
    const byType = { base: [], topping: [] };
    stockItems.value.forEach((item) => {
        const t = (item.type || item.category?.toLowerCase?.() || 'base') === 'topping' ? 'topping' : 'base';
        if (byType[t]) byType[t].push(item);
    });
    return byType;
});

const getStockPercentage = (item) =>
    item.maxCapacity ? Math.round((item.currentStock / item.maxCapacity) * 100) : 0;

const getStockSeverity = (item) => {
    const p = getStockPercentage(item);
    if (p <= 20) return 'danger';
    if (p <= 40) return 'warn';
    return 'success';
};

const openRestockDialog = (item) => {
    selectedRestockItem.value = item;
    restockQuantity.value = Math.max(1, item.maxCapacity - item.currentStock);
    restockDialog.value = true;
};

const confirmRestock = () => {
    if (!selectedRestockItem.value || restockQuantity.value <= 0) return;
    const item = selectedRestockItem.value;
    const newQty = Math.min(item.currentStock + restockQuantity.value, item.maxCapacity);
    updateStockQuantity(item, newQty);
    restockDialog.value = false;
    selectedRestockItem.value = null;
    restockQuantity.value = 0;
};

const updateStockQuantity = async (item, newQuantity) => {
    if (newQuantity == null || newQuantity < 0) return;
    try {
        const res = await api.drivers.updateStockQuantity(driverId.value, item.productId || item.id, newQuantity);
        if (res?.success) {
            item.currentStock = newQuantity;
            toast.add({ severity: 'success', summary: 'Stock updated', detail: `${item.name}: ${newQuantity} ${item.unit}`, life: 3000 });
        }
    } catch (e) {
        toast.add({ severity: 'error', summary: 'Error', detail: e?.message || 'Failed to update', life: 3000 });
    }
};

const loadStock = async () => {
    isLoading.value = true;
    try {
        const res = await api.drivers.getDriverStock(driverId.value);
        if (res?.success) stockItems.value = res.data.stock || [];
        else stockItems.value = [];
    } catch (e) {
        console.error('Failed to load stock:', e);
        stockItems.value = [];
    } finally {
        isLoading.value = false;
    }
};

const openConfirmListModal = () => {
    confirmListModal.value = true;
};

const submitConfirmation = async () => {
    isSubmittingConfirmation.value = true;
    try {
        const items = stockItems.value.map((i) => ({ productId: i.productId || i.id, productName: i.name, type: i.type, quantity: i.currentStock, unit: i.unit }));
        const res = await api.drivers.submitDriverDailyConfirmation(driverId.value, items);
        if (res?.success) {
            toast.add({ severity: 'success', summary: 'Confirmed', detail: 'Items list confirmed.', life: 3000 });
            confirmListModal.value = false;
        }
    } catch (e) {
        toast.add({ severity: 'error', summary: 'Error', detail: e?.message || 'Failed to save', life: 3000 });
    } finally {
        isSubmittingConfirmation.value = false;
    }
};

const openExchangeModal = async () => {
    exchangeModal.value = true;
    exchangeProduct.value = null;
    exchangeQuantity.value = 1;
    exchangeToDriver.value = null;
    exchangeMessage.value = '';
    try {
        const res = await api.drivers.getNearbyDrivers(driverId.value);
        if (res?.success && res.data?.nearbyDrivers) nearbyDrivers.value = res.data.nearbyDrivers;
        else nearbyDrivers.value = [];
    } catch {
        nearbyDrivers.value = [];
    }
};

const submitExchange = async () => {
    if (!exchangeProduct.value || !exchangeToDriver.value || exchangeQuantity.value <= 0) {
        toast.add({ severity: 'warn', summary: 'Invalid', detail: 'Select product, driver, and quantity.', life: 3000 });
        return;
    }
    if (exchangeQuantity.value > exchangeProduct.value.currentStock) {
        toast.add({ severity: 'warn', summary: 'Invalid', detail: 'Quantity exceeds your stock.', life: 3000 });
        return;
    }
    isSubmittingExchange.value = true;
    try {
        const res = await api.drivers.createDriverStockExchange(
            driverId.value,
            exchangeToDriver.value.id,
            exchangeProduct.value.name,
            exchangeProduct.value.type || 'topping',
            exchangeQuantity.value,
            exchangeProduct.value.unit,
            exchangeMessage.value || null
        );
        if (res?.success) {
            toast.add({ severity: 'success', summary: 'Exchange recorded', detail: `Sent ${exchangeQuantity.value} ${exchangeProduct.value.unit} ${exchangeProduct.value.name} to ${exchangeToDriver.value.name}`, life: 3000 });
            exchangeModal.value = false;
            loadStock();
        }
    } catch (e) {
        toast.add({ severity: 'error', summary: 'Error', detail: e?.message || 'Failed', life: 3000 });
    } finally {
        isSubmittingExchange.value = false;
    }
};

const openExchangeHistoryModal = async () => {
    exchangeHistoryModal.value = true;
    try {
        const res = await api.drivers.getDriverStockExchanges(driverId.value);
        exchangeHistory.value = (res?.success && res.data?.exchanges) ? res.data.exchanges : [];
    } catch {
        exchangeHistory.value = [];
    }
};

const formatExchangeMessage = (ex) => {
    const fromMe = ex.fromDriverId === driverId.value;
    const toMe = ex.toDriverId === driverId.value;
    const driverLabel = (id) => (id === driverId.value ? 'You' : `Driver ${id}`);
    if (fromMe && toMe) return `${ex.productName}: ${ex.quantity} ${ex.unit} (internal)`;
    if (fromMe) return `You sent ${ex.productName} to ${driverLabel(ex.toDriverId)}, ${ex.quantity} ${ex.unit}`;
    return `${driverLabel(ex.fromDriverId)} sent ${ex.productName} to you, ${ex.quantity} ${ex.unit}`;
};

const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' });
};

const stockStats = computed(() => [
    { title: 'Critical items', value: criticalStockItems.value.length, icon: 'pi pi-exclamation-triangle', color: 'orange', subtitle: 'Need restock' },
    { title: 'Total items', value: stockItems.value.length, icon: 'pi pi-list', color: 'purple', subtitle: 'In inventory' }
]);

onMounted(() => loadStock());
</script>

<template>
    <div class="p-4">
        <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div class="flex flex-row flex-wrap items-center w-full justify-between gap-3 mb-2">
                <p class="text-600 dark:text-400 text-sm mb-0">View and manage your stock inventory.</p>
                <Button label="Refresh" icon="pi pi-refresh" outlined size="small" :loading="isLoading"
                    @click="loadStock" />
            </div>
            <div
                class="flex flex-wrap items-center w-full gap-2 border-t border-surface-200 dark:border-surface-700 pt-4">
                <Button label="Confirm items" icon="pi pi-check" outlined size="small" @click="openConfirmListModal" />
                <Button label="Exchange" icon="pi pi-arrow-right-arrow-left" outlined size="small"
                    @click="openExchangeModal" />
                <Button label="History" icon="pi pi-history" outlined size="small" @click="openExchangeHistoryModal" />
            </div>
        </div>

        <!-- Stats (no Rp) -->
        <div class="grid grid-cols-2 gap-4 w-full mb-6">
            <div v-for="stat in stockStats" :key="stat.title"
                class="rounded-xl border-2 bg-white dark:bg-neutral-800 border-surface-200 dark:border-surface-700 overflow-hidden transition-shadow hover:shadow-sm">
                <div class="p-5 flex flex-col items-center text-center gap-3">
                    <span class="flex items-center justify-center w-14 h-14 rounded-2xl shrink-0" :class="{
                        'bg-orange-200/60 dark:bg-orange-700/40': stat.color === 'orange',
                        'bg-purple-200/60 dark:bg-purple-700/40': stat.color === 'purple'
                    }">
                        <i
                            :class="[stat.icon, 'text-2xl shrink-0', stat.color === 'orange' && 'text-orange-500', stat.color === 'purple' && 'text-purple-500']"></i>
                    </span>
                    <div class="min-w-0 w-full">
                        <div class="text-600 dark:text-400 text-sm mb-0.5">{{ stat.subtitle }}</div>
                        <div class="text-xl font-bold text-surface-900 dark:text-surface-0 truncate">{{ stat.value }}
                        </div>
                        <div class="text-surface-700 dark:text-surface-300 font-medium text-sm mt-1">{{ stat.title }}
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Critical alert -->
        <div v-if="criticalStockItems.length > 0"
            class="rounded-xl border-2 border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20 p-4 mb-6">
            <div class="flex items-start gap-3">
                <i class="pi pi-exclamation-triangle text-2xl text-orange-500 shrink-0 mt-0.5"></i>
                <div class="min-w-0 flex-1">
                    <div class="font-semibold text-orange-800 dark:text-orange-200 mb-1">Low stock</div>
                    <p class="text-sm text-orange-700 dark:text-orange-300 mb-0">
                        {{ criticalStockItems.length }} item(s): {{criticalStockItems.map((i) => i.name).join(', ')}}
                    </p>
                </div>
            </div>
        </div>

        <div v-if="isLoading" class="flex justify-center py-8">
            <ProgressSpinner style="width: 40px; height: 40px" />
        </div>
        <div v-else-if="stockItems.length === 0"
            class="rounded-xl border-2 border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800/50 p-8 text-center text-600">
            <i class="pi pi-inbox text-4xl mb-3 block"></i>
            <p class="text-lg mb-0">No stock items yet.</p>
        </div>

        <template v-else>
            <div v-for="(items, type) in stockByType" :key="type" class="mb-6">
                <h3 class="text-lg font-semibold text-surface-900 dark:text-surface-0 mb-3">{{ type }}</h3>
                <div
                    class="rounded-xl border-2 border-surface-200 dark:border-surface-700 bg-white dark:bg-neutral-800 overflow-hidden">
                    <DataTable :value="items" responsiveLayout="scroll" class="p-datatable-sm" :paginator="false">
                        <Column field="name" header="Item" style="min-width: 11rem">
                            <template #body="{ data }">
                                <div class="flex align-items-center gap-2">
                                    <span class="font-medium text-surface-900 dark:text-surface-0">{{ data.name
                                        }}</span>
                                    <Tag v-if="data.currentStock <= data.criticalLevel" value="Low" severity="danger"
                                        size="small" />
                                </div>
                            </template>
                        </Column>
                        <Column header="Current" style="min-width: 8rem">
                            <template #body="{ data }">
                                <div class="flex align-items-center gap-2">
                                    <InputNumber :model-value="data.currentStock" :min="0" :max="data.maxCapacity"
                                        size="small" @update:model-value="(v) => updateStockQuantity(data, v ?? 0)" />
                                    <span class="text-sm text-600">{{ data.unit }}</span>
                                </div>
                            </template>
                        </Column>
                        <Column header="Capacity" style="min-width: 8rem">
                            <template #body="{ data }">
                                <div class="text-sm font-medium inline-block">{{ data.currentStock }} / {{
                                    data.maxCapacity }}</div>
                                <ProgressBar :value="getStockPercentage(data)" :severity="getStockSeverity(data)"
                                    class="mt-1" />
                            </template>
                        </Column>
                        <Column header="" style="min-width: 5rem">
                            <template #body="{ data }">
                                <Button icon="pi pi-plus" severity="success" outlined size="small"
                                    v-tooltip.top="'Restock'" @click="openRestockDialog(data)" />
                            </template>
                        </Column>
                    </DataTable>
                </div>
            </div>
        </template>
    </div>

    <!-- Restock dialog (no Rp) -->
    <Dialog v-model:visible="restockDialog" header="Restock" modal :style="{ width: '380px' }">
        <div v-if="selectedRestockItem" class="flex flex-col gap-4">
            <div>
                <div class="text-lg font-semibold text-surface-900 dark:text-surface-0">{{ selectedRestockItem.name }}
                </div>
                <small class="text-600 dark:text-400">Current: {{ selectedRestockItem.currentStock }} {{
                    selectedRestockItem.unit }}</small>
            </div>
            <div>
                <label class="block text-surface-700 dark:text-surface-300 font-medium mb-2">Quantity</label>
                <InputNumber v-model="restockQuantity" :min="1"
                    :max="selectedRestockItem.maxCapacity - selectedRestockItem.currentStock" fluid />
                <small class="text-600 dark:text-400">Max: {{ selectedRestockItem.maxCapacity }} {{
                    selectedRestockItem.unit
                    }}</small>
            </div>
        </div>
        <template #footer>
            <Button label="Cancel" outlined @click="restockDialog = false" />
            <Button label="Confirm" @click="confirmRestock" />
        </template>
    </Dialog>

    <!-- Morning confirmation modal -->
    <Dialog v-model:visible="confirmListModal" header="Confirm items you have" modal :style="{ width: '420px' }">
        <p class="text-600 dark:text-400 text-sm mb-3">Check your actual items against the list, then confirm.</p>
        <ul class="list-none p-0 m-0 space-y-2 max-h-64 overflow-y-auto">
            <li v-for="item in stockItems" :key="item.productId || item.id"
                class="flex justify-between py-2 border-b border-surface-200 dark:border-surface-700">
                <span class="font-medium">{{ item.name }}</span>
                <span>{{ item.currentStock }} {{ item.unit }}</span>
            </li>
        </ul>
        <template #footer>
            <Button label="Cancel" outlined @click="confirmListModal = false" />
            <Button label="I confirm" :loading="isSubmittingConfirmation" @click="submitConfirmation" />
        </template>
    </Dialog>

    <!-- Exchange modal -->
    <Dialog v-model:visible="exchangeModal" header="Exchange with driver" modal :style="{ width: '420px' }">
        <div class="flex flex-col gap-4">
            <div>
                <label class="block text-surface-700 dark:text-surface-300 font-medium mb-2">Send to driver</label>
                <select v-model="exchangeToDriver"
                    class="w-full p-2 border border-surface-300 dark:border-surface-600 rounded bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-0">
                    <option :value="null">Select driver</option>
                    <option v-for="d in nearbyDrivers.filter((x) => x.id !== driverId)" :key="d.id" :value="d">{{ d.name
                        ||
                        d.id }}</option>
                </select>
            </div>
            <div>
                <label class="block text-surface-700 dark:text-surface-300 font-medium mb-2">Product</label>
                <select v-model="exchangeProduct"
                    class="w-full p-2 border border-surface-300 dark:border-surface-600 rounded bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-0">
                    <option :value="null">Select product</option>
                    <option v-for="i in stockItems.filter((x) => x.currentStock > 0)" :key="i.productId || i.id"
                        :value="i">
                        {{ i.name }} ({{ i.currentStock }} {{ i.unit }})</option>
                </select>
            </div>
            <div v-if="exchangeProduct">
                <label class="block text-surface-700 dark:text-surface-300 font-medium mb-2">Quantity</label>
                <InputNumber v-model="exchangeQuantity" :min="1" :max="exchangeProduct.currentStock" fluid />
            </div>
            <div>
                <label class="block text-surface-700 dark:text-surface-300 font-medium mb-2">Message (optional)</label>
                <input v-model="exchangeMessage" type="text" placeholder="e.g. Thanks for the swap"
                    class="w-full p-2 border border-surface-300 dark:border-surface-600 rounded bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-0" />
            </div>
        </div>
        <template #footer>
            <Button label="Cancel" outlined @click="exchangeModal = false" />
            <Button label="Send" :loading="isSubmittingExchange" @click="submitExchange" />
        </template>
    </Dialog>

    <!-- Exchange history modal -->
    <Dialog v-model:visible="exchangeHistoryModal" header="Exchange history" modal :style="{ width: '480px' }">
        <ul class="list-none p-0 m-0 space-y-3 max-h-80 overflow-y-auto">
            <li v-for="ex in exchangeHistory" :key="ex.id"
                class="py-2 border-b border-surface-200 dark:border-surface-700">
                <div class="text-sm text-600 dark:text-400">{{ formatDate(ex.createdAt) }}</div>
                <div class="font-medium">{{ formatExchangeMessage(ex) }}</div>
                <div v-if="ex.message" class="text-sm text-surface-500">{{ ex.message }}</div>
            </li>
            <li v-if="exchangeHistory.length === 0" class="text-600 dark:text-400 py-4 text-center">No exchanges yet.
            </li>
        </ul>
    </Dialog>
</template>
