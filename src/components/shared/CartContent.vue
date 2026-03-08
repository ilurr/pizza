<script setup>
import { computed } from 'vue';

const props = defineProps({
    items: {
        type: Array,
        default: () => []
    },
    /** Empty state message below the title */
    emptyMessage: {
        type: String,
        default: 'Add some delicious pizzas to get started!'
    },
    /** If set (e.g. after discount), shown as Total instead of subtotal */
    finalTotal: {
        type: Number,
        default: null
    },
    /** If false (e.g. offline cashier), only Total is shown; no "Items (n)" line */
    showItemsSummary: {
        type: Boolean,
        default: true
    }
});

const emit = defineEmits(['update-quantity', 'remove-item']);

const totalItems = computed(() =>
    (props.items || []).reduce((s, i) => s + (i.quantity || 0), 0)
);
const subtotal = computed(() =>
    (props.items || []).reduce((sum, i) => sum + (i.price || 0) * (i.quantity || 0), 0)
);

const formatCurrency = (amount) => {
    const formatted = new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(amount);
    return formatted.replace(/\s/g, '');
};

const itemKey = (item) => (item.type ? `${item.type}-${item.id}` : item.id);

const onUpdateQty = (item, delta) => emit('update-quantity', item, delta);
const onRemove = (item) => emit('remove-item', item);
</script>

<template>
    <!-- Empty Cart State -->
    <div v-if="!items || items.length === 0" class="text-center py-8">
        <i class="pi pi-shopping-cart !text-6xl text-gray-300 dark:text-gray-600 mb-0"></i>
        <h3 class="text-xl font-semibold text-gray-600 dark:text-gray-400 mb-2">Your cart is empty</h3>
        <p class="text-gray-500 dark:text-gray-500 mb-6">{{ emptyMessage }}</p>
        <slot name="empty-action"></slot>
    </div>

    <!-- Cart Items -->
    <div v-else class="relative">
        <div class="space-y-3">
            <div v-for="item in items" :key="itemKey(item)"
                class="flex items-center space-x-4 py-2 border-b border-surface-200 dark:border-surface-700 last:border-b-0">
                <div
                    class="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                    <i class="pi pi-image text-2xl text-gray-400" v-if="!item.image"></i>
                    <img v-else :src="item.image" :alt="item.name" loading="lazy"
                        class="w-full h-full object-cover rounded-lg" />
                </div>
                <div class="flex-1 min-w-0">
                    <h4 class="font-semibold text-gray-900 dark:text-white line-clamp-2 mb-0 text-base">
                        {{ item.name }}
                    </h4>
                    <p class="text-sm font-medium text-red-600 dark:text-red-400">{{ formatCurrency(item.price) }}</p>
                </div>
                <div class="flex items-center space-x-2 flex-shrink-0">
                    <Button icon="pi pi-minus" size="small" severity="secondary" outlined
                        :disabled="(item.quantity || 0) <= 1" class="w-8 h-8" @click="onUpdateQty(item, -1)" />
                    <span class="w-4 text-center font-medium">{{ item.quantity }}</span>
                    <Button icon="pi pi-plus" size="small" severity="secondary" outlined class="w-8 h-8"
                        @click="onUpdateQty(item, 1)" />
                </div>
                <Button icon="pi pi-trash" size="small" outlined severity="danger" class="w-8 h-8"
                    @click="onRemove(item)" />
            </div>
        </div>

        <!-- Order Summary -->
        <div class="relative mt-2">
            <div v-if="showItemsSummary"
                class="flex justify-between items-center border-t border-gray-200 dark:border-gray-700 pt-4 mb-2">
                <span class="text-gray-600 dark:text-gray-400">Items ({{ totalItems }})</span>
                <span class="font-medium">{{ formatCurrency(subtotal) }}</span>
            </div>
            <slot name="summary-extra"></slot>
            <div class="border-t border-gray-200 dark:border-gray-700 pt-4">
                <div class="flex justify-between items-center">
                    <span class="text-lg font-semibold">Total</span>
                    <span class="text-lg font-bold text-red-600 dark:text-red-400">{{
                        formatCurrency(finalTotal != null ? finalTotal : subtotal)
                    }}</span>
                </div>
            </div>
        </div>
        <slot name="footer"></slot>
    </div>
</template>
