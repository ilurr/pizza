<script setup>
import { useActiveOrders } from '@/composables/useActiveOrders';
import Badge from 'primevue/badge';
import { computed } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();
const { activeOrdersCount, hasActiveOrders } = useActiveOrders();

const isActive = (path) => {
	return computed(() => {
		if (path === '/') {
			return route.path === '/';
		}
		return route.path.startsWith(path);
	});
};
</script>

<template>
	<div
		class="flex justify-between items-stretch fixed w-full bottom-0 md:bottom-4 md:rounded-md shadow-[0_-1px_12px_0_rgba(0,0,0,0.1)] md:-translate-x-2/4 md:left-2/4 z-10 md:px-4 bg-white dark:bg-neutral-700 max-w-3xl">
		<router-link class="basis-1/5 grow-0 flex justify-center align-center h-full" to="/">
			<button type="button" :class="[
				'button outlined flex flex-col align-center justify-center gap-1 md:w-5/6 h-[70px] font-bold text-sm md:text-base',
				isActive('/').value && 'active'
			]">
				<i class="pi pi-home !text-lg"></i>
				<span>Home</span>
			</button>
		</router-link>
		<router-link class="basis-1/5 grow-0 flex justify-center align-center h-full" to="/menu">
			<button type="button" :class="[
				'button outlined flex flex-col justify-center gap-1 md:w-5/6 h-[70px] font-bold text-sm md:text-base',
				isActive('/menu').value && 'active'
			]">
				<i class="pi pi-receipt !text-lg"></i>
				<span>Menu</span>
			</button>
		</router-link>
		<router-link class="basis-1/5 grow-0 flex justify-center align-center h-full" to="/order/now">
			<button type="button"
				class="order-now-button flex flex-col justify-center gap-1 md:w-5/6 h-[70px] font-bold text-base bg-red-600 text-white rounded-full">
				<i class="pi pi-plus !text-lg"></i>
				<span>Order Now</span>
			</button>
		</router-link>
		<router-link class="basis-1/5 grow-0 flex justify-center align-center h-full" to="/order/my">
			<button type="button" :class="[
				'button outlined flex flex-col justify-center gap-1 md:w-5/6 h-[70px] font-bold text-sm md:text-base relative',
				isActive('/order/my').value && 'active'
			]">
				<div class="relative">
					<i class="pi pi-shopping-cart !text-lg"></i>
					<Badge v-if="hasActiveOrders" severity="danger"
						class="absolute -top-1 right-2 min-w-[10px] h-[10px] text-[8px]" />
				</div>
				<span>My Order</span>
			</button>
		</router-link>
		<router-link class="basis-1/5 grow-0 flex justify-center align-center h-full" to="/profile">
			<button type="button" :class="[
				'button outlined flex flex-col justify-center gap-1 md:w-5/6 h-[70px] font-bold text-sm md:text-base',
				isActive('/profile').value && 'active'
			]">
				<i class="pi pi-user !text-lg"></i>
				<span>Profile</span>
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
	transition: all .2s ease;
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