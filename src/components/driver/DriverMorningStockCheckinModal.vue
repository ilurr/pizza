<script setup>
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
const isSubmitting = ref(false);
const draftItems = ref([]);

const visible = computed({
    get: () => props.modelValue,
    set: (v) => emit('update:modelValue', v)
});

/** Local calendar day bounds (device timezone) as ISO strings for DB filter */
function getLocalDayBoundsISO() {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    return { startISO: start.toISOString(), endISO: end.toISOString(), dateKey: start.toLocaleDateString('en-CA') };
}

const todayDisplay = computed(() => {
    const now = new Date();
    return now.toLocaleDateString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
});

const todayShort = computed(() => {
    const now = new Date();
    return now.toLocaleDateString('id-ID', { dateStyle: 'medium' });
});

const loadDraftFromStock = async () => {
    if (!props.driverId) return;
    isLoading.value = true;
    draftItems.value = [];
    try {
        const res = await api.drivers.getDriverStock(props.driverId);
        const stock = res?.success && res.data?.stock ? res.data.stock : [];
        draftItems.value = stock.map((i) => ({
            productId: i.productId || i.id,
            name: i.name,
            type: i.type,
            unit: i.unit,
            currentStock: Number(i.currentStock ?? 0),
            maxCapacity: i.maxCapacity ?? 100,
            criticalLevel: i.criticalLevel ?? 5
        }));
    } catch (e) {
        console.error('[MorningStockCheckin] load failed:', e);
        toast.add({ severity: 'error', summary: 'Gagal memuat stok', detail: e?.message || 'Coba lagi', life: 4000 });
    } finally {
        isLoading.value = false;
    }
};

watch(
    () => props.modelValue,
    (open) => {
        if (open && props.driverId) {
            loadDraftFromStock();
        }
    }
);

watch(
    () => props.driverId,
    () => {
        if (props.modelValue && props.driverId) loadDraftFromStock();
    }
);

const getStockPercentage = (row) => (row.maxCapacity ? Math.round((row.currentStock / row.maxCapacity) * 100) : 0);

const getStockSeverity = (row) => {
    const p = getStockPercentage(row);
    if (p <= 20) return 'danger';
    if (p <= 40) return 'warn';
    return 'success';
};

const submitConfirmation = async () => {
    if (!props.driverId) return;
    isSubmitting.value = true;
    try {
        const { dateKey } = getLocalDayBoundsISO();
        const items = draftItems.value.map((i) => ({
            productId: i.productId,
            productName: i.name,
            type: i.type,
            quantity: i.currentStock,
            unit: i.unit
        }));
        const res = await api.drivers.submitDriverDailyConfirmation(props.driverId, items, dateKey);
        if (res?.success) {
            toast.add({
                severity: 'success',
                summary: 'Hari ini siap',
                detail: 'Stok dicocokkan dan dikonfirmasi.',
                life: 4000
            });
            try {
                sessionStorage.setItem(`morningStockConfirmed_${String(props.driverId)}_${dateKey}`, '1');
            } catch {
                /* ignore */
            }
            const statusRes = await driverStore.setOnlineStatusPersistent(true, props.driverId);
            if (!statusRes.success) {
                toast.add({
                    severity: 'warn',
                    summary: 'Status online',
                    detail: statusRes.error || 'Tidak bisa mengatur online otomatis — aktifkan lewat tombol Go Online.',
                    life: 5500
                });
            }
            visible.value = false;
            emit('confirmed', { dateKey });
        } else {
            toast.add({ severity: 'error', summary: 'Gagal menyimpan', detail: res?.error?.message || 'Coba lagi', life: 4500 });
        }
    } catch (e) {
        toast.add({ severity: 'error', summary: 'Error', detail: e?.message || 'Gagal', life: 4000 });
    } finally {
        isSubmitting.value = false;
    }
};
</script>

<template>
    <Dialog v-model:visible="visible" modal class="w-full max-w-3xl dialog-flex-end" closable close-on-escape
        dismissable-mask :draggable="false" header="Morning Stock Check-in">
        <div class="flex flex-col gap-5 mt-4">
            <div
                class="rounded-2xl border border-primary-200 dark:border-primary-800 bg-primary-50/80 dark:bg-primary-950/40 px-2 py-3 text-center">
                <div class="text-sm font-medium text-primary-700 dark:text-primary-300 uppercase tracking-wide">
                    Operational Day</div>
                <div class="text-xl md:text-2xl font-bold text-primary-900 dark:text-primary-100 leading-tight">
                    {{ todayDisplay }}
                </div>
            </div>

            <p class="text-surface-600 dark:text-surface-400 text-sm leading-relaxed m-0">
                Check and adjust to match your <strong>physical</strong> stock. If there are differences, update the
                numbers below, then confirm.
            </p>

            <div v-if="isLoading" class="flex justify-center py-12">
                <ProgressSpinner style="width: 48px; height: 48px" />
            </div>

            <template v-else>
                <div v-if="draftItems.length === 0" class="text-center text-surface-500 py-6">
                    No stock items found. Contact admin.
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
                    <Column header="Actual Quantity" style="min-width: 5rem">
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
            <div class="w-full flex justify-end gap-2">
                <Button label="Confirm Opening Day" icon="pi pi-check" :loading="isSubmitting" :disabled="isLoading"
                    severity="success" @click="submitConfirmation" />
            </div>
        </template>
    </Dialog>
</template>
