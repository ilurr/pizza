<script setup>
import CartModal from '@/components/CartModal.vue';
import { FALLBACK_PRODUCT_IMAGE_URL } from '@/constants/media.js';
import FloatingCart from '@/components/FloatingCart.vue';
import { ProductService } from '@/service/ProductService.js';
import api from '@/services/api/index.js';
import { useUserStore } from '@/stores/userStore';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const toast = useToast();
const userStore = useUserStore();

const activeCategory = ref('pizzas');
const menu = ref({ pizzas: [], beverages: [] });
const cart = ref([]);
const showCartModal = ref(false);
const isLoading = ref(true);
const loadError = ref(null);
const isStockLoading = ref(false);
const stockReady = ref(false);
// Per pizza `id` max portions derived from driver stock + product BOM
const pizzaStockLimitById = ref({});

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
        const data = await Promise.race([ProductService.getMenu(), new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), MENU_LOAD_TIMEOUT_MS))]);
        menu.value = {
            // Hide unavailable items on walk-in cashier
            pizzas: (data?.pizzas || []).filter((p) => p?.available !== false),
            beverages: (data?.beverages || []).filter((b) => b?.available !== false)
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

const refreshMenuAndStock = async () => {
    await loadMenu();
    await loadDriverStockForMvp();
};

const driverId = computed(() => {
    const id = userStore.user?.id;
    return id == null || id === '' ? '' : String(id);
});

const loadDriverStockForMvp = async () => {
    if (!driverId.value) {
        stockReady.value = true;
        pizzaStockLimitById.value = {};
        return;
    }
    isStockLoading.value = true;
    stockReady.value = false;
    try {
        // Current ingredient stock for this driver
        const stockRes = await api.drivers.getDriverStock(driverId.value);
        const stock = stockRes?.success && stockRes.data?.stock ? stockRes.data.stock : [];
        const stockByStockProductId = {};
        (stock || []).forEach((i) => {
            const pid = i.productId || i.id;
            stockByStockProductId[pid] = Number(i.currentStock ?? 0);
        });

        const fallbackRecipeRes = await api.stockRecipes.getProductStockRecipe('__default_pizza__');
        const fallbackLines = fallbackRecipeRes?.success && fallbackRecipeRes.data?.lines ? fallbackRecipeRes.data.lines : [];

        const getMaxPortionsForRecipeLines = (recipeLines) => {
            if (!Array.isArray(recipeLines) || recipeLines.length === 0) return 0;
            let maxPortions = Number.POSITIVE_INFINITY;
            for (const line of recipeLines) {
                const have = stockByStockProductId[line.stockProductId] ?? 0;
                const perPortion = Number(line.quantity ?? 0);
                if (!perPortion || perPortion <= 0) continue;
                maxPortions = Math.min(maxPortions, Math.floor(have / perPortion));
            }
            if (!Number.isFinite(maxPortions)) maxPortions = 0;
            return Math.max(0, maxPortions);
        };

        const limits = {};
        const pizzas = menu.value.pizzas || [];

        for (const pizza of pizzas) {
            const pid = pizza?.id;
            if (!pid) continue;

            // MVP: try per-product recipe first; fallback to default BOM.
            const recipeRes = await api.stockRecipes.getProductStockRecipe(String(pid));
            const specificLines = recipeRes?.success && recipeRes.data?.lines ? recipeRes.data.lines : [];
            const effectiveLines = specificLines.length ? specificLines : fallbackLines;
            limits[String(pid)] = getMaxPortionsForRecipeLines(effectiveLines);
        }

        pizzaStockLimitById.value = limits;
        menu.value.pizzas = pizzas.map((p) => ({ ...p, stock: limits[String(p.id)] ?? 0 }));
        stockReady.value = true;
    } catch (e) {
        console.error('[Offline Cashier] load stock failed:', e);
        pizzaStockLimitById.value = {};
        stockReady.value = true;
    } finally {
        isStockLoading.value = false;
    }
};

const addToCart = (product, type = 'pizza') => {
    // MVP: disable pizza add when ingredient stock is empty.
    if (type === 'pizza' && stockReady.value) {
        const limit = Number(pizzaStockLimitById.value[String(product.id)] ?? 0);
        if (limit <= 0) {
            toast.add({
                severity: 'warn',
                summary: 'Stock habis',
                detail: 'Stok bahan pembuat pizza Anda kosong. Hubungi admin / lakukan exchange.',
                life: 3000
            });
            return;
        }

        const existing = cart.value.find((i) => i.id === product.id && i.type === type);
        if (existing && existing.quantity >= limit) {
            toast.add({
                severity: 'warn',
                summary: 'Stock limit',
                detail: 'Jumlah pizza di cart sudah mencapai batas stok bahan Anda.',
                life: 3000
            });
            return;
        }
    }
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
    const nextQty = (item.quantity ?? 0) + delta;

    if (item.type === 'pizza' && stockReady.value) {
        const limit = Number(pizzaStockLimitById.value[String(item.id)] ?? 0);
        if (delta > 0 && nextQty > limit) {
            toast.add({
                severity: 'warn',
                summary: 'Stock limit',
                detail: 'Jumlah pizza di cart melebihi batas stok bahan Anda.',
                life: 3000
            });
            return;
        }
    }

    item.quantity = nextQty;
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

// Totals per pizza `id` in the cart (used for per-product stock limits).
const cartPizzaQtyById = computed(() => {
    const map = {};
    for (const item of cart.value) {
        if (item.type !== 'pizza') continue;
        const pid = String(item.id);
        map[pid] = (map[pid] ?? 0) + (item.quantity || 0);
    }
    return map;
});

const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount).replace(/\s/g, '');
};

const onCompleteSale = async (payload) => {
    const method = payload?.paymentMethod || 'cash';
    if (!cart.value.length) return;

    // Final guard: never allow checkout when cart exceeds per-pizza ingredient stock limits.
    if (stockReady.value) {
        for (const line of cart.value.filter((i) => i.type === 'pizza')) {
            const limit = Number(pizzaStockLimitById.value[String(line.id)] ?? 0);
            if (limit <= 0 || (line.quantity || 0) > limit) {
                toast.add({
                    severity: 'warn',
                    summary: 'Stock limit',
                    detail: 'Jumlah pizza di cart melebihi stok bahan Anda.',
                    life: 3500
                });
                return;
            }
        }
    }

    try {
        const items = cart.value.map((i) => ({
            id: i.id,
            name: i.name,
            price: i.price,
            quantity: i.quantity,
            type: i.type
        }));

        const driverIdVal = driverId.value;
        if (!driverIdVal) {
            toast.add({
                severity: 'error',
                summary: 'Driver not found',
                detail: 'Silakan login sebagai driver dulu.',
                life: 3500
            });
            return;
        }

        const subtotalVal = subtotal.value;
        const orderData = {
            customerId: 'guest_user',
            customerName: 'Walk-in Customer',
            customerEmail: '',
            customerPhone: '',
            items,
            subtotal: subtotalVal,
            deliveryFee: 0,
            discount: 0,
            total: subtotalVal,
            paymentMethod: method === 'qris' ? 'QRIS' : 'cash',
            deliveryAddress: {},
            estimatedDelivery: new Date(Date.now() + 45 * 60000).toISOString(),
            notes: '',
            driverId: driverIdVal,
            driverInfo: null,
            promoCode: null,
            promoTitle: null
        };

        const res = await api.orders.createOrder(orderData);
        if (res?.success && res?.data?.order?.id) {
            // Walk-in sales should be directly marked as delivered (offline sold),
            // so driver doesn't need status progression. Backend will also deduct stock.
            // Cash walk-in: OrdersApiService sets payment_status paid (guest_user + cash). QRIS: set paid here.
            const deliveredExtras = method === 'qris' ? { payment_status: 'paid' } : {};
            const upd = await api.orders.updateOrderStatus(res.data.order.id, 'delivered', deliveredExtras);
            if (!upd?.success) {
                toast.add({
                    severity: 'error',
                    summary: 'Stock deduction failed',
                    detail: upd?.error?.message || 'Gagal menyelesaikan penjualan',
                    life: 4500
                });
                return;
            }
        } else {
            toast.add({
                severity: 'error',
                summary: 'Order failed',
                detail: res?.error?.message || 'Could not create order',
                life: 4000
            });
            return;
        }

        toast.add({
            severity: 'success',
            summary: 'Sale completed',
            detail: `${method === 'cash' ? 'Cash' : 'QRIS'} · ${formatCurrency(subtotalVal)}`,
            life: 3000
        });

        cart.value = [];
        router.push('/driver');
    } catch (e) {
        console.error('[Offline Cashier] complete sale failed:', e);
        toast.add({
            severity: 'error',
            summary: 'Error',
            detail: e?.message || 'Failed to complete sale',
            life: 4000
        });
    }
};

const goBack = () => router.push('/driver');

const productsToShow = computed(() => {
    return activeCategory.value === 'pizzas' ? menu.value.pizzas : menu.value.beverages;
});

const cartTotalItems = computed(() => cart.value.reduce((s, i) => s + (i.quantity || 0), 0));

onMounted(async () => {
    await loadMenu();
    await loadDriverStockForMvp();
});
</script>

<template>
    <div class="p-4 pb-28">
        <div v-if="isLoading" class="flex justify-center py-12">
            <ProgressSpinner style="width: 48px; height: 48px" />
        </div>

        <!-- Error state: show what went wrong (Supabase, network, timeout, etc.) -->
        <div v-else-if="loadError" class="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-6">
            <div class="flex items-start gap-3">
                <i class="pi pi-exclamation-triangle text-2xl text-red-500 shrink-0 mt-0.5"></i>
                <div class="min-w-0 flex-1">
                    <h3 class="font-semibold text-red-800 dark:text-red-200 mb-1">Failed to load menu</h3>
                    <p class="text-sm text-red-700 dark:text-red-300 break-words">{{ loadError }}</p>
                    <p class="text-xs text-red-600 dark:text-red-400 mt-2">Check your internet connection and Supabase config (VITE_DATA_SOURCE, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY). See console for details.</p>
                    <Button
                        label="Try again"
                        icon="pi pi-refresh"
                        loadingIcon="pi pi-spinner animate-spin"
                        class="mt-4"
                        @click="loadMenu"
                        :loading="isLoading"
                    />
                </div>
            </div>
        </div>

        <template v-else>
            <!-- Product list + Refresh -->
            <div class="flex items-center justify-between mb-4">
                <h2 class="text-surface-900 dark:text-surface-0 text-xl font-bold mb-0 text-left">Product list</h2>
                <Button
                    label="Refresh"
                    icon="pi pi-refresh"
                    loadingIcon="pi pi-spinner animate-spin"
                    outlined
                    size="small"
                    :loading="isLoading"
                    @click="refreshMenuAndStock"
                />
            </div>

            <!-- Category tabs -->
            <div class="flex gap-2 mb-4">
                <Button :label="`Pizza (${menu.pizzas.length})`" :severity="activeCategory === 'pizzas' ? 'primary' : 'secondary'" outlined size="small" @click="activeCategory = 'pizzas'" />
                <Button :label="`Beverages (${menu.beverages.length})`" :severity="activeCategory === 'beverages' ? 'primary' : 'secondary'" outlined size="small" @click="activeCategory = 'beverages'" />
            </div>

            <div class="space-y-4">
                <!-- Product list: image, name, stock, price, + button -->
                <div class="space-y-0">
                    <div
                        v-for="product in productsToShow"
                        :key="product.id"
                        class="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 hover:bg-gray-50 dark:hover:bg-neutral-700/80 transition-colors"
                    >
                        <div class="shrink-0 w-14 h-14 rounded-xl overflow-hidden bg-gray-100 dark:bg-neutral-700 flex items-center justify-center">
                            <img :src="product.imageUrl || product.image || fallbackImageUrl" :alt="product.name" @error="handleProductImageError" class="w-full h-full object-cover" />
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="font-medium text-gray-900 dark:text-white truncate">{{ product.name }}</div>
                            <div class="text-sm text-gray-500 dark:text-gray-400">Stock: {{ product.stock ?? '-' }}</div>
                        </div>
                        <div class="shrink-0 text-sm font-medium text-gray-900 dark:text-white">{{ formatCurrency(product.price) }}</div>
                        <Button
                            icon="pi pi-plus"
                            rounded
                            size="small"
                            severity="danger"
                            class="!w-10 !h-10 !p-0 shrink-0"
                            :disabled="
                                activeCategory === 'pizzas' &&
                                stockReady &&
                                ((product.stock ?? 0) <= 0 || (cartPizzaQtyById[String(product.id)] ?? 0) >= (product.stock ?? 0))
                            "
                            :loading="isStockLoading"
                            @click="addToCart(product, activeCategory === 'pizzas' ? 'pizza' : 'beverage')"
                        />
                    </div>
                    <p v-if="productsToShow.length === 0" class="text-center text-gray-500 dark:text-gray-400 py-6">No items in this category.</p>
                </div>
            </div>

            <!-- Cart modal: same as user (CartModal) with Cash/QRIS + Complete sale -->
            <CartModal variant="offline" :visible="showCartModal" :items="cart" @update:visible="showCartModal = $event" @update-quantity="updateQty" @remove-item="removeFromCart" @complete-sale="onCompleteSale" />

            <!-- Same FloatingCart as user; higher position (bottom-20) so it sits above driver bottom menu -->
            <FloatingCart :visible="true" :total-items="cartTotalItems" :formatted-total="formatCurrency(subtotal)" bottom-class="bottom-20 md:bottom-24" @show-cart="showCartModal = true" />
        </template>
    </div>
</template>
