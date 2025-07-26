<script setup>
import { ProductService } from '@/service/ProductService';
import { onMounted, ref } from 'vue';

const products = ref([]);
const images = ref([]);

onMounted(() => {
    ProductService.getProductsMini().then((data) => (products.value = data));
});

</script>

<template>
    <Carousel :value="products" :numVisible="1" :numScroll="1" :showNavigators=false circular :autoplayInterval="8000">
        <template #item="slotProps">
            <ImageWithSkeleton :src="slotProps.data.image2" wrapperClass="relative mx-auto aspect-[74/25] md:rounded-xl"
                height="100%" />
            <!-- <div class="relative mx-auto aspect-video">
                <img :src="slotProps.data.image2" :alt="slotProps.data.name" class="w-full h-full object-cover" />
            </div> -->
        </template>
    </Carousel>
</template>

<style scoped>
:deep(.p-carousel-indicator-button) {
    height: .3rem;
    width: 2rem;
    border-radius: 4px;
}

/* :deep(.p-carousel-indicator-list) {
    padding: 2rem 0;
    margin-top: -4rem;
    z-index: 2;
} */
</style>