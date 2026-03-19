<script setup>
import CartModal from '@/components/CartModal.vue';
import { FALLBACK_PRODUCT_IMAGE_URL } from '@/constants/media.js';
import FloatingCart from '@/components/FloatingCart.vue';
import { ProductService } from '@/service/ProductService.js';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const toast = useToast();

const activeCategory = ref('pizzas');
const menu = ref({ pizzas: [], beverages: [] });
const cart = ref([]);
const showCartModal = ref(false);
const isLoading = ref(true);
const loadError = ref(null);

const MENU_LOAD_TIMEOUT_MS = 12_000;
const fallbackImageUrl = FALLBACK_PRODUCT_IMAGE_URL;

const handleProductImageError = (event) => {
    const img = event.target;
    if (img && img.src !== fallbackImageUrl) img.src = fallbackImageUrl;
};

const loadMenu = async () => {
    isLoading.value = true;
    loadError.value = null;
    try {
        const data = await Promise.race([
            ProductService.getMenu(),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('timeout')), MENU_LOAD_TIMEOUT_MS)
            )
        ]);
        menu.value = {
            pizzas: data?.pizzas || [],
            beverages: data?.beverages || []
        };
    } catch (e) {
        const message = e?.message || String(e);
        loadError.value = message;
        console.error('[Offline Cashier] Failed to load menu:', message, e);
        toast.add({
            severity: 'error',
            summary: 'Failed to load menu',
            detail: message,
            life: 6000
        });
    } finally {
        isLoading.value = false;
    }
};

const addToCart = (product, type = 'pizza') => {
    const id = product.id;
    const existing = cart.value.find((i) => i.id === id && i.type === type);
    if (existing) {
        existing.quantity += 1;
    } else {
        cart.value.push({
            id: product.id,
            type,
            name: product.name,
            price: product.price,
            quantity: 1,
            image: product.image || product.imageUrl
        });
    }
};

const updateQty = (item, delta) => {
    item.quantity += delta;
    if (item.quantity <= 0) {
        cart.value = cart.value.filter((i) => !(i.id === item.id && i.type === item.type));
    }
};

const removeFromCart = (item) => {
    cart.value = cart.value.filter((i) => !(i.id === item.id && i.type === item.type));
};

const subtotal = computed(() => {
    return cart.value.reduce((sum, i) => sum + i.price * i.quantity, 0);
});

const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount).replace(/\s/g, '');
};

const onCompleteSale = (payload) => {
    const method = payload?.paymentMethod || 'cash';
    // TODO: persist offline order to backend (order_type: 'offline', payment_method, items)
    toast.add({
        severity: 'success',
        summary: 'Sale completed',
        detail: `${method === 'cash' ? 'Cash' : 'QRIS'} · ${formatCurrency(subtotal.value)}`,
        life: 3000
    });
    cart.value = [];
    router.push('/driver');
};

const goBack = () => router.push('/driver');

const productsToShow = computed(() => {
    return activeCategory.value === 'pizzas' ? menu.value.pizzas : menu.value.beverages;
});

const cartTotalItems = computed(() => cart.value.reduce((s, i) => s + (i.quantity || 0), 0));

onMounted(() => loadMenu());
</script>

<template>
    <div class="p-4 pb-28">
        <div v-if="isLoading" class="flex justify-center py-12">
            <ProgressSpinner style="width: 48px; height: 48px" />
        </div>

        <!-- Error state: show what went wrong (Supabase, network, timeout, etc.) -->
        <div v-else-if="loadError"
            class="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-6">
            <div class="flex items-start gap-3">
                <i class="pi pi-exclamation-triangle text-2xl text-red-500 shrink-0 mt-0.5"></i>
                <div class="min-w-0 flex-1">
                    <h3 class="font-semibold text-red-800 dark:text-red-200 mb-1">Failed to load menu</h3>
                    <p class="text-sm text-red-700 dark:text-red-300 break-words">{{ loadError }}</p>
                    <p class="text-xs text-red-600 dark:text-red-400 mt-2">
                        Check your internet connection and Supabase config (VITE_DATA_SOURCE, VITE_SUPABASE_URL,
                        VITE_SUPABASE_ANON_KEY). See console for details.
                    </p>
                    <Button label="Try again" icon="pi pi-refresh" class="mt-4" @click="loadMenu"
                        :loading="isLoading" />
                </div>
            </div>
        </div>

        <template v-else>
            <!-- Product list + Refresh -->
            <div class="flex items-center justify-between mb-4">
                <h2 class="text-surface-900 dark:text-surface-0 text-xl font-bold mb-0 text-left">Product list</h2>
                <Button label="Refresh" icon="pi pi-refresh" outlined size="small" :loading="isLoading"
                    @click="loadMenu" />
            </div>

            <!-- Category tabs -->
            <div class="flex gap-2 mb-4">
                <Button :label="`Pizza (${menu.pizzas.length})`"
                    :severity="activeCategory === 'pizzas' ? 'primary' : 'secondary'" outlined size="small"
                    @click="activeCategory = 'pizzas'" />
                <Button :label="`Beverages (${menu.beverages.length})`"
                    :severity="activeCategory === 'beverages' ? 'primary' : 'secondary'" outlined size="small"
                    @click="activeCategory = 'beverages'" />
            </div>

            <div class="space-y-4">
                <!-- Product list: image, name, stock, price, + button -->
                <div class="space-y-0">
                    <div v-for="product in productsToShow" :key="product.id"
                        class="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 hover:bg-gray-50 dark:hover:bg-neutral-700/80 transition-colors">
                        <div
                            class="shrink-0 w-14 h-14 rounded-xl overflow-hidden bg-gray-100 dark:bg-neutral-700 flex items-center justify-center">
                            <img
                                :src="product.imageUrl || product.image || fallbackImageUrl"
                                :alt="product.name"
                                @error="handleProductImageError"
                                class="w-full h-full object-cover"
                            />
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="font-medium text-gray-900 dark:text-white truncate">{{ product.name }}</div>
                            <div class="text-sm text-gray-500 dark:text-gray-400">Stock: {{ product.stock ?? '-' }}
                            </div>
                        </div>
                        <div class="shrink-0 text-sm font-medium text-gray-900 dark:text-white">{{
                            formatCurrency(product.price) }}</div>
                        <Button icon="pi pi-plus" rounded size="small" severity="danger"
                            class="!w-10 !h-10 !p-0 shrink-0"
                            @click="addToCart(product, activeCategory === 'pizzas' ? 'pizza' : 'beverage')" />
                    </div>
                    <p v-if="productsToShow.length === 0" class="text-center text-gray-500 dark:text-gray-400 py-6">No
                        items in this category.</p>
                </div>
            </div>

            <!-- Cart modal: same as user (CartModal) with Cash/QRIS + Complete sale -->
            <CartModal variant="offline" :visible="showCartModal" :items="cart" @update:visible="showCartModal = $event"
                @update-quantity="updateQty" @remove-item="removeFromCart" @complete-sale="onCompleteSale" />

            <!-- Same FloatingCart as user; higher position (bottom-20) so it sits above driver bottom menu -->
            <FloatingCart :visible="true" :total-items="cartTotalItems" :formatted-total="formatCurrency(subtotal)"
                bottom-class="bottom-20 md:bottom-24" @show-cart="showCartModal = true" />
        </template>
    </div>
</template>
