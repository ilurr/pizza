<script setup>
import { useUserStore } from '@/stores/userStore.ts';
import { computed, ref } from 'vue';

import AppMenuItem from './AppMenuItem.vue';

const userStore = useUserStore();

// Admin menu structure
const adminModel = ref([
    {
        label: 'Home',
        items: [{ label: 'Dashboard', icon: 'pi pi-fw pi-home', to: '/dashboard' }]
    },
    {
        label: 'Management',
        items: [
            { label: 'Orders', icon: 'pi pi-fw pi-shopping-cart', to: '/dashboard/orders' },
            { label: 'Drivers', icon: 'pi pi-fw pi-users', to: '/dashboard/drivers' },
            { label: 'Menu Items', icon: 'pi pi-fw pi-list', to: '/dashboard/menu' },
            { label: 'Analytics', icon: 'pi pi-fw pi-chart-bar', to: '/dashboard/analytics' }
        ]
    }
]);

// Driver menu structure  
const driverModel = ref([
    {
        label: 'Operations',
        items: [
            { label: 'Dashboard', icon: 'pi pi-fw pi-home', to: '/driver' },
            { label: 'Order Requests', icon: 'pi pi-fw pi-bell', to: '/driver/orders' }
        ]
    },
    {
        label: 'Management',
        items: [
            { label: 'Stock Inventory', icon: 'pi pi-fw pi-box', to: '/driver/stock' },
            { label: 'Stock Exchange', icon: 'pi pi-fw pi-arrow-right-arrow-left', to: '/driver/exchange' },
            { label: 'Earnings', icon: 'pi pi-fw pi-wallet', to: '/driver/earnings' }
        ]
    }
]);

// Determine which menu to show based on user role
const model = computed(() => {
    const userRole = userStore.role;

    if (userRole === 'drivers') {
        return driverModel.value;
    } else {
        return adminModel.value;
    }
});
</script>

<template>
    <ul class="layout-menu">
        <template v-for="(item, i) in model" :key="item">
            <app-menu-item v-if="!item.separator" :item="item" :index="i"></app-menu-item>
            <li v-if="item.separator" class="menu-separator"></li>
        </template>
    </ul>
</template>

<style lang="scss" scoped></style>
