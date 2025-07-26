// Unified API Service Layer
// This file provides a centralized interface for all API services
// and handles the mock/real API switching mechanism

import { BaseApiService, API_CONFIG } from './ApiClient.js';
import productsApi from './ProductsApiService.js';
import ordersApi from './OrdersApiService.js';
import driverApi from './DriverApiService.js';
import locationApi from './LocationApiService.js';
import notificationApi from './NotificationApiService.js';
import promoApi from './PromoApiService.js';

// Payment service integration (existing service)
import PaymentService from '../PaymentService.js';

/**
 * Main API Client that manages all services
 */
class ApiClient {
    constructor() {
        this.config = API_CONFIG;
        this.isInitialized = false;
        
        // Service instances
        this.products = productsApi;
        this.orders = ordersApi;
        this.drivers = driverApi;
        this.locations = locationApi;
        this.notifications = notificationApi;
        this.promos = promoApi;
        this.payments = this.createPaymentWrapper();
    }

    /**
     * Initialize the API client
     * @param {Object} options - Configuration options
     */
    async initialize(options = {}) {
        if (this.isInitialized) {
            console.log('API Client already initialized');
            return;
        }

        try {
            // Merge options with default config
            this.config = { ...this.config, ...options };
            
            // Initialize notification system
            this.notifications.init();
            
            // Log current mode
            console.log(`API Client initialized in ${this.config.USE_MOCK_API ? 'MOCK' : 'REAL'} mode`);
            console.log('Available services:', this.getAvailableServices());
            
            this.isInitialized = true;
        } catch (error) {
            console.error('Failed to initialize API Client:', error);
            throw error;
        }
    }

    /**
     * Get list of available services
     */
    getAvailableServices() {
        return {
            products: 'Product catalog management (pizzas, beverages)',
            orders: 'Order lifecycle management',
            drivers: 'Driver operations and management',
            locations: 'Location services and coverage areas',
            notifications: 'Notification system and templates',
            promos: 'Promo codes and discount management',
            payments: 'Payment processing and callbacks'
        };
    }

    /**
     * Switch between mock and real API modes
     * @param {boolean} useMockApi - Whether to use mock API
     */
    setMockMode(useMockApi) {
        this.config.USE_MOCK_API = useMockApi;
        
        // Update all service instances
        this.products.useMockApi = useMockApi;
        this.orders.useMockApi = useMockApi;
        this.drivers.useMockApi = useMockApi;
        this.locations.useMockApi = useMockApi;
        this.notifications.useMockApi = useMockApi;
        this.promos.useMockApi = useMockApi;
        
        console.log(`API mode switched to: ${useMockApi ? 'MOCK' : 'REAL'}`);
    }

    /**
     * Get current API mode
     */
    isMockMode() {
        return this.config.USE_MOCK_API;
    }

    /**
     * Create a wrapper for the existing PaymentService to match API pattern
     */
    createPaymentWrapper() {
        return {
            // Wrap existing PaymentService methods
            create: async (paymentData) => {
                try {
                    if (this.config.USE_MOCK_API) {
                        const result = await PaymentService.simulatePayment(paymentData);
                        return { success: true, data: result };
                    } else {
                        const result = await PaymentService.createPayment(paymentData);
                        return { success: true, data: result };
                    }
                } catch (error) {
                    return { success: false, error: { message: error.message } };
                }
            },

            getStatus: async (externalId) => {
                try {
                    const result = await PaymentService.getPaymentStatus(externalId);
                    return { success: true, data: result };
                } catch (error) {
                    return { success: false, error: { message: error.message } };
                }
            },

            handleWebhook: async (webhookData) => {
                try {
                    const result = await PaymentService.handleWebhook(webhookData);
                    return { success: true, data: result };
                } catch (error) {
                    return { success: false, error: { message: error.message } };
                }
            },

            formatCurrency: PaymentService.formatCurrency,
            generateExternalId: PaymentService.generateExternalId,
            simulateCallback: PaymentService.simulatePaymentCallback
        };
    }

    /**
     * Health check for all services
     */
    async healthCheck() {
        const results = {
            timestamp: new Date().toISOString(),
            mode: this.config.USE_MOCK_API ? 'mock' : 'real',
            services: {}
        };

        // Test each service
        const services = [
            { name: 'products', service: this.products, test: () => this.products.getPizzas({ limit: 1 }) },
            { name: 'orders', service: this.orders, test: () => this.orders.getUserOrders('test_user', { limit: 1 }) },
            { name: 'drivers', service: this.drivers, test: () => this.drivers.getDriverProfile('driver_001') },
            { name: 'locations', service: this.locations, test: () => this.locations.getCoverageAreas({ limit: 1 }) },
            { name: 'notifications', service: this.notifications, test: () => this.notifications.getUserNotifications('test_user', { limit: 1 }) },
            { name: 'promos', service: this.promos, test: () => this.promos.getAvailablePromos('test_user', { limit: 1 }) }
        ];

        for (const { name, test } of services) {
            try {
                const startTime = Date.now();
                const response = await test();
                const endTime = Date.now();
                
                results.services[name] = {
                    status: response.success ? 'healthy' : 'error',
                    responseTime: endTime - startTime,
                    error: response.success ? null : response.error?.message
                };
            } catch (error) {
                results.services[name] = {
                    status: 'error',
                    responseTime: null,
                    error: error.message
                };
            }
        }

        return results;
    }

    /**
     * Get API statistics and metrics
     */
    getStats() {
        return {
            mode: this.config.USE_MOCK_API ? 'mock' : 'real',
            baseUrl: this.config.BASE_URL,
            timeout: this.config.TIMEOUT,
            services: Object.keys(this.getAvailableServices()).length,
            initialized: this.isInitialized,
            config: {
                useMockApi: this.config.USE_MOCK_API,
                baseUrl: this.config.BASE_URL,
                strapiUrl: this.config.STRAPI_URL
            }
        };
    }

    /**
     * Reset all services to initial state (useful for testing)
     */
    async reset() {
        console.log('Resetting API Client...');
        
        // Reset service states if they have reset methods
        if (typeof this.drivers.resetDriver === 'function') {
            this.drivers.resetDriver();
        }
        
        // Clear localStorage data in mock mode
        if (this.config.USE_MOCK_API && typeof localStorage !== 'undefined') {
            const keysToKeep = ['token', 'user', 'theme']; // Keep essential data
            const keysToRemove = [];
            
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (!keysToKeep.includes(key)) {
                    keysToRemove.push(key);
                }
            }
            
            keysToRemove.forEach(key => localStorage.removeItem(key));
        }
        
        console.log('API Client reset completed');
    }

    /**
     * Batch operations across multiple services
     */
    async batch(operations) {
        const results = {};
        
        for (const [name, operation] of Object.entries(operations)) {
            try {
                results[name] = await operation();
            } catch (error) {
                results[name] = { success: false, error: error.message };
            }
        }
        
        return results;
    }

    /**
     * Convenient method shortcuts for common operations
     */
    get shortcuts() {
        return {
            // Order shortcuts
            createOrder: (orderData) => this.orders.createOrder(orderData),
            trackOrder: (orderId) => this.orders.getOrderTracking(orderId),
            
            // Product shortcuts  
            getMenu: (filters) => this.products.getMenu(filters),
            searchProducts: (query) => this.products.searchProducts(query),
            
            // Location shortcuts
            checkCoverage: (location) => this.locations.checkCoverage(location),
            calculateDelivery: (location, orderValue) => this.locations.calculateDeliveryInfo(location, orderValue),
            
            // Driver shortcuts
            getAvailableDrivers: (location) => this.drivers.getAvailableDrivers(location),
            updateDriverStatus: (driverId, status) => this.drivers.updateDriverStatus(driverId, status),
            
            // Promo shortcuts
            getAvailablePromos: (userId, filters) => this.promos.getAvailablePromos(userId, filters),
            validatePromoCode: (code, validationData) => this.promos.validatePromoCode(code, validationData),
            applyPromoCode: (code, orderData) => this.promos.applyPromoCode(code, orderData),
            
            // Notification shortcuts
            sendOrderNotification: (orderId, status, data) => this.notifications.sendOrderStatusNotification(orderId, status, data),
            sendPaymentNotification: (paymentData) => this.notifications.sendPaymentNotification(paymentData),
            
            // Payment shortcuts
            createPayment: (paymentData) => this.payments.create(paymentData),
            getPaymentStatus: (externalId) => this.payments.getStatus(externalId)
        };
    }
}

// Create and export singleton instance
const apiClient = new ApiClient();

// Auto-initialize if in browser environment
if (typeof window !== 'undefined') {
    apiClient.initialize().catch(console.error);
}

// Named exports for individual services (backward compatibility)
export {
    productsApi,
    ordersApi,  
    driverApi,
    locationApi,
    notificationApi,
    promoApi,
    PaymentService,
    BaseApiService,
    API_CONFIG
};

// Default export - main API client
export default apiClient;

// Convenience exports
export const {
    products,
    orders,
    drivers,
    locations,
    notifications,
    promos,
    payments
} = apiClient;

export const { shortcuts } = apiClient;