<script setup lang="ts">
import CartContent from '@/components/shared/CartContent.vue';
import { useCartStore } from '@/stores/cartStore.js';
import { useToast } from 'primevue/usetoast';
import { computed, defineAsyncComponent, ref } from 'vue';
import { useRouter } from 'vue-router';

const PromoModal = defineAsyncComponent(() => import('@/components/PromoModal.vue'));

interface CartItem {
    id: string;
    type?: string;
    name: string;
    price: number;
    quantity: number;
    image?: string;
}

interface Props {
    visible: boolean;
    /** 'user' = cartStore (default), 'offline' = driver cashier with Cash/QRIS + Complete sale */
    variant?: 'user' | 'offline';
    /** Required when variant='offline': the driver's local cart items */
    items?: CartItem[];
}

const props = withDefaults(defineProps<Props>(), { variant: 'user' });

interface AppliedPromo {
    id: string;
    code: string;
    title: string;
    type: 'percentage' | 'fixed';
    value: number;
}

interface Discount {
    type: string;
    value: number;
    amount: number;
    formattedAmount: string;
}

const emit = defineEmits<{
    'update:visible': [value: boolean];
    'checkout': [];
    'update-quantity': [item: CartItem, delta: number];
    'remove-item': [item: CartItem];
    'complete-sale': [payload: { paymentMethod: 'cash' | 'qris' }];
}>();

const router = useRouter();
const cartStore = useCartStore();
const toast = useToast();

// Promo state
const showPromoModal = ref(false);
// Offline variant: payment method and derived state
const paymentMethod = ref<'cash' | 'qris'>('cash');
const isOffline = computed(() => props.variant === 'offline');
const displayItems = computed(() => (isOffline.value ? (props.items || []) : cartStore.items));
const isEmpty = computed(() => (isOffline.value ? !displayItems.value?.length : cartStore.isEmpty));

// Computed properties (user cart store)
const subtotal = computed(() => cartStore.totalPrice);
const discountAmount = computed(() => cartStore.discountAmount);
const finalTotal = computed(() => cartStore.finalTotal);

const formattedSubtotal = computed(() => cartStore.formattedTotalPrice);
const formattedDiscount = computed(() => cartStore.formattedDiscount);
const formattedFinalTotal = computed(() => cartStore.formattedFinalTotal);

// Format currency helper
const formatCurrency = (amount: number) => {
    const formatted = new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(amount);
    return formatted.replace(/\s/g, ''); // Remove spaces
};

const closeModal = () => {
    emit('update:visible', false);
};

const openPromoModal = () => {
    showPromoModal.value = true;
};

const onPromoSelected = (promo: AppliedPromo, discount: Discount) => {
    cartStore.applyPromo(promo, discount);
    showPromoModal.value = false;
};

const removePromo = () => {
    cartStore.removePromo();

    toast.add({
        severity: 'info',
        detail: 'Promo code removed',
        life: 3000,
        group: 'cart'
    });
};

// Validate current promo when cart total changes
const validateCurrentPromo = async () => {
    const result = await cartStore.validateCurrentPromo();

    if (!result.valid && result.message) {
        toast.add({
            severity: 'warn',
            detail: result.message,
            life: 4000,
            group: 'cart'
        });
    }
};

const onUpdateQuantity = (item: CartItem, delta: number) => {
    if (isOffline.value) {
        emit('update-quantity', item, delta);
    } else {
        const newQty = item.quantity + delta;
        cartStore.updateQuantity(item.id, newQty);
        if (newQty === 0) {
            toast.add({ severity: 'info', detail: 'Item has been removed from your cart', life: 3000, group: 'cart' });
        }
        validateCurrentPromo();
    }
};

const onRemoveItem = (item: CartItem) => {
    if (isOffline.value) {
        emit('remove-item', item);
    } else {
        cartStore.removeFromCart(item.id);
        toast.add({
            severity: 'info',
            detail: `${item.name} has been removed from your cart`,
            life: 3000,
            group: 'cart'
        });
        validateCurrentPromo();
    }
};

const proceedToCheckout = () => {
    if (isEmpty.value) {
        toast.add({
            severity: 'warn',
            detail: 'Please add items to your cart before checkout',
            life: 3000,
            group: 'cart'
        });
        return;
    }
    router.push('/payment-summary');
    closeModal();
};

const onCompleteSale = () => {
    if (isEmpty.value) return;
    emit('complete-sale', { paymentMethod: paymentMethod.value });
    closeModal();
};

</script>

<template>
    <Dialog :visible="visible" modal class="dialog-flex-end" header="Your Order"
        :style="{ width: '90vw', maxWidth: '600px' }" :breakpoints="{ '1199px': '75vw', '575px': '90vw' }"
        @update:visible="closeModal">
        <CartContent :items="displayItems" :final-total="isOffline ? undefined : finalTotal"
            :show-items-summary="!isOffline"
            :empty-message="isOffline ? 'Add items from the list to get started.' : 'Add some delicious pizzas to get started!'"
            @update-quantity="onUpdateQuantity" @remove-item="onRemoveItem">
            <template #empty-action>
                <Button v-if="!isOffline" label="Pick a Pizza" icon="pi pi-search" @click="closeModal"
                    class="bg-red-500 hover:bg-red-600 border-red-500" />
            </template>
            <template #summary-extra>
                <!-- Online only: delivery + promo. Offline cashier has no discount/coupon. -->
                <template v-if="!isOffline">
                    <div class="flex justify-between items-center mb-2">
                        <span class="text-gray-600 dark:text-gray-400">Delivery Fee</span>
                        <span class="font-medium text-green-600">FREE</span>
                    </div>
                    <div class="flex justify-end mb-2">
                        <div v-if="cartStore.appliedPromo"
                            class="flex w-full justify-between items-center my-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                            <div class="flex items-center space-x-2">
                                <i class="pi pi-tag text-blue-600"></i>
                                <div>
                                    <span class="text-sm font-medium text-blue-800 dark:text-blue-200">{{
                                        cartStore.appliedPromo.code }}</span>
                                    <p class="text-xs text-blue-600 dark:text-blue-400">{{ cartStore.appliedPromo.title
                                        }}</p>
                                </div>
                            </div>
                            <Button icon="pi pi-times" size="small" text severity="secondary" @click="removePromo"
                                class="w-6 h-6 text-gray-400 hover:text-red-500" />
                        </div>
                        <Button v-else label="Apply Promo Code" icon="pi pi-tag" outlined severity="info" size="small"
                            @click="openPromoModal"
                            class="w-auto my-2 border-dashed hover:border-red-500 hover:text-red-500" />
                    </div>
                    <div v-if="cartStore.promoDiscount" class="flex justify-between items-center mb-2">
                        <span class="text-gray-600 dark:text-gray-400">Discount</span>
                        <span class="font-medium text-green-600">-{{ formattedDiscount }}</span>
                    </div>
                </template>
            </template>
            <!-- After total: Payment method (offline only) -->
            <template #footer>
                <div v-if="isOffline" class="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <p class="text-lg font-semibold text-gray-700 dark:text-gray-300 my-3">Payment method</p>
                    <div class="flex gap-3" role="radiogroup" aria-label="Payment method">
                        <label :class="[
                            'flex-1 flex items-center justify-center gap-2 py-1 px-4 rounded-xl border transition-colors cursor-pointer',
                            paymentMethod === 'cash'
                                ? 'border-primary bg-primary/10 text-primary'
                                : 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50 hover:border-gray-300 dark:hover:border-gray-500'
                        ]">
                            <input type="radio" name="offline-payment" value="cash" v-model="paymentMethod"
                                class="sr-only" />
                            <i class="pi pi-money-bill text-2xl"></i>
                            <span class="font-semibold">Cash</span>
                        </label>
                        <label :class="[
                            'flex-1 flex items-center justify-center gap-2 py-1 px-4 rounded-xl border transition-colors cursor-pointer',
                            paymentMethod === 'qris'
                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                                : 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50 hover:border-gray-300 dark:hover:border-gray-500'
                        ]">
                            <input type="radio" name="offline-payment" value="qris" v-model="paymentMethod"
                                class="sr-only" />
                            <i class="pi pi-qrcode text-2xl"></i>
                            <span class="font-semibold">QRIS</span>
                        </label>
                    </div>
                </div>
            </template>
        </CartContent>

        <template #footer>
            <div v-if="!isEmpty" class="flex w-full justify-end gap-2">
                <Button v-if="!isOffline" label="Checkout" @click="proceedToCheckout"
                    class="w-full bg-red-500 hover:bg-red-600 border-red-500" />
                <Button v-else label="Complete sale" icon="pi pi-check" @click="onCompleteSale"
                    class="w-full bg-red-500 hover:bg-red-600 border-red-500" />
            </div>
        </template>
    </Dialog>

    <!-- Promo Modal: online orders only (offline cashier has no discount/coupon) -->
    <PromoModal v-if="!isOffline" :visible="showPromoModal" :userId="'customer_001'" :orderAmount="subtotal"
        :categories="cartStore.cartCategories" @update:visible="showPromoModal = $event"
        @promo-selected="onPromoSelected" />

    <!-- Custom Toast for Cart Actions -->
    <Toast position="top-center" group="cart">
        <template #container="{ message, closeCallback }">
            <section
                class="flex items-center p-4 gap-3 w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
                <i :class="[
                    'text-2xl',
                    message.severity === 'success' ? 'pi pi-check-circle text-green-600' :
                        message.severity === 'info' ? 'pi pi-info-circle text-blue-600' :
                            message.severity === 'warn' ? 'pi pi-exclamation-triangle text-yellow-600' :
                                'pi pi-times-circle text-red-600'
                ]"></i>
                <div class="flex-1">
                    <span class="text-sm font-medium text-gray-900 dark:text-white">{{ message.detail }}</span>
                </div>
                <Button icon="pi pi-times" text size="small" @click="closeCallback"
                    class="w-6 h-6 text-gray-400 hover:text-gray-600" />
            </section>
        </template>
    </Toast>
</template>

<style scoped>
:deep(.p-dialog-content) {
    padding: 1rem;
}
</style>