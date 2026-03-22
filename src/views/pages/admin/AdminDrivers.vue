<script setup lang="ts">
import { ROLES } from '@/constants/roles.js';
import api from '@/services/api/index.js';
import { getSupabaseClient } from '@/services/supabase/client.js';
import { useUserStore } from '@/stores/userStore';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, ref } from 'vue';

const isLoading = ref(false);
const isSubmitting = ref(false);
const search = ref('');
const availabilityFilter = ref<'all' | 'online' | 'offline'>('all');
const driverRows = ref<any[]>([]);
const userStore = useUserStore();
const toast = useToast();
const canManageDrivers = computed(() => userStore.role === ROLES.SUPERADMIN);

const driverDialogVisible = ref(false);
const editingDriver = ref<any | null>(null);
const form = ref({
    username: '',
    email: '',
    password: '',
    fullname: '',
    avatar: '',
    phone: ''
});

const availabilityOptions = [
    { label: 'Semua', value: 'all' },
    { label: 'Online', value: 'online' },
    { label: 'Offline', value: 'offline' }
];

const formatDateTime = (iso: string) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' });
};

const loadDrivers = async () => {
    isLoading.value = true;
    try {
        const res = await api.drivers.listDrivers?.();
        driverRows.value = res?.success && res?.data?.drivers ? res.data.drivers : [];
    } catch (e) {
        console.error('[AdminDrivers] Failed to load drivers:', e);
        driverRows.value = [];
    } finally {
        isLoading.value = false;
    }
};

const resetForm = () => {
    form.value = {
        username: '',
        email: '',
        password: '',
        fullname: '',
        avatar: '',
        phone: ''
    };
};

const openAddDialog = () => {
    editingDriver.value = null;
    resetForm();
    driverDialogVisible.value = true;
};

const openEditDialog = (driver: any) => {
    editingDriver.value = driver;
    form.value = {
        username: driver.username || '',
        email: driver.email || '',
        password: '',
        fullname: driver.name || '',
        avatar: driver.avatar || '',
        phone: driver.phone || ''
    };
    driverDialogVisible.value = true;
};

const nextDriverId = async (supabase: any) => {
    const { data, error } = await supabase.from('app_users').select('id').order('id', { ascending: false }).limit(1);
    if (error) throw error;
    return ((data && data[0]?.id) || 0) + 1;
};

const saveDriver = async () => {
    if (!canManageDrivers.value) return;
    if (!form.value.username.trim() || !form.value.email.trim()) {
        toast.add({ severity: 'warn', summary: 'Validation', detail: 'Username and email are required.', life: 2500 });
        return;
    }
    if (!editingDriver.value && !form.value.password.trim()) {
        toast.add({ severity: 'warn', summary: 'Validation', detail: 'Password is required for new driver.', life: 2500 });
        return;
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
        toast.add({ severity: 'error', summary: 'Supabase', detail: 'Supabase not configured.', life: 3000 });
        return;
    }

    isSubmitting.value = true;
    try {
        if (editingDriver.value) {
            const updates: any = {
                username: form.value.username.trim(),
                email: form.value.email.trim(),
                fullname: form.value.fullname || null,
                avatar: form.value.avatar || null,
                phone: form.value.phone || null,
                updated_at: new Date().toISOString()
            };
            if (form.value.password.trim()) updates.password = form.value.password.trim();

            const { error } = await supabase.from('app_users').update(updates).eq('id', Number(editingDriver.value.id));
            if (error) throw error;
        } else {
            const id = await nextDriverId(supabase);
            const { error } = await supabase.from('app_users').insert({
                id,
                username: form.value.username.trim(),
                email: form.value.email.trim(),
                password: form.value.password.trim(),
                fullname: form.value.fullname || null,
                avatar: form.value.avatar || null,
                phone: form.value.phone || null,
                role_type: ROLES.DRIVER,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            });
            if (error) throw error;
        }

        toast.add({
            severity: 'success',
            summary: editingDriver.value ? 'Driver updated' : 'Driver created',
            detail: editingDriver.value ? 'Driver data updated successfully.' : 'New driver added successfully.',
            life: 2500
        });
        driverDialogVisible.value = false;
        await loadDrivers();
    } catch (e: any) {
        console.error('[AdminDrivers] Save failed:', e);
        toast.add({ severity: 'error', summary: 'Failed', detail: e?.message || 'Failed to save driver.', life: 3000 });
    } finally {
        isSubmitting.value = false;
    }
};

const removeDriver = async (driver: any) => {
    if (!canManageDrivers.value) return;
    const ok = window.confirm(`Delete driver "${driver.name}"?`);
    if (!ok) return;

    const supabase = getSupabaseClient();
    if (!supabase) {
        toast.add({ severity: 'error', summary: 'Supabase', detail: 'Supabase not configured.', life: 3000 });
        return;
    }

    try {
        const id = Number(driver.id);
        await supabase.from('driver_kelurahan').delete().eq('driver_id', id);
        const { error } = await supabase.from('app_users').delete().eq('id', id);
        if (error) throw error;

        toast.add({ severity: 'success', summary: 'Deleted', detail: 'Driver deleted successfully.', life: 2500 });
        await loadDrivers();
    } catch (e: any) {
        console.error('[AdminDrivers] Delete failed:', e);
        toast.add({ severity: 'error', summary: 'Failed', detail: e?.message || 'Failed to delete driver.', life: 3000 });
    }
};

const resetFilters = () => {
    search.value = '';
    availabilityFilter.value = 'all';
};

const filteredDrivers = computed(() => {
    const q = search.value.trim().toLowerCase();
    return driverRows.value.filter((d: any) => {
        if (availabilityFilter.value === 'online' && !d.isOnline) return false;
        if (availabilityFilter.value === 'offline' && d.isOnline) return false;
        if (!q) return true;
        const name = String(d.name || '').toLowerCase();
        const email = String(d.email || '').toLowerCase();
        const phone = String(d.phone || '').toLowerCase();
        return name.includes(q) || email.includes(q) || phone.includes(q);
    });
});

const summary = computed(() => {
    const total = driverRows.value.length;
    const online = driverRows.value.filter((d: any) => d.isOnline).length;
    const available = driverRows.value.filter((d: any) => d.isAvailable !== false).length;
    const avgRating = total > 0 ? driverRows.value.reduce((sum: number, d: any) => sum + Number(d.rating || 0), 0) / total : 0;
    return { total, online, available, avgRating };
});

const statusSeverity = (d: any) => {
    if (!d.isOnline) return 'secondary';
    if (d.isAvailable === false) return 'warn';
    return 'success';
};

const statusLabel = (d: any) => {
    if (!d.isOnline) return 'Offline';
    if (d.isAvailable === false) return 'Busy';
    return 'Online';
};

onMounted(() => {
    loadDrivers();
});
</script>

<template>
    <div class="card">
        <div class="flex flex-col gap-2 mb-4">
            <div class="text-2xl font-semibold">Drivers</div>
            <div class="text-sm text-surface-500">Pantau driver, status online, rating, dan area coverage.</div>
        </div>

        <!-- Summary -->
        <div class="grid grid-cols-12 gap-4 mb-4">
            <div class="col-span-12 md:col-span-3">
                <div class="rounded-xl border border-surface-200 dark:border-surface-700 p-4">
                    <div class="text-sm text-surface-500 mb-1">Total Driver</div>
                    <div class="text-2xl font-semibold">{{ summary.total }}</div>
                </div>
            </div>
            <div class="col-span-12 md:col-span-3">
                <div class="rounded-xl border border-surface-200 dark:border-surface-700 p-4">
                    <div class="text-sm text-surface-500 mb-1">Online</div>
                    <div class="text-2xl font-semibold text-green-600">{{ summary.online }}</div>
                </div>
            </div>
            <div class="col-span-12 md:col-span-3">
                <div class="rounded-xl border border-surface-200 dark:border-surface-700 p-4">
                    <div class="text-sm text-surface-500 mb-1">Available</div>
                    <div class="text-2xl font-semibold text-blue-600">{{ summary.available }}</div>
                </div>
            </div>
            <div class="col-span-12 md:col-span-3">
                <div class="rounded-xl border border-surface-200 dark:border-surface-700 p-4">
                    <div class="text-sm text-surface-500 mb-1">Avg Rating</div>
                    <div class="text-2xl font-semibold">{{ summary.avgRating.toFixed(1) }}</div>
                </div>
            </div>
        </div>

        <!-- Filters -->
        <div class="grid grid-cols-12 gap-4 mb-4">
            <div class="col-span-12 md:col-span-4">
                <label class="block text-sm font-medium mb-2">Cari Driver</label>
                <InputText v-model="search" placeholder="Nama / email / phone" class="w-full" />
            </div>
            <div class="col-span-12 md:col-span-4">
                <label class="block text-sm font-medium mb-2">Status</label>
                <Select v-model="availabilityFilter" :options="availabilityOptions" optionLabel="label"
                    optionValue="value" class="w-full" />
            </div>
            <div class="col-span-12 flex justify-between gap-2">
                <div class="flex gap-2">
                    <Button v-if="canManageDrivers" label="Add Driver" icon="pi pi-plus" @click="openAddDialog" />
                </div>
                <div class="flex gap-2">
                    <Button label="Reset" icon="pi pi-refresh" outlined @click="resetFilters" />
                    <Button label="Refresh" icon="pi pi-sync" outlined :loading="isLoading" @click="loadDrivers" />
                </div>
            </div>
        </div>

        <!-- Table -->
        <DataTable :value="filteredDrivers" :loading="isLoading" paginator :rows="10" :rowsPerPageOptions="[10, 25, 50]"
            class="p-datatable-sm" responsiveLayout="scroll">
            <template #empty>
                <div class="py-6 text-center text-surface-500">Tidak ada driver untuk filter ini.</div>
            </template>

            <Column header="#" style="width: 60px">
                <template #body="{ index }">
                    {{ index + 1 }}
                </template>
            </Column>

            <Column header="Driver" style="min-width: 260px">
                <template #body="{ data }">
                    <div class="flex flex-col">
                        <div class="font-semibold">{{ data.name || '—' }}</div>
                        <div class="text-xs text-surface-500">{{ data.email || '—' }}</div>
                    </div>
                </template>
            </Column>

            <Column header="Contact" style="min-width: 150px">
                <template #body="{ data }">
                    {{ data.phone || '—' }}
                </template>
            </Column>

            <Column header="Coverage" style="min-width: 140px">
                <template #body="{ data }">
                    {{ (data.kelurahanIds || []).length }} area
                </template>
            </Column>

            <Column header="Rating" style="min-width: 120px">
                <template #body="{ data }">
                    <i class="pi pi-star-fill text-yellow-500 is-filled"></i> {{ Number(data.rating || 0).toFixed(1) }}
                </template>
            </Column>

            <Column header="Status" style="min-width: 120px">
                <template #body="{ data }">
                    <Tag :value="statusLabel(data)" :severity="statusSeverity(data)" />
                </template>
            </Column>

            <Column v-if="canManageDrivers" header="Action" style="min-width: 130px">
                <template #body="{ data }">
                    <div class="flex">
                        <Button icon="pi pi-pencil" text rounded severity="info" @click="openEditDialog(data)" />
                        <Button icon="pi pi-trash" text rounded severity="danger" @click="removeDriver(data)" />
                    </div>
                </template>
            </Column>
        </DataTable>
    </div>

    <Dialog v-model:visible="driverDialogVisible" modal :header="editingDriver ? 'Edit Driver' : 'Add Driver'"
        class="w-full md:w-[34rem]">
        <div class="grid grid-cols-12 gap-3">
            <div class="col-span-12 md:col-span-6">
                <label class="block text-sm font-medium mb-2">Username</label>
                <InputText v-model="form.username" class="w-full" />
            </div>
            <div class="col-span-12 md:col-span-6">
                <label class="block text-sm font-medium mb-2">Email</label>
                <InputText v-model="form.email" type="email" class="w-full" />
            </div>
            <div class="col-span-12 md:col-span-6">
                <label class="block text-sm font-medium mb-2">
                    {{ editingDriver ? 'Password (optional)' : 'Password' }}
                </label>
                <Password v-model="form.password" :feedback="false" toggleMask class="w-full" inputClass="w-full" />
            </div>
            <div class="col-span-12 md:col-span-6">
                <label class="block text-sm font-medium mb-2">Full Name</label>
                <InputText v-model="form.fullname" class="w-full" />
            </div>
            <div class="col-span-12 md:col-span-6">
                <label class="block text-sm font-medium mb-2">Phone</label>
                <InputText v-model="form.phone" class="w-full" />
            </div>
            <div class="col-span-12 md:col-span-6">
                <label class="block text-sm font-medium mb-2">Avatar URL</label>
                <InputText v-model="form.avatar" class="w-full" />
            </div>
        </div>
        <template #footer>
            <Button label="Cancel" text @click="driverDialogVisible = false" />
            <Button :label="editingDriver ? 'Update' : 'Create'" icon="pi pi-check" :loading="isSubmitting"
                @click="saveDriver" />
        </template>
    </Dialog>
</template>
