<script setup lang="ts">
import { useCartStore } from '@/stores/cartStore.js';

interface Props {
    visible?: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{
    'show-cart': [];
}>();

const cartStore = useCartStore();

const showCartModal = () => {
    emit('show-cart');
};
</script>

<template>
    <!-- Floating Cart Bar -->
    <Transition enter-active-class="transition-all duration-300 ease-out"
        enter-from-class="transform translate-y-full opacity-0" enter-to-class="transform translate-y-0 opacity-100"
        leave-active-class="transition-all duration-300 ease-in" leave-from-class="transform translate-y-0 opacity-100"
        leave-to-class="transform translate-y-full opacity-0">
        <div v-if="!cartStore.isEmpty && visible"
            class="fixed bottom-0 left-0 right-0 z-50 bg-papa-yellow dark:bg-gray-800 shadow-lg border-t border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200"
            @click="showCartModal">
            <div class="relative p-4 lg:px-80">
                <div class="flex items-center justify-between">
                    <!-- Cart Summary -->
                    <div class="flex items-center space-x-3">
                        <div class="w-10 h-10 bg-papa-red rounded-full flex items-center justify-center">
                            <i class="pi pi-shopping-cart text-white"></i>
                        </div>
                        <div>
                            <p class="font-semibold text-gray-900 dark:text-white mb-0">
                                Your Order: {{ cartStore.totalItems }} {{ cartStore.totalItems === 1 ? 'item' : 'items'
                                }}
                            </p>
                            <p class="text-sm text-gray-800 dark:text-gray-400">
                                Total: {{ cartStore.formattedTotalPrice }}
                            </p>
                        </div>
                    </div>

                    <!-- Action Arrow -->
                    <div class="flex items-center justify-center w-[25px] md:w-auto md:gap-2 space-x-2">
                        <!-- <span class="text-sm text-gray-500 dark:text-gray-400 hidden sm:block">
                            Tap to view details
                        </span> -->
                        <i class="pi pi-chevron-up text-gray-900 dark:text-gray-400 !text-xl !m-0"></i>
                    </div>
                </div>
            </div>
        </div>
    </Transition>
</template>

<style scoped>
/* Additional styles if needed */
</style>