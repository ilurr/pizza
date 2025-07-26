<script setup lang="ts">
import promoApi from '@/services/api/PromoApiService.js';
import { useToast } from 'primevue/usetoast';
import { computed, ref, watch } from 'vue';

interface Promo {
    id: string;
    code: string;
    title: string;
    description: string;
    type: 'percentage' | 'fixed';
    value: number;
    minOrderAmount: number;
    maxDiscountAmount: number;
    image: string;
    featured: boolean;
    userRestrictions: any;
    applicable?: boolean;
    disabledReason?: string | null;
}

interface Props {
    visible: boolean;
    userId: string;
    orderAmount: number;
    categories: string[];
}

const props = defineProps<Props>();
const emit = defineEmits<{
    'update:visible': [value: boolean];
    'promo-selected': [promo: Promo, discount: any];
}>();

const toast = useToast();

// State
const availablePromos = ref<Promo[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const selectedPromo = ref<Promo | null>(null);
const manualCode = ref('');
const isValidatingManualCode = ref(false);

// Computed
const featuredPromos = computed(() =>
    availablePromos.value.filter(promo => promo.featured)
);

const otherPromos = computed(() =>
    availablePromos.value.filter(promo => !promo.featured)
);

// Methods
const closeModal = () => {
    emit('update:visible', false);
    selectedPromo.value = null;
    manualCode.value = '';
    error.value = null;
};

const loadAvailablePromos = async () => {
    loading.value = true;
    error.value = null;

    try {
        const response = await promoApi.getAvailablePromos(props.userId, {
            orderAmount: props.orderAmount,
            categories: props.categories
        });

        if (response.success) {
            availablePromos.value = response.data.promos;
        } else {
            error.value = response.error.message;
        }
    } catch (err) {
        error.value = 'Failed to load promos. Please try again.';
        console.error('Failed to load promos:', err);
    } finally {
        loading.value = false;
    }
};

const selectPromo = async (promo: Promo) => {
    if (!promo.applicable) {
        toast.add({
            severity: 'warn',
            summary: 'Promo Not Applicable',
            detail: promo.disabledReason || 'This promo cannot be applied to your current order',
            life: 4000
        });
        return;
    }

    selectedPromo.value = promo;

    try {
        const response = await promoApi.validatePromoCode(promo.code, {
            userId: props.userId,
            orderAmount: props.orderAmount,
            categories: props.categories
        });

        if (response.success) {
            emit('promo-selected', promo, response.data.discount);

            toast.add({
                severity: 'success',
                summary: 'Promo Applied!',
                detail: response.data.message,
                life: 4000
            });

            closeModal();
        } else {
            toast.add({
                severity: 'error',
                summary: 'Promo Not Valid',
                detail: response.error.message,
                life: 4000
            });
        }
    } catch (err) {
        toast.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to apply promo code',
            life: 4000
        });
    }

    selectedPromo.value = null;
};

const validateManualCode = async () => {
    if (!manualCode.value.trim()) {
        toast.add({
            severity: 'warn',
            summary: 'Invalid Input',
            detail: 'Please enter a promo code',
            life: 3000
        });
        return;
    }

    isValidatingManualCode.value = true;

    try {
        const response = await promoApi.validatePromoCode(manualCode.value.trim(), {
            userId: props.userId,
            orderAmount: props.orderAmount,
            categories: props.categories
        });

        if (response.success) {
            emit('promo-selected', response.data.promo, response.data.discount);

            toast.add({
                severity: 'success',
                summary: 'Promo Applied!',
                detail: response.data.message,
                life: 4000
            });

            closeModal();
        } else {
            toast.add({
                severity: 'error',
                summary: 'Invalid Promo Code',
                detail: response.error.message,
                life: 4000
            });
        }
    } catch (err) {
        toast.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to validate promo code',
            life: 4000
        });
    } finally {
        isValidatingManualCode.value = false;
    }
};

const formatCurrency = (amount: number) => {
    const formatted = new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(amount);
    return formatted.replace(/\s/g, ''); // Remove spaces
};

const getDiscountText = (promo: Promo) => {
    if (promo.type === 'percentage') {
        return `${promo.value}% OFF`;
    } else {
        return `${formatCurrency(promo.value)} OFF`;
    }
};

const getPromoIcon = (promo: Promo) => {
    return promo.image || '🎁';
};

// Watch for visibility changes
watch(() => props.visible, (newVisible) => {
    if (newVisible) {
        loadAvailablePromos();
    }
}, { immediate: true });
</script>

<template>
    <Dialog :visible="visible" modal header="Available Promo Codes" :style="{ width: '90vw', maxWidth: '500px' }"
        :breakpoints="{ '1199px': '75vw', '575px': '90vw' }" @update:visible="closeModal">

        <!-- Manual Code Entry -->
        <div class="mb-6">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Have a promo code?
            </label>
            <div class="flex gap-2">
                <InputText v-model="manualCode" placeholder="Enter promo code" class="flex-1"
                    :disabled="isValidatingManualCode" @keyup.enter="validateManualCode" />
                <Button label="Apply" @click="validateManualCode" :loading="isValidatingManualCode"
                    :disabled="!manualCode.trim()" severity="secondary" />
            </div>
        </div>

        <Divider />

        <!-- Loading State -->
        <div v-if="loading" class="text-center py-8">
            <ProgressSpinner style="width: 50px; height: 50px" strokeWidth="4" />
            <p class="text-gray-600 dark:text-gray-400 mt-4">Loading available promos...</p>
        </div>

        <!-- Error State -->
        <div v-else-if="error" class="text-center py-8">
            <i class="pi pi-exclamation-triangle text-4xl text-red-500 mb-4"></i>
            <p class="text-red-600 dark:text-red-400 mb-4">{{ error }}</p>
            <Button label="Retry" @click="loadAvailablePromos" outlined />
        </div>

        <!-- Empty State -->
        <div v-else-if="availablePromos.length === 0" class="text-center py-8">
            <i class="pi pi-gift !text-4xl text-gray-300 mb-4"></i>
            <h3 class="text-lg font-semibold text-gray-600 dark:text-gray-400 mt-0 mb-2">
                No promos available
            </h3>
            <p class="text-gray-500 dark:text-gray-500">
                There are no promos available for your current order.
            </p>
        </div>

        <!-- Promos List -->
        <div v-else class="space-y-4">
            <!-- Featured Promos -->
            <div v-if="featuredPromos.length > 0">
                <h3 class="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-3 tracking-wide">
                    ⭐ Featured Offers
                </h3>
                <div class="space-y-3">
                    <div v-for="promo in featuredPromos" :key="promo.id"
                        class="relative p-4 rounded-lg border transition-all duration-200"
                        :class="{
                            'border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800 cursor-pointer hover:shadow-md': promo.applicable,
                            'border-gray-200 bg-gray-50 dark:bg-gray-800 dark:border-gray-600 cursor-not-allowed opacity-60': !promo.applicable,
                            'ring-2 ring-blue-500': selectedPromo?.id === promo.id
                        }" @click="selectPromo(promo)">
                        <!-- Featured Badge -->
                        <!-- <div class="absolute top-2 right-2">
                            <span class="bg-red-500 text-white text-xs px-2 py-1 rounded-full font-semibold">
                                FEATURED
                            </span>
                        </div> -->

                        <div class="flex items-start space-x-3">
                            <!-- Promo Icon -->
                            <div class="text-lg">{{ getPromoIcon(promo) }}</div>

                            <!-- Promo Details -->
                            <div class="flex-1 min-w-0">
                                <div class="flex items-center space-x-2 mb-1">
                                    <h4 class="font-semibold text-base mb-0"
                                        :class="{
                                            'text-gray-900 dark:text-white': promo.applicable,
                                            'text-gray-500 dark:text-gray-400': !promo.applicable
                                        }">
                                        {{ promo.title }}
                                    </h4>
                                    <span class="text-xs px-2 py-1 rounded-full font-bold"
                                        :class="{
                                            'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200': promo.applicable,
                                            'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400': !promo.applicable
                                        }">
                                        {{ getDiscountText(promo) }}
                                    </span>
                                </div>
                                <p class="text-sm mb-2"
                                    :class="{
                                        'text-gray-600 dark:text-gray-400': promo.applicable,
                                        'text-gray-500 dark:text-gray-500': !promo.applicable
                                    }">
                                    {{ promo.description }}
                                </p>
                                
                                <!-- Disabled Reason -->
                                <p v-if="!promo.applicable && promo.disabledReason" class="text-xs text-red-600 dark:text-red-400 mb-2 font-medium">
                                    <i class="pi pi-exclamation-triangle mr-1"></i>
                                    {{ promo.disabledReason }}
                                </p>

                                <div class="flex items-center space-x-4 text-xs"
                                    :class="{
                                        'text-gray-500 dark:text-gray-500': promo.applicable,
                                        'text-gray-400 dark:text-gray-600': !promo.applicable
                                    }">
                                    <span>
                                        <i class="pi pi-tag mr-1"></i>
                                        {{ promo.code }}
                                    </span>
                                    <span>
                                        <i class="pi pi-shopping-cart mr-1"></i>
                                        Min. {{ formatCurrency(promo.minOrderAmount) }}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Other Promos -->
            <div v-if="otherPromos.length > 0">
                <h3 class="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-3 mt-6 uppercase tracking-wide">
                    🎁 Other Offers
                </h3>
                <div class="space-y-3">
                    <div v-for="promo in otherPromos" :key="promo.id"
                        class="p-4 rounded-lg border transition-all duration-200"
                        :class="{
                            'border-gray-200 dark:border-gray-700 cursor-pointer hover:shadow-md hover:border-red-300': promo.applicable,
                            'border-gray-200 bg-gray-50 dark:bg-gray-800 dark:border-gray-600 cursor-not-allowed opacity-60': !promo.applicable,
                            'ring-2 ring-red-500 border-red-500': selectedPromo?.id === promo.id
                        }"
                        @click="selectPromo(promo)">
                        <div class="flex items-start space-x-3">
                            <!-- Promo Icon -->
                            <div class="text-2xl">{{ getPromoIcon(promo) }}</div>

                            <!-- Promo Details -->
                            <div class="flex-1 min-w-0">
                                <div class="flex items-center space-x-2 mb-1">
                                    <h4 class="font-semibold"
                                        :class="{
                                            'text-gray-900 dark:text-white': promo.applicable,
                                            'text-gray-500 dark:text-gray-400': !promo.applicable
                                        }">
                                        {{ promo.title }}
                                    </h4>
                                    <span class="text-xs px-2 py-1 rounded-full font-bold"
                                        :class="{
                                            'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200': promo.applicable,
                                            'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400': !promo.applicable
                                        }">
                                        {{ getDiscountText(promo) }}
                                    </span>
                                </div>
                                <p class="text-sm mb-2"
                                    :class="{
                                        'text-gray-600 dark:text-gray-400': promo.applicable,
                                        'text-gray-500 dark:text-gray-500': !promo.applicable
                                    }">
                                    {{ promo.description }}
                                </p>
                                
                                <!-- Disabled Reason -->
                                <p v-if="!promo.applicable && promo.disabledReason" class="text-xs text-red-600 dark:text-red-400 mb-2 font-medium">
                                    <i class="pi pi-exclamation-triangle mr-1"></i>
                                    {{ promo.disabledReason }}
                                </p>

                                <div class="flex items-center space-x-4 text-xs"
                                    :class="{
                                        'text-gray-500 dark:text-gray-500': promo.applicable,
                                        'text-gray-400 dark:text-gray-600': !promo.applicable
                                    }">
                                    <span>
                                        <i class="pi pi-tag mr-1"></i>
                                        {{ promo.code }}
                                    </span>
                                    <span>
                                        <i class="pi pi-shopping-cart mr-1"></i>
                                        Min. {{ formatCurrency(promo.minOrderAmount) }}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <template #footer>
            <div class="flex justify-end">
                <Button label="Cancel" outlined @click="closeModal" />
            </div>
        </template>
    </Dialog>
</template>

<style scoped>
:deep(.p-dialog-content) {
    padding: 1.5rem;
}

:deep(.p-dialog-footer) {
    padding: 1rem 1.5rem;
}
</style>