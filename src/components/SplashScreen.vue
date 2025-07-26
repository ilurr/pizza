<template>
    <div v-if="isVisible" class="fixed inset-0 bg-papa-red flex items-center justify-center z-50 animate-fadeIn">
        <div class="text-center text-white animate-slideUp">
            <!-- Logo -->
            <div class="mb-8">
                <img src="/src/assets/images/LogoSquareRedSVG.svg" alt="Papa Pizza"
                    class="w-64 h-64 mx-auto animate-bounce">
            </div>

            <!-- Brand Name -->
            <!-- <h1 class="text-4xl md:text-5xl font-bold mb-2 drop-shadow-lg">Panggil Papa Pizza</h1> -->
            <p class="text-lg md:text-xl mb-12 opacity-90 font-light">
                serving <em><b>quality pizza</b></em><br>
                that cooked <em><b>fresh from the oven</b></em>
            </p>

            <!-- Spinner -->
            <div class="my-8">
                <div class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4">
                </div>
                <p class="text-sm opacity-80 font-light">Loading...</p>
            </div>

            <!-- Version -->
            <div class="absolute bottom-8 left-1/2 transform -translate-x-1/2">
                <span class="text-sm opacity-70 font-light">v{{ version }}</span>
            </div>
        </div>
    </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import packageInfo from '../../package.json';

const isVisible = ref(true);
const version = ref(packageInfo.version);

defineProps({
    duration: {
        type: Number,
        default: 3000
    }
});

const emit = defineEmits(['finished']);

onMounted(() => {
    setTimeout(() => {
        isVisible.value = false;
        emit('finished');
    }, 3000);
});

defineExpose({
    hide: () => {
        isVisible.value = false;
        emit('finished');
    }
});
</script>

<style scoped>
/* Custom animations for Tailwind */
@keyframes fadeIn {
    from {
        opacity: 0;
    }

    to {
        opacity: 1;
    }
}

@keyframes slideUp {
    from {
        transform: translateY(30px);
        opacity: 0;
    }

    to {
        transform: translateY(0);
        opacity: 1;
    }
}

.animate-fadeIn {
    animation: fadeIn 0.5s ease-in-out;
}

.animate-slideUp {
    animation: slideUp 0.8s ease-out;
}
</style>