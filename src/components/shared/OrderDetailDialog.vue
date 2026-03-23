<script setup>
import api from '@/services/api/index.js';
import { useToast } from 'primevue/usetoast';
import { computed, ref, watch } from 'vue';

const props = defineProps({
    modelValue: {
        type: Boolean,
        default: false
    },
    order: {
        type: Object,
        default: null
    }
});

const emit = defineEmits(['update:modelValue', 'order-updated']);

const toast = useToast();

const visible = computed({
    get: () => props.modelValue,
    set: (v) => emit('update:modelValue', v)
});

const walkInPaymentChoice = ref('cash');
const savingWalkInPayment = ref(false);

function paymentMethodToChoice(pm) {
    const s = String(pm || '').toLowerCase();
    return s === 'qris' ? 'qris' : 'cash';
}

const isWalkInCashierOrder = computed(() => {
    const o = props.order;
    if (!o) return false;
    return String(o.customerId || '') === 'guest_user';
});

const walkInPaymentDirty = computed(() => {
    if (!props.order || !isWalkInCashierOrder.value) return false;
    return paymentMethodToChoice(props.order.paymentMethod) !== walkInPaymentChoice.value;
});

watch(
    () => [props.modelValue, props.order?.id, props.order?.paymentMethod],
    () => {
        if (props.modelValue && props.order) {
            walkInPaymentChoice.value = paymentMethodToChoice(props.order.paymentMethod);
        }
    },
    { immediate: true }
);

async function saveWalkInPayment() {
    const o = props.order;
    if (!o?.id || !isWalkInCashierOrder.value) return;
    savingWalkInPayment.value = true;
    try {
        const method = walkInPaymentChoice.value === 'qris' ? 'QRIS' : 'cash';
        const res = await api.orders.updateWalkInPaymentMethod(o.id, method);
        if (!res?.success || !res.data?.order) {
            const msg =
                res?.error?.message ||
                res?.message ||
                (typeof res?.error === 'string' ? res.error : null) ||
                'Could not update payment method';
            toast.add({ severity: 'error', summary: 'Update failed', detail: msg, life: 4500 });
            return;
        }
        const updated = res.data.order;
        toast.add({
            severity: 'success',
            summary: 'Payment method updated',
            detail: `Saved as ${updated.paymentMethod || method}.`,
            life: 3000
        });
        emit('order-updated', updated);
    } catch (e) {
        toast.add({
            severity: 'error',
            summary: 'Error',
            detail: e?.message || 'Update failed',
            life: 4000
        });
    } finally {
        savingWalkInPayment.value = false;
    }
}

const formatCurrency = (amount) => {
    const formatted = new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(Number(amount) || 0);
    return formatted.replace(/\s/g, '');
};

const formatDateTime = (iso) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' });
};

const formatDeliveryAddress = (addr) => {
    if (!addr) return '—';
    if (typeof addr === 'string') return addr.trim() || '—';
    const text = addr.address || addr.fullAddress || addr.location;
    if (text) return String(text);
    if (typeof addr === 'object' && Object.keys(addr).length === 0) return '—';
    return JSON.stringify(addr);
};

const statusSeverity = (s) => {
    const m = {
        pending: 'warn',
        assigned: 'info',
        confirmed: 'info',
        preparing: 'info',
        on_delivery: 'info',
        delivered: 'success',
        cancelled: 'danger'
    };
    return m[s] || 'secondary';
};

const headerTitle = computed(() => {
    const o = props.order;
    if (!o) return 'Order detail';
    return `Order · ${o.orderNumber || o.id}`;
});
</script>

<template>
    <Dialog v-model:visible="visible" modal :header="headerTitle" class="w-full max-w-[52rem] dialog-flex-end">
        <div v-if="order" class="order-detail-layout flex flex-col gap-5 pb-16 md:pb-0">
            <!-- Status strip -->
            <div
                class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-900/50 px-4 py-3">
                <div class="min-w-0">
                    <p class="text-xs font-medium uppercase tracking-wider text-surface-500 m-0 mb-0.5">Placed</p>
                    <p class="text-sm font-semibold text-surface-900 dark:text-surface-0 m-0">
                        {{ formatDateTime(order.orderDate) }}
                    </p>
                </div>
                <div class="flex flex-wrap items-center gap-2">
                    <Tag :value="order.status" :severity="statusSeverity(order.status)" />
                    <span
                        class="inline-flex items-center rounded-md border border-surface-200 dark:border-surface-600 bg-white dark:bg-surface-800 px-2.5 py-1 text-xs font-medium text-surface-700 dark:text-surface-200">
                        Pay: {{ order.paymentStatus || 'pending' }}
                    </span>
                </div>
            </div>

            <!-- People: side-by-side cards -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div
                    class="rounded-xl border border-surface-200 dark:border-surface-700 p-4 flex gap-3 bg-white dark:bg-surface-900/30">
                    <span
                        class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                        <i class="pi pi-user" />
                    </span>
                    <div class="min-w-0">
                        <p class="text-xs font-medium uppercase tracking-wide text-surface-500 m-0 mb-1">Customer</p>
                        <p class="text-sm font-semibold text-surface-900 dark:text-surface-0 m-0 truncate">
                            {{ order.customerName || '—' }}
                        </p>
                        <p class="text-xs text-surface-500 m-0 mt-0.5 break-all">
                            {{ order.customerPhone || order.customerEmail || '—' }}
                        </p>
                    </div>
                </div>
                <div
                    class="rounded-xl border border-surface-200 dark:border-surface-700 p-4 flex gap-3 bg-white dark:bg-surface-900/30">
                    <span
                        class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                        <i class="pi pi-car" />
                    </span>
                    <div class="min-w-0">
                        <p class="text-xs font-medium uppercase tracking-wide text-surface-500 m-0 mb-1">Driver</p>
                        <p class="text-sm font-semibold text-surface-900 dark:text-surface-0 m-0 truncate">
                            {{ order.driverInfo?.name || '—' }}
                        </p>
                        <p class="text-xs text-surface-500 m-0 mt-0.5">{{ order.driverInfo?.phone || '—' }}</p>
                    </div>
                </div>
            </div>

            <!-- Line items: table-style -->
            <div class="rounded-xl border border-surface-200 dark:border-surface-700 overflow-hidden">
                <div
                    class="grid grid-cols-12 gap-2 px-4 py-2.5 bg-surface-100/80 dark:bg-surface-800/80 text-xs font-semibold uppercase tracking-wide text-surface-600 dark:text-surface-400 border-b border-surface-200 dark:border-surface-700">
                    <span class="col-span-6 sm:col-span-5">Item</span>
                    <span class="col-span-3 sm:col-span-3 text-center">Qty × Unit</span>
                    <span class="col-span-3 sm:col-span-4 text-right">Line total</span>
                </div>
                <div v-if="(order.items || []).length === 0" class="px-4 py-6 text-sm text-surface-500 text-center">No
                    items</div>
                <div v-else class="divide-y divide-surface-200 dark:divide-surface-700">
                    <div v-for="(it, idx) in order.items" :key="it.id || (it.name + '-' + idx)"
                        class="grid grid-cols-12 gap-2 px-4 py-3 items-center">
                        <div class="col-span-6 sm:col-span-5 min-w-0">
                            <p class="text-sm font-medium text-surface-900 dark:text-surface-0 m-0 truncate">{{ it.name
                                || 'Item' }}</p>
                        </div>
                        <div
                            class="col-span-3 sm:col-span-3 text-center text-xs text-surface-600 dark:text-surface-400">
                            {{ it.quantity || 0 }} × {{ it.price != null ? formatCurrency(Number(it.price)) : '—' }}
                        </div>
                        <div
                            class="col-span-3 sm:col-span-4 text-right text-sm font-semibold text-surface-900 dark:text-surface-0">
                            {{ it.price != null ? formatCurrency(Number(it.price) * Number(it.quantity || 0)) : '—' }}
                        </div>
                    </div>
                </div>
            </div>

            <!-- Delivery + totals: stacked on mobile, split on large screens -->
            <div class="grid grid-cols-1 lg:grid-cols-12 gap-4">
                <div class="lg:col-span-5 space-y-2">
                    <p class="text-xs font-semibold uppercase tracking-wide text-surface-500 m-0">Delivery</p>
                    <div
                        class="rounded-xl border border-dashed border-surface-300 dark:border-surface-600 p-4 bg-surface-0 dark:bg-surface-900/20">
                        <p class="text-sm text-surface-800 dark:text-surface-100 m-0 leading-relaxed">
                            {{ formatDeliveryAddress(order.deliveryAddress) }}
                        </p>
                        <p v-if="order.estimatedDelivery" class="text-xs text-surface-500 m-0 mt-2">
                            <span class="font-medium text-surface-600 dark:text-surface-400">Est. delivery:</span>
                            {{ formatDateTime(order.estimatedDelivery) }}
                        </p>
                        <p v-if="order.notes"
                            class="text-xs text-surface-600 dark:text-surface-300 m-0 mt-2 border-t border-surface-200 dark:border-surface-700 pt-2">
                            <span class="font-medium">Notes:</span> {{ order.notes }}
                        </p>
                    </div>
                </div>

                <div class="lg:col-span-7 flex flex-col gap-4">
                    <div
                        class="rounded-xl border-2 border-surface-200 dark:border-surface-600 p-4 bg-surface-50/50 dark:bg-surface-800/30">
                        <p class="text-xs font-semibold uppercase tracking-wide text-surface-500 m-0 mb-3">Summary</p>
                        <div class="space-y-2 text-sm">
                            <div class="flex justify-between gap-4 text-surface-700 dark:text-surface-200">
                                <span>Subtotal</span>
                                <span class="tabular-nums">{{ formatCurrency(Number(order.subtotal || 0)) }}</span>
                            </div>
                            <div class="flex justify-between gap-4 text-surface-700 dark:text-surface-200">
                                <span>Delivery fee</span>
                                <span class="tabular-nums">{{ formatCurrency(Number(order.deliveryFee || 0)) }}</span>
                            </div>
                            <div v-if="Number(order.discount || 0) !== 0"
                                class="flex justify-between gap-4 text-surface-700 dark:text-surface-200">
                                <span>Discount</span>
                                <span class="tabular-nums text-green-600 dark:text-green-400">-{{
                                    formatCurrency(Number(order.discount || 0)) }}</span>
                            </div>
                            <div
                                class="flex justify-between gap-4 text-base font-bold text-surface-900 dark:text-surface-0 pt-3 mt-1 border-t-2 border-dashed border-surface-300 dark:border-surface-600">
                                <span>Grand total</span>
                                <span class="tabular-nums">{{ formatCurrency(Number(order.total || 0)) }}</span>
                            </div>
                        </div>
                        <p v-if="!isWalkInCashierOrder"
                            class="text-xs text-surface-500 m-0 mt-3 pt-3 border-t border-surface-200 dark:border-surface-700">
                            Payment method: <strong>{{ order.paymentMethod || '—' }}</strong>
                        </p>
                    </div>

                    <!-- Walk-in payment: full width of summary column -->
                    <div v-if="isWalkInCashierOrder"
                        class="rounded-xl border-2 border-primary-300 dark:border-primary-700 bg-gradient-to-br from-primary-50 to-white dark:from-primary-950/50 dark:to-surface-900 p-4 shadow-sm">
                        <div class="flex flex-wrap items-start justify-between gap-3 mb-3">
                            <div>
                                <p class="text-sm font-bold text-primary-800 dark:text-primary-100 m-0">Walk-in payment
                                </p>
                                <p class="text-xs text-surface-600 dark:text-surface-400 m-0 mt-1 max-w-md">
                                    Customer switched between cash and QRIS after the sale? Update here for accurate
                                    daily
                                    reconciliation.
                                </p>
                            </div>
                        </div>
                        <div class="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-4 mb-4">
                            <label class="inline-flex items-center gap-2 cursor-pointer text-sm font-medium"
                                :class="{ 'opacity-60 pointer-events-none': savingWalkInPayment }">
                                <input v-model="walkInPaymentChoice" type="radio" name="walkin-pay-detail" value="cash"
                                    class="cursor-pointer accent-primary" :disabled="savingWalkInPayment" />
                                Cash
                            </label>
                            <label class="inline-flex items-center gap-2 cursor-pointer text-sm font-medium"
                                :class="{ 'opacity-60 pointer-events-none': savingWalkInPayment }">
                                <input v-model="walkInPaymentChoice" type="radio" name="walkin-pay-detail" value="qris"
                                    class="cursor-pointer accent-primary" :disabled="savingWalkInPayment" />
                                QRIS
                            </label>
                        </div>
                        <Button label="Update payment method" icon="pi pi-check" size="small" class="w-full sm:w-auto"
                            :loading="savingWalkInPayment" :disabled="!walkInPaymentDirty || savingWalkInPayment"
                            @click="saveWalkInPayment" />
                    </div>
                </div>
            </div>
        </div>
    </Dialog>
</template>
