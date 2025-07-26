<script setup lang="ts">
import FloatingMenu from '@/components/landing/FloatingMenu.vue';
import HeroWidget from '@/components/landing/HeroWidget.vue';
import PizzaCard from '@/components/PizzaCard.vue';
import ProductDetailModal from '@/components/ProductDetailModal.vue';
import AppTopbar from '@/layout/AppTopbar.vue';
import { ProductService } from '@/service/ProductService.js';
import { onMounted, ref } from 'vue';

const popularPizzas = ref([]);
const modalVisible = ref(false);
const selectedPizza = ref(null);

const showPizzaDetail = (pizza) => {
    selectedPizza.value = pizza;
    modalVisible.value = true;
};

const addToCart = (pizza, quantity = 1) => {
    console.log('Adding to cart:', pizza.name, 'Quantity:', quantity);
    // Implement cart logic here
};

onMounted(async () => {
    try {
        const allPizzas = await ProductService.getPizzas();
        // Get available AND popular pizzas only (max 8 items)
        popularPizzas.value = allPizzas
            .filter(pizza => pizza.popular && pizza.available)
            .slice(0, 8);
    } catch (error) {
        console.error('Error loading popular pizzas:', error);
    }
});
</script>

<template>
    <div class="bg-white dark:bg-neutral-900">
        <div class="landing-wrapper overflow-hidden">
            <app-topbar></app-topbar>
            <FloatingMenu />
            <div class="relative lg:mx-80 mx-auto pt-16 md:pt-16 mb-32">
                <HeroWidget />

                <!-- Popular Products Section -->
                <div class="relative p-4 md:px-0">
                    <div class="flex justify-between items-center mb-4">
                        <h2 class="text-surface-900 dark:text-surface-0 text-xl font-bold mt-6 mb-0 text-left">
                            🔥 Popular </h2>
                        <router-link to="/menu" class="text-papa-red hover:text-red-700 font-medium">
                            View All →
                        </router-link>
                    </div>

                    <!-- Popular Pizza Container -->
                    <div
                        class="popular-pizza overflow-x-auto scrollbar-hide -ml-[14px] -mr-[14px] md:ml-0 md:mr-0 md:overflow-visible">
                        <PizzaCard v-for="pizza in popularPizzas" :key="pizza.id" :pizza="pizza" variant="popular"
                            @add-to-cart="addToCart" @show-detail="showPizzaDetail" />
                    </div>
                </div>

                <div class="relative p-4 md:px-0 my-8">
                    <div class="text-surface-900 dark:text-surface-0 text-xl font-bold mb-4 text-left w-full px-2">🤨
                        Masih
                        Bingung?
                        Coba
                        Baca Ini!</div>
                    <Accordion value="0">
                        <AccordionPanel value="0">
                            <AccordionHeader>Apa itu Voyee</AccordionHeader>
                            <AccordionContent>
                                <p class="m-0">
                                    <b>Voyee</b> adalah Kopi Keliling Pertama di Surabaya yang bisa kamu pesan lewat
                                    online dan
                                    langsung
                                    dikirim ke tampatmu tanpa bayar ongkos kirim.
                                </p>
                            </AccordionContent>
                        </AccordionPanel>
                        <AccordionPanel value="1">
                            <AccordionHeader>Beneran ongkirnya gratis?</AccordionHeader>
                            <AccordionContent>
                                <p class="m-0">
                                    Iyaa seriusan! Gratis tanpa ada syarat apapun lagi.
                                </p>
                            </AccordionContent>
                        </AccordionPanel>
                        <AccordionPanel value="2">
                            <AccordionHeader>Voyee bisa dipesan dari mana aja?</AccordionHeader>
                            <AccordionContent>
                                <p class="m-0">
                                    Untuk saat ini kamu bisa pesan dan kirim Kopi Voyee ke 2 kecamatan, yaitu Kecamatan
                                    Genteng dan
                                    Kecamatan Gubeng Kota Surabaya.
                                </p>
                            </AccordionContent>
                        </AccordionPanel>
                        <AccordionPanel value="3">
                            <AccordionHeader>Gimana cara bayar QRIS-nya? Kan QR-Code nya ada di layar hp sendiri?
                            </AccordionHeader>
                            <AccordionContent>
                                <p class="m-0">
                                    Gampang banget, kamu tinggal screenshot <strong>QR-Code</strong> yang tampil di
                                    layar, lalu buka
                                    aplikasi M-Banking. Dan pilih pembayaran dengan QRIS, terakhir upload foto
                                    screenshot
                                    <strong>QR-Code</strong> tadi pada menu upload foto.
                                </p>
                            </AccordionContent>
                        </AccordionPanel>
                    </Accordion>
                </div>

            </div>
        </div>

        <!-- Product Detail Modal -->
        <ProductDetailModal :visible="modalVisible" :pizza="selectedPizza"
            @update:visible="(value) => modalVisible = value" @add-to-cart="addToCart" />
    </div>
</template>

<style lang="scss" scoped>
.scrollbar-hide {
    -ms-overflow-style: none;
    scrollbar-width: none;

    &::-webkit-scrollbar {
        display: none;
    }
}

.popular-pizza {
    display: flex;
    flex-wrap: nowrap;
    gap: 1rem;

    @media (min-width: 768px) {
        flex-wrap: wrap;
    }

    .card-item {
        // height: 100%;
        flex-basis: 300px;
        flex-grow: 0;
        flex-shrink: 0;

        @media (min-width: 768px) {
            flex-basis: calc(50% - (1rem / 2));
        }

        &:first-child {
            margin-left: 1rem;

            @media (min-width: 768px) {
                margin-left: 0;
            }
        }

        &:last-child {
            margin-right: 1rem;

            @media (min-width: 768px) {
                margin-right: 0;
            }
        }
    }
}
</style>
