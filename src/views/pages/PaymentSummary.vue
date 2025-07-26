<script setup lang="ts">
import AppTopbar from '@/layout/AppTopbar.vue';
import NotificationService from '@/service/NotificationService.js';
import PaymentService from '@/service/PaymentService.js';
import { useCartStore } from '@/stores/cartStore.js';
import { useOrderStore } from '@/stores/orderStore.js';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const cartStore = useCartStore();
const orderStore = useOrderStore();
const toast = useToast();

const isProcessingPayment = ref(false);
const paymentWindow = ref<Window | null>(null);

// Computed values for order summary
const deliveryFee = computed(() => 0); // Free delivery
const subtotal = computed(() => cartStore.totalPrice);
const discountAmount = computed(() => cartStore.discountAmount);
const total = computed(() => cartStore.finalTotal + deliveryFee.value);

const goBack = () => {
    router.push('/order/now');
};

// Payment will be handled by Xendit/Midtrans gateway

const createPaymentRequest = async () => {
    const paymentData = {
        external_id: PaymentService.generateExternalId(),
        amount: total.value,
        currency: 'IDR',
        customer: {
            name: orderStore.userLocation?.address || 'Customer',
            email: 'customer@example.com'
        },
        items: cartStore.items.map(item => ({
            name: item.name,
            quantity: item.quantity,
            price: item.price,
            category: item.category
        })),
        delivery_address: orderStore.userLocation,
        chef: orderStore.selectedDriver,
        success_redirect_url: `${window.location.origin}/payment-success`,
        failure_redirect_url: `${window.location.origin}/payment-failed`
    };

    return paymentData;
};

const processPayment = async () => {
    if (cartStore.isEmpty) {
        toast.add({
            severity: 'warn',
            summary: 'Empty Cart',
            detail: 'Your cart is empty. Please add items before checkout.',
            life: 3000
        });
        return;
    }

    isProcessingPayment.value = true;

    try {
        // Create payment request
        const paymentData = await createPaymentRequest();

        // Use PaymentService to create payment (in production, this calls your backend)
        // For demo, we use the simulate method
        const paymentResponse = await PaymentService.simulatePayment(paymentData);

        // Add to pending payments for status tracking
        NotificationService.addPendingPayment(paymentData);

        // Open payment gateway in new tab
        paymentWindow.value = window.open(paymentResponse.checkout_url, '_blank', 'width=800,height=600,scrollbars=yes,resizable=yes');

        // Monitor payment window
        const checkClosed = setInterval(() => {
            if (paymentWindow.value?.closed) {
                clearInterval(checkClosed);
                handlePaymentWindowClosed();
            }
        }, 1000);

        // Simulate payment callback for demo (in real app, this comes from Xendit webhook)
        NotificationService.simulatePaymentCallback(paymentData.external_id, 'PAID');

        toast.add({
            severity: 'info',
            summary: 'Payment Gateway Opened',
            detail: 'Complete your payment in the new tab that opened.',
            life: 5000
        });

    } catch (error) {
        console.error('Payment error:', error);
        toast.add({
            severity: 'error',
            summary: 'Payment Error',
            detail: 'Failed to process payment. Please try again.',
            life: 3000
        });
    } finally {
        isProcessingPayment.value = false;
    }
};

// Setup notification listeners
const setupNotificationListeners = () => {
    NotificationService.on('show_toast', (toastData) => {
        toast.add(toastData);
    });

    NotificationService.on('payment_update', (notification) => {
        console.log('Payment update received:', notification);

        // Handle successful payment
        if (notification.status === 'PAID') {
            // Clear cart and redirect to success page after a delay
            setTimeout(() => {
                cartStore.clearCart();
                router.push('/order/my');
            }, 3000);
        }
    });
};

const handlePaymentWindowClosed = () => {
    toast.add({
        severity: 'info',
        summary: 'Payment Window Closed',
        detail: 'We\'ll notify you once payment status is confirmed.',
        life: 3000
    });
};

// Cleanup function
const cleanup = () => {
    NotificationService.off('show_toast', () => { });
    NotificationService.off('payment_update', () => { });
};

// Check if cart is empty on mount
onMounted(() => {
    if (cartStore.isEmpty) {
        toast.add({
            severity: 'warn',
            summary: 'No Items',
            detail: 'Your cart is empty. Redirecting to menu...',
            life: 3000
        });
        setTimeout(() => {
            router.push('/order/now');
        }, 2000);
        return;
    }

    // Initialize notification system
    NotificationService.init();
    setupNotificationListeners();
});

onUnmounted(() => {
    cleanup();
});
</script>

<template>
    <div class="bg-surface-0 dark:bg-surface-900">
        <div class="landing-wrapper overflow-hidden">
            <app-topbar variant="page-header" page-title="Payment Summary" @back="goBack"></app-topbar>

            <div class="relative lg:mx-80 mx-auto pt-16 md:pt-16 mb-32">
                <div class="relative p-4 md:p-0">

                    <!-- Order Summary Section -->
                    <div
                        class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-6">
                        <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-4">Order Summary</h2>

                        <!-- Delivery Info -->
                        <div class="mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                            <div class="flex items-start space-x-3">
                                <i class="pi pi-map-marker text-green-600 mt-1"></i>
                                <div>
                                    <p class="font-medium text-gray-900 dark:text-white mb-0">Delivery Address</p>
                                    <p class="text-sm text-gray-600 dark:text-gray-400">{{
                                        orderStore.userLocation?.address }}</p>
                                </div>
                            </div>
                            <div class="flex items-start space-x-3 mt-3">
                                <i class="pi pi-user text-blue-600 mt-1"></i>
                                <div>
                                    <p class="font-medium text-gray-900 dark:text-white mb-0">Chef</p>
                                    <p class="text-sm text-gray-600 dark:text-gray-400">{{
                                        orderStore.selectedDriver?.name }}</p>
                                </div>
                            </div>
                        </div>

                        <!-- Items List -->
                        <div class="space-y-3 mb-4">
                            <div v-for="item in cartStore.items" :key="item.id"
                                class="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700 last:border-b-0">
                                <div class="flex-1">
                                    <p class="font-medium text-gray-900 dark:text-white mb-0">{{ item.name }}</p>
                                    <p class="text-sm text-gray-500 dark:text-gray-400">{{ item.quantity }} × Rp{{
                                        item.price.toLocaleString('id-ID') }}</p>
                                </div>
                                <p class="font-medium text-gray-900 dark:text-white">Rp{{ (item.price *
                                    item.quantity).toLocaleString('id-ID') }}</p>
                            </div>
                        </div>

                        <!-- Price Breakdown -->
                        <div class="border-t border-gray-200 dark:border-gray-700 pt-4">
                            <div class="flex justify-between items-center mb-2">
                                <span class="text-gray-600 dark:text-gray-400">Subtotal</span>
                                <span class="font-medium">{{ cartStore.formattedTotalPrice }}</span>
                            </div>
                            <div class="flex justify-between items-center mb-2">
                                <span class="text-gray-600 dark:text-gray-400">Delivery Fee</span>
                                <span class="font-medium text-green-600">FREE</span>
                            </div>

                            <!-- Applied Promo Display -->
                            <div v-if="cartStore.appliedPromo"
                                class="flex justify-between items-center mb-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
                                <div class="flex items-center space-x-2">
                                    <i class="pi pi-tag text-blue-600"></i>
                                    <div>
                                        <span class="text-sm font-medium text-blue-800 dark:text-blue-200">{{
                                            cartStore.appliedPromo.code }}</span>
                                        <p class="text-xs text-blue-600 dark:text-blue-400 mb-0">{{
                                            cartStore.appliedPromo.title }}</p>
                                    </div>
                                </div>
                                <!-- <span class="font-medium text-green-600">-{{ cartStore.formattedDiscount }}</span> -->
                            </div>

                            <!-- Discount Line -->
                            <div v-if="cartStore.promoDiscount" class="flex justify-between items-center mb-2">
                                <span class="text-gray-600 dark:text-gray-400">Discount</span>
                                <span class="font-medium text-green-600">-{{ cartStore.formattedDiscount }}</span>
                            </div>

                            <div class="border-t border-gray-200 dark:border-gray-700 pt-2">
                                <div class="flex justify-between items-center">
                                    <span class="text-lg font-semibold">Total</span>
                                    <span class="text-lg font-bold text-red-600">{{ cartStore.formattedFinalTotal
                                        }}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Payment Gateway Info -->
                    <div
                        class="shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-6 flex items-center space-x-3 p-4 gap-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                        <!-- <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-4">Payment</h2> -->

                        <!-- <div class="flex items-center space-x-3 p-4 gap-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg"> -->
                        <i class="pi pi-shield text-blue-600 !text-2xl"></i>
                        <div>
                            <p class="font-medium text-gray-900 dark:text-white mb-1">Secure Payment</p>
                            <p class="text-sm text-gray-600 dark:text-gray-400">
                                Choose from various payment methods including Credit Card, Bank Transfer, E-Wallet
                                (OVO, GoPay, Dana), and QRIS in the next step.
                            </p>
                        </div>
                        <!-- </div> -->
                    </div>

                    <!-- Action Buttons -->
                    <div
                        class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                        <div class="flex gap-4">
                            <Button label="Back to Cart" outlined @click="goBack" class="flex-1" />
                            <Button label="Pay Now" :loading="isProcessingPayment" @click="processPayment"
                                class="flex-1 bg-red-500 hover:bg-red-600 border-red-500" />
                        </div>

                        <p class="text-xs text-gray-500 dark:text-gray-400 text-center mt-3">
                            Your payment will be processed securely through Xendit
                        </p>
                    </div>

                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.landing-wrapper {
    min-height: 100vh;
}
</style>