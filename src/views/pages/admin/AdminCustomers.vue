<script setup lang="ts">
import { ROLES } from '@/constants/roles.js';
import { getSupabaseClient } from '@/services/supabase/client.js';
import { useUserStore } from '@/stores/userStore';
import { computed, onMounted, ref, watch } from 'vue';
import { useToast } from 'primevue/usetoast';

const userStore = useUserStore();
const toast = useToast();

const isLoading = ref(false);
const search = ref('');
const customers = ref<any[]>([]);

const canViewCustomers = computed(() => [ROLES.SUPERADMIN, ROLES.MITRA].includes(userStore.role));
const canManageCustomers = computed(() => userStore.role === ROLES.SUPERADMIN);

const formatDateTime = (iso: string) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' });
};

const customerDialogVisible = ref(false);
const editingCustomer = ref<any | null>(null);
const isSavingCustomer = ref(false);
const form = ref({
    fullname: '',
    email: '',
    avatar: '',
    resetPassword: false,
    newPassword: ''
});

watch(
    () => form.value.resetPassword,
    (enabled) => {
        if (!enabled) return;
        if (!form.value.newPassword) form.value.newPassword = generateTempPassword();
    }
);

const filteredCustomers = computed(() => {
    const q = search.value.trim().toLowerCase();
    if (!q) return customers.value;

    return customers.value.filter((c: any) => {
        const username = String(c.username || '').toLowerCase();
        const fullname = String(c.fullname || '').toLowerCase();
        const email = String(c.email || '').toLowerCase();
        return username.includes(q) || fullname.includes(q) || email.includes(q);
    });
});

const generateTempPassword = () => {
    // Simple temporary password generator for demo/admin usage.
    // Uses only characters that are typically safe for copy/paste.
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
    let out = '';
    for (let i = 0; i < 10; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
    return out;
};

const openEditCustomerDialog = (customer: any) => {
    if (!canManageCustomers.value) return;
    editingCustomer.value = customer;
    form.value = {
        fullname: customer?.fullname || '',
        email: customer?.email || '',
        avatar: customer?.avatar || '',
        resetPassword: false,
        newPassword: ''
    };
    customerDialogVisible.value = true;
};

const saveCustomerEdits = async () => {
    if (!canManageCustomers.value) return;
    if (!editingCustomer.value) return;

    if (!form.value.email?.trim()) {
        toast.add({
            severity: 'warn',
            summary: 'Email required',
            detail: 'Please enter a valid email before saving.',
            life: 4500
        });
        return;
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
        toast.add({
            severity: 'error',
            summary: 'Supabase not configured',
            detail: 'Switch DATA_SOURCE to supabase and set env keys.',
            life: 4500
        });
        return;
    }

    isSavingCustomer.value = true;
    try {
        const payload: Record<string, any> = {
            fullname: form.value.fullname || null,
            email: form.value.email || null,
            avatar: form.value.avatar || null
        };

        if (form.value.resetPassword) {
            payload.password = form.value.newPassword || generateTempPassword();
        }

        const { error, data } = await supabase
            .from('app_users')
            .update(payload)
            .eq('id', Number(editingCustomer.value.id))
            .select('id, username, fullname, email, avatar, role_type, created_at, updated_at')
            .single();

        if (error) throw error;

        if (form.value.resetPassword) {
            toast.add({
                severity: 'success',
                summary: 'Password reset',
                detail: `New temporary password: ${payload.password}`,
                life: 7000
            });
        } else {
            toast.add({
                severity: 'success',
                summary: 'Customer updated',
                detail: data?.email ? `Updated: ${data.email}` : 'Saved successfully',
                life: 4500
            });
        }

        customerDialogVisible.value = false;
        editingCustomer.value = null;
        await loadCustomers();
    } catch (e: any) {
        console.error('[AdminCustomers] Failed to update customer:', e);
        toast.add({
            severity: 'error',
            summary: 'Failed to update customer',
            detail: e?.message || 'Unknown error',
            life: 5500
        });
    } finally {
        isSavingCustomer.value = false;
    }
};

const loadCustomers = async () => {
    if (!canViewCustomers.value) return;

    const supabase = getSupabaseClient();
    if (!supabase) {
        toast.add({
            severity: 'error',
            summary: 'Supabase not configured',
            detail: 'Switch DATA_SOURCE to supabase and set env keys.',
            life: 4500
        });
        return;
    }

    isLoading.value = true;
    try {
        const { data, error } = await supabase
            .from('app_users')
            .select('id, username, fullname, email, avatar, role_type, created_at, updated_at')
            .or('role_type.eq.customers,role_type.eq.customer')
            .order('created_at', { ascending: false })
            .limit(2000);

        if (error) throw error;
        customers.value = data || [];
    } catch (e: any) {
        console.error('[AdminCustomers] Failed to load customers:', e);
        customers.value = [];
        toast.add({
            severity: 'error',
            summary: 'Failed to load customers',
            detail: e?.message || 'Unknown error',
            life: 4500
        });
    } finally {
        isLoading.value = false;
    }
};

onMounted(() => {
    loadCustomers();
});
</script>

<template>
    <div class="card">
        <div class="flex flex-col gap-2 mb-4">
            <div class="text-2xl font-semibold">Customers</div>
            <div class="text-sm text-surface-500">Master daftar pelanggan.</div>
        </div>

        <!-- Filters -->
        <div class="grid grid-cols-12 gap-4 mb-4">
            <div class="col-span-12 md:col-span-6">
                <label class="block text-sm font-medium mb-2">Cari</label>
                <InputText v-model="search" placeholder="Nama / username / email" class="w-full" />
            </div>
            <div class="col-span-12 md:col-span-6 flex items-end justify-end gap-2">
                <Button
                    label="Refresh"
                    icon="pi pi-sync"
                    outlined
                    :loading="isLoading"
                    @click="loadCustomers"
                />
            </div>
        </div>

        <DataTable
            :value="filteredCustomers"
            :loading="isLoading"
            paginator
            :rows="10"
            :rowsPerPageOptions="[10, 25, 50]"
            class="p-datatable-sm"
            responsiveLayout="scroll"
        >
            <template #empty>
                <div class="py-6 text-center text-surface-500">Tidak ada pelanggan.</div>
            </template>

            <Column header="#" style="width: 60px">
                <template #body="{ index }">
                    {{ index + 1 }}
                </template>
            </Column>

            <Column header="Customer" style="min-width: 260px">
                <template #body="{ data }">
                    <div class="flex flex-col min-w-0">
                        <div class="font-semibold truncate">
                            {{ data.fullname || data.username || '—' }}
                        </div>
                    </div>
                </template>
            </Column>

            <Column header="Username" style="min-width: 180px">
                <template #body="{ data }">
                    {{ data.username || '—' }}
                </template>
            </Column>

            <Column header="Email" style="min-width: 220px">
                <template #body="{ data }">
                    {{ data.email || '—' }}
                </template>
            </Column>

            <Column v-if="canManageCustomers" header="Action" style="width: 120px">
                <template #body="{ data }">
                    <div class="flex gap-2">
                        <Button
                            icon="pi pi-pencil"
                            text
                            rounded
                            severity="info"
                            v-tooltip.top="'Edit customer'"
                            @click="openEditCustomerDialog(data)"
                        />
                    </div>
                </template>
            </Column>
        </DataTable>
    </div>

    <Dialog
        v-model:visible="customerDialogVisible"
        modal
        :header="editingCustomer ? `Edit Customer - ${editingCustomer.fullname || editingCustomer.username}` : 'Edit Customer'"
        class="w-full md:w-[36rem]"
    >
        <div v-if="editingCustomer" class="grid grid-cols-12 gap-3">
            <div class="col-span-12 md:col-span-6">
                <label class="block text-sm font-medium mb-2">Username</label>
                <InputText :modelValue="editingCustomer.username" disabled class="w-full" />
            </div>
            <div class="col-span-12 md:col-span-6">
                <label class="block text-sm font-medium mb-2">Role Type</label>
                <InputText :modelValue="editingCustomer.role_type || '—'" disabled class="w-full" />
            </div>

            <div class="col-span-12">
                <label class="block text-sm font-medium mb-2">Full name</label>
                <InputText v-model="form.fullname" class="w-full" />
            </div>

            <div class="col-span-12">
                <label class="block text-sm font-medium mb-2">Email</label>
                <InputText v-model="form.email" class="w-full" />
            </div>

            <div class="col-span-12">
                <label class="block text-sm font-medium mb-2">Avatar URL</label>
                <InputText v-model="form.avatar" class="w-full" />
            </div>

            <div class="col-span-12">
                <div class="flex items-center gap-2">
                    <Checkbox v-model="form.resetPassword" :binary="true" inputId="reset-password" />
                    <label for="reset-password">Reset password</label>
                </div>
            </div>

            <div v-if="form.resetPassword" class="col-span-12">
                <label class="block text-sm font-medium mb-2">Temporary new password</label>
                <div class="flex gap-2 items-center">
                    <InputText v-model="form.newPassword" class="w-full" />
                    <Button
                        type="button"
                        icon="pi pi-refresh"
                        outlined
                        @click="form.newPassword = generateTempPassword()"
                    />
                </div>
                <div class="text-xs text-surface-500 mt-2">
                    This is a demo reset for admin usage.
                </div>
            </div>
        </div>

        <template #footer>
            <Button label="Cancel" text :disabled="isSavingCustomer" @click="customerDialogVisible = false" />
            <Button
                label="Save"
                icon="pi pi-check"
                :loading="isSavingCustomer"
                severity="primary"
                @click="saveCustomerEdits"
            />
        </template>
    </Dialog>
</template>

