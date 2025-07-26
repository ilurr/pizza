<script setup>
import { useUserStore } from '@/stores/userStore';

const userStore = useUserStore();
</script>

<template>
    <div className="card">
        <div class="font-semibold text-xl mb-4" v-if="userStore.user">
            <p>
                Hello, <strong>{{ userStore.user.username }}!</strong>
            </p>
            <p>
                Your role is: <strong>{{ userStore.role }}</strong>
            </p>
        </div>
    </div>
    <!-- <div class="grid grid-cols-12 gap-8">
        <StatsWidget />

        <div class="col-span-12 xl:col-span-6">
            <RecentSalesWidget />
            <BestSellingWidget />
        </div>
        <div class="col-span-12 xl:col-span-6">
            <RevenueStreamWidget />
            <NotificationsWidget />
        </div>
    </div> -->
</template>
