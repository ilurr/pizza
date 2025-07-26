<script setup>
import { useUserStore } from '@/stores/userStore';
import { onMounted, ref } from 'vue';
import SplashScreen from '@/components/SplashScreen.vue';
import Toast from 'primevue/toast';

const userStore = useUserStore();
const showSplash = ref(true);

const handleSplashFinished = () => {
    showSplash.value = false;
};

onMounted(() => {
    userStore.fetchUser(); // Fetch user only once
});
</script>

<template>
    <SplashScreen v-if="showSplash" @finished="handleSplashFinished" />
    <router-view v-else />
    <Toast />
</template>

<style scoped></style>
