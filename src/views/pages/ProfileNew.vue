<script setup lang="ts">
import FloatingMenu from '@/components/landing/FloatingMenu.vue';
import ProfileContent from '@/components/shared/ProfileContent.vue';
import AppTopbar from '@/layout/AppTopbar.vue';
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();

// Detect if we're in dashboard context
const isDashboard = computed(() => route.path.startsWith('/dashboard'));

const goBack = () => {
    if (isDashboard.value) {
        router.push('/dashboard');
    } else {
        router.push('/');
    }
};
</script>

<template>
    <div class="bg-white dark:bg-neutral-900">
        <div class="landing-wrapper overflow-hidden">
            <!-- Topbar for customer-facing pages -->
            <app-topbar v-if="!isDashboard" variant="page-header" page-title="Profile" @back="goBack" />

            <div :class="['relative mx-auto mb-32', isDashboard ? 'pt-8' : 'lg:mx-80 pt-16 md:pt-16']">
                <div class="relative md:py-4">
                    <!-- Shared Profile Content -->
                    <ProfileContent :variant="isDashboard ? 'dashboard' : 'customer'" :show-stats="isDashboard" />
                </div>
            </div>
        </div>

        <!-- Floating Menu for customer pages only -->
        <FloatingMenu v-if="!isDashboard" />
    </div>
</template>

<style scoped>
.landing-wrapper {
    min-height: 100vh;
}
</style>