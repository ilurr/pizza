import { BaseApiService } from './ApiClient.js';
import { getSupabaseClient } from '@/services/supabase/client.js';

function rowToOrder(row) {
    if (!row) return null;
    return {
        id: row.id,
        orderNumber: row.order_number,
        customerId: row.customer_id,
        customerName: row.customer_name,
        customerPhone: row.customer_phone,
        customerEmail: row.customer_email,
        orderDate: row.order_date,
        status: row.status,
        items: row.items || [],
        subtotal: row.subtotal,
        deliveryFee: row.delivery_fee ?? 0,
        discount: row.discount ?? 0,
        total: row.total,
        paymentMethod: row.payment_method,
        paymentStatus: row.payment_status,
        deliveryAddress: row.delivery_address || {},
        deliveryTime: row.delivery_time,
        estimatedDelivery: row.estimated_delivery,
        notes: row.notes,
        promoCode: row.promo_code,
        promoTitle: row.promo_title,
        driverId: row.driver_id,
        driverInfo: row.driver_info,
        rating: row.rating,
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
}

function orderToRow(order) {
    if (!order) return null;
    const row = {
        order_number: order.orderNumber,
        customer_id: order.customerId,
        customer_name: order.customerName,
        customer_phone: order.customerPhone,
        customer_email: order.customerEmail,
        order_date: order.orderDate,
        status: order.status,
        items: order.items,
        subtotal: order.subtotal,
        delivery_fee: order.deliveryFee ?? 0,
        discount: order.discount ?? 0,
        total: order.total,
        payment_method: order.paymentMethod,
        payment_status: order.paymentStatus ?? 'pending',
        delivery_address: order.deliveryAddress,
        delivery_time: order.deliveryTime,
        estimated_delivery: order.estimatedDelivery,
        notes: order.notes,
        promo_code: order.promoCode,
        promo_title: order.promoTitle,
        driver_id: order.driverId,
        driver_info: order.driverInfo,
        rating: order.rating
    };
    if (order.id) row.id = order.id;
    return row;
}

export class OrdersApiService extends BaseApiService {
    constructor() {
        super();
        this.endpoint = '/orders';
    }

    async createOrder(orderData) {
        if (this.dataSource === 'supabase') {
            const supabase = getSupabaseClient();
            if (!supabase) {
                return this.createMockError('Supabase not configured', 500);
            }
            const newOrder = {
                id: `order_${Date.now()}`,
                order_number: `PZ-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`,
                customer_id: orderData.customerId || 'guest_user',
                customer_name: orderData.customerName,
                customer_phone: orderData.customerPhone || null,
                customer_email: orderData.customerEmail || null,
                order_date: new Date().toISOString(),
                status: 'pending',
                items: orderData.items || [],
                subtotal: Number(orderData.subtotal),
                delivery_fee: Number(orderData.deliveryFee ?? 0),
                discount: Number(orderData.discount ?? 0),
                total: Number(orderData.total),
                payment_method: orderData.paymentMethod || null,
                payment_status: 'pending',
                delivery_address: orderData.deliveryAddress || {},
                estimated_delivery: orderData.estimatedDelivery || new Date(Date.now() + 45 * 60000).toISOString(),
                notes: orderData.notes || null,
                promo_code: orderData.promoCode || null,
                promo_title: orderData.promoTitle || null,
                driver_id: orderData.driverId || null,
                driver_info: orderData.driverInfo || null
            };
            const { data, error } = await supabase.from('orders').insert(newOrder).select().single();
            if (error) {
                return this.createMockError(error.message || 'Failed to create order', error.code || 500);
            }
            return this.createMockResponse({ order: rowToOrder(data), message: 'Order created successfully' });
        }
        return await this.post(this.endpoint, orderData);
    }

    async getUserOrders(userId, filters = {}) {
        if (this.dataSource === 'supabase') {
            const supabase = getSupabaseClient();
            if (!supabase) {
                return this.createMockError('Supabase not configured', 500);
            }
            let query = supabase.from('orders').select('*').or(`customer_id.eq.${userId},customer_id.eq.guest_user`).order('order_date', { ascending: false });
            if (filters.status) query = query.eq('status', filters.status);
            if (filters.dateFrom) query = query.gte('order_date', filters.dateFrom);
            if (filters.dateTo) query = query.lte('order_date', filters.dateTo);
            const { data: rows, error } = await query;
            if (error) {
                return this.createMockError(error.message || 'Failed to fetch orders', error.code || 500);
            }
            const orders = (rows || []).map(rowToOrder);
            const page = filters.page || 1;
            const limit = filters.limit || 10;
            const startIndex = (page - 1) * limit;
            const paginatedOrders = orders.slice(startIndex, startIndex + limit);
            return this.createMockResponse({
                orders: paginatedOrders,
                total: orders.length,
                page,
                limit,
                totalPages: Math.ceil(orders.length / limit)
            });
        }
        return await this.get(`${this.endpoint}/user/${userId}`, filters);
    }

    async getOrder(orderId) {
        if (this.dataSource === 'supabase') {
            const supabase = getSupabaseClient();
            if (!supabase) {
                return this.createMockError('Supabase not configured', 500);
            }
            const { data, error } = await supabase.from('orders').select('*').eq('id', orderId).single();
            if (error || !data) {
                return this.createMockError('Order not found', 404);
            }
            return this.createMockResponse({ order: rowToOrder(data) });
        }
        return await this.get(`${this.endpoint}/${orderId}`);
    }

    async updateOrderStatus(orderId, status, additionalData = {}) {
        if (this.dataSource === 'supabase') {
            const supabase = getSupabaseClient();
            if (!supabase) {
                return this.createMockError('Supabase not configured', 500);
            }
            const updates = { status, updated_at: new Date().toISOString(), ...additionalData };
            if (status === 'delivered') {
                updates.delivery_time = updates.delivery_time || new Date().toISOString();
            }
            const { data, error } = await supabase.from('orders').update(updates).eq('id', orderId).select().single();
            if (error) {
                return this.createMockError(error.message || 'Failed to update order', error.code || 500);
            }
            return this.createMockResponse({ order: rowToOrder(data), message: `Order status updated to ${status}` });
        }
        return await this.patch(`${this.endpoint}/${orderId}/status`, { status, ...additionalData });
    }

    async assignDriver(orderId, driverId, driverInfo) {
        if (this.dataSource === 'supabase') {
            const supabase = getSupabaseClient();
            if (!supabase) {
                return this.createMockError('Supabase not configured', 500);
            }
            const { data, error } = await supabase
                .from('orders')
                .update({
                    driver_id: driverId,
                    driver_info: driverInfo,
                status: 'assigned',
                    updated_at: new Date().toISOString()
                })
                .eq('id', orderId)
                .select()
                .single();
            if (error) {
                return this.createMockError(error.message || 'Failed to assign driver', error.code || 500);
            }
            return this.createMockResponse({ order: rowToOrder(data), message: 'Driver assigned successfully' });
        }
        return await this.patch(`${this.endpoint}/${orderId}/assign-driver`, { driverId, driverInfo });
    }

    async getOrderTracking(orderId) {
        if (this.dataSource === 'supabase') {
            const res = await this.getOrder(orderId);
            if (!res.success || !res.data?.order) return res;
            const order = res.data.order;
            const trackingSteps = [
                { status: 'pending', label: 'Order Placed', timestamp: order.orderDate, completed: true, description: 'Your order has been received and is being processed' },
                { status: 'assigned', label: 'Order Confirmed', timestamp: order.updatedAt, completed: !['pending'].includes(order.status), description: 'Your order has been confirmed and assigned to a chef' },
                { status: 'preparing', label: 'Preparing', timestamp: order.updatedAt, completed: ['preparing', 'on_delivery', 'delivered'].includes(order.status), description: 'Chef is preparing your delicious pizza' },
                { status: 'on_delivery', label: 'On Delivery', timestamp: order.updatedAt, completed: ['on_delivery', 'delivered'].includes(order.status), description: 'Chef is on the way to your location' },
                { status: 'delivered', label: 'Delivered', timestamp: order.deliveryTime || order.updatedAt, completed: order.status === 'delivered', description: 'Order delivered successfully!' }
            ];
            return this.createMockResponse({
                orderId,
                currentStatus: order.status,
                estimatedDelivery: order.estimatedDelivery,
                trackingSteps,
                driverInfo: order.driverInfo,
                lastUpdated: order.updatedAt
            });
        }
        return await this.get(`${this.endpoint}/${orderId}/tracking`);
    }

    async cancelOrder(orderId, reason = '') {
        if (this.dataSource === 'supabase') {
            const res = await this.getOrder(orderId);
            if (!res.success || !res.data?.order) return this.createMockError('Order not found', 404);
            const order = res.data.order;
            if (['delivered', 'cancelled'].includes(order.status)) {
                return this.createMockError('Order cannot be cancelled', 400);
            }
            return this.updateOrderStatus(orderId, 'cancelled', { cancellation_reason: reason });
        }
        return await this.patch(`${this.endpoint}/${orderId}/cancel`, { reason });
    }

    async getOrderStats(userId, period = 'all') {
        if (this.dataSource === 'supabase') {
            const res = await this.getUserOrders(userId, { limit: 1000 });
            if (!res.success) return res;
            let userOrders = res.data.orders || [];
            if (period !== 'all') {
                const now = new Date();
                let startDate;
                if (period === 'week') startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                else if (period === 'month') startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                else if (period === 'year') startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
                if (startDate) userOrders = userOrders.filter((o) => new Date(o.orderDate) >= startDate);
            }
            const stats = {
                totalOrders: userOrders.length,
                totalSpent: userOrders.reduce((sum, o) => sum + o.total, 0),
                averageOrderValue: userOrders.length ? userOrders.reduce((sum, o) => sum + o.total, 0) / userOrders.length : 0,
                favoriteItems: this.calculateFavoriteItems(userOrders),
                ordersByStatus: {
                    pending: userOrders.filter((o) => o.status === 'pending').length,
                    assigned: userOrders.filter((o) => o.status === 'assigned').length,
                    preparing: userOrders.filter((o) => o.status === 'preparing').length,
                    on_delivery: userOrders.filter((o) => o.status === 'on_delivery').length,
                    delivered: userOrders.filter((o) => o.status === 'delivered').length,
                    cancelled: userOrders.filter((o) => o.status === 'cancelled').length
                },
                period
            };
            return this.createMockResponse({ stats });
        }
        return await this.get(`${this.endpoint}/stats/${userId}`, { period });
    }

    calculateFavoriteItems(orders) {
        const itemCount = {};
        (orders || []).forEach((order) => {
            (order.items || []).forEach((item) => {
                const key = item.name;
                itemCount[key] = (itemCount[key] || 0) + item.quantity;
            });
        });
        return Object.entries(itemCount)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5)
            .map(([name, count]) => ({ name, count }));
    }

    async getDriverOrders(driverId, status = null) {
        if (this.dataSource === 'supabase') {
            const supabase = getSupabaseClient();
            if (!supabase) {
                return this.createMockError('Supabase not configured', 500);
            }
            let query = supabase.from('orders').select('*').eq('driver_id', driverId);
            if (status) query = query.eq('status', status);
            const { data: rows, error } = await query.order('order_date', { ascending: false });
            if (error) {
                return this.createMockError(error.message || 'Failed to fetch driver orders', error.code || 500);
            }
            const orders = (rows || []).map(rowToOrder);
            return this.createMockResponse({ orders, total: orders.length });
        }
        return await this.get(`${this.endpoint}/driver/${driverId}`, { status });
    }
}

export default new OrdersApiService();
