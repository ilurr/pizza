import { BaseApiService } from './ApiClient.js';

export class DriverApiService extends BaseApiService {
    constructor() {
        super();
        this.endpoint = '/drivers';
        this.initializeMockData();
    }

    initializeMockData() {
        // Mock driver profiles
        this.mockDrivers = [
            {
                id: 'driver_001',
                name: 'Pak Agus',
                email: 'agus@pizza.com',
                phone: '081234567899',
                avatar: 'https://voyee.id/assets/foto_seller/2024_06_17_18_28_06_1718623686_35496cf2d62376ca0ef0.jpg',
                rating: 4.8,
                totalDeliveries: 245,
                status: 'active',
                isOnline: false,
                isAvailable: true,
                currentLocation: { lat: -7.2575, lng: 112.7521 },
                vehicleInfo: {
                    type: 'motorcycle',
                    plate: 'B 1234 AG',
                    model: 'Honda Beat'
                },
                coverageArea: {
                    center: { lat: -7.2575, lng: 112.7521 },
                    radius: 8,
                    polygon: []
                },
                createdAt: '2024-01-15T00:00:00Z',
                updatedAt: new Date().toISOString()
            }
        ];

        // Mock stock data
        this.mockStock = [
            {
                id: 'flour',
                name: 'Pizza Flour',
                category: 'Base',
                currentStock: 15,
                maxCapacity: 25,
                unit: 'kg',
                criticalLevel: 5,
                estimatedUsage: 2.5,
                cost: 15000,
                lastRestocked: '2024-01-20T10:00:00Z'
            },
            {
                id: 'cheese',
                name: 'Mozzarella Cheese',
                category: 'Toppings',
                currentStock: 8,
                maxCapacity: 15,
                unit: 'kg',
                criticalLevel: 3,
                estimatedUsage: 0.8,
                cost: 85000,
                lastRestocked: '2024-01-19T14:30:00Z'
            },
            {
                id: 'tomato_sauce',
                name: 'Tomato Sauce',
                category: 'Base',
                currentStock: 12,
                maxCapacity: 20,
                unit: 'liters',
                criticalLevel: 4,
                estimatedUsage: 0.3,
                cost: 25000,
                lastRestocked: '2024-01-18T09:15:00Z'
            },
            {
                id: 'pepperoni',
                name: 'Pepperoni',
                category: 'Toppings',
                currentStock: 3,
                maxCapacity: 8,
                unit: 'kg',
                criticalLevel: 2,
                estimatedUsage: 0.5,
                cost: 120000,
                lastRestocked: '2024-01-17T16:45:00Z'
            },
            {
                id: 'mushrooms',
                name: 'Fresh Mushrooms',
                category: 'Toppings',
                currentStock: 2,
                maxCapacity: 6,
                unit: 'kg',
                criticalLevel: 1,
                estimatedUsage: 0.3,
                cost: 45000,
                lastRestocked: '2024-01-16T11:20:00Z'
            },
            {
                id: 'olive_oil',
                name: 'Olive Oil',
                category: 'Base',
                currentStock: 5,
                maxCapacity: 8,
                unit: 'liters',
                criticalLevel: 2,
                estimatedUsage: 0.1,
                cost: 65000,
                lastRestocked: '2024-01-15T13:00:00Z'
            },
            {
                id: 'gas',
                name: 'Cooking Gas',
                category: 'Equipment',
                currentStock: 2,
                maxCapacity: 4,
                unit: 'tanks',
                criticalLevel: 1,
                estimatedUsage: 0.1,
                cost: 35000,
                lastRestocked: '2024-01-14T08:30:00Z'
            }
        ];

        // Mock earnings data
        this.mockEarnings = {
            today: {
                deliveries: 12,
                grossEarnings: 180000,
                commission: 27000,
                expenses: 35000,
                netEarnings: 145000,
                tips: 25000,
                bonus: 15000
            },
            week: {
                deliveries: 78,
                grossEarnings: 1170000,
                commission: 175500,
                expenses: 245000,
                netEarnings: 925000,
                tips: 156000,
                bonus: 75000
            },
            month: {
                deliveries: 312,
                grossEarnings: 4680000,
                commission: 702000,
                expenses: 890000,
                netEarnings: 3790000,
                tips: 624000,
                bonus: 300000
            }
        };

        // Mock transactions
        this.mockTransactions = [
            {
                id: 'TXN001',
                driverId: 'driver_001',
                type: 'delivery',
                orderId: 'PZ-2024-156',
                amount: 15000,
                customerTip: 5000,
                date: new Date().toISOString(),
                status: 'completed',
                description: 'Order delivery commission'
            },
            {
                id: 'TXN002', 
                driverId: 'driver_001',
                type: 'delivery',
                orderId: 'PZ-2024-155',
                amount: 22500,
                customerTip: 0,
                date: new Date(Date.now() - 3600000).toISOString(),
                status: 'completed',
                description: 'Order delivery commission'
            },
            {
                id: 'TXN003',
                driverId: 'driver_001',
                type: 'bonus',
                description: 'Peak hours bonus',
                amount: 15000,
                date: new Date(Date.now() - 7200000).toISOString(),
                status: 'completed'
            },
            {
                id: 'TXN004',
                driverId: 'driver_001',
                type: 'expense',
                description: 'Gas refill',
                amount: -25000,
                date: new Date(Date.now() - 10800000).toISOString(),
                status: 'completed'
            }
        ];
    }

    // Get driver profile by ID
    async getDriverProfile(driverId) {
        if (this.useMockApi) {
            await this.mockDelay();
            
            const driver = this.mockDrivers.find(d => d.id === driverId);
            
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
            
            const driverIndex = this.mockDrivers.findIndex(d => d.id === driverId);
            
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
            
            const driverIndex = this.mockDrivers.findIndex(d => d.id === driverId);
            
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

    // Get driver stock/inventory
    async getDriverStock(driverId, filters = {}) {
        if (this.useMockApi) {
            await this.mockDelay();
            
            let filteredStock = [...this.mockStock];
            
            // Apply filters
            if (filters.category) {
                filteredStock = filteredStock.filter(item => 
                    item.category.toLowerCase() === filters.category.toLowerCase()
                );
            }
            
            if (filters.critical) {
                filteredStock = filteredStock.filter(item => 
                    item.currentStock <= item.criticalLevel
                );
            }
            
            if (filters.lowStock) {
                filteredStock = filteredStock.filter(item => 
                    item.currentStock <= item.maxCapacity * 0.3
                );
            }
            
            // Calculate stock metrics
            const totalItems = filteredStock.length;
            const criticalItems = filteredStock.filter(item => 
                item.currentStock <= item.criticalLevel
            ).length;
            const lowStockItems = filteredStock.filter(item => 
                item.currentStock <= item.maxCapacity * 0.3
            ).length;
            const totalValue = filteredStock.reduce((sum, item) => 
                sum + (item.currentStock * item.cost), 0
            );
            
            return this.createMockResponse({
                stock: filteredStock,
                metrics: {
                    totalItems,
                    criticalItems,
                    lowStockItems,
                    totalValue,
                    capacityUtilization: filteredStock.reduce((sum, item) => 
                        sum + (item.currentStock / item.maxCapacity), 0
                    ) / filteredStock.length
                }
            });
        }
        
        return await this.get(`${this.endpoint}/${driverId}/stock`, filters);
    }

    // Update stock levels (restock)
    async updateStock(driverId, stockUpdates) {
        if (this.useMockApi) {
            await this.mockDelay(1500); // Simulate processing time
            
            const updatedItems = [];
            
            for (const update of stockUpdates) {
                const itemIndex = this.mockStock.findIndex(item => item.id === update.itemId);
                
                if (itemIndex !== -1) {
                    const newStock = Math.min(
                        this.mockStock[itemIndex].currentStock + update.quantity,
                        this.mockStock[itemIndex].maxCapacity
                    );
                    
                    this.mockStock[itemIndex].currentStock = newStock;
                    this.mockStock[itemIndex].lastRestocked = new Date().toISOString();
                    
                    updatedItems.push(this.mockStock[itemIndex]);
                }
            }
            
            return this.createMockResponse({
                updatedItems,
                message: `Successfully restocked ${updatedItems.length} items`
            });
        }
        
        return await this.patch(`${this.endpoint}/${driverId}/stock`, { updates: stockUpdates });
    }

    // Get driver earnings data
    async getDriverEarnings(driverId, period = 'today', filters = {}) {
        if (this.useMockApi) {
            await this.mockDelay();
            
            const earnings = this.mockEarnings[period];
            
            if (!earnings) {
                return this.createMockError('Invalid period specified', 400);
            }
            
            // Get recent transactions for the period
            let transactions = this.mockTransactions.filter(t => t.driverId === driverId);
            
            if (period === 'today') {
                const today = new Date().toDateString();
                transactions = transactions.filter(t => 
                    new Date(t.date).toDateString() === today
                );
            } else if (period === 'week') {
                const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
                transactions = transactions.filter(t => 
                    new Date(t.date) >= weekAgo
                );
            } else if (period === 'month') {
                const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
                transactions = transactions.filter(t => 
                    new Date(t.date) >= monthAgo
                );
            }
            
            return this.createMockResponse({
                earnings: earnings,
                transactions: transactions.slice(0, 10), // Recent 10 transactions
                period: period,
                generatedAt: new Date().toISOString()
            });
        }
        
        return await this.get(`${this.endpoint}/${driverId}/earnings`, { period, ...filters });
    }

    // Add earning transaction
    async addTransaction(driverId, transactionData) {
        if (this.useMockApi) {
            await this.mockDelay();
            
            const newTransaction = {
                id: `TXN${Date.now()}`,
                driverId: driverId,
                date: new Date().toISOString(),
                status: 'completed',
                ...transactionData
            };
            
            this.mockTransactions.unshift(newTransaction);
            
            return this.createMockResponse({
                transaction: newTransaction,
                message: 'Transaction recorded successfully'
            });
        }
        
        return await this.post(`${this.endpoint}/${driverId}/transactions`, transactionData);
    }

    // Get available drivers in area
    async getAvailableDrivers(location, radius = 10) {
        if (this.useMockApi) {
            await this.mockDelay();
            
            const availableDrivers = this.mockDrivers.filter(driver => {
                if (!driver.isOnline || !driver.isAvailable) return false;
                
                // Calculate distance from location
                const distance = this.calculateDistance(
                    location.lat, location.lng,
                    driver.currentLocation.lat, driver.currentLocation.lng
                );
                
                return distance <= radius;
            });
            
            // Sort by distance and rating
            availableDrivers.sort((a, b) => {
                const distanceA = this.calculateDistance(
                    location.lat, location.lng,
                    a.currentLocation.lat, a.currentLocation.lng
                );
                const distanceB = this.calculateDistance(
                    location.lat, location.lng,
                    b.currentLocation.lat, b.currentLocation.lng
                );
                
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
            
            const driver = this.mockDrivers.find(d => d.id === driverId);
            if (!driver) {
                return this.createMockError('Driver not found', 404);
            }
            
            const earnings = this.mockEarnings[period];
            const transactions = this.mockTransactions.filter(t => t.driverId === driverId);
            
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
                    averageEarningsPerDelivery: earnings.deliveries > 0 ? 
                        earnings.netEarnings / earnings.deliveries : 0,
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
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    // Get nearby drivers for stock exchange
    async getNearbyDrivers(driverId, radius = 15) {
        if (this.useMockApi) {
            await this.mockDelay();
            
            const currentDriver = this.mockDrivers.find(d => d.id === driverId);
            if (!currentDriver) {
                return this.createMockError('Driver not found', 404);
            }
            
            // Mock additional drivers for exchange
            const mockNearbyDrivers = [
                {
                    id: 'driver_002',
                    name: 'Bu Sari',
                    rating: 4.6,
                    distance: 2.3,
                    avatar: 'https://example.com/avatar2.jpg',
                    currentLocation: { lat: -7.2605, lng: 112.7551 },
                    availableStock: [
                        { id: 'cheese', quantity: 5, unit: 'kg' },
                        { id: 'tomato_sauce', quantity: 8, unit: 'liters' }
                    ],
                    neededStock: [
                        { id: 'pepperoni', quantity: 2, unit: 'kg' }
                    ]
                },
                {
                    id: 'driver_003',
                    name: 'Pak Budi',
                    rating: 4.9,
                    distance: 4.7,
                    avatar: 'https://example.com/avatar3.jpg',
                    currentLocation: { lat: -7.2425, lng: 112.7621 },
                    availableStock: [
                        { id: 'flour', quantity: 10, unit: 'kg' },
                        { id: 'olive_oil', quantity: 3, unit: 'liters' }
                    ],
                    neededStock: [
                        { id: 'mushrooms', quantity: 1, unit: 'kg' }
                    ]
                }
            ];
            
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