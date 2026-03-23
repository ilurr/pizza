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
const rows = ref<any[]>([]);

const typeFilter = ref<'base' | 'topping' | null>(null);
const typeOptions = [
    { label: 'All types', value: null },
    { label: 'Base', value: 'base' },
    { label: 'Topping', value: 'topping' }
];

const loadStockProducts = async () => {
    isLoading.value = true;
    try {
        const res = await api.stockRecipes.getStockProducts({
            type: typeFilter.value || undefined
        });
        rows.value = res?.success && res?.data?.products ? res.data.products : [];
    } catch (e: any) {
        console.error('[AdminStockProducts] Failed to load stock products:', e);
        rows.value = [];
        toast.add({
            severity: 'error',
            summary: 'Failed',
            detail: e?.message || 'Failed to load stock products',
            life: 3500
        });
    } finally {
        isLoading.value = false;
    }
};

watch(typeFilter, () => {
    loadStockProducts();
});

// Dialog state
const productDialogVisible = ref(false);
const editingRow = ref<any | null>(null);
const isSaving = ref(false);

const form = ref({
    id: null as string | null,
    name: '',
    type: 'base' as 'base' | 'topping',
    unit: 'pcs'
});

const openAddDialog = () => {
    editingRow.value = null;
    form.value = {
        id: null,
        name: '',
        type: 'base',
        unit: 'pcs'
    };
    productDialogVisible.value = true;
};

const openEditDialog = (row: any) => {
    editingRow.value = row;
    form.value = {
        id: row.id,
        name: row.name || '',
        type: row.type || 'base',
        unit: row.unit || 'pcs'
    };
    productDialogVisible.value = true;
};

const saveProduct = async () => {
    if (!canManage.value) return;
    if (!form.value.name.trim()) {
        toast.add({ severity: 'warn', summary: 'Validation', detail: 'Name is required', life: 2500 });
        return;
    }

    isSaving.value = true;
    try {
        const res = await api.stockRecipes.upsertStockProduct({
            id: form.value.id,
            name: form.value.name,
            type: form.value.type,
            unit: form.value.unit
        });

        if (!res?.success) {
            toast.add({
                severity: 'error',
                summary: 'Failed',
                detail: res?.error?.message || 'Failed to save stock product',
                life: 3500
            });
            return;
        }

        toast.add({ severity: 'success', summary: 'Saved', detail: 'Stock product updated', life: 2500 });
        productDialogVisible.value = false;
        await loadStockProducts();
    } catch (e: any) {
        console.error('[AdminStockProducts] Save failed:', e);
        toast.add({
            severity: 'error',
            summary: 'Failed',
            detail: e?.message || 'Failed to save',
            life: 3500
        });
    } finally {
        isSaving.value = false;
    }
};

const deleteProduct = async (row: any) => {
    if (!canManage.value) return;
    const ok = window.confirm(`Delete "${row.name}"? This also removes recipe rows using it.`);
    if (!ok) return;

    try {
        const res = await api.stockRecipes.deleteStockProduct(row.id);
        if (!res?.success) {
            toast.add({
                severity: 'error',
                summary: 'Failed',
                detail: res?.error?.message || 'Failed to delete',
                life: 3500
            });
            return;
        }
        toast.add({ severity: 'success', summary: 'Deleted', detail: 'Removed stock product', life: 2500 });
        await loadStockProducts();
    } catch (e: any) {
        console.error('[AdminStockProducts] Delete failed:', e);
        toast.add({
            severity: 'error',
            summary: 'Failed',
            detail: e?.message || 'Failed to delete',
            life: 3500
        });
    }
};

onMounted(() => loadStockProducts());
</script>

<template>
    <div class="card">
        <div v-if="!canView" class="text-surface-500">You do not have access to this page.</div>

        <div v-else>
            <div class="flex flex-col gap-2 mb-4">
                <div class="text-2xl font-semibold">Ingredients</div>
                <div class="text-sm text-surface-500">
                    Manage the master ingredient list (<code>stock_products</code>): base or topping types.
                </div>
            </div>

            <div class="flex flex-wrap gap-3 items-end mb-4">
                <div class="min-w-[220px]">
                    <label class="block text-sm font-medium mb-2">Filter by type</label>
                    <Select v-model="typeFilter" :options="typeOptions" optionLabel="label" optionValue="value"
                        class="w-full" />
                </div>
                <div class="ml-auto" v-if="canManage">
                    <Button label="Add Ingredient" icon="pi pi-plus" @click="openAddDialog" />
                </div>
            </div>

            <DataTable :value="rows" :loading="isLoading" responsiveLayout="scroll" paginator :rows="10"
                class="p-datatable-sm">
                <Column header="Name">
                    <template #body="{ data }">
                        <div class="font-semibold">{{ data.name }}</div>
                        <div class="text-xs text-surface-500">{{ data.id }}</div>
                    </template>
                </Column>
                <Column header="Type" style="width: 140px">
                    <template #body="{ data }">
                        <Tag :value="data.type" :severity="data.type === 'topping' ? 'info' : 'secondary'" />
                    </template>
                </Column>
                <Column header="Unit" style="width: 120px">
                    <template #body="{ data }">
                        <div class="text-sm">{{ data.unit || 'pcs' }}</div>
                    </template>
                </Column>
                <Column header="Actions" style="width: 180px">
                    <template #body="{ data }">
                        <div class="flex gap-2">
                            <Button v-if="canManage" icon="pi pi-pencil" severity="secondary" text rounded
                                v-tooltip.top="'Edit ingredient'" @click="openEditDialog(data)" />
                            <Button v-if="canManage" icon="pi pi-trash" severity="danger" text rounded
                                v-tooltip.top="'Delete ingredient'" @click="deleteProduct(data)" />
                        </div>
                    </template>
                </Column>
            </DataTable>
        </div>

        <Dialog v-model:visible="productDialogVisible" modal header="Stock Product" :style="{ width: '30rem' }"
            :closable="false">
            <div class="flex flex-col gap-3">
                <div>
                    <label class="block text-sm font-medium mb-2">Name</label>
                    <InputText v-model="form.name" class="w-full" />
                </div>
                <div>
                    <label class="block text-sm font-medium mb-2">Type</label>
                    <Select v-model="form.type"
                        :options="[{ label: 'Base', value: 'base' }, { label: 'Topping', value: 'topping' }]"
                        optionLabel="label" optionValue="value" class="w-full" />
                </div>
                <div>
                    <label class="block text-sm font-medium mb-2">Unit</label>
                    <InputText v-model="form.unit" class="w-full" />
                </div>
            </div>

            <template #footer>
                <div class="flex justify-end gap-2">
                    <Button label="Cancel" text :disabled="isSaving" @click="productDialogVisible = false" />
                    <Button label="Save" icon="pi pi-save" :loading="isSaving" :disabled="!canManage"
                        @click="saveProduct" />
                </div>
            </template>
        </Dialog>
    </div>
</template>
