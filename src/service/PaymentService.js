// Payment Service for handling Xendit integration
export class PaymentService {
    static baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';
    static xenditWebhookSecret = import.meta.env.VITE_XENDIT_WEBHOOK_SECRET;

    /**
     * Create a payment request through Xendit
     * @param {Object} paymentData - Payment details
     * @returns {Promise<Object>} Payment response with checkout URL
     */
    static async createPayment(paymentData) {
        try {
            const response = await fetch(`${this.baseURL}/payments/create`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    external_id: paymentData.external_id,
                    amount: paymentData.amount,
                    currency: 'IDR',
                    payment_methods: this.getPaymentMethods(paymentData.payment_method),
                    customer: paymentData.customer,
                    items: paymentData.items,
                    metadata: {
                        delivery_address: paymentData.delivery_address,
                        chef_id: paymentData.chef?.id,
                        chef_name: paymentData.chef?.name,
                        order_type: 'pizza_delivery'
                    },
                    success_redirect_url: paymentData.success_redirect_url,
                    failure_redirect_url: paymentData.failure_redirect_url,
                    webhook_url: `${this.baseURL}/payments/webhook`
                })
            });

            if (!response.ok) {
                throw new Error(`Payment creation failed: ${response.status}`);
            }

            const result = await response.json();
            return result;
        } catch (error) {
            console.error('Payment service error:', error);
            throw error;
        }
    }

    /**
     * Get payment status from backend
     * @param {string} externalId - Order external ID
     * @returns {Promise<Object>} Payment status
     */
    static async getPaymentStatus(externalId) {
        try {
            const response = await fetch(`${this.baseURL}/payments/status/${externalId}`);
            
            if (!response.ok) {
                throw new Error(`Failed to get payment status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Get payment status error:', error);
            throw error;
        }
    }

    /**
     * Handle webhook callback from Xendit
     * @param {Object} webhookData - Webhook payload from Xendit
     * @returns {Promise<Object>} Processed webhook response
     */
    static async handleWebhook(webhookData) {
        try {
            const response = await fetch(`${this.baseURL}/payments/webhook`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(webhookData)
            });

            if (!response.ok) {
                throw new Error(`Webhook handling failed: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Webhook handling error:', error);
            throw error;
        }
    }

    /**
     * Get available payment methods based on selection
     * @param {string} methodType - Selected payment method type
     * @returns {Array} Array of enabled payment methods
     */
    static getPaymentMethods(methodType) {
        const methodMap = {
            'credit_card': ['CREDIT_CARD'],
            'bank_transfer': ['BCA', 'BNI', 'BRI', 'MANDIRI', 'PERMATA'],
            'ewallet': ['OVO', 'DANA', 'LINKAJA', 'SHOPEEPAY'],
            'qris': ['QRIS']
        };

        return methodMap[methodType] || ['CREDIT_CARD'];
    }

    /**
     * Format Indonesian Rupiah currency
     * @param {number} amount - Amount in IDR
     * @returns {string} Formatted currency string
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
     * Generate unique external ID for orders
     * @returns {string} Unique external ID
     */
    static generateExternalId() {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 8);
        return `pizza-order-${timestamp}-${random}`;
    }

    /**
     * Simulate payment for demo purposes
     * @param {Object} paymentData - Payment data
     * @returns {Promise<Object>} Simulated payment response
     */
    static async simulatePayment(paymentData) {
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Return mock Xendit response
        return {
            id: paymentData.external_id,
            external_id: paymentData.external_id,
            status: 'PENDING',
            checkout_url: this.generateMockCheckoutUrl(paymentData),
            amount: paymentData.amount,
            currency: 'IDR',
            payment_method: paymentData.payment_method,
            created: new Date().toISOString(),
            updated: new Date().toISOString()
        };
    }

    /**
     * Generate mock checkout URL for demo
     * @param {Object} paymentData - Payment data
     * @returns {string} Mock checkout URL
     */
    static generateMockCheckoutUrl(paymentData) {
        const params = new URLSearchParams({
            external_id: paymentData.external_id,
            amount: paymentData.amount.toString(),
            payment_method: paymentData.payment_method,
            customer_name: paymentData.customer.name,
            return_url: paymentData.success_redirect_url
        });

        // Mock Xendit checkout URL for demo
        return `https://checkout.xendit.co/web/checkout/${paymentData.external_id}?${params.toString()}`;
    }

    /**
     * Mock payment callback for demo
     * @param {string} status - Payment status (PAID, FAILED, PENDING)
     * @param {string} externalId - Order external ID  
     * @returns {Object} Mock callback data
     */
    static mockPaymentCallback(status, externalId) {
        return {
            id: externalId,
            external_id: externalId,
            status: status,
            amount: 0, // Would be filled by actual amount
            currency: 'IDR',
            payment_method: 'CREDIT_CARD',
            paid_at: status === 'PAID' ? new Date().toISOString() : null,
            failure_reason: status === 'FAILED' ? 'Insufficient funds' : null,
            created: new Date().toISOString(),
            updated: new Date().toISOString()
        };
    }
}

export default PaymentService;