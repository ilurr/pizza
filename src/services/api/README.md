# Centralized API Services

This directory contains the centralized API service layer for the Vue.js Pizza application. All mock data has been organized into dedicated services that can seamlessly switch between mock and real API calls.

## Architecture

```
src/services/api/
├── index.js                 # Main API client and service aggregator
├── ApiClient.js             # Base API service with axios configuration
├── ProductsApiService.js    # Pizza and beverage management
├── OrdersApiService.js      # Order lifecycle management
├── DriverApiService.js      # Driver operations and management
├── LocationApiService.js    # Location services and coverage areas
├── NotificationApiService.js # Notification system and templates
└── README.md               # This file
```

## Quick Start

### Basic Usage

```javascript
import api from '@/services/api';

// Initialize (auto-runs in browser)
await api.initialize();

// Use services directly
const pizzas = await api.products.getPizzas();
const order = await api.orders.createOrder(orderData);
const coverage = await api.locations.checkCoverage(location);

// Or use shortcuts
const menu = await api.shortcuts.getMenu();
const orderTracking = await api.shortcuts.trackOrder(orderId);
```

### Switching API Modes

```javascript
import api from '@/services/api';

// Check current mode
console.log(api.isMockMode()); // true/false

// Switch to real API mode
api.setMockMode(false);

// Switch back to mock mode
api.setMockMode(true);
```

### Environment Configuration

Set these environment variables in your `.env` file:

```env
# API Configuration
VITE_USE_MOCK_API=true                    # true = mock data, false = real API
VITE_API_BASE_URL=http://localhost:3000/api/v1
VITE_STRAPI_URL=http://localhost:1337/api

# Payment Configuration (Xendit)
VITE_XENDIT_WEBHOOK_SECRET=your_webhook_secret
```

## Available Services

### Products API (`api.products`)

Manages pizza and beverage catalog.

```javascript
// Get all pizzas with filtering
const pizzas = await api.products.getPizzas({
    category: 'classic',
    popular: true,
    maxPrice: 100000
});

// Get full menu
const menu = await api.products.getMenu();

// Search products
const results = await api.products.searchProducts('margherita');

// Check availability
const availability = await api.products.checkAvailability('pizza_001', 2);
```

### Orders API (`api.orders`)

Handles complete order lifecycle.

```javascript
// Create new order
const order = await api.orders.createOrder({
    customerId: 'customer_001',
    items: [{ productId: 'pizza_001', quantity: 2 }],
    deliveryAddress: address,
    paymentMethod: 'QRIS'
});

// Track order
const tracking = await api.orders.getOrderTracking(orderId);

// Update order status
await api.orders.updateOrderStatus(orderId, 'delivered');

// Get user orders
const userOrders = await api.orders.getUserOrders(userId, {
    status: 'delivered',
    limit: 10
});
```

### Driver API (`api.drivers`)

Driver operations and management.

```javascript
// Get driver profile
const driver = await api.drivers.getDriverProfile('driver_001');

// Update driver status
await api.drivers.updateDriverStatus('driver_001', {
    isOnline: true,
    isAvailable: true
});

// Get driver stock
const stock = await api.drivers.getDriverStock('driver_001', {
    critical: true
});

// Update stock levels
await api.drivers.updateStock('driver_001', [
    { itemId: 'flour', quantity: 10 }
]);

// Get driver earnings
const earnings = await api.drivers.getDriverEarnings('driver_001', 'month');
```

### Location API (`api.locations`)

Location services and coverage management.

```javascript
// Check coverage for location
const coverage = await api.locations.checkCoverage({
    lat: -7.2575,
    lng: 112.7521
});

// Get all coverage areas
const areas = await api.locations.getCoverageAreas();

// Geocode address
const geocoded = await api.locations.geocodeAddress('Jl. Diponegoro No. 123');

// Calculate delivery info
const deliveryInfo = await api.locations.calculateDeliveryInfo(
    { lat: -7.2575, lng: 112.7521 },
    85000 // order value
);

// Search locations
const locations = await api.locations.searchLocations('Surabaya');
```

### Notifications API (`api.notifications`)

Comprehensive notification system.

```javascript
// Get user notifications
const notifications = await api.notifications.getUserNotifications('user_001');

// Create notification
await api.notifications.createNotification({
    userId: 'user_001',
    templateId: 'order_placed',
    data: { orderNumber: 'PZ-2024-001' }
});

// Send order status notification
await api.notifications.sendOrderStatusNotification(
    'order_001',
    'delivered',
    { customerId: 'user_001', driverName: 'Pak Agus' }
);

// Mark as read
await api.notifications.markAsRead('notif_001', 'user_001');

// Get/update preferences
const prefs = await api.notifications.getPreferences('user_001');
await api.notifications.updatePreferences('user_001', {
    enabledChannels: ['app', 'email']
});
```

### Payments API (`api.payments`)

Payment processing integration.

```javascript
// Create payment
const payment = await api.payments.create({
    external_id: 'order_123',
    amount: 75000,
    customer: { name: 'John Doe', email: 'john@example.com' },
    payment_method: 'qris'
});

// Get payment status
const status = await api.payments.getStatus('order_123');

// Format currency
const formatted = api.payments.formatCurrency(75000); // "Rp75.000"
```

## Shortcuts

For common operations, use the shortcuts API:

```javascript
import { shortcuts } from '@/services/api';

// Quick operations
const menu = await shortcuts.getMenu();
const order = await shortcuts.createOrder(orderData);
const tracking = await shortcuts.trackOrder(orderId);
const coverage = await shortcuts.checkCoverage(location);
const payment = await shortcuts.createPayment(paymentData);
```

## Health Check & Monitoring

```javascript
// Check service health
const health = await api.healthCheck();
console.log(health);
// {
//   timestamp: "2024-01-20T10:00:00Z",
//   mode: "mock",
//   services: {
//     products: { status: "healthy", responseTime: 145 },
//     orders: { status: "healthy", responseTime: 203 },
//     ...
//   }
// }

// Get API stats
const stats = api.getStats();
console.log(stats);
// {
//   mode: "mock",
//   services: 5,
//   initialized: true,
//   config: { ... }
// }
```

## Batch Operations

Execute multiple API calls efficiently:

```javascript
const results = await api.batch({
    menu: () => api.products.getMenu(),
    userOrders: () => api.orders.getUserOrders('user_001'),
    notifications: () => api.notifications.getUserNotifications('user_001')
});

console.log(results.menu.data);
console.log(results.userOrders.data);
console.log(results.notifications.data);
```

## Migration from Old Code

### Before (scattered data)
```javascript
// Old way - data scattered across components
const pizzas = [
    { id: 1, name: 'Margherita', price: 45000 },
    // ... hardcoded data
];
```

### After (centralized service)
```javascript
// New way - centralized service
import { products } from '@/services/api';

const pizzasResponse = await products.getPizzas();
const pizzas = pizzasResponse.data.pizzas;
```

### Store Integration

Update your Pinia stores to use the new services:

```javascript
// stores/productStore.js
import { products } from '@/services/api';

export const useProductStore = defineStore('products', {
    state: () => ({
        pizzas: [],
        loading: false
    }),
    
    actions: {
        async loadPizzas() {
            this.loading = true;
            try {
                const response = await products.getPizzas();
                this.pizzas = response.data.pizzas;
            } catch (error) {
                console.error('Failed to load pizzas:', error);
            } finally {
                this.loading = false;
            }
        }
    }
});
```

## Error Handling

All services return consistent response format:

```javascript
const response = await api.products.getPizzas();

if (response.success) {
    console.log('Data:', response.data);
} else {
    console.error('Error:', response.error.message);
}
```

## Testing

The mock API provides realistic delays and error scenarios for testing:

```javascript
// Services automatically include delays and error simulation
const response = await api.orders.createOrder(invalidData);
// Will return appropriate error response with proper status codes
```

## Real API Integration

When ready to switch to real APIs:

1. Set `VITE_USE_MOCK_API=false` in your environment
2. Ensure your backend implements the expected endpoints
3. All service methods will automatically use real HTTP calls

The service interfaces remain identical, making the transition seamless.

## Best Practices

1. **Always handle errors**: Check `response.success` before using data
2. **Use environment variables**: Configure API URLs via environment
3. **Leverage shortcuts**: Use `api.shortcuts` for common operations
4. **Monitor health**: Regularly check `api.healthCheck()` in production
5. **Batch operations**: Use `api.batch()` for multiple related calls
6. **Handle loading states**: Services include realistic delays even in mock mode

## Support

This API layer is designed to make the transition from mock data to real APIs seamless. All services maintain consistent interfaces and error handling patterns, ensuring your application code remains unchanged when switching between modes.