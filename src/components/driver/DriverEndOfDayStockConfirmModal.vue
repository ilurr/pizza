<script setup lang="ts">
import api from '@/services/api/index.js';
import { useDriverStore } from '@/stores/driverStore.js';
import { useToast } from 'primevue/usetoast';
import { computed, ref, watch } from 'vue';

const driverStore = useDriverStore();

const props = defineProps({
    modelValue: {
        type: Boolean,
        default: false
    },
    driverId: {
        type: [String, Number],
        default: null
    }
});

const emit = defineEmits(['update:modelValue', 'confirmed']);

const toast = useToast();

const isLoading = ref(false);
const isLoadingSales = ref(false);
const isSubmitting = ref(false);
const draftItems = ref<any[]>([]);
/** Delivered orders for this calendar day (reconcile with physical stock + cash). */
const daySalesReport = ref<{ totalSoldItems: number; totalEarnings: number } | null>(null);
const daySalesChannels = ref({ online: 0, offlineCash: 0, offlineQris: 0 });
const daySalesLines = ref<any[]>([]);

const visible = computed({
    get: () => props.modelValue,
    set: (v: boolean) => emit('update:modelValue', v)
});

function localDayKey() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toLocaleDateString('en-CA');
}

/** Match DriverMorningStockCheckinModal: Indonesian locale for on-screen dates */
function todayDisplay() {
    const now = new Date();
    return now.toLocaleDateString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
}

function todayShort() {
    const now = new Date();
    return now.toLocaleDateString('id-ID', { dateStyle: 'medium' });
}

const formatCurrency = (amount: number) => {
    if (amount == null || Number.isNaN(Number(amount))) return '—';
    const formatted = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(Number(amount));
    return formatted.replace(/\s/g, '');
};

const loadDaySalesSummary = async () => {
    if (!props.driverId) return;
    isLoadingSales.value = true;
    daySalesReport.value = null;
    daySalesChannels.value = { online: 0, offlineCash: 0, offlineQris: 0 };
    daySalesLines.value = [];
    try {
        const dateKey = localDayKey();
        const res = await api.drivers.getDriverDaySalesSummary(props.driverId, dateKey);
        if (res?.success && res.data) {
            daySalesReport.value = res.data.report || { totalSoldItems: 0, totalEarnings: 0 };
            daySalesChannels.value = res.data.channels || { online: 0, offlineCash: 0, offlineQris: 0 };
            daySalesLines.value = res.data.lines || [];
        }
    } catch (e: any) {
        console.error('[EndOfDayStockConfirm] sales summary failed:', e);
    } finally {
        isLoadingSales.value = false;
    }
};

const loadDraftFromCurrentStock = async () => {
    if (!props.driverId) return;
    isLoading.value = true;
    draftItems.value = [];
    try {
        const res = await api.drivers.getDriverStock(props.driverId);
        const stock = res?.success && res.data?.stock ? res.data.stock : [];
        draftItems.value = stock.map((i: any) => ({
            productId: i.productId || i.id,
            name: i.name,
            type: i.type,
            unit: i.unit,
            currentStock: Number(i.currentStock ?? 0),
            maxCapacity: i.maxCapacity ?? 100,
            criticalLevel: i.criticalLevel ?? 5
        }));
    } catch (e: any) {
        console.error('[EndOfDayStockConfirm] load failed:', e);
        toast.add({ severity: 'error', summary: 'Failed to load stock', detail: e?.message || 'Please try again', life: 4000 });
    } finally {
        isLoading.value = false;
    }
};

const loadAll = async () => {
    if (!props.driverId) return;
    await Promise.all([loadDraftFromCurrentStock(), loadDaySalesSummary()]);
};

watch(
    () => props.modelValue,
    (open) => {
        if (open && props.driverId) loadAll();
    }
);

const getStockPercentage = (row: any) => (row.maxCapacity ? Math.round((row.currentStock / row.maxCapacity) * 100) : 0);
const getStockSeverity = (row: any) => {
    const p = getStockPercentage(row);
    if (p <= 20) return 'danger';
    if (p <= 40) return 'warn';
    return 'success';
};

const submitClosing = async () => {
    if (!props.driverId) return;
    isSubmitting.value = true;
    try {
        const dateKey = localDayKey();
        const items = draftItems.value.map((i) => ({
            productId: i.productId,
            productName: i.name,
            type: i.type,
            quantity: i.currentStock,
            unit: i.unit
        }));

        const res = await api.drivers.submitDriverDailyClosingConfirmation(props.driverId, items, dateKey);
        if (res?.success) {
            const dep = res.data?.depositSync;
            if (dep && dep.ok === false) {
                toast.add({
                    severity: 'warn',
                    summary: 'Stock saved',
                    detail: dep.message || 'Daily sales snapshot could not be synced to the deposit ledger. Try again or contact admin.',
                    life: 6000
                });
            } else {
                toast.add({
                    severity: 'success',
                    summary: 'Day closed',
                    detail: "Closing stock and today's sales summary were saved for reconciliation.",
                    life: 4500
                });
            }
            try {
                sessionStorage.setItem(`eveningStockConfirmed_${String(props.driverId)}_${dateKey}`, '1');
            } catch {
                /* ignore */
            }
            const statusRes = await driverStore.setOnlineStatusPersistent(false, props.driverId);
            if (!statusRes.success) {
                toast.add({
                    severity: 'warn',
                    summary: 'Offline status',
                    detail: statusRes.error || 'Day closed but we could not set you offline in the system — use Go Offline.',
                    life: 5500
                });
            }
            visible.value = false;
            emit('confirmed', { dateKey });
        } else {
            toast.add({ severity: 'error', summary: 'Save failed', detail: res?.error?.message || 'Please try again', life: 4500 });
        }
    } catch (e: any) {
        toast.add({ severity: 'error', summary: 'Error', detail: e?.message || 'Something went wrong', life: 4000 });
    } finally {
        isSubmitting.value = false;
    }
};
</script>

<template>
    <Dialog v-model:visible="visible" modal class="w-full max-w-3xl dialog-flex-end" closable close-on-escape
        dismissable-mask :draggable="false" header="Close day — stock & sales">
        <div class="flex flex-col gap-5">
            <div
                class="rounded-2xl border border-primary-200 dark:border-primary-800 bg-primary-50/80 dark:bg-primary-950/40 px-2 py-3 text-center">
                <div class="text-sm font-medium text-primary-700 dark:text-primary-300 uppercase tracking-wide">
                    Operational Day</div>
                <div class="text-xl md:text-2xl font-bold text-primary-900 dark:text-primary-100 leading-tight">
                    {{ todayDisplay() }}
                </div>
            </div>

            <p class="text-surface-600 dark:text-surface-400 text-sm leading-relaxed m-0">
                <strong>Stock:</strong> matches system counts (sales & exchanges). Adjust if your physical count
                differs.
                <strong class="ml-1">Sales:</strong> summary from today's <strong>delivered</strong> orders — reconcile
                with cash, QRIS, and closing stock.
                After you confirm, per-product sales are saved to the daily ledger (deposits).
            </p>

            <!-- Sales summary (from orders) -->
            <div
                class="rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-900/40 p-4">
                <h3 class="text-sm font-semibold text-surface-900 dark:text-surface-0 mb-3 m-0">Today's sales (from
                    system)</h3>
                <div v-if="isLoadingSales" class="flex justify-center py-6">
                    <ProgressSpinner style="width: 36px; height: 36px" />
                </div>
                <template v-else-if="daySalesReport">
                    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3 text-sm">
                        <div
                            class="rounded-lg bg-white dark:bg-surface-800 p-2 border border-surface-200 dark:border-surface-600">
                            <div class="text-surface-500 text-xs">Total revenue</div>
                            <div class="font-bold text-surface-900 dark:text-surface-0">{{
                                formatCurrency(daySalesReport.totalEarnings) }}</div>
                        </div>
                        <div
                            class="rounded-lg bg-white dark:bg-surface-800 p-2 border border-surface-200 dark:border-surface-600">
                            <div class="text-surface-500 text-xs">Units sold</div>
                            <div class="font-bold text-surface-900 dark:text-surface-0">{{ daySalesReport.totalSoldItems
                            }}</div>
                        </div>
                        <div
                            class="rounded-lg bg-white dark:bg-surface-800 p-2 border border-surface-200 dark:border-surface-600">
                            <div class="text-surface-500 text-xs">Online</div>
                            <div class="font-semibold text-surface-900 dark:text-surface-0">{{
                                formatCurrency(daySalesChannels.online) }}</div>
                        </div>
                        <div
                            class="rounded-lg bg-white dark:bg-surface-800 p-2 border border-surface-200 dark:border-surface-600">
                            <div class="text-surface-500 text-xs">Walk-in cash / QRIS</div>
                            <div class="font-semibold text-surface-900 dark:text-surface-0 text-xs leading-tight">
                                {{ formatCurrency(daySalesChannels.offlineCash) }} / {{
                                    formatCurrency(daySalesChannels.offlineQris) }}
                            </div>
                        </div>
                    </div>
                    <p v-if="daySalesLines.length === 0" class="text-xs text-surface-500 m-0">No delivered orders today
                        yet.</p>
                    <DataTable v-else :value="daySalesLines" class="p-datatable-sm"
                        :paginator="daySalesLines.length > 5" :rows="5">
                        <Column field="productName" header="Product" style="min-width: 8rem" />
                        <Column field="soldItems" header="Sold" style="width: 5rem" />
                        <Column header="Online" style="min-width: 6rem">
                            <template #body="{ data }">{{ formatCurrency(data.onlineAmount) }}</template>
                        </Column>
                        <Column header="Cash" style="min-width: 6rem">
                            <template #body="{ data }">{{ formatCurrency(data.offlineCashAmount) }}</template>
                        </Column>
                        <Column header="QRIS" style="min-width: 6rem">
                            <template #body="{ data }">{{ formatCurrency(data.offlineQrisAmount) }}</template>
                        </Column>
                        <Column header="Subtotal" style="min-width: 6rem">
                            <template #body="{ data }">{{ formatCurrency(data.totalEarning) }}</template>
                        </Column>
                    </DataTable>
                </template>
            </div>

            <div v-if="isLoading" class="flex justify-center py-12">
                <ProgressSpinner style="width: 48px; height: 48px" />
            </div>

            <template v-else>
                <div v-if="draftItems.length === 0" class="text-center text-surface-500 py-6">
                    No stock rows yet. You can still confirm to close the day.
                </div>

                <DataTable v-else :value="draftItems" responsiveLayout="scroll" class="p-datatable-sm"
                    :paginator="false">
                    <Column field="name" header="Item" style="min-width: 10rem">
                        <template #body="{ data }">
                            <span class="font-medium">{{ data.name }}</span>
                            <Tag v-if="data.currentStock <= data.criticalLevel" value="Low" severity="danger"
                                class="ml-2" size="small" />
                        </template>
                    </Column>

                    <Column header="Actual quantity" style="min-width: 5rem">
                        <template #body="{ data }">
                            <div class="flex align-items-center gap-2 max-w-32">
                                <InputNumber v-model="data.currentStock" :min="0" :max="data.maxCapacity" size="small"
                                    class="flex w-full" />
                                <span class="text-sm text-surface-500">{{ data.unit }}</span>
                            </div>
                        </template>
                    </Column>

                    <Column header="Capacity" style="min-width: 5rem">
                        <template #body="{ data }">
                            <div class="flex flex-col gap-1">
                                <span class="text-sm">{{ data.currentStock }} / {{ data.maxCapacity }}</span>
                                <ProgressBar class="mt-1" :value="getStockPercentage(data)"
                                    :severity="getStockSeverity(data)" />
                            </div>
                        </template>
                    </Column>
                </DataTable>
            </template>
        </div>

        <template #footer>
            <div class="w-full flex flex-wrap justify-end gap-2">
                <Button label="Confirm close day" icon="pi pi-check" :loading="isSubmitting"
                    :disabled="isLoading || isLoadingSales" severity="success" @click="submitClosing" />
            </div>
        </template>
    </Dialog>
</template>
