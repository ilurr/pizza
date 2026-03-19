<script setup lang="ts">
import api from '@/services/api/index.js';
import { FALLBACK_PRODUCT_IMAGE_URL } from '@/constants/media.js';
import { getSupabaseClient } from '@/services/supabase/client.js';
import { ROLES } from '@/constants/roles.js';
import { useUserStore } from '@/stores/userStore';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, ref } from 'vue';

type ProductType = 'all' | 'pizza' | 'beverage';
type AvailabilityType = 'all' | 'available' | 'unavailable';

const typeOptions = [
    { label: 'Semua', value: 'all' as ProductType },
    { label: 'Pizza', value: 'pizza' as ProductType },
    { label: 'Beverage', value: 'beverage' as ProductType }
];

const availabilityOptions = [
    { label: 'Semua', value: 'all' as AvailabilityType },
    { label: 'Available', value: 'available' as AvailabilityType },
    { label: 'Unavailable', value: 'unavailable' as AvailabilityType }
];

const isLoading = ref(false);
const isSubmitting = ref(false);
const search = ref('');
const selectedType = ref<ProductType>('all');
const selectedAvailability = ref<AvailabilityType>('all');
const selectedCategory = ref<string | null>(null);

const categories = ref<string[]>([]);
const rows = ref<any[]>([]);
const userStore = useUserStore();
const toast = useToast();

const canManageProducts = computed(() => userStore.role === ROLES.SUPERADMIN);
const canViewPriceHistory = computed(() => [ROLES.SUPERADMIN, ROLES.MITRA].includes(userStore.role));

const productDialogVisible = ref(false);
const historyDialogVisible = ref(false);
const editingRow = ref<any | null>(null);
const selectedHistoryProduct = ref<any | null>(null);
const isHistoryLoading = ref(false);
const priceHistoryRows = ref<any[]>([]);
const form = ref({
    type: 'pizza' as ProductType,
    name: '',
    category: '',
    description: '',
    price: 0,
    image: '',
    available: true,
    changeReason: ''
});

const formatCurrency = (amount: number) => {
    const formatted = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount || 0);
    return formatted.replace(/\s/g, '');
};
const fallbackImageUrl = FALLBACK_PRODUCT_IMAGE_URL;
const handleProductImageError = (event: Event) => {
    const img = event.target as HTMLImageElement | null;
    if (img && img.src !== fallbackImageUrl) {
        img.src = fallbackImageUrl;
    }
};
const formatDateTime = (iso: string) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' });
};

const categoryOptions = computed(() => [{ label: 'Semua kategori', value: null }, ...categories.value.map((c) => ({ label: c, value: c }))]);

const filteredRows = computed(() => {
    const q = search.value.trim().toLowerCase();
    return rows.value.filter((r: any) => {
        if (selectedType.value !== 'all' && r.type !== selectedType.value) return false;
        if (selectedAvailability.value === 'available' && !r.available) return false;
        if (selectedAvailability.value === 'unavailable' && r.available) return false;
        if (selectedCategory.value && r.category !== selectedCategory.value) return false;
        if (!q) return true;
        return (
            String(r.name || '').toLowerCase().includes(q) ||
            String(r.category || '').toLowerCase().includes(q) ||
            String(r.description || '').toLowerCase().includes(q)
        );
    });
});

const summary = computed(() => {
    const total = rows.value.length;
    const pizzas = rows.value.filter((r: any) => r.type === 'pizza').length;
    const beverages = rows.value.filter((r: any) => r.type === 'beverage').length;
    const available = rows.value.filter((r: any) => r.available).length;
    return { total, pizzas, beverages, available };
});

const loadProducts = async () => {
    isLoading.value = true;
    try {
        const res = await api.products.getMenu({});
        const pizzas = res?.success && res?.data?.pizzas ? res.data.pizzas : [];
        const beverages = res?.success && res?.data?.beverages ? res.data.beverages : [];

        const mappedPizzas = pizzas.map((p: any) => ({
            id: p.id,
            type: 'pizza',
            name: p.name,
            category: p.category,
            description: p.description,
            price: Number(p.price || 0),
            available: p.available !== false,
            popular: !!p.popular,
            rating: Number(p.rating || 0),
            image: p.image
        }));

        const mappedBeverages = beverages.map((b: any) => ({
            id: b.id,
            type: 'beverage',
            name: b.name,
            category: b.category,
            description: b.description,
            price: Number(b.price || 0),
            available: b.available !== false,
            popular: false,
            rating: 0,
            image: b.image
        }));

        rows.value = [...mappedPizzas, ...mappedBeverages];

        const cats = new Set<string>();
        rows.value.forEach((r: any) => {
            if (r.category) cats.add(r.category);
        });
        categories.value = Array.from(cats).sort((a, b) => a.localeCompare(b));
    } catch (e) {
        console.error('[AdminProducts] Failed to load products:', e);
        rows.value = [];
        categories.value = [];
    } finally {
        isLoading.value = false;
    }
};

const resetFilters = () => {
    search.value = '';
    selectedType.value = 'all';
    selectedAvailability.value = 'all';
    selectedCategory.value = null;
};

const openAddDialog = () => {
    editingRow.value = null;
    form.value = {
        type: 'pizza',
        name: '',
        category: '',
        description: '',
        price: 0,
        image: '',
        available: true,
        changeReason: ''
    };
    productDialogVisible.value = true;
};

const openEditDialog = (row: any) => {
    editingRow.value = row;
    form.value = {
        type: row.type,
        name: row.name || '',
        category: row.category || '',
        description: row.description || '',
        price: Number(row.price || 0),
        image: row.image || '',
        available: row.available !== false,
        changeReason: ''
    };
    productDialogVisible.value = true;
};

const saveProduct = async () => {
    if (!canManageProducts.value) return;
    if (!form.value.name.trim()) {
        toast.add({ severity: 'warn', summary: 'Validation', detail: 'Product name is required.', life: 2500 });
        return;
    }
    const supabase = getSupabaseClient();
    if (!supabase) {
        toast.add({ severity: 'error', summary: 'Supabase', detail: 'Supabase not configured.', life: 3000 });
        return;
    }

    isSubmitting.value = true;
    try {
        const previousPrice = Number(editingRow.value?.price ?? 0);
        const nextPrice = Number(form.value.price ?? 0);
        const isPriceChanged = !!editingRow.value && previousPrice !== nextPrice;

        const table = form.value.type === 'pizza' ? 'pizzas' : 'beverages';
        const payload: any = {
            name: form.value.name.trim(),
            category: form.value.category || null,
            description: form.value.description || null,
            price: nextPrice,
            image: form.value.image || null,
            available: form.value.available
        };
        if (table === 'pizzas') {
            payload.popular = editingRow.value?.popular ?? false;
            payload.rating = editingRow.value?.rating ?? 0;
            payload.cooking_time = editingRow.value?.cookingTime ?? 15;
        } else {
            payload.type = editingRow.value?.type === 'beverage' ? (editingRow.value?.beverageType || 'cold') : 'cold';
        }

        let error: any = null;
        if (editingRow.value) {
            ({ error } = await supabase.from(table).update(payload).eq('id', editingRow.value.id));
        } else {
            ({ error } = await supabase.from(table).insert(payload));
        }

        if (error) throw error;

        if (isPriceChanged) {
            const priceHistoryRes = await api.products.recordPriceChange({
                productType: form.value.type,
                productId: editingRow.value.id,
                oldPrice: previousPrice,
                newPrice: nextPrice,
                changeReason: form.value.changeReason || null,
                changedBy: userStore.user?.id ?? null
            });
            if (!priceHistoryRes?.success) {
                console.warn('[AdminProducts] Price updated but history insert failed:', priceHistoryRes?.error);
                toast.add({
                    severity: 'warn',
                    summary: 'Price updated',
                    detail: 'Product updated but price history was not saved. Please check DB permission.',
                    life: 4500
                });
            }
        }

        toast.add({
            severity: 'success',
            summary: 'Saved',
            detail: editingRow.value ? 'Product updated successfully.' : 'Product created successfully.',
            life: 2500
        });
        productDialogVisible.value = false;
        await loadProducts();
    } catch (e: any) {
        console.error('[AdminProducts] Save failed:', e);
        toast.add({ severity: 'error', summary: 'Failed', detail: e?.message || 'Failed to save product.', life: 3000 });
    } finally {
        isSubmitting.value = false;
    }
};

const removeProduct = async (row: any) => {
    if (!canManageProducts.value) return;
    const ok = window.confirm(`Delete product "${row.name}"?`);
    if (!ok) return;

    const supabase = getSupabaseClient();
    if (!supabase) {
        toast.add({ severity: 'error', summary: 'Supabase', detail: 'Supabase not configured.', life: 3000 });
        return;
    }
    try {
        const table = row.type === 'pizza' ? 'pizzas' : 'beverages';
        const { error } = await supabase.from(table).delete().eq('id', row.id);
        if (error) throw error;
        toast.add({ severity: 'success', summary: 'Deleted', detail: 'Product deleted successfully.', life: 2500 });
        await loadProducts();
    } catch (e: any) {
        console.error('[AdminProducts] Delete failed:', e);
        toast.add({ severity: 'error', summary: 'Failed', detail: e?.message || 'Failed to delete product.', life: 3000 });
    }
};

const openHistoryDialog = async (row: any) => {
    selectedHistoryProduct.value = row;
    historyDialogVisible.value = true;
    isHistoryLoading.value = true;
    priceHistoryRows.value = [];
    try {
        const res = await api.products.getProductPriceHistory(row.type, row.id, 100);
        priceHistoryRows.value = res?.success && res?.data?.history ? res.data.history : [];
    } catch (e) {
        console.error('[AdminProducts] Failed to load price history:', e);
        priceHistoryRows.value = [];
    } finally {
        isHistoryLoading.value = false;
    }
};

onMounted(() => {
    loadProducts();
});
</script>

<template>
    <div class="card">
        <div class="flex flex-col gap-2 mb-4">
            <div class="text-2xl font-semibold">Master Product</div>
            <div class="text-sm text-surface-500">Kelola daftar produk (pizza & beverage), kategori, harga, dan ketersediaan.</div>
        </div>
        <div v-if="canManageProducts" class="flex justify-end mb-4">
            <Button label="Add Product" icon="pi pi-plus" @click="openAddDialog" />
        </div>

        <!-- Summary cards -->
        <div class="grid grid-cols-12 gap-4 mb-4">
            <div class="col-span-12 md:col-span-3">
                <div class="rounded-xl border border-surface-200 dark:border-surface-700 p-4">
                    <div class="text-sm text-surface-500 mb-1">Total Product</div>
                    <div class="text-2xl font-semibold">{{ summary.total }}</div>
                </div>
            </div>
            <div class="col-span-12 md:col-span-3">
                <div class="rounded-xl border border-surface-200 dark:border-surface-700 p-4">
                    <div class="text-sm text-surface-500 mb-1">Pizza</div>
                    <div class="text-2xl font-semibold text-blue-600">{{ summary.pizzas }}</div>
                </div>
            </div>
            <div class="col-span-12 md:col-span-3">
                <div class="rounded-xl border border-surface-200 dark:border-surface-700 p-4">
                    <div class="text-sm text-surface-500 mb-1">Beverage</div>
                    <div class="text-2xl font-semibold text-indigo-600">{{ summary.beverages }}</div>
                </div>
            </div>
            <div class="col-span-12 md:col-span-3">
                <div class="rounded-xl border border-surface-200 dark:border-surface-700 p-4">
                    <div class="text-sm text-surface-500 mb-1">Available</div>
                    <div class="text-2xl font-semibold text-green-600">{{ summary.available }}</div>
                </div>
            </div>
        </div>

        <!-- Filters -->
        <div class="grid grid-cols-12 gap-4 mb-4">
            <div class="col-span-12 md:col-span-4">
                <label class="block text-sm font-medium mb-2">Cari Product</label>
                <InputText v-model="search" placeholder="Nama / kategori / deskripsi" class="w-full" />
            </div>
            <div class="col-span-12 md:col-span-2">
                <label class="block text-sm font-medium mb-2">Tipe</label>
                <Dropdown v-model="selectedType" :options="typeOptions" optionLabel="label" optionValue="value" class="w-full" />
            </div>
            <div class="col-span-12 md:col-span-3">
                <label class="block text-sm font-medium mb-2">Kategori</label>
                <Dropdown v-model="selectedCategory" :options="categoryOptions" optionLabel="label" optionValue="value" class="w-full" />
            </div>
            <div class="col-span-12 md:col-span-3">
                <label class="block text-sm font-medium mb-2">Availability</label>
                <Dropdown v-model="selectedAvailability" :options="availabilityOptions" optionLabel="label" optionValue="value" class="w-full" />
            </div>
            <div class="col-span-12 flex justify-end gap-2">
                <Button label="Reset" icon="pi pi-refresh" outlined @click="resetFilters" />
                <Button label="Refresh" icon="pi pi-sync" @click="loadProducts" :loading="isLoading" />
            </div>
        </div>

        <!-- Table -->
        <DataTable
            :value="filteredRows"
            :loading="isLoading"
            paginator
            :rows="10"
            :rowsPerPageOptions="[10, 25, 50]"
            class="p-datatable-sm"
            responsiveLayout="scroll"
        >
            <template #empty>
                <div class="py-6 text-center text-surface-500">Tidak ada produk untuk filter ini.</div>
            </template>

            <Column header="Product" style="min-width: 260px">
                <template #body="{ data }">
                    <div class="flex items-start gap-3">
                        <img
                            :src="data.image || fallbackImageUrl"
                            :alt="data.name"
                            @error="handleProductImageError"
                            class="w-12 h-12 rounded-lg object-cover border border-surface-200 dark:border-surface-700"
                        />
                        <div class="flex flex-col">
                            <div class="font-semibold">{{ data.name }}</div>
                            <div class="text-xs text-surface-500 line-clamp-2">{{ data.description || '—' }}</div>
                        </div>
                    </div>
                </template>
            </Column>

            <Column header="Type" style="min-width: 120px">
                <template #body="{ data }">
                    <Tag :value="data.type" :severity="data.type === 'pizza' ? 'info' : 'secondary'" />
                </template>
            </Column>

            <Column field="category" header="Category" style="min-width: 140px" />

            <Column header="Price" style="min-width: 140px">
                <template #body="{ data }">
                    {{ formatCurrency(data.price) }}
                </template>
            </Column>

            <Column header="Rating" style="min-width: 100px">
                <template #body="{ data }">
                    <span v-if="data.type === 'pizza'">⭐ {{ Number(data.rating || 0).toFixed(1) }}</span>
                    <span v-else class="text-surface-500">—</span>
                </template>
            </Column>

            <Column header="Status" style="min-width: 120px">
                <template #body="{ data }">
                    <Tag :value="data.available ? 'Available' : 'Unavailable'" :severity="data.available ? 'success' : 'danger'" />
                </template>
            </Column>

            <Column v-if="canViewPriceHistory" header="History" style="min-width: 110px">
                <template #body="{ data }">
                    <Button icon="pi pi-clock" text rounded severity="secondary" @click="openHistoryDialog(data)" />
                </template>
            </Column>

            <Column v-if="canManageProducts" header="Action" style="min-width: 140px">
                <template #body="{ data }">
                    <div class="flex gap-2">
                        <Button icon="pi pi-pencil" text rounded severity="info" @click="openEditDialog(data)" />
                        <Button icon="pi pi-trash" text rounded severity="danger" @click="removeProduct(data)" />
                    </div>
                </template>
            </Column>
        </DataTable>
    </div>

    <Dialog v-model:visible="productDialogVisible" modal :header="editingRow ? 'Edit Product' : 'Add Product'" class="w-full md:w-[34rem]">
        <div class="grid grid-cols-12 gap-3">
            <div class="col-span-12 md:col-span-6">
                <label class="block text-sm font-medium mb-2">Type</label>
                <Dropdown v-model="form.type" :options="typeOptions.filter(t => t.value !== 'all')" optionLabel="label" optionValue="value"
                    :disabled="!!editingRow" class="w-full" />
            </div>
            <div class="col-span-12 md:col-span-6">
                <label class="block text-sm font-medium mb-2">Price</label>
                <InputNumber v-model="form.price" mode="currency" currency="IDR" locale="id-ID" class="w-full" />
            </div>
            <div class="col-span-12">
                <label class="block text-sm font-medium mb-2">Name</label>
                <InputText v-model="form.name" class="w-full" />
            </div>
            <div class="col-span-12 md:col-span-6">
                <label class="block text-sm font-medium mb-2">Category</label>
                <InputText v-model="form.category" class="w-full" />
            </div>
            <div class="col-span-12 md:col-span-6">
                <label class="block text-sm font-medium mb-2">Image URL</label>
                <InputText v-model="form.image" class="w-full" />
            </div>
            <div class="col-span-12">
                <label class="block text-sm font-medium mb-2">Description</label>
                <Textarea v-model="form.description" rows="3" class="w-full" />
            </div>
            <div class="col-span-12">
                <div class="flex items-center gap-2">
                    <Checkbox v-model="form.available" :binary="true" inputId="product-available" />
                    <label for="product-available">Available</label>
                </div>
            </div>
            <div v-if="editingRow" class="col-span-12">
                <label class="block text-sm font-medium mb-2">Change Reason (optional)</label>
                <Textarea v-model="form.changeReason" rows="2" class="w-full" placeholder="Example: inflation adjustment, supplier cost update" />
            </div>
        </div>
        <template #footer>
            <Button label="Cancel" text @click="productDialogVisible = false" />
            <Button :label="editingRow ? 'Update' : 'Create'" icon="pi pi-check" :loading="isSubmitting" @click="saveProduct" />
        </template>
    </Dialog>

    <Dialog
        v-model:visible="historyDialogVisible"
        modal
        :header="selectedHistoryProduct ? `Price History - ${selectedHistoryProduct.name}` : 'Price History'"
        class="w-full md:w-[44rem]"
    >
        <DataTable :value="priceHistoryRows" :loading="isHistoryLoading" class="p-datatable-sm" responsiveLayout="scroll">
            <template #empty>
                <div class="py-6 text-center text-surface-500">No price history yet.</div>
            </template>

            <Column header="Effective">
                <template #body="{ data }">
                    {{ formatDateTime(data.effective_from || data.created_at) }}
                </template>
            </Column>
            <Column header="Old Price">
                <template #body="{ data }">
                    {{ formatCurrency(Number(data.old_price || 0)) }}
                </template>
            </Column>
            <Column header="New Price">
                <template #body="{ data }">
                    {{ formatCurrency(Number(data.new_price || 0)) }}
                </template>
            </Column>
            <Column header="Changed By">
                <template #body="{ data }">
                    {{ data.changed_by || '—' }}
                </template>
            </Column>
            <Column header="Reason" style="min-width: 220px">
                <template #body="{ data }">
                    {{ data.change_reason || '—' }}
                </template>
            </Column>
        </DataTable>
    </Dialog>
</template>
