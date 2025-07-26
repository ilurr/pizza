<script setup lang="ts">
import AppTopbar from '@/layout/AppTopbar.vue';
import NotificationService from '@/service/NotificationService.js';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const toast = useToast();

const notifications = ref([]);
const selectedFilter = ref('all'); // all, payment, system
const selectedStatus = ref('all'); // all, unread, read
const isLoading = ref(false);

// Computed filtered notifications
const filteredNotifications = computed(() => {
	let filtered = notifications.value;

	// Filter by type
	if (selectedFilter.value !== 'all') {
		filtered = filtered.filter(n => n.type === selectedFilter.value);
	}

	// Filter by read status
	if (selectedStatus.value !== 'all') {
		const isRead = selectedStatus.value === 'read';
		filtered = filtered.filter(n => n.read === isRead);
	}

	return filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
});

// Computed stats
const notificationStats = computed(() => {
	const total = notifications.value.length;
	const unread = notifications.value.filter(n => !n.read).length;
	const payment = notifications.value.filter(n => n.type === 'payment').length;
	const system = notifications.value.filter(n => n.type === 'system').length;

	return { total, unread, payment, system };
});

// Handle topbar action events
const handleMarkAllRead = () => {
	markAllAsRead();
};

const handleClearAll = () => {
	clearAllNotifications();
};

const goBack = () => {
	router.push('/');
};

// Load notifications
const loadNotifications = () => {
	isLoading.value = true;

	try {
		// Get stored notifications
		const stored = NotificationService.getStoredNotifications();

		// Add mock system notifications for demo
		const systemNotifications = [
			{
				id: 'sys-1',
				type: 'system',
				title: 'Welcome to Panggil Papa Pizza! 🍕',
				message: 'Your account has been set up successfully. Start ordering delicious pizzas now!',
				timestamp: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
				read: false,
				severity: 'info',
				icon: 'pi-check-circle'
			},
			{
				id: 'sys-2',
				type: 'system',
				title: 'New Pizza Added to Menu! 🆕',
				message: 'Try our new Truffle Mushroom Pizza - made with premium truffle oil and fresh mushrooms.',
				timestamp: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
				read: true,
				severity: 'success',
				icon: 'pi-plus-circle'
			}
		];

		// Merge and format notifications
		const allNotifications = [
			...stored.map(formatPaymentNotification),
			...systemNotifications
		];

		notifications.value = allNotifications;
	} catch (error) {
		console.error('Error loading notifications:', error);
		toast.add({
			severity: 'error',
			summary: 'Error',
			detail: 'Failed to load notifications',
			life: 3000
		});
	} finally {
		isLoading.value = false;
	}
};

// Format payment notifications for display
const formatPaymentNotification = (notification) => {
	const statusTitles = {
		'PAID': 'Payment Successful! 🎉',
		'FAILED': 'Payment Failed ❌',
		'PENDING': 'Payment Pending ⏳',
		'EXPIRED': 'Payment Expired ⏰'
	};

	const statusMessages = {
		'PAID': `Your payment of ${NotificationService.formatCurrency(notification.amount)} has been confirmed. Order ID: ${notification.external_id}`,
		'FAILED': `Payment of ${NotificationService.formatCurrency(notification.amount)} could not be processed. Please try again.`,
		'PENDING': `Payment of ${NotificationService.formatCurrency(notification.amount)} is being processed. Order ID: ${notification.external_id}`,
		'EXPIRED': `Payment session for ${NotificationService.formatCurrency(notification.amount)} has expired. Please create a new order.`
	};

	const statusIcons = {
		'PAID': 'pi-check-circle',
		'FAILED': 'pi-times-circle',
		'PENDING': 'pi-clock',
		'EXPIRED': 'pi-exclamation-triangle'
	};

	const statusSeverities = {
		'PAID': 'success',
		'FAILED': 'error',
		'PENDING': 'info',
		'EXPIRED': 'warn'
	};

	return {
		...notification,
		title: statusTitles[notification.status] || 'Payment Update',
		message: statusMessages[notification.status] || 'Payment status updated',
		icon: statusIcons[notification.status] || 'pi-info-circle',
		severity: statusSeverities[notification.status] || 'info',
		read: notification.read || false
	};
};

// Mark notification as read
const markAsRead = (notificationId) => {
	const notification = notifications.value.find(n => n.id === notificationId);
	if (notification && !notification.read) {
		notification.read = true;
		updateStoredNotifications();
	}
};

// Mark all as read
const markAllAsRead = () => {
	notifications.value.forEach(n => n.read = true);
	updateStoredNotifications();

	toast.add({
		severity: 'success',
		summary: 'All Read',
		detail: 'All notifications marked as read',
		life: 2000
	});
};

// Clear all notifications
const clearAllNotifications = () => {
	notifications.value = [];
	localStorage.removeItem('payment_notifications');

	toast.add({
		severity: 'info',
		summary: 'Cleared',
		detail: 'All notifications have been cleared',
		life: 2000
	});
};

// Update stored notifications
const updateStoredNotifications = () => {
	const paymentNotifications = notifications.value.filter(n => n.type === 'payment');
	localStorage.setItem('payment_notifications', JSON.stringify(paymentNotifications));
};

// Delete single notification
const deleteNotification = (notificationId) => {
	notifications.value = notifications.value.filter(n => n.id !== notificationId);
	updateStoredNotifications();

	toast.add({
		severity: 'info',
		summary: 'Deleted',
		detail: 'Notification removed',
		life: 2000
	});
};

// Get notification icon class
const getNotificationIconClass = (notification) => {
	const baseClass = 'flex items-center justify-center w-10 h-10 rounded-full';
	const severityClasses = {
		'success': 'bg-green-100 text-green-600',
		'error': 'bg-red-100 text-red-600',
		'info': 'bg-blue-100 text-blue-600',
		'warn': 'bg-yellow-100 text-yellow-600'
	};

	return `${baseClass} ${severityClasses[notification.severity] || severityClasses.info}`;
};

// Format relative time
const formatRelativeTime = (timestamp) => {
	const now = new Date();
	const time = new Date(timestamp);
	const diffMs = now.getTime() - time.getTime();
	const diffMins = Math.floor(diffMs / 60000);
	const diffHours = Math.floor(diffMs / 3600000);
	const diffDays = Math.floor(diffMs / 86400000);

	if (diffMins < 1) return 'Just now';
	if (diffMins < 60) return `${diffMins}m ago`;
	if (diffHours < 24) return `${diffHours}h ago`;
	if (diffDays < 30) return `${diffDays}d ago`;

	return time.toLocaleDateString();
};

// Setup real-time notifications
const setupRealtimeNotifications = () => {
	NotificationService.on('payment_update', (notification) => {
		const formatted = formatPaymentNotification(notification);

		// Add to beginning of notifications array
		notifications.value.unshift(formatted);

		// Keep only last 50 notifications
		if (notifications.value.length > 50) {
			notifications.value = notifications.value.slice(0, 50);
		}
	});
};

// Cleanup
const cleanup = () => {
	NotificationService.off('payment_update', () => { });
};

onMounted(() => {
	loadNotifications();
	setupRealtimeNotifications();
});

onUnmounted(() => {
	cleanup();
});
</script>

<template>
	<div class="bg-white dark:bg-neutral-900">
		<div class="landing-wrapper overflow-hidden">
			<app-topbar variant="page-header" page-title="Notifications" :show-notification-actions="true"
				:notification-stats="notificationStats" @back="goBack" @mark-all-read="handleMarkAllRead"
				@clear-all="handleClearAll"></app-topbar>

			<div class="relative lg:mx-80 mx-auto pt-16 md:pt-16 mb-32">
				<div class="relative md:py-4">

					<!-- Stats Cards -->
					<!-- <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        <div class="bg-white dark:bg-gray-800 rounded-lg p-4 text-center border border-gray-200 dark:border-gray-700">
                            <div class="text-2xl font-bold text-blue-600">{{ notificationStats.total }}</div>
                            <div class="text-sm text-gray-600 dark:text-gray-400">Total</div>
                        </div>
                        <div class="bg-white dark:bg-gray-800 rounded-lg p-4 text-center border border-gray-200 dark:border-gray-700">
                            <div class="text-2xl font-bold text-red-600">{{ notificationStats.unread }}</div>
                            <div class="text-sm text-gray-600 dark:text-gray-400">Unread</div>
                        </div>
                        <div class="bg-white dark:bg-gray-800 rounded-lg p-4 text-center border border-gray-200 dark:border-gray-700">
                            <div class="text-2xl font-bold text-green-600">{{ notificationStats.payment }}</div>
                            <div class="text-sm text-gray-600 dark:text-gray-400">Payment</div>
                        </div>
                        <div class="bg-white dark:bg-gray-800 rounded-lg p-4 text-center border border-gray-200 dark:border-gray-700">
                            <div class="text-2xl font-bold text-purple-600">{{ notificationStats.system }}</div>
                            <div class="text-sm text-gray-600 dark:text-gray-400">System</div>
                        </div>
                    </div> -->


					<!-- Loading State -->
					<div v-if="isLoading" class="text-center py-12">
						<ProgressSpinner class="!w-12 !h-12" />
						<p class="text-gray-600 dark:text-gray-300 mt-4">Loading notifications...</p>
					</div>

					<!-- Empty State -->
					<div v-else-if="filteredNotifications.length === 0" class="text-center py-12">
						<i class="pi pi-bell-slash !text-6xl text-gray-300 mb-0"></i>
						<h3 class="text-2xl font-semibold text-gray-600 dark:text-gray-400 mb-2">
							No notifications
						</h3>
						<p class="text-gray-500 dark:text-gray-500">
							{{ selectedFilter !== 'all' || selectedStatus !== 'all'
								? 'Try adjusting your filters'
								: 'Notifications will appear here when you have activity' }}
						</p>
					</div>

					<!-- Notifications List -->
					<div v-else class="">
						<div v-for="notification in filteredNotifications" :key="notification.id" :class="[
							'bg-white dark:bg-neutral-800 p-4 md:p-6 transition-all border-b border-surface',
							!notification.read ? 'border-l-4 !border-l-blue-500' : ''
						]" @click="markAsRead(notification.id)">
							<div class="flex items-start space-x-4">
								<!-- Icon -->
								<div :class="getNotificationIconClass(notification)">
									<i :class="['pi', notification.icon]"></i>
								</div>

								<!-- Content -->
								<div class="flex-1 min-w-0">
									<div class="flex items-start justify-between">
										<div class="flex-1">
											<h4 :class="[
												'text-sm font-medium mb-1',
												!notification.read ? 'text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'
											]">
												{{ notification.title }}
												<span v-if="!notification.read"
													class="inline-block w-2 h-2 bg-blue-500 rounded-full ml-2"></span>
											</h4>
											<p class="text-sm text-gray-600 dark:text-gray-400 mb-2">
												{{ notification.message }}
											</p>

											<!-- Payment Details (if payment notification) -->
											<div v-if="notification.type === 'payment'" class="text-xs text-gray-500 dark:text-gray-500">
												<span v-if="notification.external_id">Order ID: {{
													notification.external_id }}</span>
												<span v-if="notification.amount" class="ml-2">
													Amount: {{ NotificationService.formatCurrency(notification.amount)
													}}
												</span>
											</div>
										</div>

										<!-- Actions -->
										<div class="flex items-center space-x-2 ml-4">
											<span class="text-xs text-gray-500 dark:text-gray-500">
												{{ formatRelativeTime(notification.timestamp) }}
											</span>
											<Button icon="pi pi-times" text size="small" severity="danger"
												@click.stop="deleteNotification(notification.id)" class="w-6 h-6" />
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>

				</div>
			</div>
		</div>
	</div>
</template>

<style scoped>
.landing-wrapper {
	min-height: 100vh;
}
</style>