<script setup>
import { useActiveOrders } from '@/composables/useActiveOrders';
import Badge from 'primevue/badge';
import { computed } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();
const { hasActiveOrders } = useActiveOrders();

/** Menu item: path, label, icon (PrimeIcons class e.g. 'pi-home'), highlight (center CTA), showBadge */
const USER_MENU_ITEMS = [
    { path: '/', label: 'Home', icon: 'pi-home' },
    { path: '/menu', label: 'Menu', icon: 'pi-receipt' },
    { path: '/order/now', label: 'Order Now', icon: 'pi-plus', highlight: true },
    { path: '/order/my', label: 'My Order', icon: 'pi-shopping-cart', showBadge: true },
    { path: '/profile', label: 'Profile', icon: 'pi-user' }
];

const props = defineProps({
    /** Override menu items (e.g. driver menu). If not set, uses default user menu. */
    items: { type: Array, default: null },
    /** Optional badge counts by path, e.g. { '/order/my': true, '/driver/orders': 3 }. Used when items are provided. */
    badgeCounts: { type: Object, default: () => ({}) }
});

const menuItems = computed(() => props.items || USER_MENU_ITEMS);

/** Root container classes vary slightly by area (user / driver / admin). */
const containerClasses = computed(() => {
    const base =
        'flex justify-between items-stretch fixed w-full bottom-0 md:bottom-4 md:rounded-md shadow-[0_-1px_12px_0_rgba(0,0,0,0.1)] md:-translate-x-2/4 md:left-2/4 z-10 md:px-4 bg-white dark:bg-neutral-700 max-w-3xl z-50';

    if (route.path.startsWith('/driver')) {
        return `${base} driver-floating-menu`;
    }
    if (route.path.startsWith('/admin')) {
        return `${base} admin-floating-menu`;
    }
    return `${base} user-floating-menu`;
});

/** First item (index 0) uses exact match so Dashboard/Home is only active on that route. */
const isActive = (path, index) => {
    return computed(() => {
        if (index === 0) return route.path === path;
        return route.path === path || route.path.startsWith(path + '/');
    });
};

const showBadge = (item) => {
    if (!item.showBadge) return false;
    if (props.items) {
        const v = props.badgeCounts[item.path];
        return typeof v === 'number' ? v > 0 : !!v;
    }
    return hasActiveOrders.value;
};
</script>

<template>
    <div :class="containerClasses">
        <router-link v-for="(item, index) in menuItems" :key="item.path"
            class="basis-1/5 grow-0 flex justify-center items-center h-full" :to="item.path">
            <button type="button" :class="[
                'flex flex-col items-center justify-center gap-1 md:w-5/6 h-[70px] font-bold text-sm md:text-base',
                item.highlight ? 'order-now-button bg-red-600 text-white rounded-full text-base' : 'button outlined',
                item.highlight ? '' : (isActive(item.path, index).value && 'active')
            ]">
                <div class="relative">
                    <i :class="['pi', item.icon, '!text-lg']"></i>
                    <Badge v-if="showBadge(item)" severity="danger"
                        class="absolute -top-1 -right-2 min-w-[10px] h-[10px] text-[8px]" />
                </div>
                <span>{{ item.label }}</span>
            </button>
        </router-link>
    </div>
</template>

<style scoped>
.button.active {
    border-top: 2px solid #ff0009;
    color: #ff0009;
}

.order-now-button {
    /* transform: scale(1.1); */
    margin-top: -1rem;
    box-shadow: 0 4px 12px rgba(220, 38, 38, 0.3);
    padding: 0.5rem;
    width: 84px;
    height: 84px;
    transition: all 0.2s ease;
}

.order-now-button:hover {
    transform: scale(1.15);
    box-shadow: 0 6px 16px rgba(220, 38, 38, 0.4);
}

/* Badge styling */
:deep(.p-badge) {
    font-size: 0;
    min-width: 10px;
    height: 10px;
    line-height: 10px;
    padding: 0;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
}

:deep(.p-badge.p-badge-danger) {
    background-color: #dc3545;
    color: white;
}
</style>
