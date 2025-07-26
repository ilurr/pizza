import { defineStore } from 'pinia';

export const useDriverStore = defineStore('driver', {
    state: () => ({
        // Driver profile
        driverProfile: null,
        isInitialized: false,
        
        // Driver status
        isOnline: false,
        isAvailable: true,
        currentLocation: null,
        
        // Orders
        pendingOrders: [],
        activeOrders: [],
        completedOrders: [],
        
        // Coverage area
        coverageArea: {
            center: { lat: -7.2575, lng: 112.7521 }, // Default Surabaya
            radius: 5, // km
            polygon: []
        },
        
        // Statistics
        stats: {
            totalDeliveries: 0,
            todayDeliveries: 0,
            todayEarnings: 0,
            rating: 0,
            acceptanceRate: 0
        },
        
        // Loading states
        isLoadingOrders: false,
        isUpdatingLocation: false,
        isProcessingOrder: false
    }),

    getters: {
        // Get orders that need driver attention
        ordersRequiringAction: (state) => {
            return state.pendingOrders.filter(order => 
                order.status === 'pending' && 
                state.isOrderInCoverage(order.deliveryLocation)
            );
        },

        // Check if driver is currently working
        isWorking: (state) => {
            return state.isOnline && state.activeOrders.length > 0;
        },

        // Get current order capacity
        canAcceptNewOrder: (state) => {
            const maxOrders = 3; // Maximum concurrent orders
            return state.isOnline && state.isAvailable && state.activeOrders.length < maxOrders;
        },

        // Get today's statistics
        todayStats: (state) => {
            const today = new Date().toDateString();
            const todayOrders = state.completedOrders.filter(order => 
                new Date(order.completedAt).toDateString() === today
            );
            
            return {
                deliveries: todayOrders.length,
                earnings: todayOrders.reduce((sum, order) => sum + (order.driverEarnings || 0), 0),
                averageTime: todayOrders.length > 0 ? 
                    todayOrders.reduce((sum, order) => sum + order.deliveryTime, 0) / todayOrders.length : 0
            };
        }
    },

    actions: {
        // Initialize driver data
        async initializeDriver(driverId) {
            // Prevent multiple initializations
            if (this.isInitialized) {
                console.log('Driver already initialized, skipping...');
                return;
            }
            
            try {
                console.log('Initializing driver:', driverId);
                // In production, this would fetch from API
                this.driverProfile = await this.fetchDriverProfile(driverId);
                this.coverageArea = this.driverProfile.coverageArea || this.coverageArea;
                await this.loadOrders();
                await this.updateLocation();
                this.isInitialized = true;
                console.log('Driver initialization completed');
            } catch (error) {
                console.error('Failed to initialize driver:', error);
            }
        },

        // Mock driver profile fetch
        async fetchDriverProfile(driverId) {
            // Mock data - replace with actual API call
            const mockProfiles = {
                'driver_001': {
                    id: 'driver_001',
                    name: 'Pak Agus',
                    email: 'agus@pizza.com',
                    phone: '081234567899',
                    avatar: 'https://voyee.id/assets/foto_seller/2024_06_17_18_28_06_1718623686_35496cf2d62376ca0ef0.jpg',
                    rating: 4.8,
                    totalDeliveries: 245,
                    vehicleInfo: {
                        type: 'motorcycle',
                        plate: 'B 1234 AG',
                        model: 'Honda Beat'
                    },
                    coverageArea: {
                        center: { lat: -7.2575, lng: 112.7521 },
                        radius: 8,
                        polygon: []
                    }
                }
            };

            return mockProfiles[driverId] || mockProfiles['driver_001'];
        },

        // Load orders for driver
        async loadOrders() {
            this.isLoadingOrders = true;
            try {
                // Mock order data - replace with actual API calls
                this.pendingOrders = await this.fetchPendingOrders();
                this.activeOrders = await this.fetchActiveOrders();
                this.completedOrders = await this.fetchCompletedOrders();
                
                this.updateStats();
            } catch (error) {
                console.error('Failed to load orders:', error);
            } finally {
                this.isLoadingOrders = false;
            }
        },

        // Mock fetch functions - replace with actual API calls
        async fetchPendingOrders() {
            return [
                {
                    id: 'order_001',
                    orderNumber: 'PZ-2024-001',
                    customerName: 'John Doe',
                    customerPhone: '081234567890',
                    items: [
                        { name: 'Margherita Classic', quantity: 2, price: 45000 },
                        { name: 'Pepperoni Supreme', quantity: 1, price: 75000 }
                    ],
                    total: 165000,
                    deliveryLocation: {
                        address: 'Jl. Diponegoro No. 123, Surabaya',
                        coordinates: { lat: -7.2575, lng: 112.7521 }
                    },
                    distance: 2.5,
                    estimatedCookingTime: 15, // minutes
                    requestedAt: new Date().toISOString(),
                    status: 'pending',
                    paymentMethod: 'QRIS',
                    notes: 'Extra spicy sauce'
                },
                {
                    id: 'order_002',
                    orderNumber: 'PZ-2024-002',
                    customerName: 'Jane Smith',
                    customerPhone: '081234567891',
                    items: [
                        { name: 'Pepperoni Supreme', quantity: 1, price: 75000 },
                        { name: 'Coca Cola', quantity: 2, price: 12000 }
                    ],
                    total: 99000,
                    deliveryLocation: {
                        address: 'Jl. Basuki Rahmat No. 456, Surabaya',
                        coordinates: { lat: -7.2504, lng: 112.7688 }
                    },
                    distance: 3.2,
                    estimatedCookingTime: 12,
                    requestedAt: new Date(Date.now() - 5 * 60000).toISOString(), // 5 minutes ago
                    status: 'pending',
                    paymentMethod: 'Credit Card',
                    notes: null
                }
            ];
        },

        async fetchActiveOrders() {
            return [];
        },

        async fetchCompletedOrders() {
            return [
                {
                    id: 'order_099',
                    orderNumber: 'PZ-2024-099',
                    customerName: 'Previous Customer',
                    total: 125000,
                    completedAt: new Date().toISOString(),
                    deliveryTime: 25, // minutes
                    driverEarnings: 25000
                }
            ];
        },

        // Driver status management
        toggleOnlineStatus() {
            this.isOnline = !this.isOnline;
            if (!this.isOnline) {
                this.isAvailable = false;
            }
        },

        toggleAvailability() {
            if (this.isOnline) {
                this.isAvailable = !this.isAvailable;
            }
        },

        // Location management
        async updateLocation() {
            this.isUpdatingLocation = true;
            try {
                if (navigator.geolocation) {
                    const position = await new Promise((resolve, reject) => {
                        navigator.geolocation.getCurrentPosition(resolve, reject);
                    });
                    
                    this.currentLocation = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                        timestamp: new Date().toISOString()
                    };
                } else {
                    // Fallback to coverage area center
                    this.currentLocation = {
                        ...this.coverageArea.center,
                        timestamp: new Date().toISOString()
                    };
                }
            } catch (error) {
                console.error('Failed to update location:', error);
                // Use coverage area center as fallback
                this.currentLocation = {
                    ...this.coverageArea.center,
                    timestamp: new Date().toISOString()
                };
            } finally {
                this.isUpdatingLocation = false;
            }
        },

        // Order management
        async acceptOrder(orderId) {
            this.isProcessingOrder = true;
            try {
                const order = this.pendingOrders.find(o => o.id === orderId);
                if (order && this.canAcceptNewOrder) {
                    // Move order from pending to active
                    this.pendingOrders = this.pendingOrders.filter(o => o.id !== orderId);
                    order.status = 'accepted';
                    order.acceptedAt = new Date().toISOString();
                    order.driverId = this.driverProfile.id;
                    this.activeOrders.push(order);
                    
                    // In production, make API call to update order status
                    // await api.post(`/orders/${orderId}/accept`);
                    
                    return { success: true };
                }
                return { success: false, error: 'Cannot accept order' };
            } catch (error) {
                console.error('Failed to accept order:', error);
                return { success: false, error: error.message };
            } finally {
                this.isProcessingOrder = false;
            }
        },

        async rejectOrder(orderId, reason = '') {
            this.isProcessingOrder = true;
            try {
                const order = this.pendingOrders.find(o => o.id === orderId);
                if (order) {
                    // Remove from pending orders
                    this.pendingOrders = this.pendingOrders.filter(o => o.id !== orderId);
                    
                    // In production, make API call to reject order
                    // await api.post(`/orders/${orderId}/reject`, { reason });
                    
                    return { success: true };
                }
                return { success: false, error: 'Order not found' };
            } catch (error) {
                console.error('Failed to reject order:', error);
                return { success: false, error: error.message };
            } finally {
                this.isProcessingOrder = false;
            }
        },

        async updateOrderStatus(orderId, status, location = null) {
            try {
                const order = this.activeOrders.find(o => o.id === orderId);
                if (order) {
                    order.status = status;
                    order.lastUpdate = new Date().toISOString();
                    
                    if (location) {
                        order.driverLocation = location;
                    }

                    // Handle order completion
                    if (status === 'delivered') {
                        order.completedAt = new Date().toISOString();
                        order.deliveryTime = Math.floor((new Date() - new Date(order.acceptedAt)) / 60000); // minutes
                        order.driverEarnings = Math.floor(order.total * 0.15); // 15% commission
                        
                        // Move to completed orders
                        this.activeOrders = this.activeOrders.filter(o => o.id !== orderId);
                        this.completedOrders.unshift(order);
                        
                        this.updateStats();
                    }
                    
                    // In production, make API call
                    // await api.patch(`/orders/${orderId}/status`, { status, location });
                    
                    return { success: true };
                }
                return { success: false, error: 'Order not found' };
            } catch (error) {
                console.error('Failed to update order status:', error);
                return { success: false, error: error.message };
            }
        },

        // Coverage area management
        isOrderInCoverage(location) {
            if (!location || !location.coordinates) return false;
            
            const distance = this.calculateDistance(
                this.coverageArea.center.lat,
                this.coverageArea.center.lng,
                location.coordinates.lat,
                location.coordinates.lng
            );
            
            return distance <= this.coverageArea.radius;
        },

        calculateDistance(lat1, lng1, lat2, lng2) {
            const R = 6371; // Earth's radius in km
            const dLat = (lat2 - lat1) * Math.PI / 180;
            const dLng = (lng2 - lng1) * Math.PI / 180;
            const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLng / 2) * Math.sin(dLng / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            return R * c;
        },

        // Update statistics
        updateStats() {
            this.stats.totalDeliveries = this.completedOrders.length;
            
            const today = new Date().toDateString();
            const todayOrders = this.completedOrders.filter(order => 
                new Date(order.completedAt).toDateString() === today
            );
            
            this.stats.todayDeliveries = todayOrders.length;
            this.stats.todayEarnings = todayOrders.reduce((sum, order) => 
                sum + (order.driverEarnings || 0), 0
            );
            
            if (this.completedOrders.length > 0) {
                this.stats.rating = this.driverProfile?.rating || 4.8;
            }
        },

        // Reset driver state
        resetDriver() {
            this.driverProfile = null;
            this.isInitialized = false;
            this.isOnline = false;
            this.isAvailable = true;
            this.currentLocation = null;
            this.pendingOrders = [];
            this.activeOrders = [];
            this.completedOrders = [];
            this.stats = {
                totalDeliveries: 0,
                todayDeliveries: 0,
                todayEarnings: 0,
                rating: 0,
                acceptanceRate: 0
            };
        }
    }
});