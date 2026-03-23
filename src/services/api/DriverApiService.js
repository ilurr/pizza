import { BaseApiService } from './ApiClient.js';
import { ROLES } from '@/constants/roles.js';
import { getSupabaseClient } from '@/services/supabase/client.js';

const GUEST_WALKIN_CUSTOMER_ID = 'guest_user';

/** Instant that defines which *local* calendar day a delivered order counts toward (matches morning stock / stock_date). */
function earningsAttributionInstant(row) {
    return row.delivery_time || row.order_date;
}

/**
 * Real sales live in `orders`. `driver_daily_deposits` is an optional manual ledger and is often empty.
 * Aggregate delivered orders for this driver in [rangeStart, rangeEnd] into report + per-product/day rows.
 *
 * Bounds are local-day instants (from the client). Rows are included when **delivery_time** falls in range;
 * legacy rows without **delivery_time** fall back to **order_date** in range (same instants).
 */
async function aggregateDriverEarningsFromOrders(supabase, tableDriverId, rangeStart, rangeEnd) {
    const rangeStartIso = rangeStart.toISOString();
    const rangeEndIso = rangeEnd.toISOString();
    const selectCols = 'id, order_date, delivery_time, customer_id, payment_method, total, items, status';

    const { data: byDeliveryTime, error: errDelivered } = await supabase
        .from('orders')
        .select(selectCols)
        .eq('driver_id', String(tableDriverId))
        .eq('status', 'delivered')
        .gte('delivery_time', rangeStartIso)
        .lte('delivery_time', rangeEndIso);

    if (errDelivered) {
        return { error: errDelivered, report: { totalSoldItems: 0, totalEarnings: 0 }, dailyDeposits: [] };
    }

    const { data: legacyNoDeliveryTs, error: errLegacy } = await supabase
        .from('orders')
        .select(selectCols)
        .eq('driver_id', String(tableDriverId))
        .eq('status', 'delivered')
        .is('delivery_time', null)
        .gte('order_date', rangeStartIso)
        .lte('order_date', rangeEndIso);

    if (errLegacy) {
        return { error: errLegacy, report: { totalSoldItems: 0, totalEarnings: 0 }, dailyDeposits: [] };
    }

    const seen = new Set();
    const orderRows = [];
    for (const row of byDeliveryTime || []) {
        if (seen.has(row.id)) continue;
        seen.add(row.id);
        orderRows.push(row);
    }
    for (const row of legacyNoDeliveryTs || []) {
        if (seen.has(row.id)) continue;
        seen.add(row.id);
        orderRows.push(row);
    }

    const map = new Map();
    let totalEarnings = 0;
    let totalSoldItems = 0;

    for (const row of orderRows) {
        totalEarnings += Number(row.total || 0);
        const items = Array.isArray(row.items) ? row.items : [];
        const isWalkIn = String(row.customer_id || '') === GUEST_WALKIN_CUSTOMER_ID;
        const pm = String(row.payment_method || '').toLowerCase();
        const att = earningsAttributionInstant(row);
        const orderDay = att ? new Date(att).toLocaleDateString('en-CA') : '';

        for (const it of items) {
            const qty = Math.max(0, Math.floor(Number(it.quantity) || 0));
            if (qty <= 0) continue;
            totalSoldItems += qty;
            const name = (String(it.name || 'Item').trim() || 'Item');
            const lineTotal = Number(it.price || 0) * qty;
            const key = `${orderDay}\t${name}`;
            if (!map.has(key)) {
                map.set(key, {
                    id: `order-agg-${key.replace(/\s/g, '_')}`,
                    driverId: String(tableDriverId),
                    depositDate: orderDay,
                    productName: name,
                    earlyStock: 0,
                    soldItems: 0,
                    onlineAmount: 0,
                    offlineCashAmount: 0,
                    offlineQrisAmount: 0,
                    totalEarning: 0
                });
            }
            const a = map.get(key);
            a.soldItems += qty;
            if (isWalkIn) {
                if (pm.includes('qris')) {
                    a.offlineQrisAmount += lineTotal;
                } else {
                    a.offlineCashAmount += lineTotal;
                }
            } else {
                a.onlineAmount += lineTotal;
            }
            a.totalEarning += lineTotal;
        }
    }

    const dailyDeposits = [...map.values()].sort((a, b) => {
        const c = String(b.depositDate).localeCompare(String(a.depositDate));
        if (c !== 0) return c;
        return String(a.productName).localeCompare(String(b.productName));
    });

    return {
        error: null,
        report: { totalSoldItems, totalEarnings },
        dailyDeposits
    };
}

/** Local calendar bounds for YYYY-MM-DD (same convention as driver daily stock_date). */
function dayBoundsFromDateKey(dateKey) {
    const parts = String(dateKey || '').split('-').map((n) => parseInt(n, 10));
    if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return null;
    const [y, m, d] = parts;
    const rangeStart = new Date(y, m - 1, d, 0, 0, 0, 0);
    const rangeEnd = new Date(y, m - 1, d, 23, 59, 59, 999);
    return { rangeStart, rangeEnd };
}

/**
 * Replace `driver_daily_deposits` for one driver + date with a snapshot from delivered orders (close-day ledger).
 */
async function syncDriverDailyDepositsForDate(supabase, tableDriverId, dateKey) {
    const bounds = dayBoundsFromDateKey(dateKey);
    if (!bounds) return { ok: false, message: 'Invalid stock date' };

    const agg = await aggregateDriverEarningsFromOrders(supabase, tableDriverId, bounds.rangeStart, bounds.rangeEnd);
    if (agg.error) return { ok: false, message: agg.error.message || 'Failed to aggregate orders' };

    const rowsForDay = (agg.dailyDeposits || []).filter((r) => String(r.depositDate) === String(dateKey));

    const { error: delErr } = await supabase.from('driver_daily_deposits').delete().eq('driver_id', tableDriverId).eq('deposit_date', dateKey);
    if (delErr) return { ok: false, message: delErr.message || 'Failed to clear old deposit rows' };

    if (!rowsForDay.length) {
        return { ok: true, inserted: 0 };
    }

    const insertPayload = rowsForDay.map((r) => ({
        driver_id: tableDriverId,
        deposit_date: dateKey,
        product_name: r.productName,
        early_stock: 0,
        sold_items: r.soldItems,
        online_amount: r.onlineAmount,
        offline_cash_amount: r.offlineCashAmount,
        offline_qris_amount: r.offlineQrisAmount,
        total_earning: r.totalEarning
    }));

    const { error: insErr } = await supabase.from('driver_daily_deposits').insert(insertPayload);
    if (insErr) return { ok: false, message: insErr.message || 'Failed to save daily deposits' };
    return { ok: true, inserted: insertPayload.length };
}

export class DriverApiService extends BaseApiService {
    constructor() {
        super();
        this.endpoint = '/drivers';
        this.dataSource = import.meta.env?.VITE_DATA_SOURCE || 'supabase';
        this.initializeMockData();
    }

    initializeMockData() {
        this.mockDrivers = [];
        this._mockTransactions = [];
    }

    // Resolve driverId (integer or numeric string = app_users.id) to app_users row from Supabase
    async _resolveDriverRow(supabase, driverId) {
        const isNumeric = typeof driverId === 'number' || (typeof driverId === 'string' && /^\d+$/.test(driverId));
        if (!isNumeric) return null;
        const { data: row, error } = await supabase.from('app_users').select('*').eq('id', Number(driverId)).eq('role_type', ROLES.DRIVER).maybeSingle();
        if (error || !row) return null;
        return row;
    }

    // For driver_stock, driver_daily_confirmations, etc.: use app_users.id as text (e.g. "5")
    async _driverIdForTables(supabase, driverId) {
        const row = await this._resolveDriverRow(supabase, driverId);
        return row ? String(row.id) : typeof driverId === 'string' ? driverId : String(driverId);
    }

    // Map app_users + optional profile + kelurahanIds to driver shape expected by app
    _rowToDriver(userRow, profileRow, kelurahanIds = []) {
        const id = String(userRow.id);
        return {
            id,
            username: userRow.username || '',
            name: userRow.fullname || userRow.username,
            email: userRow.email,
            phone: userRow.phone || '',
            avatar: userRow.avatar || '',
            rating: profileRow ? Number(profileRow.rating) || 4.5 : 4.5,
            totalDeliveries: profileRow?.total_deliveries ?? 0,
            status: profileRow?.status || 'active',
            // Online flag synced from app_users.is_online (default false in DB)
            isOnline: userRow.is_online === true,
            isAvailable: profileRow ? profileRow.is_available !== false : true,
            currentLocation: profileRow?.current_lat != null ? { lat: profileRow.current_lat, lng: profileRow.current_lng } : null,
            vehicleInfo: profileRow ? { type: profileRow.vehicle_type || 'motorcycle', plate: profileRow.vehicle_plate || '', model: profileRow.vehicle_model || '' } : null,
            kelurahanIds: kelurahanIds.length ? kelurahanIds : undefined,
            createdAt: userRow.created_at,
            updatedAt: userRow.updated_at
        };
    }

    // Get driver profile by ID (app_users.id when using Supabase)
    async getDriverProfile(driverId) {
        if (this.dataSource === 'supabase') {
            const supabase = getSupabaseClient();
            if (!supabase) return this.createMockError('Supabase not configured', 500);
            const userRow = await this._resolveDriverRow(supabase, driverId);
            if (!userRow) return this.createMockError('Driver not found', 404);
            const { data: kRows } = await supabase.from('driver_kelurahan').select('kelurahan_id').eq('driver_id', userRow.id);
            const kelurahanIds = (kRows || []).map((r) => r.kelurahan_id);
            const driver = this._rowToDriver(userRow, null, kelurahanIds);
            return this.createMockResponse({ driver });
        }
        if (this.useMockApi) {
            await this.mockDelay();
            const driver = this.mockDrivers.find((d) => d.id === driverId);
            if (!driver) return this.createMockError('Driver not found', 404);
            return this.createMockResponse({ driver });
        }
        return await this.get(`${this.endpoint}/${driverId}`);
    }

    // Update driver status (online/offline/available)
    async updateDriverStatus(driverId, statusData) {
        if (this.dataSource === 'supabase') {
            const supabase = getSupabaseClient();
            if (!supabase) return this.createMockError('Supabase not configured', 500);
            const userRow = await this._resolveDriverRow(supabase, driverId);
            if (!userRow) return this.createMockError('Driver not found', 404);
            const updates = { updated_at: new Date().toISOString() };
            if (statusData.isOnline !== undefined) updates.is_online = !!statusData.isOnline;
            if (Object.keys(updates).length <= 1) {
                return this.createMockError('No status fields to update', 400);
            }
            const { data, error } = await supabase.from('app_users').update(updates).eq('id', userRow.id).select().single();
            if (error) return this.createMockError(error.message, 400);
            const { data: kRows } = await supabase.from('driver_kelurahan').select('kelurahan_id').eq('driver_id', data.id);
            const kelurahanIds = (kRows || []).map((r) => r.kelurahan_id);
            const driver = this._rowToDriver(data, null, kelurahanIds);
            return this.createMockResponse({
                driver,
                message: 'Driver status updated successfully'
            });
        }
        if (this.useMockApi) {
            await this.mockDelay();

            const driverIndex = this.mockDrivers.findIndex((d) => d.id === driverId);

            if (driverIndex === -1) {
                return this.createMockError('Driver not found', 404);
            }

            this.mockDrivers[driverIndex] = {
                ...this.mockDrivers[driverIndex],
                ...statusData,
                updatedAt: new Date().toISOString()
            };

            return this.createMockResponse({
                driver: this.mockDrivers[driverIndex],
                message: 'Driver status updated successfully'
            });
        }

        return await this.patch(`${this.endpoint}/${driverId}/status`, statusData);
    }

    // Update driver location
    async updateDriverLocation(driverId, location) {
        if (this.useMockApi) {
            await this.mockDelay();

            const driverIndex = this.mockDrivers.findIndex((d) => d.id === driverId);

            if (driverIndex === -1) {
                return this.createMockError('Driver not found', 404);
            }

            this.mockDrivers[driverIndex].currentLocation = {
                ...location,
                timestamp: new Date().toISOString()
            };
            this.mockDrivers[driverIndex].updatedAt = new Date().toISOString();

            return this.createMockResponse({
                location: this.mockDrivers[driverIndex].currentLocation,
                message: 'Location updated successfully'
            });
        }

        return await this.patch(`${this.endpoint}/${driverId}/location`, { location });
    }

    // Get driver stock (base + topping only, quantity only, no Rp)
    async getDriverStock(driverId, filters = {}) {
        if (this.dataSource === 'supabase') {
            const supabase = getSupabaseClient();
            if (!supabase) return this.createMockError('Supabase not configured', 500);
            const tableDriverId = await this._driverIdForTables(supabase, driverId);
            const { data: stockRows, error: e1 } = await supabase.from('driver_stock').select('*').eq('driver_id', tableDriverId);
            if (e1) return this.createMockError(e1.message || 'Failed to fetch stock', e1.code || 500);
            const productIds = [...new Set((stockRows || []).map((r) => r.product_id))];
            if (productIds.length === 0) return this.createMockResponse({ stock: [], metrics: { totalItems: 0, criticalItems: 0 } });
            const { data: products, error: e2 } = await supabase.from('stock_products').select('id, name, type, unit').in('id', productIds);
            if (e2) return this.createMockError(e2.message || 'Failed to fetch products', e2.code || 500);
            const productMap = (products || []).reduce((acc, p) => {
                acc[p.id] = p;
                return acc;
            }, {});
            let stock = (stockRows || []).map((r) => {
                const p = productMap[r.product_id] || {};
                return {
                    id: r.product_id,
                    productId: r.product_id,
                    name: p.name,
                    type: p.type || 'base',
                    category: (p.type || 'base').charAt(0).toUpperCase() + (p.type || 'base').slice(1),
                    unit: p.unit || 'pcs',
                    currentStock: r.quantity ?? 0,
                    maxCapacity: r.max_capacity ?? 100,
                    criticalLevel: r.critical_level ?? 5
                };
            });
            if (filters.type) stock = stock.filter((i) => i.type === filters.type);
            if (filters.critical) stock = stock.filter((i) => i.currentStock <= i.criticalLevel);
            return this.createMockResponse({
                stock,
                metrics: { totalItems: stock.length, criticalItems: stock.filter((i) => i.currentStock <= i.criticalLevel).length }
            });
        }
        if (this.useMockApi) {
            await this.mockDelay();
            return this.createMockResponse({ stock: [], metrics: { totalItems: 0, criticalItems: 0 } });
        }
        return await this.get(`${this.endpoint}/${driverId}/stock`, filters);
    }

    // Update one stock item quantity (Supabase or API)
    async updateStockQuantity(driverId, productId, quantity) {
        if (this.dataSource === 'supabase') {
            const supabase = getSupabaseClient();
            if (!supabase) return this.createMockError('Supabase not configured', 500);
            const tableDriverId = await this._driverIdForTables(supabase, driverId);
            const { data, error } = await supabase
                .from('driver_stock')
                .update({ quantity: Math.max(0, quantity), updated_at: new Date().toISOString() })
                .eq('driver_id', tableDriverId)
                .eq('product_id', productId)
                .select()
                .single();
            if (error) return this.createMockError(error.message || 'Failed to update stock', error.code || 500);
            return this.createMockResponse({ stock: data, message: 'Stock updated' });
        }
        return await this.patch(`${this.endpoint}/${driverId}/stock`, { productId, quantity });
    }

    /**
     * Admin: create missing `driver_stock` rows for a driver so the admin table can be populated.
     * This does NOT overwrite existing quantities.
     *
     * @param {string|number} driverId
     * @param {{ type?: 'base'|'topping', initialQuantity?: number }} options
     */
    async initializeDriverStock(driverId, options = {}) {
        if (this.dataSource === 'supabase') {
            const supabase = getSupabaseClient();
            if (!supabase) return this.createMockError('Supabase not configured', 500);

            const tableDriverId = await this._driverIdForTables(supabase, driverId);
            const initialQuantity = Math.max(0, Number(options.initialQuantity ?? 0));
            const type = options.type || null;

            // Only consider stock products of given type (or all types when not specified)
            let q = supabase.from('stock_products').select('id');
            if (type) q = q.eq('type', type);
            const { data: allProducts, error: pErr } = await q;
            if (pErr) return this.createMockError(pErr.message || 'Failed to fetch stock products', pErr.code || 500);

            const productIds = (allProducts || []).map((p) => p.id).filter(Boolean);
            if (!productIds.length) return this.createMockResponse({ message: 'No stock products found' });

            const { data: existing, error: eErr } = await supabase.from('driver_stock').select('product_id').eq('driver_id', tableDriverId).in('product_id', productIds);

            if (eErr) return this.createMockError(eErr.message || 'Failed to read existing driver stock', eErr.code || 500);

            const existingSet = new Set((existing || []).map((r) => r.product_id).filter(Boolean));
            const missing = (allProducts || []).filter((p) => !existingSet.has(p.id));

            if (!missing.length) return this.createMockResponse({ message: 'Nothing to initialize', created: 0 });

            const insertRows = missing.map((p) => ({
                driver_id: tableDriverId,
                product_id: p.id,
                quantity: initialQuantity
            }));

            const { error: insErr } = await supabase.from('driver_stock').insert(insertRows);
            if (insErr) return this.createMockError(insErr.message || 'Failed to initialize driver stock', insErr.code || 500);

            return this.createMockResponse({ message: 'Driver stock initialized', created: insertRows.length });
        }

        return this.createMockResponse({ message: 'Driver stock initialized', created: 0 });
    }

    /**
     * Admin: all driver_stock rows with product + driver display name (app_users when driver_id is numeric).
     * @param {{ driverId?: string, type?: 'base'|'topping', critical?: boolean }} filters
     */
    async getAllDriversStock(filters = {}) {
        if (this.dataSource === 'supabase') {
            const supabase = getSupabaseClient();
            if (!supabase) return this.createMockError('Supabase not configured', 500);

            let q = supabase.from('driver_stock').select('*');
            if (filters.driverId) q = q.eq('driver_id', String(filters.driverId));

            const { data: stockRows, error: e1 } = await q;
            if (e1) return this.createMockError(e1.message || 'Failed to fetch stock', e1.code || 500);

            const rows = stockRows || [];
            const productIds = [...new Set(rows.map((r) => r.product_id).filter(Boolean))];
            if (productIds.length === 0) {
                return this.createMockResponse({
                    rows: [],
                    metrics: { totalRows: 0, criticalRows: 0, driverCount: 0 }
                });
            }

            const { data: products, error: e2 } = await supabase.from('stock_products').select('id, name, type, unit').in('id', productIds);
            if (e2) return this.createMockError(e2.message || 'Failed to fetch products', e2.code || 500);
            const productMap = (products || []).reduce((acc, p) => {
                acc[p.id] = p;
                return acc;
            }, {});

            const driverIds = [...new Set(rows.map((r) => String(r.driver_id)))];
            const numericDriverIds = driverIds.filter((id) => /^\d+$/.test(id)).map((id) => Number(id));
            const userMap = {};
            if (numericDriverIds.length) {
                const { data: userRows } = await supabase.from('app_users').select('id, fullname, username, email').in('id', numericDriverIds);
                (userRows || []).forEach((u) => {
                    userMap[String(u.id)] = u.fullname || u.username || String(u.id);
                });
            }

            let list = rows.map((r) => {
                const p = productMap[r.product_id] || {};
                const did = String(r.driver_id);
                const currentStock = r.quantity ?? 0;
                const criticalLevel = r.critical_level ?? 5;
                return {
                    driverId: did,
                    driverName: userMap[did] || did,
                    productId: r.product_id,
                    name: p.name || '—',
                    type: p.type || 'base',
                    unit: p.unit || 'pcs',
                    currentStock,
                    maxCapacity: r.max_capacity ?? 100,
                    criticalLevel,
                    isLow: currentStock <= criticalLevel
                };
            });

            if (filters.type) list = list.filter((i) => i.type === filters.type);
            if (filters.critical) list = list.filter((i) => i.isLow);

            const driverCount = new Set(list.map((r) => r.driverId)).size;
            const criticalRows = list.filter((i) => i.isLow).length;

            return this.createMockResponse({
                rows: list,
                metrics: {
                    totalRows: list.length,
                    criticalRows,
                    driverCount
                }
            });
        }
        if (this.useMockApi) {
            await this.mockDelay();
            return this.createMockResponse({
                rows: [],
                metrics: { totalRows: 0, criticalRows: 0, driverCount: 0 }
            });
        }
        return await this.get(`${this.endpoint}/admin/stock`, filters);
    }

    /** Admin: all stock exchanges (newest first). */
    async getAllStockExchanges(limit = 200) {
        if (this.dataSource === 'supabase') {
            const supabase = getSupabaseClient();
            if (!supabase) return this.createMockError('Supabase not configured', 500);
            const { data: rows, error } = await supabase.from('driver_stock_exchanges').select('*').order('created_at', { ascending: false }).limit(limit);
            if (error) return this.createMockError(error.message || 'Failed to fetch exchanges', error.code || 500);
            const list = (rows || []).map((r) => ({
                id: r.id,
                fromDriverId: r.from_driver_id,
                toDriverId: r.to_driver_id,
                productName: r.product_name,
                productType: r.product_type,
                quantity: r.quantity,
                unit: r.unit,
                message: r.message,
                createdAt: r.created_at
            }));
            return this.createMockResponse({ exchanges: list });
        }
        return this.createMockResponse({ exchanges: [] });
    }

    /**
     * Driver morning check-in: is there already a confirmation for this driver in [startISO, endISO] (local day bounds)?
     * @param {string} driverId
     * @param {{ startISO?: string, endISO?: string, stockDate?: string }} window
     */
    async getDriverDailyConfirmationStatus(driverId, window) {
        if (this.dataSource === 'supabase') {
            const supabase = getSupabaseClient();
            if (!supabase) return this.createMockError('Supabase not configured', 500);
            if (!window?.startISO || !window?.endISO) {
                // allow caller to omit time bounds and just provide stockDate
                if (!window?.stockDate) {
                    return this.createMockError('startISO/endISO or stockDate is required', 400);
                }
            }
            const tableDriverId = await this._driverIdForTables(supabase, driverId);
            const q = supabase.from('driver_daily_confirmations').select('id, confirmed_at, items, stock_date, closing_confirmed_at, closing_items').eq('driver_id', tableDriverId);

            if (window?.stockDate) {
                q.eq('stock_date', window.stockDate);
            } else {
                q.gte('confirmed_at', window.startISO).lte('confirmed_at', window.endISO);
            }

            const { data, error } = await q.order('confirmed_at', { ascending: false }).limit(1).maybeSingle();
            if (error) return this.createMockError(error.message || 'Failed to check confirmation', error.code || 500);
            return this.createMockResponse({
                confirmed: !!data, // opening confirmed
                confirmation: data || null,
                closingConfirmed: !!data?.closing_confirmed_at,
                closingConfirmation: data?.closing_confirmed_at ? data : null
            });
        }
        return this.createMockResponse({ confirmed: false, confirmation: null });
    }

    // Submit morning confirmation (items driver confirms they have)
    async submitDriverDailyConfirmation(driverId, items, stockDate) {
        if (this.dataSource === 'supabase') {
            const supabase = getSupabaseClient();
            if (!supabase) return this.createMockError('Supabase not configured', 500);
            const tableDriverId = await this._driverIdForTables(supabase, driverId);
            const nowIso = new Date().toISOString();
            const sd = stockDate ? String(stockDate) : null;
            if (!sd) {
                return this.createMockError('stockDate is required for idempotent confirmations', 400);
            }

            // Sync physical recount → driver_stock before saving the confirmation row
            if (Array.isArray(items) && items.length > 0) {
                for (const item of items) {
                    const pid = item.productId || item.id;
                    if (!pid) continue;
                    const qty = Math.max(0, Number(item.quantity ?? 0));
                    const { error: upErr } = await supabase.from('driver_stock').update({ quantity: qty, updated_at: nowIso }).eq('driver_id', tableDriverId).eq('product_id', pid);
                    if (upErr) return this.createMockError(upErr.message || 'Failed to sync stock', upErr.code || 500);
                }
            }

            // Idempotent upsert per driver + stock_date
            const { data, error } = await supabase
                .from('driver_daily_confirmations')
                .upsert(
                    {
                        driver_id: tableDriverId,
                        stock_date: sd,
                        items: items || []
                    },
                    { onConflict: 'driver_id,stock_date' }
                )
                .select()
                .single();

            if (error) return this.createMockError(error.message || 'Failed to save confirmation', error.code || 500);
            return this.createMockResponse({ confirmation: data, message: 'Confirmation saved' });
        }
        return this.createMockResponse({ message: 'Confirmation saved' });
    }

    // Submit end-of-day confirmation (computed closing stock + driver confirm)
    async submitDriverDailyClosingConfirmation(driverId, items, stockDate) {
        if (this.dataSource === 'supabase') {
            const supabase = getSupabaseClient();
            if (!supabase) return this.createMockError('Supabase not configured', 500);

            const tableDriverId = await this._driverIdForTables(supabase, driverId);
            const nowIso = new Date().toISOString();
            const sd = stockDate ? String(stockDate) : null;
            if (!sd) {
                return this.createMockError('stockDate is required', 400);
            }

            // Sync physical recount → driver_stock before saving closing snapshot
            if (Array.isArray(items) && items.length > 0) {
                for (const item of items) {
                    const pid = item.productId || item.id;
                    if (!pid) continue;
                    const qty = Math.max(0, Number(item.quantity ?? 0));
                    const { error: upErr } = await supabase.from('driver_stock').update({ quantity: qty, updated_at: nowIso }).eq('driver_id', tableDriverId).eq('product_id', pid);
                    if (upErr) return this.createMockError(upErr.message || 'Failed to sync stock', upErr.code || 500);
                }
            }

            const { data, error } = await supabase
                .from('driver_daily_confirmations')
                .upsert(
                    {
                        driver_id: tableDriverId,
                        stock_date: sd,
                        closing_confirmed_at: nowIso,
                        closing_items: items || []
                    },
                    { onConflict: 'driver_id,stock_date' }
                )
                .select()
                .single();

            if (error) return this.createMockError(error.message || 'Failed to save closing confirmation', error.code || 500);

            // Lock in sales ledger for this calendar day (balances vs stock / cash / online in reports)
            const depositSync = await syncDriverDailyDepositsForDate(supabase, tableDriverId, sd);

            return this.createMockResponse({
                confirmation: data,
                message: 'Closing stock saved',
                depositSync
            });
        }
        return this.createMockResponse({ message: 'Closing stock saved', depositSync: { ok: true, inserted: 0 } });
    }

    /**
     * Read-only sales summary for one calendar day (delivered orders), for close-day reconciliation UI.
     * @param {string|number} driverId
     * @param {string} dateKey YYYY-MM-DD (en-CA)
     */
    async getDriverDaySalesSummary(driverId, dateKey) {
        if (this.dataSource === 'supabase') {
            const supabase = getSupabaseClient();
            if (!supabase) return this.createMockError('Supabase not configured', 500);
            const tableDriverId = await this._driverIdForTables(supabase, driverId);
            const bounds = dayBoundsFromDateKey(dateKey);
            if (!bounds) return this.createMockError('Invalid date', 400);

            const agg = await aggregateDriverEarningsFromOrders(supabase, tableDriverId, bounds.rangeStart, bounds.rangeEnd);
            if (agg.error) {
                return this.createMockError(agg.error.message || 'Failed to load sales', agg.error.code || 500);
            }
            const lines = (agg.dailyDeposits || []).filter((r) => String(r.depositDate) === String(dateKey));

            let onlineTotal = 0;
            let offlineCashTotal = 0;
            let offlineQrisTotal = 0;
            for (const line of lines) {
                onlineTotal += Number(line.onlineAmount || 0);
                offlineCashTotal += Number(line.offlineCashAmount || 0);
                offlineQrisTotal += Number(line.offlineQrisAmount || 0);
            }

            return this.createMockResponse({
                dateKey,
                report: agg.report,
                lines,
                channels: {
                    online: onlineTotal,
                    offlineCash: offlineCashTotal,
                    offlineQris: offlineQrisTotal
                }
            });
        }
        return this.createMockResponse({
            dateKey,
            report: { totalSoldItems: 0, totalEarnings: 0 },
            lines: [],
            channels: { online: 0, offlineCash: 0, offlineQris: 0 }
        });
    }

    // Get exchange history for driver
    async getDriverStockExchanges(driverId, limit = 50) {
        if (this.dataSource === 'supabase') {
            const supabase = getSupabaseClient();
            if (!supabase) return this.createMockError('Supabase not configured', 500);
            const { data: rows, error } = await supabase.from('driver_stock_exchanges').select('*').or(`from_driver_id.eq.${driverId},to_driver_id.eq.${driverId}`).order('created_at', { ascending: false }).limit(limit);
            if (error) return this.createMockError(error.message || 'Failed to fetch exchanges', error.code || 500);
            const list = (rows || []).map((r) => ({
                id: r.id,
                fromDriverId: r.from_driver_id,
                toDriverId: r.to_driver_id,
                productName: r.product_name,
                productType: r.product_type,
                quantity: r.quantity,
                unit: r.unit,
                message: r.message,
                createdAt: r.created_at
            }));
            return this.createMockResponse({ exchanges: list });
        }
        return this.createMockResponse({ exchanges: [] });
    }

    // Create exchange (driver sends product to another driver) — updates driver_stock for both parties
    async createDriverStockExchange(fromDriverId, toDriverId, productName, productType, quantity, unit = 'pcs', message = null) {
        if (this.dataSource === 'supabase') {
            const supabase = getSupabaseClient();
            if (!supabase) return this.createMockError('Supabase not configured', 500);
            const q = Math.floor(Number(quantity));
            if (!Number.isFinite(q) || q <= 0) return this.createMockError('Invalid quantity', 400);

            const fromId = await this._driverIdForTables(supabase, fromDriverId);
            const toIdRaw = typeof toDriverId === 'object' && toDriverId?.id != null ? toDriverId.id : toDriverId;
            const toId = await this._driverIdForTables(supabase, toIdRaw);
            if (fromId === toId) return this.createMockError('Cannot exchange with yourself', 400);

            const nameTrim = (productName || '').trim();
            const { data: product, error: pErr } = await supabase.from('stock_products').select('id').eq('name', nameTrim).eq('type', productType).maybeSingle();
            if (pErr) return this.createMockError(pErr.message || 'Product lookup failed', pErr.code || 500);
            if (!product) return this.createMockError('Product not found', 404);

            const productId = product.id;

            const { data: fromRow, error: fErr } = await supabase.from('driver_stock').select('*').eq('driver_id', fromId).eq('product_id', productId).maybeSingle();
            if (fErr) return this.createMockError(fErr.message, fErr.code || 500);
            if (!fromRow) return this.createMockError('No stock line for this product', 400);
            const fromQty = Number(fromRow.quantity ?? 0);
            if (fromQty < q) return this.createMockError('Insufficient stock', 400);

            const { data: toRow, error: tErr } = await supabase.from('driver_stock').select('*').eq('driver_id', toId).eq('product_id', productId).maybeSingle();
            if (tErr) return this.createMockError(tErr.message, tErr.code || 500);

            const nowIso = new Date().toISOString();
            const toQtyBefore = toRow ? Number(toRow.quantity ?? 0) : 0;
            let insertedToStockId = null;

            const { error: uFromErr } = await supabase
                .from('driver_stock')
                .update({ quantity: fromQty - q, updated_at: nowIso })
                .eq('driver_id', fromId)
                .eq('product_id', productId);
            if (uFromErr) return this.createMockError(uFromErr.message || 'Failed to update sender stock', uFromErr.code || 500);

            const rollbackStock = async () => {
                await supabase.from('driver_stock').update({ quantity: fromQty, updated_at: new Date().toISOString() }).eq('driver_id', fromId).eq('product_id', productId);
                if (toRow) {
                    await supabase.from('driver_stock').update({ quantity: toQtyBefore, updated_at: new Date().toISOString() }).eq('driver_id', toId).eq('product_id', productId);
                } else if (insertedToStockId) {
                    await supabase.from('driver_stock').delete().eq('id', insertedToStockId);
                }
            };

            try {
                if (toRow) {
                    const { error: uToErr } = await supabase
                        .from('driver_stock')
                        .update({ quantity: toQtyBefore + q, updated_at: nowIso })
                        .eq('driver_id', toId)
                        .eq('product_id', productId);
                    if (uToErr) throw new Error(uToErr.message || 'Failed to update recipient stock');
                } else {
                    const { data: inserted, error: insErr } = await supabase
                        .from('driver_stock')
                        .insert({
                            driver_id: toId,
                            product_id: productId,
                            quantity: q,
                            max_capacity: fromRow.max_capacity ?? 100,
                            critical_level: fromRow.critical_level ?? 5,
                            updated_at: nowIso
                        })
                        .select('id')
                        .single();
                    if (insErr || !inserted?.id) throw new Error(insErr?.message || 'Failed to create recipient stock');
                    insertedToStockId = inserted.id;
                }

                const { data, error: exErr } = await supabase
                    .from('driver_stock_exchanges')
                    .insert({
                        from_driver_id: fromId,
                        to_driver_id: toId,
                        product_name: nameTrim,
                        product_type: productType,
                        quantity: q,
                        unit,
                        message
                    })
                    .select()
                    .single();
                if (exErr) throw new Error(exErr.message || 'Failed to create exchange');

                return this.createMockResponse({ exchange: data, message: 'Exchange recorded' });
            } catch (e) {
                await rollbackStock();
                return this.createMockError(e?.message || 'Exchange failed', 500);
            }
        }
        return this.createMockResponse({ message: 'Exchange recorded' });
    }

    // Get driver earnings: report + daily rows from delivered orders; merge optional driver_daily_deposits (manual ledger)
    async getDriverEarnings(driverId, period = 'today') {
        if (this.dataSource === 'supabase') {
            const supabase = getSupabaseClient();
            if (!supabase) {
                return this.createMockError('Supabase not configured', 500);
            }
            const now = new Date();
            let startDate;
            if (period === 'today') {
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            } else if (period === 'week') {
                startDate = new Date(now);
                startDate.setDate(startDate.getDate() - 7);
            } else if (period === 'month') {
                startDate = new Date(now);
                startDate.setDate(startDate.getDate() - 30);
            } else {
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            }
            const rangeStart = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), 0, 0, 0, 0);
            const rangeEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
            // Calendar dates in the user's locale (same as morning stock stock_date), not UTC from toISOString().slice(0,10)
            const startStr = rangeStart.toLocaleDateString('en-CA');
            const endStr = rangeEnd.toLocaleDateString('en-CA');

            const tableDriverId = await this._driverIdForTables(supabase, driverId);

            const fromOrders = await aggregateDriverEarningsFromOrders(supabase, tableDriverId, rangeStart, rangeEnd);
            if (fromOrders.error) {
                return this.createMockError(fromOrders.error.message || 'Failed to fetch earnings from orders', fromOrders.error.code || 500);
            }

            const byKey = new Map();
            for (const r of fromOrders.dailyDeposits) {
                const key = `${r.depositDate}\t${r.productName}`;
                byKey.set(key, { ...r });
            }

            let { totalSoldItems, totalEarnings } = fromOrders.report;

            const { data: depositRows, error: depErr } = await supabase
                .from('driver_daily_deposits')
                .select('*')
                .eq('driver_id', tableDriverId)
                .gte('deposit_date', startStr)
                .lte('deposit_date', endStr);

            // Manual / extra ledger rows only: close-day sync copies orders into deposits, so merging the same keys
            // would double-count. Only attach deposit rows for keys not already produced from orders.
            if (!depErr && depositRows?.length) {
                for (const r of depositRows) {
                    const key = `${r.deposit_date}\t${r.product_name}`;
                    if (byKey.has(key)) continue;
                    const extra = {
                        earlyStock: Number(r.early_stock ?? 0),
                        soldItems: Number(r.sold_items ?? 0),
                        onlineAmount: Number(r.online_amount ?? 0),
                        offlineCashAmount: Number(r.offline_cash_amount ?? 0),
                        offlineQrisAmount: Number(r.offline_qris_amount ?? 0),
                        totalEarning: Number(r.total_earning ?? 0)
                    };
                    byKey.set(key, {
                        id: r.id,
                        driverId: r.driver_id,
                        depositDate: r.deposit_date,
                        productName: r.product_name,
                        earlyStock: extra.earlyStock,
                        soldItems: extra.soldItems,
                        onlineAmount: extra.onlineAmount,
                        offlineCashAmount: extra.offlineCashAmount,
                        offlineQrisAmount: extra.offlineQrisAmount,
                        totalEarning: extra.totalEarning
                    });
                    totalSoldItems += extra.soldItems;
                    totalEarnings += extra.totalEarning;
                }
            }

            const dailyDeposits = [...byKey.values()].sort((a, b) => {
                const c = String(b.depositDate).localeCompare(String(a.depositDate));
                if (c !== 0) return c;
                return String(a.productName).localeCompare(String(b.productName));
            });

            return this.createMockResponse({
                report: { totalSoldItems, totalEarnings },
                dailyDeposits,
                period,
                generatedAt: new Date().toISOString()
            });
        }
        return await this.get(`${this.endpoint}/${driverId}/earnings`, { period });
    }

    // Add earning transaction (mock only; Supabase uses driver_daily_deposits)
    async addTransaction(driverId, transactionData) {
        if (this.useMockApi) {
            await this.mockDelay();
            const newTransaction = {
                id: `TXN${Date.now()}`,
                driverId,
                date: new Date().toISOString(),
                status: 'completed',
                ...transactionData
            };
            this._mockTransactions.unshift(newTransaction);
            return this.createMockResponse({ transaction: newTransaction, message: 'Transaction recorded' });
        }
        return await this.post(`${this.endpoint}/${driverId}/transactions`, transactionData);
    }

    // Get drivers who cover this kelurahan (each driver handles up to 4 kelurahan; user chooses one)
    async getAvailableDriversByKelurahan(kelurahanId) {
        if (this.dataSource === 'supabase') {
            const supabase = getSupabaseClient();
            if (!supabase) return this.createMockError('Supabase not configured', 500);
            const kid = Array.isArray(kelurahanId) ? kelurahanId[0] : kelurahanId;
            const { data: dkRows, error: e1 } = await supabase.from('driver_kelurahan').select('driver_id').eq('kelurahan_id', kid);
            if (e1) return this.createMockError(e1.message || 'Failed to fetch drivers', e1.code || 500);
            const driverIds = [...new Set((dkRows || []).map((r) => r.driver_id))];
            if (driverIds.length === 0) return this.createMockResponse({ drivers: [], kelurahanId: kid, total: 0 });
            const { data: userRows, error: e2 } = await supabase.from('app_users').select('*').in('id', driverIds).eq('role_type', ROLES.DRIVER);
            if (e2) return this.createMockError(e2.message || 'Failed to fetch users', e2.code || 500);
            const { data: kRows } = await supabase.from('driver_kelurahan').select('driver_id, kelurahan_id').in('driver_id', driverIds);
            const kelurahanByDriver = (kRows || []).reduce((acc, r) => {
                if (!acc[r.driver_id]) acc[r.driver_id] = [];
                acc[r.driver_id].push(r.kelurahan_id);
                return acc;
            }, {});
            const drivers = (userRows || []).map((u) => this._rowToDriver(u, null, kelurahanByDriver[u.id] || [])).filter((d) => d.isOnline && d.isAvailable);
            return this.createMockResponse({ drivers, kelurahanId: kid, total: drivers.length });
        }
        if (this.useMockApi) {
            await this.mockDelay();
            const ids = Array.isArray(kelurahanId) ? kelurahanId : [kelurahanId];
            const drivers = this.mockDrivers.filter((d) => {
                if (!d.isOnline || !d.isAvailable) return false;
                const kIds = d.kelurahanIds || [];
                return ids.some((id) => kIds.includes(id));
            });
            return this.createMockResponse({
                drivers,
                kelurahanId: ids[0],
                total: drivers.length
            });
        }
        return await this.get(`${this.endpoint}/available-by-kelurahan`, { kelurahanId });
    }

    // Get kelurahan list for a driver (id = app_users.id)
    async getDriverKelurahan(driverId) {
        if (this.dataSource === 'supabase') {
            const supabase = getSupabaseClient();
            if (!supabase) return this.createMockError('Supabase not configured', 500);
            const userRow = await this._resolveDriverRow(supabase, driverId);
            if (!userRow) return this.createMockError('Driver not found', 404);
            const { data: relRows, error: e1 } = await supabase.from('driver_kelurahan').select('kelurahan_id').eq('driver_id', userRow.id);
            if (e1) return this.createMockError(e1.message || 'Failed to fetch driver kelurahan', e1.code || 500);
            const kelIds = [...new Set((relRows || []).map((r) => r.kelurahan_id))];
            if (kelIds.length === 0) return this.createMockResponse({ kelurahan: [] });
            const { data: rows, error: e2 } = await supabase.from('kelurahan').select('id, name, city, province').in('id', kelIds);
            if (e2) return this.createMockError(e2.message || 'Failed to fetch kelurahan', e2.code || 500);
            const list = (rows || []).map((k) => ({
                id: k.id,
                name: k.name,
                city: k.city,
                province: k.province
            }));
            return this.createMockResponse({ kelurahan: list });
        }
        if (this.useMockApi) {
            await this.mockDelay();
            return this.createMockResponse({ kelurahan: [] });
        }
        return await this.get(`${this.endpoint}/${driverId}/kelurahan`);
    }

    // Get available drivers in area (legacy GPS-based; prefer getAvailableDriversByKelurahan for user pickup)
    async getAvailableDrivers(location, radius = 10) {
        if (this.useMockApi) {
            await this.mockDelay();

            const availableDrivers = this.mockDrivers.filter((driver) => {
                if (!driver.isOnline || !driver.isAvailable) return false;

                // Calculate distance from location
                const distance = this.calculateDistance(location.lat, location.lng, driver.currentLocation.lat, driver.currentLocation.lng);

                return distance <= radius;
            });

            // Sort by distance and rating
            availableDrivers.sort((a, b) => {
                const distanceA = this.calculateDistance(location.lat, location.lng, a.currentLocation.lat, a.currentLocation.lng);
                const distanceB = this.calculateDistance(location.lat, location.lng, b.currentLocation.lat, b.currentLocation.lng);

                // Primary sort: distance, secondary sort: rating
                if (distanceA !== distanceB) {
                    return distanceA - distanceB;
                }
                return b.rating - a.rating;
            });

            return this.createMockResponse({
                drivers: availableDrivers,
                searchLocation: location,
                searchRadius: radius,
                total: availableDrivers.length
            });
        }

        return await this.get(`${this.endpoint}/available`, {
            lat: location.lat,
            lng: location.lng,
            radius
        });
    }

    // Get driver statistics
    async getDriverStats(driverId, period = 'month') {
        if (this.useMockApi) {
            await this.mockDelay();

            const driver = this.mockDrivers.find((d) => d.id === driverId);
            if (!driver) {
                return this.createMockError('Driver not found', 404);
            }

            const earnings = this.mockEarnings[period];
            const transactions = this.mockTransactions.filter((t) => t.driverId === driverId);

            const stats = {
                profile: {
                    name: driver.name,
                    rating: driver.rating,
                    totalDeliveries: driver.totalDeliveries,
                    joinDate: driver.createdAt
                },
                performance: {
                    deliveries: earnings.deliveries,
                    earnings: earnings.netEarnings,
                    averageEarningsPerDelivery: earnings.deliveries > 0 ? earnings.netEarnings / earnings.deliveries : 0,
                    completionRate: 98.5, // Mock data
                    averageDeliveryTime: 25 // minutes
                },
                period: period,
                lastUpdated: new Date().toISOString()
            };

            return this.createMockResponse({ stats });
        }

        return await this.get(`${this.endpoint}/${driverId}/stats`, { period });
    }

    // Helper method to calculate distance between two points
    calculateDistance(lat1, lng1, lat2, lng2) {
        const R = 6371; // Earth's radius in km
        const dLat = ((lat2 - lat1) * Math.PI) / 180;
        const dLng = ((lng2 - lng1) * Math.PI) / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    // Get nearby drivers for stock exchange (other drivers; filter by role_type = drivers)
    async getNearbyDrivers(driverId, radius = 15) {
        if (this.dataSource === 'supabase') {
            const supabase = getSupabaseClient();
            if (!supabase) return this.createMockError('Supabase not configured', 500);
            const userRow = await this._resolveDriverRow(supabase, driverId);
            if (!userRow) return this.createMockError('Driver not found', 404);
            const excludeId = userRow.id;
            const { data: userRows, error } = await supabase.from('app_users').select('*').eq('role_type', ROLES.DRIVER).neq('id', excludeId);
            if (error) return this.createMockError(error.message || 'Failed to fetch drivers', error.code || 500);
            const nearbyDrivers = (userRows || []).map((u) => {
                const d = this._rowToDriver(u, null, []);
                return { id: d.id, name: d.name, avatar: d.avatar, rating: d.rating, phone: d.phone };
            });
            return this.createMockResponse({ nearbyDrivers, searchRadius: radius, total: nearbyDrivers.length });
        }
        if (this.useMockApi) {
            await this.mockDelay();
            return this.createMockResponse({
                nearbyDrivers: [],
                searchRadius: radius,
                total: 0
            });
        }
        return await this.get(`${this.endpoint}/${driverId}/nearby`, { radius });
    }

    /**
     * Admin/Mitra: list all drivers (from app_users.role_type='drivers').
     */
    async listDrivers() {
        if (this.dataSource === 'supabase') {
            const supabase = getSupabaseClient();
            if (!supabase) return this.createMockError('Supabase not configured', 500);
            const { data: userRows, error } = await supabase.from('app_users').select('*').eq('role_type', ROLES.DRIVER);
            if (error) return this.createMockError(error.message || 'Failed to fetch drivers', error.code || 500);
            const userIds = (userRows || []).map((u) => u.id);
            let kelurahanByDriver = {};
            if (userIds.length) {
                const { data: relRows } = await supabase.from('driver_kelurahan').select('driver_id, kelurahan_id').in('driver_id', userIds);
                kelurahanByDriver = (relRows || []).reduce((acc, r) => {
                    const key = String(r.driver_id);
                    if (!acc[key]) acc[key] = [];
                    if (!acc[key].includes(r.kelurahan_id)) acc[key].push(r.kelurahan_id);
                    return acc;
                }, {});
            }

            const drivers = (userRows || []).map((u) => this._rowToDriver(u, null, kelurahanByDriver[String(u.id)] || []));
            return this.createMockResponse({ drivers, total: drivers.length });
        }
        if (this.useMockApi) {
            await this.mockDelay();
            return this.createMockResponse({ drivers: [], total: 0 });
        }
        return await this.get(`${this.endpoint}`, { role: ROLES.DRIVER });
    }

    // Create stock exchange request
    async createStockExchange(driverId, exchangeData) {
        if (this.useMockApi) {
            await this.mockDelay(1000);

            const exchangeRequest = {
                id: `EXC${Date.now()}`,
                requesterId: driverId,
                targetDriverId: exchangeData.targetDriverId,
                offerItems: exchangeData.offerItems,
                requestItems: exchangeData.requestItems,
                message: exchangeData.message || '',
                status: 'pending',
                createdAt: new Date().toISOString(),
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
            };

            return this.createMockResponse({
                exchange: exchangeRequest,
                message: 'Exchange request sent successfully'
            });
        }

        return await this.post(`${this.endpoint}/${driverId}/exchanges`, exchangeData);
    }
}

// Export singleton instance
export default new DriverApiService();
