import { BaseApiService } from './ApiClient.js';
import ordersData from '@/data/orders.json';

export class OrdersApiService extends BaseApiService {
    constructor() {
        super();
        this.endpoint = '/orders';
        this.mockOrders = [...ordersData]; // Copy for manipulation
    }

    // Create a new order
    async createOrder(orderData) {
        if (this.useMockApi) {
            await this.mockDelay(1000); // Simulate processing time
            
            // Generate new order
            const newOrder = {
                id: `order_${Date.now()}`,
                orderNumber: `PZ-${new Date().getFullYear()}-${String(this.mockOrders.length + 1).padStart(3, '0')}`,
                customerId: orderData.customerId || 'guest_user',
                customerName: orderData.customerName,
                customerPhone: orderData.customerPhone,
                customerEmail: orderData.customerEmail,
                orderDate: new Date().toISOString(),
                status: 'pending',
                items: orderData.items,
                subtotal: orderData.subtotal,
                deliveryFee: orderData.deliveryFee || 0,
                discount: orderData.discount || 0,
                total: orderData.total,
                paymentMethod: orderData.paymentMethod,
                paymentStatus: 'pending',
                deliveryAddress: orderData.deliveryAddress,
                estimatedDelivery: new Date(Date.now() + 45 * 60000).toISOString(), // 45 minutes
                notes: orderData.notes || null,
                driverId: null,
                driverInfo: null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            
            this.mockOrders.push(newOrder);
            
            return this.createMockResponse({
                order: newOrder,
                message: 'Order created successfully'
            });
        }
        
        // Real API call
        return await this.post(this.endpoint, orderData);
    }

    // Get user's orders
    async getUserOrders(userId, filters = {}) {
        if (this.useMockApi) {
            await this.mockDelay();
            
            let userOrders = this.mockOrders.filter(order => 
                order.customerId === userId || order.customerId === 'guest_user'
            );
            
            // Apply filters
            if (filters.status) {
                userOrders = userOrders.filter(order => order.status === filters.status);
            }
            
            if (filters.dateFrom) {
                userOrders = userOrders.filter(order => 
                    new Date(order.orderDate) >= new Date(filters.dateFrom)
                );
            }
            
            if (filters.dateTo) {
                userOrders = userOrders.filter(order => 
                    new Date(order.orderDate) <= new Date(filters.dateTo)
                );
            }
            
            // Sort by date (newest first)
            userOrders.sort((a, b) => new Date(b.orderDate) - new Date(a.orderDate));
            
            // Pagination
            const page = filters.page || 1;
            const limit = filters.limit || 10;
            const startIndex = (page - 1) * limit;
            const paginatedOrders = userOrders.slice(startIndex, startIndex + limit);
            
            return this.createMockResponse({
                orders: paginatedOrders,
                total: userOrders.length,
                page: page,
                limit: limit,
                totalPages: Math.ceil(userOrders.length / limit)
            });
        }
        
        // Real API call
        return await this.get(`${this.endpoint}/user/${userId}`, filters);
    }

    // Get specific order by ID
    async getOrder(orderId) {
        if (this.useMockApi) {
            await this.mockDelay();
            
            const order = this.mockOrders.find(o => o.id === orderId);
            
            if (!order) {
                return this.createMockError('Order not found', 404);
            }
            
            return this.createMockResponse({ order });
        }
        
        // Real API call
        return await this.get(`${this.endpoint}/${orderId}`);
    }

    // Update order status
    async updateOrderStatus(orderId, status, additionalData = {}) {
        if (this.useMockApi) {
            await this.mockDelay();
            
            const orderIndex = this.mockOrders.findIndex(o => o.id === orderId);
            
            if (orderIndex === -1) {
                return this.createMockError('Order not found', 404);
            }
            
            // Update order status and additional data
            this.mockOrders[orderIndex] = {
                ...this.mockOrders[orderIndex],
                status: status,
                updatedAt: new Date().toISOString(),
                ...additionalData
            };
            
            // Handle status-specific updates
            switch (status) {
                case 'confirmed':
                    this.mockOrders[orderIndex].confirmedAt = new Date().toISOString();
                    break;
                case 'preparing':
                    this.mockOrders[orderIndex].preparingAt = new Date().toISOString();
                    break;
                case 'on_delivery':
                    this.mockOrders[orderIndex].onDeliveryAt = new Date().toISOString();
                    break;
                case 'delivered':
                    this.mockOrders[orderIndex].deliveredAt = new Date().toISOString();
                    this.mockOrders[orderIndex].deliveryTime = new Date().toISOString();
                    break;
                case 'cancelled':
                    this.mockOrders[orderIndex].cancelledAt = new Date().toISOString();
                    break;
            }
            
            return this.createMockResponse({
                order: this.mockOrders[orderIndex],
                message: `Order status updated to ${status}`
            });
        }
        
        // Real API call
        return await this.patch(`${this.endpoint}/${orderId}/status`, { 
            status, 
            ...additionalData 
        });
    }

    // Assign driver to order
    async assignDriver(orderId, driverId, driverInfo) {
        if (this.useMockApi) {
            await this.mockDelay();
            
            const orderIndex = this.mockOrders.findIndex(o => o.id === orderId);
            
            if (orderIndex === -1) {
                return this.createMockError('Order not found', 404);
            }
            
            this.mockOrders[orderIndex] = {
                ...this.mockOrders[orderIndex],
                driverId: driverId,
                driverInfo: driverInfo,
                status: 'assigned',
                assignedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            
            return this.createMockResponse({
                order: this.mockOrders[orderIndex],
                message: 'Driver assigned successfully'
            });
        }
        
        // Real API call
        return await this.patch(`${this.endpoint}/${orderId}/assign-driver`, {
            driverId,
            driverInfo
        });
    }

    // Get order tracking information
    async getOrderTracking(orderId) {
        if (this.useMockApi) {
            await this.mockDelay();
            
            const order = this.mockOrders.find(o => o.id === orderId);
            
            if (!order) {
                return this.createMockError('Order not found', 404);
            }
            
            // Generate mock tracking data
            const trackingSteps = [
                {
                    status: 'pending',
                    label: 'Order Placed',
                    timestamp: order.orderDate,
                    completed: true,
                    description: 'Your order has been received and is being processed'
                },
                {
                    status: 'confirmed',
                    label: 'Order Confirmed',
                    timestamp: order.confirmedAt,
                    completed: !!order.confirmedAt,
                    description: 'Your order has been confirmed and assigned to a chef'
                },
                {
                    status: 'preparing',
                    label: 'Preparing',
                    timestamp: order.preparingAt,
                    completed: !!order.preparingAt,
                    description: 'Chef is preparing your delicious pizza'
                },
                {
                    status: 'on_delivery',
                    label: 'On Delivery',
                    timestamp: order.onDeliveryAt,
                    completed: !!order.onDeliveryAt,
                    description: 'Chef is on the way to your location'
                },
                {
                    status: 'delivered',
                    label: 'Delivered',
                    timestamp: order.deliveredAt,
                    completed: !!order.deliveredAt,
                    description: 'Order delivered successfully!'
                }
            ];
            
            return this.createMockResponse({
                orderId: orderId,
                currentStatus: order.status,
                estimatedDelivery: order.estimatedDelivery,
                trackingSteps: trackingSteps,
                driverInfo: order.driverInfo,
                lastUpdated: order.updatedAt
            });
        }
        
        // Real API call
        return await this.get(`${this.endpoint}/${orderId}/tracking`);
    }

    // Cancel order
    async cancelOrder(orderId, reason = '') {
        if (this.useMockApi) {
            await this.mockDelay();
            
            const orderIndex = this.mockOrders.findIndex(o => o.id === orderId);
            
            if (orderIndex === -1) {
                return this.createMockError('Order not found', 404);
            }
            
            const order = this.mockOrders[orderIndex];
            
            // Check if order can be cancelled
            if (['delivered', 'cancelled'].includes(order.status)) {
                return this.createMockError('Order cannot be cancelled', 400);
            }
            
            this.mockOrders[orderIndex] = {
                ...order,
                status: 'cancelled',
                cancelledAt: new Date().toISOString(),
                cancellationReason: reason,
                updatedAt: new Date().toISOString()
            };
            
            return this.createMockResponse({
                order: this.mockOrders[orderIndex],
                message: 'Order cancelled successfully'
            });
        }
        
        // Real API call
        return await this.patch(`${this.endpoint}/${orderId}/cancel`, { reason });
    }

    // Get order statistics for a user
    async getOrderStats(userId, period = 'all') {
        if (this.useMockApi) {
            await this.mockDelay();
            
            let userOrders = this.mockOrders.filter(order => 
                order.customerId === userId || order.customerId === 'guest_user'
            );
            
            // Apply period filter
            if (period !== 'all') {
                const now = new Date();
                let startDate;
                
                switch (period) {
                    case 'week':
                        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                        break;
                    case 'month':
                        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                        break;
                    case 'year':
                        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
                        break;
                    default:
                        startDate = null;
                }
                
                if (startDate) {
                    userOrders = userOrders.filter(order => 
                        new Date(order.orderDate) >= startDate
                    );
                }
            }
            
            const stats = {
                totalOrders: userOrders.length,
                totalSpent: userOrders.reduce((sum, order) => sum + order.total, 0),
                averageOrderValue: userOrders.length > 0 ? 
                    userOrders.reduce((sum, order) => sum + order.total, 0) / userOrders.length : 0,
                favoriteItems: this.calculateFavoriteItems(userOrders),
                ordersByStatus: {
                    pending: userOrders.filter(o => o.status === 'pending').length,
                    confirmed: userOrders.filter(o => o.status === 'confirmed').length,
                    preparing: userOrders.filter(o => o.status === 'preparing').length,
                    on_delivery: userOrders.filter(o => o.status === 'on_delivery').length,
                    delivered: userOrders.filter(o => o.status === 'delivered').length,
                    cancelled: userOrders.filter(o => o.status === 'cancelled').length
                },
                period: period
            };
            
            return this.createMockResponse({ stats });
        }
        
        // Real API call
        return await this.get(`${this.endpoint}/stats/${userId}`, { period });
    }

    // Helper method to calculate favorite items
    calculateFavoriteItems(orders) {
        const itemCount = {};
        
        orders.forEach(order => {
            order.items.forEach(item => {
                const key = item.name;
                itemCount[key] = (itemCount[key] || 0) + item.quantity;
            });
        });
        
        return Object.entries(itemCount)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5)
            .map(([name, count]) => ({ name, count }));
    }

    // Get orders for driver (used in driver dashboard)
    async getDriverOrders(driverId, status = null) {
        if (this.useMockApi) {
            await this.mockDelay();
            
            let driverOrders = this.mockOrders.filter(order => order.driverId === driverId);
            
            if (status) {
                driverOrders = driverOrders.filter(order => order.status === status);
            }
            
            return this.createMockResponse({
                orders: driverOrders,
                total: driverOrders.length
            });
        }
        
        // Real API call
        return await this.get(`${this.endpoint}/driver/${driverId}`, { status });
    }
}

// Export singleton instance
export default new OrdersApiService();