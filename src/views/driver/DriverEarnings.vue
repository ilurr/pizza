<script setup>
import api from '@/services/api/index.js';
import { useUserStore } from '@/stores/userStore';
import { computed, onMounted, ref, watch } from 'vue';

const userStore = useUserStore();
const selectedPeriod = ref('today');
const report = ref({ totalSoldItems: 0, totalEarnings: 0 });
const dailyDeposits = ref([]);
const isLoading = ref(false);

const driverId = computed(() => (userStore.user?.id != null ? String(userStore.user.id) : ''));

const formatCurrency = (amount) => {
    if (amount == null) return '—';
    const formatted = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
    return formatted.replace(/\s/g, '');
};

const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
};

const reportSummary = computed(() => [
    { title: 'Total sold items', value: report.value.totalSoldItems, icon: 'pi pi-box', color: 'blue', subtitle: 'Units', isCurrency: false },
    { title: 'Total earnings', value: report.value.totalEarnings, icon: 'pi pi-wallet', color: 'green', subtitle: 'Rp', isCurrency: true }
]);

const loadEarnings = async () => {
    if (!driverId.value) {
        report.value = { totalSoldItems: 0, totalEarnings: 0 };
        dailyDeposits.value = [];
        isLoading.value = false;
        return;
    }
    isLoading.value = true;
    try {
        const res = await api.drivers.getDriverEarnings(driverId.value, selectedPeriod.value);
        if (res?.success && res.data) {
            report.value = res.data.report || { totalSoldItems: 0, totalEarnings: 0 };
            dailyDeposits.value = res.data.dailyDeposits || [];
        } else {
            report.value = { totalSoldItems: 0, totalEarnings: 0 };
            dailyDeposits.value = [];
        }
    } catch (e) {
        console.error('Failed to load driver earnings:', e);
        report.value = { totalSoldItems: 0, totalEarnings: 0 };
        dailyDeposits.value = [];
    } finally {
        isLoading.value = false;
    }
};

onMounted(() => loadEarnings());
watch(selectedPeriod, () => loadEarnings());
</script>

<template>
    <div class="p-4">
        <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div class="flex flex-row items-center justify-between gap-3 mb-4">
                <p class="text-600 dark:text-400 text-sm mb-0">Sold items and total earnings for the period.</p>
                <Button
                    label="Refresh"
                    icon="pi pi-refresh"
                    loadingIcon="pi pi-spinner animate-spin"
                    outlined
                    size="small"
                    :loading="isLoading"
                    @click="loadEarnings"
                />
            </div>
            <div class="flex flex-wrap items-center gap-2">
                <SelectButton v-model="selectedPeriod" :options="[
                    { label: 'Today', value: 'today' },
                    { label: 'Week', value: 'week' },
                    { label: 'Month', value: 'month' }
                ]" optionLabel="label" optionValue="value" size="small" />
            </div>
        </div>

        <div v-if="isLoading" class="flex justify-center py-8">
            <ProgressSpinner style="width: 40px; height: 40px" />
        </div>

        <template v-else>
            <!-- Report summary -->
            <div class="grid grid-cols-2 gap-4 w-full mb-6">
                <div v-for="s in reportSummary" :key="s.title"
                    class="rounded-xl border-2 bg-white dark:bg-neutral-800 border-surface-200 dark:border-surface-700 overflow-hidden transition-shadow hover:shadow-sm">
                    <div class="p-5 flex flex-col items-center text-center gap-3">
                        <span class="flex items-center justify-center w-14 h-14 rounded-2xl shrink-0" :class="{
                            'bg-blue-200/60 dark:bg-blue-700/40': s.color === 'blue',
                            'bg-green-200/60 dark:bg-green-700/40': s.color === 'green'
                        }">
                            <i
                                :class="[s.icon, '!text-2xl shrink-0', s.color === 'blue' && 'text-blue-500', s.color === 'green' && 'text-green-500']"></i>
                        </span>
                        <div class="min-w-0 w-full">
                            <div class="text-600 dark:text-400 text-sm mb-0.5">{{ s.subtitle }}</div>
                            <div class="text-xl font-bold text-surface-900 dark:text-surface-0 truncate">
                                {{ s.isCurrency ? formatCurrency(s.value) : s.value }}
                            </div>
                            <div class="text-surface-700 dark:text-surface-300 font-medium text-sm mt-1">{{ s.title }}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Daily deposit table -->
            <div>
                <h3 class="text-lg font-semibold text-surface-900 dark:text-surface-0 mb-3">Daily deposit</h3>
                <div v-if="dailyDeposits.length === 0"
                    class="rounded-xl border-2 border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800/50 p-8 text-center text-600">
                    <i class="pi pi-inbox !text-4xl mb-3 block"></i>
                    <p class="mb-0">No deposit rows for this period.</p>
                </div>
                <div v-else
                    class="rounded-xl border-2 border-surface-200 dark:border-surface-700 bg-white dark:bg-neutral-800 overflow-hidden">
                    <DataTable :value="dailyDeposits" responsiveLayout="scroll" class="p-datatable-sm"
                        :paginator="dailyDeposits.length > 10" :rows="10">
                        <Column field="productName" header="Product" style="min-width: 10rem" />
                        <Column field="earlyStock" header="Early stock" style="min-width: 6rem" />
                        <Column field="soldItems" header="Sold" style="min-width: 5rem" />
                        <Column header="Online" style="min-width: 8rem">
                            <template #body="{ data }">{{ formatCurrency(data.onlineAmount) }}</template>
                        </Column>
                        <Column header="Offline Cash" style="min-width: 9rem">
                            <template #body="{ data }">{{ formatCurrency(data.offlineCashAmount) }}</template>
                        </Column>
                        <Column header="Offline QRIS" style="min-width: 10rem">
                            <template #body="{ data }">{{ formatCurrency(data.offlineQrisAmount) }}</template>
                        </Column>
                        <Column header="Total earning" style="min-width: 9rem">
                            <template #body="{ data }">
                                <span class="font-semibold text-green-600 dark:text-green-400">{{
                                    formatCurrency(data.totalEarning) }}</span>
                            </template>
                        </Column>
                        <Column header="Date" style="min-width: 7rem">
                            <template #body="{ data }">{{ formatDate(data.depositDate) }}</template>
                        </Column>
                    </DataTable>
                </div>
            </div>
        </template>
    </div>
</template>
