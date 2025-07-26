// Notification Service for handling payment callbacks and notifications
export class NotificationService {
    static eventListeners = new Map();
    static notificationQueue = [];

    /**
     * Initialize notification system
     */
    static init() {
        // Listen for payment callback events
        this.setupPaymentCallbackListener();
        
        // Setup periodic check for payment status
        this.startPaymentStatusCheck();
    }

    /**
     * Setup payment callback listener
     */
    static setupPaymentCallbackListener() {
        // Listen for postMessage from payment window
        window.addEventListener('message', (event) => {
            if (event.origin !== window.location.origin) {
                return; // Ignore messages from other origins
            }

            if (event.data.type === 'PAYMENT_CALLBACK') {
                this.handlePaymentCallback(event.data.payload);
            }
        });

        // Setup storage event listener for cross-tab communication
        window.addEventListener('storage', (event) => {
            if (event.key === 'payment_callback') {
                const callbackData = JSON.parse(event.newValue || '{}');
                this.handlePaymentCallback(callbackData);
            }
        });
    }

    /**
     * Handle payment callback from Xendit
     * @param {Object} callbackData - Payment callback data
     */
    static handlePaymentCallback(callbackData) {
        console.log('Payment callback received:', callbackData);

        const notification = {
            id: Date.now().toString(),
            type: 'payment',
            status: callbackData.status,
            external_id: callbackData.external_id,
            amount: callbackData.amount,
            timestamp: new Date().toISOString(),
            data: callbackData
        };

        // Add to notification queue
        this.notificationQueue.push(notification);

        // Emit notification event
        this.emit('payment_update', notification);

        // Show toast notification
        this.showPaymentNotification(notification);

        // Store in localStorage for persistence
        this.storeNotification(notification);
    }

    /**
     * Show payment notification toast
     * @param {Object} notification - Notification data
     */
    static showPaymentNotification(notification) {
        // This would integrate with your toast system
        const toastData = this.formatPaymentToast(notification);
        
        // Emit toast event for components to listen to
        this.emit('show_toast', toastData);
    }

    /**
     * Format payment notification for toast display
     * @param {Object} notification - Notification data
     * @returns {Object} Toast configuration
     */
    static formatPaymentToast(notification) {
        const statusMessages = {
            'PAID': {
                severity: 'success',
                summary: 'Payment Successful! 🎉',
                detail: `Your order has been confirmed. Amount: ${this.formatCurrency(notification.amount)}`
            },
            'FAILED': {
                severity: 'error',
                summary: 'Payment Failed',
                detail: 'Your payment could not be processed. Please try again.'
            },
            'PENDING': {
                severity: 'info',
                summary: 'Payment Pending',
                detail: 'Your payment is being processed. We\'ll notify you once confirmed.'
            },
            'EXPIRED': {
                severity: 'warn',
                summary: 'Payment Expired',
                detail: 'Your payment session has expired. Please try again.'
            }
        };

        return {
            ...statusMessages[notification.status],
            life: notification.status === 'PAID' ? 8000 : 5000,
            sticky: notification.status === 'PAID'
        };
    }

    /**
     * Store notification in localStorage
     * @param {Object} notification - Notification data
     */
    static storeNotification(notification) {
        const stored = JSON.parse(localStorage.getItem('payment_notifications') || '[]');
        stored.unshift(notification);
        
        // Keep only last 10 notifications
        if (stored.length > 10) {
            stored.splice(10);
        }
        
        localStorage.setItem('payment_notifications', JSON.stringify(stored));
    }

    /**
     * Get stored notifications
     * @returns {Array} Array of notifications
     */
    static getStoredNotifications() {
        return JSON.parse(localStorage.getItem('payment_notifications') || '[]');
    }

    /**
     * Start periodic payment status check
     */
    static startPaymentStatusCheck() {
        setInterval(() => {
            this.checkPendingPayments();
        }, 30000); // Check every 30 seconds
    }

    /**
     * Check status of pending payments
     */
    static async checkPendingPayments() {
        const pendingPayments = JSON.parse(localStorage.getItem('pending_payments') || '[]');
        
        for (const payment of pendingPayments) {
            try {
                // In real implementation, this would call your backend
                const status = await this.mockCheckPaymentStatus(payment.external_id);
                
                if (status.status !== 'PENDING') {
                    this.handlePaymentCallback(status);
                    this.removePendingPayment(payment.external_id);
                }
            } catch (error) {
                console.error('Error checking payment status:', error);
            }
        }
    }

    /**
     * Add payment to pending list
     * @param {Object} paymentData - Payment data
     */
    static addPendingPayment(paymentData) {
        const pending = JSON.parse(localStorage.getItem('pending_payments') || '[]');
        pending.push({
            external_id: paymentData.external_id,
            created_at: new Date().toISOString(),
            amount: paymentData.amount
        });
        localStorage.setItem('pending_payments', JSON.stringify(pending));
    }

    /**
     * Remove payment from pending list
     * @param {string} externalId - Payment external ID
     */
    static removePendingPayment(externalId) {
        const pending = JSON.parse(localStorage.getItem('pending_payments') || '[]');
        const filtered = pending.filter(p => p.external_id !== externalId);
        localStorage.setItem('pending_payments', JSON.stringify(filtered));
    }

    /**
     * Mock payment status check for demo
     * @param {string} externalId - Payment external ID
     * @returns {Promise<Object>} Payment status
     */
    static async mockCheckPaymentStatus(externalId) {
        // Simulate random payment completion for demo
        const statuses = ['PAID', 'FAILED', 'PENDING'];
        const randomStatus = Math.random() < 0.3 ? statuses[Math.floor(Math.random() * 2)] : 'PENDING';
        
        return {
            external_id: externalId,
            status: randomStatus,
            amount: 50000, // Mock amount
            paid_at: randomStatus === 'PAID' ? new Date().toISOString() : null
        };
    }

    /**
     * Event emitter functionality
     */
    static on(event, listener) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event).push(listener);
    }

    static emit(event, data) {
        const listeners = this.eventListeners.get(event) || [];
        listeners.forEach(listener => {
            try {
                listener(data);
            } catch (error) {
                console.error('Error in event listener:', error);
            }
        });
    }

    static off(event, listener) {
        const listeners = this.eventListeners.get(event) || [];
        const index = listeners.indexOf(listener);
        if (index > -1) {
            listeners.splice(index, 1);
        }
    }

    /**
     * Format currency
     * @param {number} amount - Amount to format
     * @returns {string} Formatted currency
     */
    static formatCurrency(amount) {
        const formatted = new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        }).format(amount);
        return formatted.replace(/\s/g, ''); // Remove spaces
    }

    /**
     * Create a generic notification
     * @param {Object} options - Notification options
     * @param {string} options.title - Notification title
     * @param {string} options.message - Notification message
     * @param {string} options.type - Notification type
     * @param {Object} options.data - Additional data
     */
    static create(options) {
        const notification = {
            id: Date.now().toString(),
            title: options.title || 'Notification',
            message: options.message || '',
            type: options.type || 'info',
            timestamp: new Date().toISOString(),
            read: false,
            data: options.data || {}
        };

        // Store notification
        this.storeGenericNotification(notification);

        // Show toast notification
        this.showGenericNotification(notification);

        // Emit event
        this.emit(options.type, notification);

        return notification;
    }

    /**
     * Store generic notification
     * @param {Object} notification - Notification data
     */
    static storeGenericNotification(notification) {
        const stored = JSON.parse(localStorage.getItem('notifications') || '[]');
        stored.unshift(notification);
        
        // Keep only last 50 notifications
        if (stored.length > 50) {
            stored.splice(50);
        }
        
        localStorage.setItem('notifications', JSON.stringify(stored));
    }

    /**
     * Show generic notification toast
     * @param {Object} notification - Notification data
     */
    static showGenericNotification(notification) {
        const toastData = {
            severity: this.getToastSeverity(notification.type),
            summary: notification.title,
            detail: notification.message,
            life: 5000
        };
        
        this.emit('show_toast', toastData);
    }

    /**
     * Get toast severity based on notification type
     * @param {string} type - Notification type
     * @returns {string} Toast severity
     */
    static getToastSeverity(type) {
        const severityMap = {
            'delivery_update': 'info',
            'payment_update': 'success',
            'order_update': 'info',
            'error': 'error',
            'warning': 'warn',
            'success': 'success',
            'info': 'info'
        };
        
        return severityMap[type] || 'info';
    }

    /**
     * Get all stored notifications
     * @returns {Array} Array of notifications
     */
    static getAllNotifications() {
        return JSON.parse(localStorage.getItem('notifications') || '[]');
    }

    /**
     * Save expansion request notification
     * @param {Object} requestData - Expansion request data
     */
    static async saveExpansionRequest(requestData) {
        const notification = {
            id: Date.now().toString(),
            type: 'expansion_request',
            timestamp: new Date().toISOString(),
            data: requestData
        };
        
        // Store in localStorage for demo
        const requests = JSON.parse(localStorage.getItem('expansion_requests') || '[]');
        requests.unshift(notification);
        localStorage.setItem('expansion_requests', JSON.stringify(requests));
        
        return notification;
    }

    /**
     * Simulate payment callback for demo
     * @param {string} externalId - Payment external ID
     * @param {string} status - Payment status
     */
    static simulatePaymentCallback(externalId, status = 'PAID') {
        setTimeout(() => {
            const callbackData = {
                external_id: externalId,
                status: status,
                amount: 50000,
                paid_at: status === 'PAID' ? new Date().toISOString() : null,
                payment_method: 'CREDIT_CARD'
            };
            
            this.handlePaymentCallback(callbackData);
        }, Math.random() * 10000 + 5000); // Random delay 5-15 seconds
    }
}

export default NotificationService;