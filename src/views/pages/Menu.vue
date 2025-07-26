<script setup lang="ts">
import FloatingMenu from '@/components/landing/FloatingMenu.vue';
import PizzaCard from '@/components/PizzaCard.vue';
import ProductDetailModal from '@/components/ProductDetailModal.vue';
import AppTopbar from '@/layout/AppTopbar.vue';

import { ProductService } from '@/service/ProductService.js';
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();

const pizzas = ref([]);
const beverages = ref([]);
const orders = ref([]);
const modalVisible = ref(false);
const selectedPizza = ref(null);

const getStatusColor = (status) => {
    switch (status) {
        case 'delivered':
            return 'bg-green-100 text-green-800';
        case 'preparing':
            return 'bg-blue-100 text-blue-800';
        case 'on_delivery':
            return 'bg-yellow-100 text-yellow-800';
        case 'cancelled':
            return 'bg-red-100 text-red-800';
        default:
            return 'bg-gray-100 text-gray-800';
    }
};

const showPizzaDetail = (pizza) => {
    selectedPizza.value = pizza;
    modalVisible.value = true;
};

const goBack = () => {
    router.push('/');
};

const addToCart = (pizza, quantity = 1) => {
    console.log('Adding to cart:', pizza.name, 'Quantity:', quantity);
    // Implement cart logic here
};

onMounted(async () => {
    try {
        const allPizzas = await ProductService.getPizzas();
        // Sort pizzas: available ones first, unavailable ones last
        pizzas.value = allPizzas.sort((a, b) => {
            if (a.available === b.available) return 0;
            return a.available ? -1 : 1;
        });
        beverages.value = await ProductService.getBeverages();
        orders.value = await ProductService.getOrders();
    } catch (error) {
        console.error('Error loading data:', error);
    }
});

</script>

<template>
    <div class="bg-white dark:bg-neutral-900">
        <div class="landing-wrapper overflow-hidden">
            <app-topbar variant="page-header" page-title="Our Menu" @back="goBack"></app-topbar>
            <FloatingMenu />
            <div class="relative lg:mx-80 mx-auto pt-16 md:pt-16 mb-32">

                <!-- Pizzas Section -->
                <div class="relative p-4 md:px-0 mb-8">
                    <h2 class="text-surface-900 dark:text-surface-0 text-xl font-bold mt-6 mb-4 text-left px-2">
                        🔥 Pizzas </h2>
                    <div class="flex flex-wrap gap-4 thumb">
                        <PizzaCard v-for="pizza in pizzas" :key="pizza.id" :pizza="pizza" @add-to-cart="addToCart"
                            @show-detail="showPizzaDetail" />
                    </div>
                </div>

            </div>
        </div>

        <!-- Product Detail Modal -->
        <ProductDetailModal v-model:visible="modalVisible" :pizza="selectedPizza" @add-to-cart="addToCart" />
    </div>
</template>

<style scoped>
/* .thumb>.card-item {
    flex-basis: calc(50% - 3rem);
    flex-grow: 1;
} */
</style>