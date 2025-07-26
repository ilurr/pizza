<script setup>
import { useDriverStore } from '@/stores/driverStore.js';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, onUnmounted, ref } from 'vue';

const driverStore = useDriverStore();
const toast = useToast();

const refreshInterval = ref(null);

// Computed properties
const statusColor = computed(() => {
	return driverStore.isOnline ? 'success' : 'danger';
});

const statusText = computed(() => {
	return driverStore.isOnline ? 'Available' : 'Closed';
});

// Auto-determine if driver is busy from active orders
const isBusy = computed(() => {
	return driverStore.activeOrders.length > 0;
});

const formatCurrency = (amount) => {
	const formatted = new Intl.NumberFormat('id-ID', {
		style: 'currency',
		currency: 'IDR',
		minimumFractionDigits: 0
	}).format(amount);
	return formatted.replace(/\s/g, ''); // Remove spaces
};

const todayEarnings = computed(() => {
	return formatCurrency(driverStore.stats.todayEarnings);
});

// Quick stats for cards
const quickStats = computed(() => [
	{
		title: 'Pending Orders',
		value: driverStore.ordersRequiringAction.length,
		icon: 'pi pi-clock',
		color: 'orange',
		subtitle: 'Need attention'
	},
	{
		title: 'Active Orders',
		value: driverStore.activeOrders.length,
		icon: 'pi pi-truck',
		color: 'blue',
		subtitle: 'In progress'
	},
	{
		title: "Today's Deliveries",
		value: driverStore.stats.todayDeliveries,
		icon: 'pi pi-check-circle',
		color: 'green',
		subtitle: 'Completed'
	},
	{
		title: "Today's Earnings",
		value: todayEarnings.value,
		icon: 'pi pi-wallet',
		color: 'purple',
		subtitle: 'Total earned',
		isCurrency: true
	}
]);

// Methods
const toggleOnlineStatus = async () => {
	driverStore.toggleOnlineStatus();

	if (driverStore.isOnline) {
		await driverStore.updateLocation();
		toast.add({
			severity: 'success',
			summary: 'You are now online',
			detail: 'You will start receiving order requests',
			life: 3000
		});
	} else {
		toast.add({
			severity: 'info',
			summary: 'You are now offline',
			detail: 'You will not receive new order requests',
			life: 3000
		});
	}
};


const refreshData = async () => {
	await driverStore.loadOrders();
	await driverStore.updateLocation();
};

const formatTime = (dateString) => {
	return new Date(dateString).toLocaleTimeString('id-ID', {
		hour: '2-digit',
		minute: '2-digit'
	});
};

// Lifecycle
onMounted(async () => {
	await driverStore.initializeDriver('driver_001');

	// Set up periodic refresh
	refreshInterval.value = setInterval(refreshData, 30000); // Every 30 seconds
});

onUnmounted(() => {
	if (refreshInterval.value) {
		clearInterval(refreshInterval.value);
	}
});
</script>

<template>
	<div class="relative p-4 md:p-0">
		<!-- Header with Driver Status -->
		<h3 class="text-surface-900 dark:text-surface-0 text-xl font-bold !mt-2 mb-4 text-left px-2">Welcome back, Chef! 👋
		</h3>
		<div
			class="relative z-50 bg-white dark:bg-neutral-800 rounded-lg shadow-lg border border-gray-200 dark:border-transparent p-4 mb-6">
			<div class="flex flex-col gap-4 items-center">
				<div class="flex items-center gap-4 w-full">
					<div class="flex items-center gap-4">
						<Avatar :image="driverStore.driverProfile?.avatar" size="xlarge" shape="circle" />
						<div>
							<div class="font-medium text-xl text-gray-900 dark:text-white mb-1 truncate">{{
								driverStore.driverProfile?.name }}</div>
							<div class="flex items-center gap-2">
								<Tag :value="statusText" :severity="statusColor" />
								<!-- <Tag v-if="driverStore.isOnline && isBusy" value="Cooking" severity="warn" /> -->
								<!-- <span class="text-sm text-600">
																	{{ driverStore.driverProfile?.vehicleInfo?.model }} - {{ driverStore.driverProfile?.vehicleInfo?.plate }}
															</span> -->
							</div>
						</div>
					</div>

					<div class="flex gap-3 ml-auto items-center">
						<!-- Online/Offline Toggle Switch -->
						<div class="flex items-center gap-2">
							<!-- <span class="text-sm text-600">{{ driverStore.isOnline ? 'Online' : 'Offline' }}</span> -->
							<!-- <ToggleButton v-model="driverStore.isOnline" onLabel="ON" offLabel="OFF" size="large" class="min-w-24"
							@change="toggleOnlineStatus" /> -->
							<Button :label="driverStore.isOnline ? 'ON' : 'OFF'" rounded
								:severity="driverStore.isOnline ? 'success' : 'danger'" @click="toggleOnlineStatus"
								:icon="driverStore.isOnline ? 'pi pi-face-smile' : 'pi pi-power-off'" />
							<!-- <Button :label="driverStore.isAvailable ? 'Set Busy' : 'Set Available'"
							:severity="driverStore.isAvailable ? 'warn' : 'info'" @click="toggleAvailability" outlined
							:disabled="!driverStore.isOnline" :icon="driverStore.isAvailable ? 'pi pi-pause' : 'pi pi-check'" /> -->

						</div>
						<!-- <Button label="Refresh" icon="pi pi-refresh" @click="refreshData" :loading="driverStore.isLoadingOrders" outlined size="small" /> -->
					</div>
				</div>
				<div class="relative text-base/6 w-full pt-4 pb-2 border-t">
					Your coverage area: <br><strong>Gayungan, Tambaksari, Gubeng, Wonorejo</strong>
				</div>
			</div>
		</div>

		<!-- Quick Stats -->
		<div v-for="stat in quickStats" :key="stat.title">
			<div class="card text-center">
				<div class="text-900 font-medium text-xl mb-2">{{ stat.title }}</div>
				<div class="flex items-center justify-content-center mb-3">
					<i :class="[stat.icon, `text-${stat.color}-500`]" class="mr-2 text-2xl"></i>
					<span class="text-2xl font-bold" :class="`text-${stat.color}-500`">
						{{ stat.isurrency ? stat.value : stat.value }}
					</span>
				</div>
				<div class="text-600 text-sm">{{ stat.subtitle }}</div>
			</div>
		</div>

		<!-- Recent Activity -->
		<div class="card w-full">
			<div class="flex items-center justify-content-between mb-4">
				<h5>Recent Orders</h5>
				<router-link to="/driver/orders">
					<Button label="View All" outlined size="small" />
				</router-link>
			</div>

			<DataTable :value="[...driverStore.activeOrders, ...driverStore.pendingOrders].slice(0, 5)"
				responsiveLayout="scroll" :paginator="false">
				<Column field="orderNumber" header="Order #" />
				<Column field="customerName" header="Customer" />
				<Column header="Status">
					<template #body="{ data }">
						<Tag :value="data.status" :severity="data.status === 'pending' ? 'warning' : 'info'" />
					</template>
				</Column>
				<Column header="Total">
					<template #body="{ data }">
						<span class="font-semibold">
							{{ formatCurrency(data.total) }}
						</span>
					</template>
				</Column>
				<Column header="Distance">
					<template #body="{ data }">
						{{ data.distance }}km
					</template>
				</Column>
			</DataTable>

			<div v-if="driverStore.pendingOrders.length === 0 && driverStore.activeOrders.length === 0"
				class="text-center py-6 text-600">
				<i class="pi pi-inbox text-4xl mb-3 block"></i>
				<p class="text-lg mb-2">No orders yet</p>
				<!-- <p class="text-sm">{{ driverStore.isOnline ? 'Waiting for new orders...' : 'Go online to receive orders' }}</p> -->
			</div>
		</div>

		<!-- Performance & Location -->
		<div class="card mb-4">
			<h5>Performance Rating</h5>
			<div class="text-center">
				<div class="text-4xl font-bold text-blue-500 mb-2">
					{{ driverStore.stats.rating }}
				</div>
				<div class="flex items-center justify-content-center mb-3">
					<i class="pi pi-star-fill text-yellow-500 mr-1" v-for="n in 5" :key="n"></i>
				</div>
				<div class="text-sm text-600">
					Based on {{ driverStore.stats.totalDeliveries }} deliveries
				</div>
			</div>
		</div>

		<div class="card">
			<h5>Location Status</h5>
			<div class="text-sm text-600 mb-3">
				<i class="pi pi-map-marker mr-2"></i>
				Coverage Area: {{ driverStore.coverageArea.radius }}km radius
			</div>
			<div class="text-sm text-600 mb-3">
				<i class="pi pi-clock mr-2"></i>
				Last updated:
				{{ driverStore.currentLocation ? formatTime(driverStore.currentLocation.timestamp) : 'Never' }}
			</div>
			<Button label="Update Location" icon="pi pi-refresh" @click="driverStore.updateLocation"
				:loading="driverStore.isUpdatingLocation" size="small" class="w-full" outlined />
		</div>

	</div>
</template>

<style scoped>
.card {
	background: var(--surface-card);
	border-radius: 10px;
	box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.24);
}
</style>