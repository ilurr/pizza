<script setup>
import NotificationService from '@/service/NotificationService.js';
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();

const props = defineProps({
	showStats: {
		type: Boolean,
		default: true
	},
	variant: {
		type: String,
		default: 'auto', // 'auto', 'dashboard', 'customer'
		validator: (value) => ['auto', 'dashboard', 'customer'].includes(value)
	}
});

const emit = defineEmits(['mark-all-read', 'clear-all']);

const notifications = ref([]);
const notificationStats = ref({
	total: 0,
	unread: 0,
	payment: 0,
	system: 0
});

// Auto-detect layout context
const layoutContext = computed(() => {
	if (props.variant !== 'auto') return props.variant;
	return route.path.startsWith('/dashboard') ? 'dashboard' : 'customer';
});

const isDashboard = computed(() => layoutContext.value === 'dashboard');

const loadNotifications = () => {
	// Get stored notifications
	const stored = NotificationService.getStoredNotifications();

	// Add mock system notifications for demo (duplicated from existing)
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
		},
		{
			id: 'sys-3',
			type: 'order_update',
			title: 'Order Delivered Successfully! ✅',
			message: 'Your order #PZ-2024-001 has been delivered. Thank you for choosing Panggil Papa Pizza!',
			timestamp: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
			read: false,
			severity: 'success',
			icon: 'pi-check-circle'
		},
		{
			id: 'sys-4',
			type: 'delivery_update',
			title: 'Driver is on the way! 🚗',
			message: 'Your driver Pak Agus is heading to your location. Estimated arrival: 15 minutes.',
			timestamp: new Date(Date.now() - 900000).toISOString(), // 15 minutes ago
			read: false,
			severity: 'info',
			icon: 'pi-truck'
		},
		{
			id: 'sys-5',
			type: 'payment_update',
			title: 'Payment Successful! 🎉',
			message: 'Your payment of Rp125,000 has been confirmed. Order ID: PZ-2024-002',
			timestamp: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
			read: true,
			severity: 'success',
			icon: 'pi-money-bill'
		}
	];

	// Merge and format notifications
	const allNotifications = [
		...stored.map(formatPaymentNotification),
		...systemNotifications
	];

	notifications.value = allNotifications.sort((a, b) =>
		new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
	);
	updateStats();
};

// Format payment notifications for display (duplicated from existing)
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

const updateStats = () => {
	const total = notifications.value.length;
	const unread = notifications.value.filter(n => !n.read).length;
	const payment = notifications.value.filter(n => n.type === 'payment_update').length;
	const system = notifications.value.filter(n => n.type === 'system').length;

	notificationStats.value = { total, unread, payment, system };
};

const markAsRead = (notification) => {
	if (!notification.read) {
		notification.read = true;
		NotificationService.markAsRead(notification.id);
		updateStats();
	}
};

const markAllAsRead = () => {
	notifications.value.forEach(n => {
		if (!n.read) {
			n.read = true;
			NotificationService.markAsRead(n.id);
		}
	});
	updateStats();
	emit('mark-all-read');
};

const clearAll = () => {
	NotificationService.clearAll();
	notifications.value = [];
	updateStats();
	emit('clear-all');
};

const deleteNotification = (notificationId) => {
	NotificationService.delete(notificationId);
	notifications.value = notifications.value.filter(n => n.id !== notificationId);
	updateStats();
};

// Get notification icon class (duplicated from existing)
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

// Format relative time (duplicated from existing)
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

onMounted(() => {
	loadNotifications();
});
</script>

<template>
	<div class="notification-content">
		<!-- Action Buttons (Dashboard style) -->
		<div v-if="isDashboard && notifications.length > 0" class="flex gap-2 p-4 justify-end">
			<Button label="Mark All Read" icon="pi pi-check" severity="secondary" @click="markAllAsRead"
				:disabled="notificationStats.unread === 0" size="small" />
			<Button label="Clear All" icon="pi pi-trash" severity="secondary" @click="clearAll"
				:disabled="notificationStats.total === 0" size="small" />
		</div>

		<!-- Empty State -->
		<div v-if="notifications.length === 0" class="text-center py-12">
			<i class="pi pi-bell-slash !text-6xl text-gray-300 mb-0"></i>
			<h3 class="text-2xl font-semibold text-gray-600 dark:text-gray-400 mb-2">
				No notifications
			</h3>
			<p class="text-gray-500 dark:text-gray-500">
				Notifications will appear here when you have activity
			</p>
		</div>

		<!-- Notifications List -->
		<div v-else class="">
			<div v-for="notification in notifications" :key="notification.id" :class="[
				'bg-white dark:bg-neutral-800 p-4 md:p-6 transition-all border-b border-surface',
				!notification.read ? 'border-l-4 !border-l-blue-500' : 'border-l-4 !border-l-transparent'
			]" @click="markAsRead(notification)">
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
									<span v-if="!notification.read" class="inline-block w-2 h-2 bg-blue-500 rounded-full ml-2"></span>
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
								<Button v-if="isDashboard" icon="pi pi-times" text size="small" severity="danger"
									@click.stop="deleteNotification(notification.id)" class="w-6 h-6" />
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>