<script setup lang="ts">
import { ADMIN_PANEL_ROLES, ROLES } from '@/constants/roles.js';
import api from '@/services/api/index.js';
import { useUserStore } from '@/stores/userStore';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, ref, watch } from 'vue';

const userStore = useUserStore();
const toast = useToast();

const canView = computed(() => ADMIN_PANEL_ROLES.includes(userStore.role as (typeof ADMIN_PANEL_ROLES)[number]));
const canManage = computed(() => userStore.role === ROLES.SUPERADMIN);

const isLoading = ref(false);
const saving = ref(false);

const pizzas = ref<any[]>([]);
const stockProducts = ref<any[]>([]);

const recipeLines = ref<any[]>([]);

// MVP keys used by OrdersApiService stock deduction
const DEFAULT_PIZZA_KEY = '__default_pizza__';
const defaultProductOption = { label: 'Default Pizza BOM (applies when no specific recipe)', value: DEFAULT_PIZZA_KEY };

const productOptions = computed(() => {
    const opts = pizzas.value.map((p: any) => ({ label: p.name, value: p.id }));
    return [defaultProductOption, ...opts];
});

const selectedProductId = ref<string>(DEFAULT_PIZZA_KEY);

const loadPizzasAndIngredients = async () => {
    isLoading.value = true;
    try {
        const menuRes = await api.products.getMenu({});
        const pizzasRes = menuRes?.success && menuRes?.data?.pizzas ? menuRes.data.pizzas : [];
        pizzas.value = pizzasRes;

        const stockRes = await api.stockRecipes.getStockProducts({});
        stockProducts.value = stockRes?.success && stockRes?.data?.products ? stockRes.data.products : [];
    } catch (e: any) {
        console.error('[AdminRecipes] Failed to load data:', e);
        toast.add({
            severity: 'error',
            summary: 'Failed',
            detail: e?.message || 'Failed to load data',
            life: 3500
        });
        pizzas.value = [];
        stockProducts.value = [];
    } finally {
        isLoading.value = false;
    }
};

const loadRecipe = async () => {
    if (!selectedProductId.value) return;
    isLoading.value = true;
    try {
        const res = await api.stockRecipes.getProductStockRecipe(selectedProductId.value);
        recipeLines.value = res?.success && res?.data?.lines ? res.data.lines : [];
    } catch (e: any) {
        console.error('[AdminRecipes] Failed to load recipe:', e);
        recipeLines.value = [];
        toast.add({
            severity: 'error',
            summary: 'Failed',
            detail: e?.message || 'Failed to load recipe',
            life: 3500
        });
    } finally {
        isLoading.value = false;
    }
};

watch(selectedProductId, () => loadRecipe());

const ingredientOptions = computed(() => {
    return stockProducts.value.map((p: any) => ({
        label: `${p.name} (${p.type})`,
        value: p.id,
        product: p
    }));
});

const selectedIngredientId = ref<string | null>(null);
const selectedIngredientQuantity = ref<number>(1);

const addRecipeLine = () => {
    if (!selectedIngredientId.value) return;
    const existing = recipeLines.value.find((l) => l.stockProductId === selectedIngredientId.value);
    if (existing) {
        existing.quantity = selectedIngredientQuantity.value;
    } else {
        const sp = stockProducts.value.find((s: any) => s.id === selectedIngredientId.value);
        recipeLines.value.push({
            stockProductId: selectedIngredientId.value,
            quantity: selectedIngredientQuantity.value,
            stockProduct: sp || null
        });
    }
};

const removeRecipeLine = (stockProductId: string) => {
    recipeLines.value = recipeLines.value.filter((l) => l.stockProductId !== stockProductId);
};

const saveRecipe = async () => {
    if (!canManage.value) return;
    if (!selectedProductId.value) return;

    const payload = recipeLines.value
        .map((l) => ({
            stockProductId: l.stockProductId,
            quantity: Number(l.quantity)
        }))
        .filter((l) => l.stockProductId && Number.isFinite(l.quantity) && l.quantity > 0);

    if (!payload.length) {
        toast.add({ severity: 'warn', summary: 'Validation', detail: 'Recipe cannot be empty', life: 3000 });
        return;
    }

    saving.value = true;
    try {
        const res = await api.stockRecipes.setProductStockRecipe(selectedProductId.value, payload);
        if (!res?.success) {
            toast.add({
                severity: 'error',
                summary: 'Failed',
                detail: res?.error?.message || 'Failed to save recipe',
                life: 3500
            });
            return;
        }
        toast.add({ severity: 'success', summary: 'Saved', detail: 'Recipe updated', life: 2500 });
        await loadRecipe();
    } catch (e: any) {
        console.error('[AdminRecipes] Save failed:', e);
        toast.add({
            severity: 'error',
            summary: 'Failed',
            detail: e?.message || 'Failed to save',
            life: 3500
        });
    } finally {
        saving.value = false;
    }
};

onMounted(async () => {
    await loadPizzasAndIngredients();
    await loadRecipe();
});
</script>

<template>
    <div class="card">
        <div v-if="!canView" class="text-surface-500">You do not have access to this page.</div>

        <div v-else>
            <div class="flex flex-col gap-2 mb-4">
                <div class="text-2xl font-semibold">Recipes (Stock BOM)</div>
                <div class="text-sm text-surface-500">
                    Map one portion of each product to ingredients (<code>stock_products</code>) for stock deduction
                    when an
                    order moves to <strong>preparing</strong> (driver accepts) or walk-in is completed as delivered.
                </div>
            </div>

            <div class="grid grid-cols-12 gap-4 mb-4">
                <div class="col-span-12 md:col-span-6">
                    <label class="block text-sm font-medium mb-2">Product (BOM)</label>
                    <Select v-model="selectedProductId" :options="productOptions" optionLabel="label"
                        optionValue="value" class="w-full" />
                </div>
                <div class="col-span-12 md:col-span-6 flex items-end justify-end gap-2">
                    <Button label="Save Recipe" icon="pi pi-save" :loading="saving" :disabled="!canManage"
                        @click="saveRecipe" />
                </div>
            </div>

            <div class="p-4 border rounded-lg mb-4">
                <div class="flex flex-wrap gap-3 items-end">
                    <div class="min-w-[260px]">
                        <label class="block text-sm font-medium mb-2">Add ingredient</label>
                        <Select v-model="selectedIngredientId" :options="ingredientOptions" optionLabel="label"
                            optionValue="value" placeholder="Select base / topping" class="w-full"
                            :disabled="!canManage" />
                    </div>
                    <div class="w-[160px]">
                        <label class="block text-sm font-medium mb-2">Quantity per 1 portion</label>
                        <InputNumber v-model="selectedIngredientQuantity" :min="0" :step="1" :disabled="!canManage"
                            class="w-full" />
                    </div>
                    <div class="relative">
                        <Button label="Add / Update" icon="pi pi-plus" :disabled="!canManage" @click="addRecipeLine" />
                    </div>
                </div>
            </div>

            <DataTable :value="recipeLines" :loading="isLoading" responsiveLayout="scroll" class="p-datatable-sm">
                <Column header="Ingredient">
                    <template #body="{ data }">
                        <div class="font-semibold">{{ data.stockProduct?.name || '—' }}</div>
                        <div class="text-xs text-surface-500">{{ data.stockProduct?.type || '—' }} · {{
                            data.stockProduct?.unit || '' }}</div>
                    </template>
                </Column>
                <Column header="Quantity (per portion)" style="width: 240px">
                    <template #body="{ data }">
                        <InputNumber v-model="data.quantity" :min="0" :step="1" :disabled="!canManage" class="w-full" />
                    </template>
                </Column>
                <Column header="Actions" style="width: 120px">
                    <template #body="{ data }">
                        <span v-tooltip.top="canManage ? 'Remove from recipe' : 'Editing disabled'" class="inline-flex">
                            <Button icon="pi pi-trash" severity="danger" text rounded :disabled="!canManage"
                                @click="removeRecipeLine(data.stockProductId)" />
                        </span>
                    </template>
                </Column>
            </DataTable>
        </div>
    </div>
</template>
