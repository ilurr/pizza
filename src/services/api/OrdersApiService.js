import { BaseApiService } from './ApiClient.js';
import { getSupabaseClient } from '@/services/supabase/client.js';

/** Walk-in cashier (guest) paying cash: money collected at counter → treat as paid when completed. */
function isWalkInCashOrder(row) {
    if (!row) return false;
    const isGuestWalkIn = String(row.customer_id || '') === 'guest_user';
    const isCash = String(row.payment_method || '').toLowerCase() === 'cash';
    return isGuestWalkIn && isCash;
}

/**
 * Admin list + detail read `driverInfo` from `orders.driver_info` (JSON). Walk-in and some flows only set `driver_id`.
 * Merge display fields from `app_users` when name or phone is missing so UIs (e.g. WhatsApp) work.
 */
async function enrichOrdersDriverInfoFromUsers(supabase, orders) {
    if (!Array.isArray(orders) || !orders.length || !supabase) return orders;

    const idsToFetch = new Set();
    for (const o of orders) {
        if (o.driverId == null || String(o.driverId) === '') continue;
        const di = o.driverInfo;
        const hasName = di && typeof di === 'object' && String(di.name || '').trim() !== '';
        const hasPhone = di && typeof di === 'object' && String(di.phone || '').trim() !== '';
        if (!hasName || !hasPhone) idsToFetch.add(String(o.driverId));
    }
    if (!idsToFetch.size) return orders;

    const ids = [...idsToFetch];
    const { data: users, error } = await supabase.from('app_users').select('id, fullname, username, phone, avatar').in('id', ids);
    if (error || !users?.length) return orders;

    const byId = Object.fromEntries(users.map((u) => [String(u.id), u]));

    return orders.map((o) => {
        const id = o.driverId != null ? String(o.driverId) : '';
        if (!id || !idsToFetch.has(id)) return o;
        const u = byId[id];
        if (!u) return o;
        const prev = o.driverInfo && typeof o.driverInfo === 'object' ? { ...o.driverInfo } : {};
        prev.name = String(prev.name || '').trim() || u.fullname || u.username || id;
        prev.phone = String(prev.phone || '').trim() || u.phone || '';
        if (u.avatar && (prev.avatar == null || prev.avatar === '')) prev.avatar = u.avatar;
        return { ...o, driverInfo: prev };
    });
}

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
        updatedAt: row.updated_at,
        stockDeductedAt: row.stock_deducted_at
    };
}

/** MVP: one BOM for all pizzas; optional per-menu id rows later. Beverages use __default_beverage__ (usually empty). */
const DEFAULT_PIZZA_RECIPE_KEY = '__default_pizza__';
const DEFAULT_BEVERAGE_RECIPE_KEY = '__default_beverage__';

async function fetchRecipeLinesForItem(supabase, menuProductId, isBeverage) {
    if (isBeverage) {
        const { data, error } = await supabase.from('product_stock_recipe').select('stock_product_id, quantity').eq('product_id', DEFAULT_BEVERAGE_RECIPE_KEY);
        if (error) throw new Error(error.message);
        return data || [];
    }
    const id = String(menuProductId ?? '');
    const { data: specific, error: e1 } = await supabase.from('product_stock_recipe').select('stock_product_id, quantity').eq('product_id', id);
    if (e1) throw new Error(e1.message);
    if (specific?.length) return specific;
    const { data: fallback, error: e2 } = await supabase.from('product_stock_recipe').select('stock_product_id, quantity').eq('product_id', DEFAULT_PIZZA_RECIPE_KEY);
    if (e2) throw new Error(e2.message);
    return fallback || [];
}

/**
 * Decrement driver_stock for order lines (driver accept → preparing).
 * @returns {{ ok: boolean, message?: string, deducted: { stockProductId: string, amount: number }[] }}
 */
async function applyStockDeductionForPreparingOrder(supabase, orderRow) {
    const driverId = orderRow.driver_id ? String(orderRow.driver_id) : null;
    if (!driverId) {
        return { ok: false, message: 'Order has no driver assigned', deducted: [] };
    }
    const items = Array.isArray(orderRow.items) ? orderRow.items : [];
    if (!items.length) {
        return { ok: true, deducted: [] };
    }

    const totals = new Map();
    for (const item of items) {
        const lineQty = Math.max(1, Math.floor(Number(item.quantity) || 1));
        const isBeverage = item.type === 'beverage';
        const menuId = item.id ?? item.productId;
        const lines = await fetchRecipeLinesForItem(supabase, menuId, isBeverage);
        for (const line of lines) {
            const pid = line.stock_product_id;
            const q = Number(line.quantity) * lineQty;
            if (!Number.isFinite(q) || q <= 0) continue;
            totals.set(pid, (totals.get(pid) || 0) + q);
        }
    }

    if (totals.size === 0) {
        return { ok: true, deducted: [] };
    }

    const now = new Date().toISOString();
    const deducted = [];

    for (const [stockProductId, needRaw] of totals.entries()) {
        const needInt = Math.max(1, Math.ceil(Number(needRaw)));
        const { data: row, error: selErr } = await supabase.from('driver_stock').select('quantity').eq('driver_id', driverId).eq('product_id', stockProductId).maybeSingle();
        if (selErr) {
            return { ok: false, message: selErr.message || 'Failed to read driver stock', deducted };
        }
        const have = Number(row?.quantity ?? 0);
        if (!row || have < needInt) {
            await rollbackStockDeduction(supabase, driverId, deducted);
            return {
                ok: false,
                message: `Insufficient stock (need ${needInt} of ingredient, have ${row ? have : 0}). Restock or check recipe.`,
                deducted: []
            };
        }
        const { error: upErr } = await supabase
            .from('driver_stock')
            .update({ quantity: have - needInt, updated_at: now })
            .eq('driver_id', driverId)
            .eq('product_id', stockProductId);
        if (upErr) {
            await rollbackStockDeduction(supabase, driverId, deducted);
            return { ok: false, message: upErr.message || 'Failed to update driver stock', deducted: [] };
        }
        deducted.push({ stockProductId, amount: needInt });
    }

    return { ok: true, deducted };
}

/**
 * When an order is cancelled after stock was deducted (preparing+), add BOM quantities back to driver_stock.
 */
async function restoreStockForCancelledOrder(supabase, orderRow) {
    const driverId = orderRow.driver_id ? String(orderRow.driver_id) : null;
    if (!driverId) return { ok: true };
    const items = Array.isArray(orderRow.items) ? orderRow.items : [];
    const totals = new Map();
    for (const item of items) {
        const lineQty = Math.max(1, Math.floor(Number(item.quantity) || 1));
        const isBeverage = item.type === 'beverage';
        const menuId = item.id ?? item.productId;
        const lines = await fetchRecipeLinesForItem(supabase, menuId, isBeverage);
        for (const line of lines) {
            const pid = line.stock_product_id;
            const q = Number(line.quantity) * lineQty;
            if (!Number.isFinite(q) || q <= 0) continue;
            totals.set(pid, (totals.get(pid) || 0) + q);
        }
    }
    if (totals.size === 0) return { ok: true };

    const now = new Date().toISOString();
    for (const [stockProductId, needRaw] of totals.entries()) {
        const needInt = Math.max(1, Math.ceil(Number(needRaw)));
        const { data: row, error: selErr } = await supabase.from('driver_stock').select('quantity').eq('driver_id', driverId).eq('product_id', stockProductId).maybeSingle();
        if (selErr) {
            return { ok: false, message: selErr.message || 'Failed to read driver stock' };
        }
        const have = Number(row?.quantity ?? 0);
        const { error: upErr } = await supabase
            .from('driver_stock')
            .update({ quantity: have + needInt, updated_at: now })
            .eq('driver_id', driverId)
            .eq('product_id', stockProductId);
        if (upErr) {
            return { ok: false, message: upErr.message || 'Failed to restore driver stock' };
        }
    }
    return { ok: true };
}

async function rollbackStockDeduction(supabase, driverId, deducted) {
    if (!driverId || !deducted?.length) return;
    const now = new Date().toISOString();
    for (const { stockProductId, amount } of deducted) {
        const { data: row } = await supabase.from('driver_stock').select('quantity').eq('driver_id', driverId).eq('product_id', stockProductId).maybeSingle();
        const have = Number(row?.quantity ?? 0);
        await supabase
            .from('driver_stock')
            .update({ quantity: have + amount, updated_at: now })
            .eq('driver_id', driverId)
            .eq('product_id', stockProductId);
    }
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
            // Only this customer's rows. Do NOT OR with guest_user — that would show every walk-in order to every logged-in user.
            const uid = String(userId ?? 'guest_user');
            let query = supabase.from('orders').select('*').eq('customer_id', uid).order('order_date', { ascending: false });
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
            let paginatedOrders = orders.slice(startIndex, startIndex + limit);
            paginatedOrders = await enrichOrdersDriverInfoFromUsers(supabase, paginatedOrders);
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

    /**
     * Admin/Mitra: fetch orders across all users.
     * Supported filters: { status, driverId, dateFrom, dateTo, limit }
     */
    async getAllOrders(filters = {}) {
        if (this.dataSource === 'supabase') {
            const supabase = getSupabaseClient();
            if (!supabase) {
                return this.createMockError('Supabase not configured', 500);
            }

            let query = supabase.from('orders').select('*').order('order_date', { ascending: false });
            if (filters.status) query = query.eq('status', filters.status);
            if (filters.driverId) query = query.eq('driver_id', String(filters.driverId));
            if (filters.dateFrom) query = query.gte('order_date', filters.dateFrom);
            if (filters.dateTo) query = query.lte('order_date', filters.dateTo);
            if (filters.limit) query = query.limit(filters.limit);

            const { data: rows, error } = await query;
            if (error) {
                return this.createMockError(error.message || 'Failed to fetch orders', error.code || 500);
            }
            let orders = (rows || []).map(rowToOrder);
            orders = await enrichOrdersDriverInfoFromUsers(supabase, orders);
            return this.createMockResponse({ orders, total: orders.length });
        }
        return await this.get(this.endpoint, filters);
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
            let order = rowToOrder(data);
            const enriched = await enrichOrdersDriverInfoFromUsers(supabase, [order]);
            order = enriched[0] || order;
            return this.createMockResponse({ order });
        }
        return await this.get(`${this.endpoint}/${orderId}`);
    }

    async updateOrderStatus(orderId, status, additionalData = {}) {
        if (this.dataSource === 'supabase') {
            const supabase = getSupabaseClient();
            if (!supabase) {
                return this.createMockError('Supabase not configured', 500);
            }

            const { data: prev, error: fetchErr } = await supabase.from('orders').select('*').eq('id', orderId).maybeSingle();
            if (fetchErr || !prev) {
                return this.createMockError('Order not found', 404);
            }

            const updates = { status, updated_at: new Date().toISOString(), ...additionalData };

            if (status === 'cancelled' && prev.stock_deducted_at && prev.driver_id) {
                const restoreRes = await restoreStockForCancelledOrder(supabase, prev);
                if (!restoreRes.ok) {
                    return this.createMockError(restoreRes.message || 'Failed to restore stock on cancel', 500);
                }
                updates.stock_deducted_at = null;
            }

            if (status === 'delivered') {
                updates.delivery_time = updates.delivery_time || new Date().toISOString();
                // Cashier walk-in + cash: payment collected on the spot; mark paid if still pending (caller may override).
                if (!Object.prototype.hasOwnProperty.call(additionalData || {}, 'payment_status')) {
                    const ps = prev.payment_status;
                    if (isWalkInCashOrder(prev) && (!ps || ps === 'pending')) {
                        updates.payment_status = 'paid';
                    }
                }
            }

            /** Driver accept / offline sold: first transition to preparing or delivered deducts stock once (MVP: __default_pizza__ BOM). */
            let rollbackDeduction = null;
            if (!prev.stock_deducted_at && (status === 'preparing' || status === 'delivered')) {
                if (!prev.driver_id) {
                    return this.createMockError('Assign a driver before consuming stock', 400);
                }

                const allowedPrior =
                    status === 'preparing' ? ['pending', 'assigned', 'preparing'] : ['pending', 'assigned', 'preparing', 'on_delivery'];
                if (!allowedPrior.includes(prev.status)) {
                    return this.createMockError(`Invalid transition to ${status}`, 400);
                }

                try {
                    const dres = await applyStockDeductionForPreparingOrder(supabase, prev);
                    if (!dres.ok) {
                        return this.createMockError(dres.message || 'Stock deduction failed', 400);
                    }
                    rollbackDeduction = { driverId: String(prev.driver_id), deducted: dres.deducted };
                    updates.stock_deducted_at = new Date().toISOString();
                } catch (e) {
                    return this.createMockError(e?.message || 'Stock deduction failed', 500);
                }
            }

            const { data, error } = await supabase.from('orders').update(updates).eq('id', orderId).select().single();
            if (error) {
                if (rollbackDeduction?.deducted?.length) {
                    await rollbackStockDeduction(supabase, rollbackDeduction.driverId, rollbackDeduction.deducted);
                }
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
            const extra = reason ? { cancellation_reason: reason } : {};
            return this.updateOrderStatus(orderId, 'cancelled', extra);
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
            let query = supabase.from('orders').select('*').eq('driver_id', String(driverId));
            if (status) query = query.eq('status', status);
            const { data: rows, error } = await query.order('order_date', { ascending: false });
            if (error) {
                return this.createMockError(error.message || 'Failed to fetch driver orders', error.code || 500);
            }
            let orders = (rows || []).map(rowToOrder);
            orders = await enrichOrdersDriverInfoFromUsers(supabase, orders);
            return this.createMockResponse({ orders, total: orders.length });
        }
        return await this.get(`${this.endpoint}/driver/${driverId}`, { status });
    }

    /**
     * Walk-in cashier orders only (`customer_id` = guest_user). Switch cash ↔ QRIS if customer changes mind after sale.
     * Persists `payment_method` as `cash` or `QRIS` (same as DriverOfflineOrder).
     */
    async updateWalkInPaymentMethod(orderId, paymentMethod) {
        const raw = String(paymentMethod || '').toLowerCase();
        const method = raw === 'qris' ? 'QRIS' : raw === 'cash' ? 'cash' : null;
        if (!method) {
            return this.createMockError('Payment method must be cash or QRIS', 400);
        }

        if (this.dataSource === 'supabase') {
            const supabase = getSupabaseClient();
            if (!supabase) {
                return this.createMockError('Supabase not configured', 500);
            }

            const { data: prev, error: fetchErr } = await supabase.from('orders').select('*').eq('id', orderId).maybeSingle();
            if (fetchErr || !prev) {
                return this.createMockError('Order not found', 404);
            }
            if (String(prev.customer_id || '') !== 'guest_user') {
                return this.createMockError('Only walk-in cashier orders can change payment method here', 400);
            }

            const { data, error } = await supabase
                .from('orders')
                .update({
                    payment_method: method,
                    updated_at: new Date().toISOString()
                })
                .eq('id', orderId)
                .select()
                .single();

            if (error) {
                return this.createMockError(error.message || 'Failed to update payment method', error.code || 500);
            }
            let order = rowToOrder(data);
            const enriched = await enrichOrdersDriverInfoFromUsers(supabase, [order]);
            order = enriched[0] || order;
            return this.createMockResponse({ order, message: 'Payment method updated' });
        }

        return await this.patch(`${this.endpoint}/${orderId}/payment-method`, { paymentMethod: method });
    }
}

export default new OrdersApiService();
