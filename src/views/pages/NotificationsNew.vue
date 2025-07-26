<script setup lang="ts">
import FloatingMenu from '@/components/landing/FloatingMenu.vue';
import NotificationContent from '@/components/shared/NotificationContent.vue';
import AppTopbar from '@/layout/AppTopbar.vue';
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();

// Detect if we're in dashboard context
const isDashboard = computed(() => route.path.startsWith('/dashboard'));

const notificationStats = ref({
    total: 0,
    unread: 0,
    payment: 0,
    system: 0
});

const goBack = () => {
    if (isDashboard.value) {
        router.push('/dashboard');
    } else {
        router.push('/');
    }
};

const handleMarkAllRead = () => {
    // Handle from topbar if needed
};

const handleClearAll = () => {
    // Handle from topbar if needed
};
</script>

<template>
    <div class="bg-surface-0 dark:bg-surface-900">
        <div class="landing-wrapper overflow-hidden">
            <!-- Topbar for customer-facing pages -->
            <app-topbar v-if="!isDashboard" variant="page-header" page-title="Notifications"
                :show-notification-actions="true" :notification-stats="notificationStats" @back="goBack"
                @mark-all-read="handleMarkAllRead" @clear-all="handleClearAll" />

            <div :class="['relative mx-auto mb-32', isDashboard ? 'pt-0' : 'lg:mx-80 pt-16 md:pt-16']">
                <div class="relative md:py-4">
                    <!-- Shared Notification Content -->
                    <NotificationContent :variant="isDashboard ? 'dashboard' : 'customer'" :show-stats="isDashboard"
                        @mark-all-read="handleMarkAllRead" @clear-all="handleClearAll" />
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