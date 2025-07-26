<script setup lang="ts">
import PromoModal from '@/components/PromoModal.vue';
import { useCartStore } from '@/stores/cartStore.js';
import { useToast } from 'primevue/usetoast';
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';

interface Props {
    visible: boolean;
}

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

const props = defineProps<Props>();
const emit = defineEmits<{
    'update:visible': [value: boolean];
    'checkout': [];
}>();

const router = useRouter();
const cartStore = useCartStore();
const toast = useToast();

// Promo state
const showPromoModal = ref(false);

// Computed properties
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

const updateQuantity = (itemId: string, newQuantity: number) => {
    cartStore.updateQuantity(itemId, newQuantity);

    if (newQuantity === 0) {
        toast.add({
            severity: 'info',
            detail: 'Item has been removed from your cart',
            life: 3000,
            group: 'cart'
        });
    }

    // Validate promo after cart change
    validateCurrentPromo();
};

const removeItem = (itemId: string, itemName: string) => {
    cartStore.removeFromCart(itemId);
    toast.add({
        severity: 'info',
        detail: `${itemName} has been removed from your cart`,
        life: 3000,
        group: 'cart'
    });

    // Validate promo after cart change
    validateCurrentPromo();
};

const proceedToCheckout = () => {
    if (cartStore.isEmpty) {
        toast.add({
            severity: 'warn',
            detail: 'Please add items to your cart before checkout',
            life: 3000,
            group: 'cart'
        });
        return;
    }

    // Navigate to payment summary page
    router.push('/payment-summary');
    closeModal();
};

</script>

<template>
    <Dialog :visible="visible" modal class="dialog-flex-end" header="Your Order"
        :style="{ width: '90vw', maxWidth: '600px' }" :breakpoints="{ '1199px': '75vw', '575px': '90vw' }"
        @update:visible="closeModal">
        <!-- Empty Cart State -->
        <div v-if="cartStore.isEmpty" class="text-center py-8">
            <i class="pi pi-shopping-cart !text-6xl text-gray-300 mb-0"></i>
            <h3 class="text-xl font-semibold text-gray-600 dark:text-gray-400 mb-2">
                Your cart is empty
            </h3>
            <p class="text-gray-500 dark:text-gray-500 mb-6">
                Add some delicious pizzas to get started!
            </p>
            <Button label="Pick a Pizza" icon="pi pi-search" @click="closeModal"
                class="bg-red-500 hover:bg-red-600 border-red-500" />
        </div>

        <!-- Cart Items -->
        <div v-else class="space-y-4">
            <!-- Cart Items List -->
            <div class="space-y-3">
                <div v-for="item in cartStore.items" :key="item.id"
                    class="flex items-center space-x-4 py-2 border-b border-surface">
                    <!-- Pizza Image -->
                    <div
                        class="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center flex-shrink-0">
                        <i class="pi pi-image text-2xl text-gray-400" v-if="!item.image"></i>
                        <img v-else :src="item.image" :alt="item.name" class="w-full h-full object-cover rounded-lg" />
                    </div>

                    <!-- Item Details -->
                    <div class="flex-1 min-w-0">
                        <h4 class="font-semibold text-gray-900 dark:text-white line-clamp-2 mb-0 text-base">
                            {{ item.name }}
                        </h4>
                        <!-- <p class="text-sm text-gray-600 dark:text-gray-400 truncate">
                            {{ item.description }}
                        </p> -->
                        <p class="text-sm font-medium text-red-600 dark:text-red-400">
                            {{ formatCurrency(item.price) }}
                        </p>
                    </div>

                    <!-- Quantity Controls -->
                    <div class="flex items-center space-x-2 flex-shrink-0">
                        <Button icon="pi pi-minus" size="small" severity="secondary" outlined
                            @click="updateQuantity(item.id, item.quantity - 1)" :disabled="item.quantity <= 1"
                            class="w-8 h-8" />
                        <span class="w-4 text-center font-medium">{{ item.quantity }}</span>
                        <Button icon="pi pi-plus" size="small" severity="secondary" outlined
                            @click="updateQuantity(item.id, item.quantity + 1)" class="w-8 h-8" />
                    </div>

                    <!-- Remove Button -->
                    <Button icon="pi pi-trash" size="small" outlined severity="danger"
                        @click="removeItem(item.id, item.name)" class="w-8 h-8" />
                </div>
            </div>

            <!-- Order Summary -->
            <div class="relative">
                <div class="flex justify-between items-center mb-2">
                    <span class="text-gray-600 dark:text-gray-400">Items ({{ cartStore.totalItems }})</span>
                    <span class="font-medium">{{ formattedSubtotal }}</span>
                </div>
                <div class="flex justify-between items-center mb-2">
                    <span class="text-gray-600 dark:text-gray-400">Delivery Fee</span>
                    <span class="font-medium text-green-600">FREE</span>
                </div>

                <!-- Promo Section -->
                <div class="flex justify-end mb-2">
                    <!-- Applied Promo -->
                    <div v-if="cartStore.appliedPromo"
                        class="flex w-full justify-between items-center my-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                        <div class="flex items-center space-x-2">
                            <i class="pi pi-tag text-blue-600"></i>
                            <div>
                                <span class="text-sm font-medium text-blue-800 dark:text-blue-200">{{
                                    cartStore.appliedPromo.code }}</span>
                                <p class="text-xs text-blue-600 dark:text-blue-400">{{ cartStore.appliedPromo.title }}</p>
                            </div>
                        </div>
                        <div class="flex items-center space-x-2">
                            <!-- <span class="font-medium text-blue-600">-{{ formattedDiscount }}</span> -->
                            <Button icon="pi pi-times" size="small" text severity="secondary" @click="removePromo"
                                class="w-6 h-6 text-gray-400 hover:text-red-500" />
                        </div>
                    </div>

                    <!-- Promo Button -->
                    <Button v-if="!cartStore.appliedPromo" label="Apply Promo Code" icon="pi pi-tag" outlined severity="info"
                        size="small" @click="openPromoModal"
                        class="w-auto my-2 border-dashed hover:border-red-500 hover:text-red-500" />
                </div>

                <!-- Discount Line -->
                <div v-if="cartStore.promoDiscount" class="flex justify-between items-center mb-2">
                    <span class="text-gray-600 dark:text-gray-400">Discount</span>
                    <span class="font-medium text-green-600">-{{ formattedDiscount }}</span>
                </div>

                <div class="border-t border-gray-200 dark:border-gray-700 pt-2">
                    <div class="flex justify-between items-center">
                        <span class="text-lg font-semibold">Total</span>
                        <span class="text-lg font-bold text-red-600">{{ formattedFinalTotal }}</span>
                    </div>
                </div>
            </div>
        </div>

        <template #footer>
            <div v-if="!cartStore.isEmpty" class="flex justify-between gap-2">
                <div class="flex gap-2 ml-auto">
                    <Button label="Checkout" @click="proceedToCheckout"
                        class="bg-red-500 hover:bg-red-600 border-red-500" />
                </div>
            </div>
        </template>
    </Dialog>

    <!-- Promo Modal -->
    <PromoModal :visible="showPromoModal" :userId="'customer_001'" :orderAmount="subtotal" :categories="cartStore.cartCategories"
        @update:visible="showPromoModal = $event" @promo-selected="onPromoSelected" />

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