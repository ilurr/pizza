<script setup>
import FloatingMenu from '@/components/landing/FloatingMenu.vue';
import { useLayout } from '@/layout/composables/layout';
import { useDriverStore } from '@/stores/driverStore.js';
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AppFooter from './AppFooter.vue';
import AppSidebar from './AppSidebar.vue';
import AppTopbar from './AppTopbar.vue';

const route = useRoute();
const router = useRouter();
const driverStore = useDriverStore();
const { layoutConfig, layoutState, isSidebarActive } = useLayout();

const isDriverRoute = computed(() => route.path.startsWith('/driver'));

// Use simple page-header (back + title) for driver sub-pages, same pattern as user/buyer
const driverPageHeader = computed(() => {
    if (route.path === '/driver/order/offline') return { title: 'Walk-in Cashier', back: '/driver' };
    if (route.path === '/driver/orders') return { title: 'Order history', back: '/driver' };
    if (route.path === '/driver/orders/online') return { title: 'Delivery', back: '/driver/orders' };
    if (route.path === '/driver/stock') return { title: 'Stock', back: '/driver' };
    if (route.path === '/driver/earnings') return { title: 'Earnings', back: '/driver' };
    return null;
});

const goBackDriver = () => {
    if (driverPageHeader.value?.back) router.push(driverPageHeader.value.back);
};

const driverMenuItems = [
    { path: '/driver', label: 'Dashboard', icon: 'pi-home' },
    { path: '/driver/order/offline', label: 'Walk-in', icon: 'pi-money-bill' },
    { path: '/driver/orders/online', label: 'Delivery', icon: 'pi-truck', showBadge: true },
    { path: '/driver/stock', label: 'Stock', icon: 'pi-box' },
    { path: '/driver/earnings', label: 'Earnings', icon: 'pi-wallet' }
];

const driverBadgeCounts = computed(() => ({
    '/driver/orders/online': driverStore.ordersRequiringAction?.length ?? 0
}));

const outsideClickListener = ref(null);

watch(isSidebarActive, (newVal) => {
    if (newVal) {
        bindOutsideClickListener();
    } else {
        unbindOutsideClickListener();
    }
});

const containerClass = computed(() => {
    return {
        'layout-overlay': layoutConfig.menuMode === 'overlay',
        'layout-static': layoutConfig.menuMode === 'static',
        'layout-static-inactive': layoutState.staticMenuDesktopInactive && layoutConfig.menuMode === 'static',
        'layout-overlay-active': layoutState.overlayMenuActive,
        'layout-mobile-active': layoutState.staticMenuMobileActive
    };
});

function bindOutsideClickListener() {
    if (!outsideClickListener.value) {
        outsideClickListener.value = (event) => {
            if (isOutsideClicked(event)) {
                layoutState.overlayMenuActive = false;
                layoutState.staticMenuMobileActive = false;
                layoutState.menuHoverActive = false;
            }
        };
        document.addEventListener('click', outsideClickListener.value);
    }
}

function unbindOutsideClickListener() {
    if (outsideClickListener.value) {
        document.removeEventListener('click', outsideClickListener);
        outsideClickListener.value = null;
    }
}

function isOutsideClicked(event) {
    const sidebarEl = document.querySelector('.layout-sidebar');
    const topbarEl = document.querySelector('.layout-menu-button');

    // Check if sidebar was clicked
    const sidebarClicked = sidebarEl && (sidebarEl.isSameNode(event.target) || sidebarEl.contains(event.target));

    // Check if menu button was clicked (only if it exists)
    const topbarClicked = topbarEl && (topbarEl.isSameNode(event.target) || topbarEl.contains(event.target));

    return !(sidebarClicked || topbarClicked);
}
</script>

<template>
    <div class="layout-wrapper" :class="containerClass">
        <app-topbar v-if="driverPageHeader" variant="page-header" :page-title="driverPageHeader.title"
            @back="goBackDriver" />
        <app-topbar v-else :admin="true"></app-topbar>
        <app-sidebar></app-sidebar>
        <div class="layout-main-container">
            <div class="layout-main" :class="{ 'pb-24': isDriverRoute }">
                <router-view></router-view>
            </div>
            <app-footer></app-footer>
        </div>
        <div class="layout-mask animate-fadein"></div>
        <FloatingMenu v-if="isDriverRoute" :items="driverMenuItems" :badge-counts="driverBadgeCounts" />
    </div>
    <Toast />
</template>
