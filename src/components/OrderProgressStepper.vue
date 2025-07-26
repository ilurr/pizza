<script setup lang="ts">
import { useOrderStore } from '@/stores/orderStore.js';

interface Props {
    variant?: 'summary' | 'page-header';
    pageTitle?: string;
}

const props = withDefaults(defineProps<Props>(), {
    variant: 'summary'
});

const emit = defineEmits<{
    'edit-location': [];
    'edit-driver': [];
    'reset-order': [];
    'back': [];
}>();

const orderStore = useOrderStore();

const editLocation = () => {
    emit('edit-location');
};

const editDriver = () => {
    emit('edit-driver');
};

const resetOrder = () => {
    emit('reset-order');
};

const goBack = () => {
    emit('back');
};
</script>

<template>
    <!-- Page Header Variant -->
    <div v-if="variant === 'page-header'"
        class="sticky top-4 z-50 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-4 mb-6">
        <div class="flex items-center justify-between">
            <div class="flex items-center space-x-3">
                <Button icon="pi pi-arrow-left" outlined size="small" @click="goBack" />
                <h1 class="text-xl font-semibold text-gray-900 dark:text-white">{{ pageTitle || 'Page' }}</h1>
            </div>
        </div>
    </div>

    <!-- Order Summary Variant -->
    <div v-else-if="orderStore.userLocation || orderStore.selectedDriver"
        class="sticky top-4 z-50 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-4 mb-6">
        <div class="flex items-center justify-between mb-3">
            <h4 class="font-medium text-lg text-gray-900 dark:text-white mb-0">Order Summary</h4>
            <Button icon="pi pi-replay" text severity="warn" size="small" v-tooltip="'Reset Order'"
                @click="resetOrder" />
        </div>

        <div class="space-y-3">
            <!-- Location Summary -->
            <div v-if="orderStore.userLocation" class="flex items-center justify-between">
                <div class="flex items-center space-x-3">
                    <i class="pi pi-map-marker text-green-600"></i>
                    <div>
                        <p class="text-sm font-medium text-gray-900 dark:text-white mb-0">Location</p>
                        <p class="text-xs text-gray-600 dark:text-gray-400 truncate max-w-[220px] md:max-w-md">
                            {{ orderStore.userLocation.address }}
                        </p>
                    </div>
                </div>
                <Button label="Edit" size="small" severity="secondary" text @click="editLocation" />
            </div>

            <!-- Driver Summary -->
            <div v-if="orderStore.selectedDriver" class="flex items-center justify-between">
                <div class="flex items-center space-x-3">
                    <i class="pi pi-user text-blue-600"></i>
                    <div>
                        <p class="text-sm font-medium text-gray-900 dark:text-white mb-0">Chef</p>
                        <p class="text-xs text-gray-600 dark:text-gray-400">
                            {{ orderStore.selectedDriver.name }}
                            <!-- ({{ orderStore.selectedDriver.rating }}⭐) -->
                        </p>
                    </div>
                </div>
                <Button label="Change" size="small" severity="secondary" text @click="editDriver" />
            </div>
        </div>
    </div>
</template>

<style scoped>
/* Additional custom styles if needed */
</style>