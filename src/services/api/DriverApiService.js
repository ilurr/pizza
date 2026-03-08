import { BaseApiService } from './ApiClient.js';
import { getSupabaseClient } from '@/services/supabase/client.js';
import driversData from '@/data/drivers.json';
import driverNearbyDriversData from '@/data/driverNearbyDrivers.json';

export class DriverApiService extends BaseApiService {
    constructor() {
        super();
        this.endpoint = '/drivers';
        this.dataSource = import.meta.env?.VITE_DATA_SOURCE || 'supabase';
        this.initializeMockData();
    }

    initializeMockData() {
        this.mockDrivers = JSON.parse(JSON.stringify(driversData)).map((d) => ({
            ...d,
            updatedAt: new Date().toISOString()
        }));
        this._mockTransactions = [];
    }

    // Get driver profile by ID
    async getDriverProfile(driverId) {
        if (this.useMockApi) {
            await this.mockDelay();

            const driver = this.mockDrivers.find((d) => d.id === driverId);

            if (!driver) {
                return this.createMockError('Driver not found', 404);
            }

            return this.createMockResponse({ driver });
        }

        return await this.get(`${this.endpoint}/${driverId}`);
    }

    // Update driver status (online/offline/available)
    async updateDriverStatus(driverId, statusData) {
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
            const { data: stockRows, error: e1 } = await supabase.from('driver_stock').select('*').eq('driver_id', driverId);
            if (e1) return this.createMockError(e1.message || 'Failed to fetch stock', e1.code || 500);
            const productIds = [...new Set((stockRows || []).map((r) => r.product_id))];
            if (productIds.length === 0) return this.createMockResponse({ stock: [], metrics: { totalItems: 0, criticalItems: 0 } });
            const { data: products, error: e2 } = await supabase.from('stock_products').select('id, name, type, unit').in('id', productIds);
            if (e2) return this.createMockError(e2.message || 'Failed to fetch products', e2.code || 500);
            const productMap = (products || []).reduce((acc, p) => { acc[p.id] = p; return acc; }, {});
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
            const { data, error } = await supabase
                .from('driver_stock')
                .update({ quantity: Math.max(0, quantity), updated_at: new Date().toISOString() })
                .eq('driver_id', driverId)
                .eq('product_id', productId)
                .select()
                .single();
            if (error) return this.createMockError(error.message || 'Failed to update stock', error.code || 500);
            return this.createMockResponse({ stock: data, message: 'Stock updated' });
        }
        return await this.patch(`${this.endpoint}/${driverId}/stock`, { productId, quantity });
    }

    // Submit morning confirmation (items driver confirms they have)
    async submitDriverDailyConfirmation(driverId, items) {
        if (this.dataSource === 'supabase') {
            const supabase = getSupabaseClient();
            if (!supabase) return this.createMockError('Supabase not configured', 500);
            const { data, error } = await supabase
                .from('driver_daily_confirmations')
                .insert({ driver_id: driverId, items: items || [] })
                .select()
                .single();
            if (error) return this.createMockError(error.message || 'Failed to save confirmation', error.code || 500);
            return this.createMockResponse({ confirmation: data, message: 'Confirmation saved' });
        }
        return this.createMockResponse({ message: 'Confirmation saved' });
    }

    // Get exchange history for driver
    async getDriverStockExchanges(driverId, limit = 50) {
        if (this.dataSource === 'supabase') {
            const supabase = getSupabaseClient();
            if (!supabase) return this.createMockError('Supabase not configured', 500);
            const { data: rows, error } = await supabase
                .from('driver_stock_exchanges')
                .select('*')
                .or(`from_driver_id.eq.${driverId},to_driver_id.eq.${driverId}`)
                .order('created_at', { ascending: false })
                .limit(limit);
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

    // Create exchange (driver sends product to another driver)
    async createDriverStockExchange(fromDriverId, toDriverId, productName, productType, quantity, unit = 'pcs', message = null) {
        if (this.dataSource === 'supabase') {
            const supabase = getSupabaseClient();
            if (!supabase) return this.createMockError('Supabase not configured', 500);
            const { data, error } = await supabase
                .from('driver_stock_exchanges')
                .insert({
                    from_driver_id: fromDriverId,
                    to_driver_id: toDriverId,
                    product_name: productName,
                    product_type: productType,
                    quantity,
                    unit,
                    message
                })
                .select()
                .single();
            if (error) return this.createMockError(error.message || 'Failed to create exchange', error.code || 500);
            return this.createMockResponse({ exchange: data, message: 'Exchange recorded' });
        }
        return this.createMockResponse({ message: 'Exchange recorded' });
    }

    // Get driver earnings: report (total sold items, total earnings) + daily deposit rows from Supabase
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
            const startStr = startDate.toISOString().slice(0, 10);
            const endStr = now.toISOString().slice(0, 10);

            const { data: rows, error } = await supabase
                .from('driver_daily_deposits')
                .select('*')
                .eq('driver_id', driverId)
                .gte('deposit_date', startStr)
                .lte('deposit_date', endStr)
                .order('deposit_date', { ascending: false })
                .order('product_name', { ascending: true });

            if (error) {
                return this.createMockError(error.message || 'Failed to fetch earnings', error.code || 500);
            }

            const dailyDeposits = (rows || []).map((r) => ({
                id: r.id,
                driverId: r.driver_id,
                depositDate: r.deposit_date,
                productName: r.product_name,
                earlyStock: r.early_stock ?? 0,
                soldItems: r.sold_items ?? 0,
                onlineAmount: Number(r.online_amount ?? 0),
                offlineCashAmount: Number(r.offline_cash_amount ?? 0),
                offlineQrisAmount: Number(r.offline_qris_amount ?? 0),
                totalEarning: Number(r.total_earning ?? 0)
            }));

            const totalSoldItems = dailyDeposits.reduce((sum, r) => sum + r.soldItems, 0);
            const totalEarnings = dailyDeposits.reduce((sum, r) => sum + r.totalEarning, 0);

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

    // Get available drivers in area
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

    // Get nearby drivers for stock exchange
    async getNearbyDrivers(driverId, radius = 15) {
        if (this.useMockApi) {
            await this.mockDelay();

            const currentDriver = this.mockDrivers.find((d) => d.id === driverId);
            if (!currentDriver) {
                return this.createMockError('Driver not found', 404);
            }

            // Mock additional drivers for exchange from central data
            const mockNearbyDrivers = JSON.parse(JSON.stringify(driverNearbyDriversData));

            return this.createMockResponse({
                nearbyDrivers: mockNearbyDrivers,
                searchRadius: radius,
                total: mockNearbyDrivers.length
            });
        }

        return await this.get(`${this.endpoint}/${driverId}/nearby`, { radius });
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
