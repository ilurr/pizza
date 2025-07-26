import { BaseApiService } from './ApiClient.js';

export class NotificationApiService extends BaseApiService {
    constructor() {
        super();
        this.endpoint = '/notifications';
        this.eventListeners = new Map();
        this.initializeMockData();
        this.init();
    }

    initializeMockData() {
        // Mock notification templates
        this.mockTemplates = {
            order_placed: {
                id: 'order_placed',
                title: 'Order Confirmed! 🎉',
                message: 'Your order #{orderNumber} has been placed successfully.',
                type: 'order_update',
                severity: 'success',
                channels: ['app', 'email'],
                autoMarkRead: false
            },
            payment_success: {
                id: 'payment_success',
                title: 'Payment Successful! 💳',
                message: 'Your payment of {amount} has been processed successfully.',
                type: 'payment_update',
                severity: 'success',
                channels: ['app', 'email', 'sms'],
                autoMarkRead: false
            },
            driver_assigned: {
                id: 'driver_assigned',
                title: 'Chef Assigned! 👨‍🍳',
                message: '{driverName} will prepare and deliver your order.',
                type: 'delivery_update',
                severity: 'info',
                channels: ['app', 'push'],
                autoMarkRead: true
            },
            order_preparing: {
                id: 'order_preparing',
                title: 'Order Being Prepared 🍕',
                message: 'Your delicious pizza is being prepared by our chef.',
                type: 'delivery_update',
                severity: 'info',
                channels: ['app'],
                autoMarkRead: true
            },
            driver_en_route: {
                id: 'driver_en_route',
                title: 'Chef is On the Way! 🏍️',
                message: '{driverName} is heading to your location with fresh ingredients.',
                type: 'delivery_update',
                severity: 'info',
                channels: ['app', 'push'],
                autoMarkRead: false
            },
            driver_arrived: {
                id: 'driver_arrived',
                title: 'Chef Has Arrived! 📍',
                message: '{driverName} has arrived and will start cooking your pizza.',
                type: 'delivery_update',
                severity: 'success',
                channels: ['app', 'push', 'sms'],
                autoMarkRead: false
            },
            order_cooking: {
                id: 'order_cooking',
                title: 'Cooking in Progress! 🔥',
                message: 'Your pizza is being freshly cooked at your location.',
                type: 'delivery_update',
                severity: 'info',
                channels: ['app'],
                autoMarkRead: true
            },
            order_ready: {
                id: 'order_ready',
                title: 'Pizza Ready! 🍕✨',
                message: 'Your freshly made pizza is ready to be served!',
                type: 'delivery_update',
                severity: 'success',
                channels: ['app', 'push'],
                autoMarkRead: false
            },
            order_delivered: {
                id: 'order_delivered',
                title: 'Order Delivered! ✅',
                message: 'Your order has been delivered. Enjoy your meal!',
                type: 'delivery_update',
                severity: 'success',
                channels: ['app', 'email'],
                autoMarkRead: false
            },
            order_cancelled: {
                id: 'order_cancelled',
                title: 'Order Cancelled',
                message: 'Your order #{orderNumber} has been cancelled.',
                type: 'order_update',
                severity: 'warn',
                channels: ['app', 'email'],
                autoMarkRead: false
            },
            payment_failed: {
                id: 'payment_failed',
                title: 'Payment Failed',
                message: 'Your payment could not be processed. Please try again.',
                type: 'payment_update',
                severity: 'error',
                channels: ['app', 'email'],
                autoMarkRead: false
            },
            expansion_request: {
                id: 'expansion_request',
                title: 'Service Area Request',
                message: 'Thank you for requesting service in {location}. We\'ll notify you when available.',
                type: 'info',
                severity: 'info',
                channels: ['app'],
                autoMarkRead: true
            },
            driver_stock_low: {
                id: 'driver_stock_low',
                title: 'Low Stock Alert! ⚠️',
                message: '{itemName} is running low. Current stock: {currentStock} {unit}.',
                type: 'driver_alert',
                severity: 'warn',
                channels: ['app'],
                autoMarkRead: false
            },
            driver_earnings_milestone: {
                id: 'driver_earnings_milestone',
                title: 'Milestone Reached! 🎯',
                message: 'Congratulations! You\'ve earned {amount} this {period}.',
                type: 'driver_update',
                severity: 'success',
                channels: ['app'],
                autoMarkRead: false
            }
        };

        // Mock stored notifications
        this.mockNotifications = [
            {
                id: 'notif_001',
                userId: 'customer_001',
                templateId: 'order_placed',
                title: 'Order Confirmed! 🎉',
                message: 'Your order #PZ-2024-156 has been placed successfully.',
                type: 'order_update',
                severity: 'success',
                read: false,
                channels: ['app', 'email'],
                createdAt: new Date().toISOString(),
                data: {
                    orderNumber: 'PZ-2024-156',
                    orderId: 'order_156'
                }
            },
            {
                id: 'notif_002',
                userId: 'customer_001',
                templateId: 'driver_assigned',
                title: 'Chef Assigned! 👨‍🍳',
                message: 'Pak Agus will prepare and deliver your order.',
                type: 'delivery_update',
                severity: 'info',
                read: true,
                channels: ['app', 'push'],
                createdAt: new Date(Date.now() - 3600000).toISOString(),
                data: {
                    driverName: 'Pak Agus',
                    driverId: 'driver_001',
                    orderId: 'order_156'
                }
            },
            {
                id: 'notif_003',
                userId: 'driver_001',
                templateId: 'driver_stock_low',
                title: 'Low Stock Alert! ⚠️',
                message: 'Mozzarella Cheese is running low. Current stock: 3 kg.',
                type: 'driver_alert',
                severity: 'warn',
                read: false,
                channels: ['app'],
                createdAt: new Date(Date.now() - 7200000).toISOString(),
                data: {
                    itemName: 'Mozzarella Cheese',
                    currentStock: 3,
                    unit: 'kg',
                    itemId: 'cheese'
                }
            }
        ];

        // Mock notification preferences
        this.mockPreferences = {
            customer_001: {
                userId: 'customer_001',
                enabledChannels: ['app', 'email', 'push'],
                enabledTypes: ['order_update', 'delivery_update', 'payment_update'],
                quietHours: {
                    enabled: true,
                    start: '22:00',
                    end: '07:00'
                },
                language: 'id',
                timezone: 'Asia/Jakarta'
            },
            driver_001: {
                userId: 'driver_001',
                enabledChannels: ['app', 'push'],
                enabledTypes: ['driver_alert', 'driver_update', 'order_update'],
                quietHours: {
                    enabled: false
                },
                language: 'id',
                timezone: 'Asia/Jakarta'
            }
        };
    }

    // Initialize notification system
    init() {
        if (typeof window !== 'undefined') {
            this.setupPaymentCallbackListener();
            this.startPaymentStatusCheck();
        }
    }

    // Get user notifications
    async getUserNotifications(userId, filters = {}) {
        if (this.useMockApi) {
            await this.mockDelay();
            
            let notifications = this.mockNotifications.filter(n => n.userId === userId);
            
            // Apply filters
            if (filters.type) {
                notifications = notifications.filter(n => n.type === filters.type);
            }
            
            if (filters.read !== undefined) {
                notifications = notifications.filter(n => n.read === filters.read);
            }
            
            if (filters.severity) {
                notifications = notifications.filter(n => n.severity === filters.severity);
            }
            
            if (filters.since) {
                notifications = notifications.filter(n => 
                    new Date(n.createdAt) >= new Date(filters.since)
                );
            }
            
            // Sort by creation date (newest first)
            notifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            
            // Pagination
            const page = filters.page || 1;
            const limit = filters.limit || 20;
            const startIndex = (page - 1) * limit;
            const paginatedNotifications = notifications.slice(startIndex, startIndex + limit);
            
            // Calculate unread count
            const unreadCount = this.mockNotifications.filter(n => 
                n.userId === userId && !n.read
            ).length;
            
            return this.createMockResponse({
                notifications: paginatedNotifications,
                total: notifications.length,
                unreadCount: unreadCount,
                page: page,
                limit: limit,
                totalPages: Math.ceil(notifications.length / limit)
            });
        }
        
        return await this.get(`${this.endpoint}/user/${userId}`, filters);
    }

    // Create a new notification
    async createNotification(notificationData) {
        if (this.useMockApi) {
            await this.mockDelay();
            
            const template = this.mockTemplates[notificationData.templateId];
            if (!template) {
                return this.createMockError('Template not found', 404);
            }
            
            // Replace placeholders in template
            const title = this.replacePlaceholders(template.title, notificationData.data);
            const message = this.replacePlaceholders(template.message, notificationData.data);
            
            const notification = {
                id: `notif_${Date.now()}`,
                userId: notificationData.userId,
                templateId: notificationData.templateId,
                title: title,
                message: message,
                type: template.type,
                severity: template.severity,
                read: template.autoMarkRead || false,
                channels: notificationData.channels || template.channels,
                createdAt: new Date().toISOString(),
                data: notificationData.data || {}
            };
            
            // Add to mock storage
            this.mockNotifications.unshift(notification);
            
            // Emit notification for real-time updates
            this.emit('notification_created', notification);
            
            // Show toast if appropriate
            if (notification.channels.includes('app')) {
                this.showToastNotification(notification);
            }
            
            return this.createMockResponse({
                notification: notification,
                message: 'Notification created successfully'
            });
        }
        
        return await this.post(this.endpoint, notificationData);
    }

    // Mark notification as read
    async markAsRead(notificationId, userId) {
        if (this.useMockApi) {
            await this.mockDelay();
            
            const notificationIndex = this.mockNotifications.findIndex(n => 
                n.id === notificationId && n.userId === userId
            );
            
            if (notificationIndex === -1) {
                return this.createMockError('Notification not found', 404);
            }
            
            this.mockNotifications[notificationIndex].read = true;
            this.mockNotifications[notificationIndex].readAt = new Date().toISOString();
            
            return this.createMockResponse({
                notification: this.mockNotifications[notificationIndex],
                message: 'Notification marked as read'
            });
        }
        
        return await this.patch(`${this.endpoint}/${notificationId}/read`, { userId });
    }

    // Mark all notifications as read
    async markAllAsRead(userId) {
        if (this.useMockApi) {
            await this.mockDelay();
            
            const userNotifications = this.mockNotifications.filter(n => 
                n.userId === userId && !n.read
            );
            
            userNotifications.forEach(notification => {
                notification.read = true;
                notification.readAt = new Date().toISOString();
            });
            
            return this.createMockResponse({
                markedCount: userNotifications.length,
                message: `${userNotifications.length} notifications marked as read`
            });
        }
        
        return await this.patch(`${this.endpoint}/user/${userId}/read-all`);
    }

    // Delete notification
    async deleteNotification(notificationId, userId) {
        if (this.useMockApi) {
            await this.mockDelay();
            
            const notificationIndex = this.mockNotifications.findIndex(n => 
                n.id === notificationId && n.userId === userId
            );
            
            if (notificationIndex === -1) {
                return this.createMockError('Notification not found', 404);
            }
            
            this.mockNotifications.splice(notificationIndex, 1);
            
            return this.createMockResponse({
                message: 'Notification deleted successfully'
            });
        }
        
        return await this.delete(`${this.endpoint}/${notificationId}`, { userId });
    }

    // Get notification preferences
    async getPreferences(userId) {
        if (this.useMockApi) {
            await this.mockDelay();
            
            const preferences = this.mockPreferences[userId] || {
                userId: userId,
                enabledChannels: ['app', 'email'],
                enabledTypes: ['order_update', 'delivery_update', 'payment_update'],
                quietHours: {
                    enabled: false,
                    start: '22:00',
                    end: '07:00'
                },
                language: 'id',
                timezone: 'Asia/Jakarta'
            };
            
            return this.createMockResponse({ preferences });
        }
        
        return await this.get(`${this.endpoint}/preferences/${userId}`);
    }

    // Update notification preferences
    async updatePreferences(userId, preferences) {
        if (this.useMockApi) {
            await this.mockDelay();
            
            this.mockPreferences[userId] = {
                ...this.mockPreferences[userId],
                ...preferences,
                userId: userId,
                updatedAt: new Date().toISOString()
            };
            
            return this.createMockResponse({
                preferences: this.mockPreferences[userId],
                message: 'Preferences updated successfully'
            });
        }
        
        return await this.put(`${this.endpoint}/preferences/${userId}`, preferences);
    }

    // Send order status notification
    async sendOrderStatusNotification(orderId, status, data = {}) {
        const statusTemplateMap = {
            'pending': 'order_placed',
            'confirmed': 'payment_success',
            'assigned': 'driver_assigned',
            'preparing': 'order_preparing',
            'en_route': 'driver_en_route',
            'arrived': 'driver_arrived',
            'cooking': 'order_cooking',
            'ready': 'order_ready',
            'delivered': 'order_delivered',
            'cancelled': 'order_cancelled'
        };
        
        const templateId = statusTemplateMap[status];
        if (!templateId) {
            return this.createMockError('Invalid order status', 400);
        }
        
        return await this.createNotification({
            userId: data.customerId || 'customer_001',
            templateId: templateId,
            data: {
                orderId: orderId,
                orderNumber: data.orderNumber,
                driverName: data.driverName,
                ...data
            }
        });
    }

    // Send payment notification
    async sendPaymentNotification(paymentData) {
        const templateId = paymentData.status === 'PAID' ? 'payment_success' : 'payment_failed';
        
        return await this.createNotification({
            userId: paymentData.customerId || 'customer_001',
            templateId: templateId,
            data: {
                amount: this.formatCurrency(paymentData.amount),
                paymentMethod: paymentData.payment_method,
                orderId: paymentData.external_id,
                ...paymentData
            }
        });
    }

    // Send driver alert notification
    async sendDriverAlert(driverId, alertType, data = {}) {
        const templateMap = {
            'stock_low': 'driver_stock_low',
            'earnings_milestone': 'driver_earnings_milestone'
        };
        
        const templateId = templateMap[alertType];
        if (!templateId) {
            return this.createMockError('Invalid alert type', 400);
        }
        
        return await this.createNotification({
            userId: driverId,
            templateId: templateId,
            data: data
        });
    }

    // Helper method to replace placeholders in templates
    replacePlaceholders(text, data) {
        if (!data) return text;
        
        return text.replace(/\{(\w+)\}/g, (match, key) => {
            return data[key] !== undefined ? data[key] : match;
        });
    }

    // Format currency for notifications
    formatCurrency(amount) {
        const formatted = new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        }).format(amount);
        return formatted.replace(/\s/g, ''); // Remove spaces
    }

    // Show toast notification
    showToastNotification(notification) {
        const toastData = {
            severity: notification.severity,
            summary: notification.title,
            detail: notification.message,
            life: notification.severity === 'success' ? 8000 : 5000,
            sticky: notification.severity === 'error'
        };
        
        this.emit('show_toast', toastData);
    }

    // Event system for real-time notifications
    on(event, listener) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event).push(listener);
    }

    emit(event, data) {
        const listeners = this.eventListeners.get(event) || [];
        listeners.forEach(listener => {
            try {
                listener(data);
            } catch (error) {
                console.error('Error in notification event listener:', error);
            }
        });
    }

    off(event, listener) {
        const listeners = this.eventListeners.get(event) || [];
        const index = listeners.indexOf(listener);
        if (index > -1) {
            listeners.splice(index, 1);
        }
    }

    // Payment callback handling (from original NotificationService)
    setupPaymentCallbackListener() {
        if (typeof window === 'undefined') return;
        
        window.addEventListener('message', (event) => {
            if (event.origin !== window.location.origin) return;
            
            if (event.data.type === 'PAYMENT_CALLBACK') {
                this.handlePaymentCallback(event.data.payload);
            }
        });

        window.addEventListener('storage', (event) => {
            if (event.key === 'payment_callback') {
                const callbackData = JSON.parse(event.newValue || '{}');
                this.handlePaymentCallback(callbackData);
            }
        });
    }

    async handlePaymentCallback(callbackData) {
        console.log('Payment callback received:', callbackData);
        
        // Send payment notification
        await this.sendPaymentNotification(callbackData);
        
        // Emit payment update event
        this.emit('payment_update', callbackData);
        
        // Store in localStorage for persistence
        this.storePaymentNotification(callbackData);
    }

    storePaymentNotification(callbackData) {
        if (typeof localStorage === 'undefined') return;
        
        const stored = JSON.parse(localStorage.getItem('payment_notifications') || '[]');
        stored.unshift(callbackData);
        
        if (stored.length > 10) {
            stored.splice(10);
        }
        
        localStorage.setItem('payment_notifications', JSON.stringify(stored));
    }

    startPaymentStatusCheck() {
        if (typeof window === 'undefined') return;
        
        setInterval(() => {
            this.checkPendingPayments();
        }, 30000);
    }

    async checkPendingPayments() {
        if (typeof localStorage === 'undefined') return;
        
        const pendingPayments = JSON.parse(localStorage.getItem('pending_payments') || '[]');
        
        for (const payment of pendingPayments) {
            try {
                const status = await this.mockCheckPaymentStatus(payment.external_id);
                
                if (status.status !== 'PENDING') {
                    await this.handlePaymentCallback(status);
                    this.removePendingPayment(payment.external_id);
                }
            } catch (error) {
                console.error('Error checking payment status:', error);
            }
        }
    }

    async mockCheckPaymentStatus(externalId) {
        const statuses = ['PAID', 'FAILED', 'PENDING'];
        const randomStatus = Math.random() < 0.3 ? statuses[Math.floor(Math.random() * 2)] : 'PENDING';
        
        return {
            external_id: externalId,
            status: randomStatus,
            amount: 50000,
            customerId: 'customer_001',
            paid_at: randomStatus === 'PAID' ? new Date().toISOString() : null
        };
    }

    removePendingPayment(externalId) {
        if (typeof localStorage === 'undefined') return;
        
        const pending = JSON.parse(localStorage.getItem('pending_payments') || '[]');
        const filtered = pending.filter(p => p.external_id !== externalId);
        localStorage.setItem('pending_payments', JSON.stringify(filtered));
    }
}

// Export singleton instance
export default new NotificationApiService();