import api from '@/services/api/index.js';
import { defineStore } from 'pinia';

/** Map API order → shape used by driver UI */
function normalizeDriverOrder(o) {
    if (!o) return null;
    const addr = o.deliveryAddress || {};
    const lat = addr.lat ?? addr.latitude ?? addr.coordinates?.lat;
    const lng = addr.lng ?? addr.longitude ?? addr.coordinates?.lng;
    const address = addr.address || addr.formatted || addr.fullAddress || (typeof addr === 'string' ? addr : '') || '—';
    return {
        ...o,
        deliveryLocation: {
            address,
            coordinates: lat != null && lng != null && !Number.isNaN(Number(lat)) && !Number.isNaN(Number(lng)) ? { lat: Number(lat), lng: Number(lng) } : null
        },
        requestedAt: o.orderDate || o.createdAt,
        distance: typeof o.distance === 'number' ? o.distance : 0,
        estimatedCookingTime: typeof o.estimatedCookingTime === 'number' ? o.estimatedCookingTime : 15,
        completedAt: o.deliveryTime || o.updatedAt || o.orderDate,
        driverEarnings: o.driverEarnings ?? 0
    };
}

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
            return state.pendingOrders.filter((order) => ['pending', 'assigned'].includes(order.status) && state.isOrderInCoverage(order.deliveryLocation));
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
            const todayOrders = state.completedOrders.filter((order) => {
                const d = order.completedAt || order.deliveryTime || order.updatedAt;
                return d && new Date(d).toDateString() === today;
            });
            const minutes = todayOrders.map((order) => (typeof order.deliveryTimeMinutes === 'number' ? order.deliveryTimeMinutes : null)).filter((n) => n != null);
            return {
                deliveries: todayOrders.length,
                earnings: todayOrders.reduce((sum, order) => sum + (order.driverEarnings || 0), 0),
                averageTime: minutes.length ? minutes.reduce((a, b) => a + b, 0) / minutes.length : 0
            };
        }
    },

    actions: {
        // Initialize driver data
        async initializeDriver(driverId) {
            const sid = String(driverId ?? '');
            // Same session, same user: skip redundant work
            if (this.isInitialized && this.driverProfile?.id === sid) {
                return;
            }

            try {
                this.driverProfile = await this.fetchDriverProfile(sid);
                this.isOnline = this.driverProfile.isOnline === true;
                this.isAvailable = this.driverProfile.isAvailable !== false;
                this.coverageArea = this.driverProfile.coverageArea || this.coverageArea;
                await this.loadOrders();
                await this.updateLocation();
                this.isInitialized = true;
            } catch (error) {
                console.error('Failed to initialize driver:', error);
                this.driverProfile = null;
                this.isInitialized = false;
                this.pendingOrders = [];
                this.activeOrders = [];
                this.completedOrders = [];
            }
        },

        async fetchDriverProfile(driverId) {
            if (!driverId) {
                throw new Error('Driver id is required');
            }
            const res = await api.drivers.getDriverProfile(driverId);
            if (!res?.success || !res.data?.driver) {
                const msg = res?.message || (typeof res?.error === 'string' ? res.error : null) || 'Driver profile not found';
                throw new Error(msg);
            }
            const d = res.data.driver;
            return {
                id: String(d.id),
                name: d.name || d.username || 'Driver',
                email: d.email || '',
                phone: d.phone || '',
                avatar: d.avatar || '',
                rating: Number(d.rating) || 0,
                totalDeliveries: d.totalDeliveries ?? 0,
                vehicleInfo: d.vehicleInfo || { type: 'motorcycle', plate: '', model: '' },
                isOnline: d.isOnline === true,
                isAvailable: d.isAvailable !== false,
                coverageArea: this.coverageArea
            };
        },

        async loadOrders() {
            this.isLoadingOrders = true;
            try {
                const did = this.driverProfile?.id;
                if (!did) {
                    this.pendingOrders = [];
                    this.activeOrders = [];
                    this.completedOrders = [];
                    this.updateStats();
                    return;
                }
                const res = await api.orders.getDriverOrders(String(did));
                if (!res?.success) {
                    this.pendingOrders = [];
                    this.activeOrders = [];
                    this.completedOrders = [];
                    this.updateStats();
                    return;
                }
                const raw = res.data.orders || [];
                const orders = raw.map(normalizeDriverOrder).filter(Boolean);
                this.pendingOrders = orders.filter((o) => ['pending', 'assigned'].includes(o.status));
                this.activeOrders = orders.filter((o) => ['preparing', 'on_delivery'].includes(o.status));
                this.completedOrders = orders.filter((o) => o.status === 'delivered');
                this.updateStats();
            } catch (error) {
                console.error('Failed to load orders:', error);
                this.pendingOrders = [];
                this.activeOrders = [];
                this.completedOrders = [];
            } finally {
                this.isLoadingOrders = false;
            }
        },

        // Driver status management
        /**
         * Set online/offline and persist to API (app_users.is_online).
         * @param {boolean} isOnline
         * @param {string|number|null} [explicitDriverId] - Use when store has no profile yet (e.g. modals from layout)
         */
        async setOnlineStatusPersistent(isOnline, explicitDriverId = null) {
            const next = !!isOnline;
            const did = explicitDriverId != null ? String(explicitDriverId) : this.driverProfile?.id;
            const sameUser = !this.driverProfile?.id || String(this.driverProfile.id) === String(did);

            if (!did) {
                if (sameUser) {
                    this.isOnline = next;
                    if (!next) this.isAvailable = false;
                    else this.isAvailable = true;
                }
                return { success: true };
            }

            try {
                const res = await api.drivers.updateDriverStatus(String(did), { isOnline: next });
                if (!res?.success) {
                    const errMsg =
                        res?.error?.message ||
                        res?.message ||
                        (typeof res?.error === 'string' ? res.error : null) ||
                        'Failed to update status';
                    return { success: false, error: errMsg };
                }
                if (sameUser) {
                    this.isOnline = next;
                    if (!next) this.isAvailable = false;
                    else this.isAvailable = true;
                    if (this.driverProfile) this.driverProfile.isOnline = next;
                }
                return { success: true };
            } catch (error) {
                console.error('Failed to set online status:', error);
                return { success: false, error: error?.message || 'Failed to update status' };
            }
        },

        async toggleOnlineStatus() {
            const next = !this.isOnline;
            return this.setOnlineStatusPersistent(next);
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

        // Order management (statuses: pending → assigned → preparing → on_delivery → delivered)
        async acceptOrder(orderId) {
            this.isProcessingOrder = true;
            try {
                const order = this.pendingOrders.find((o) => o.id === orderId);
                if (!order || !this.canAcceptNewOrder) {
                    return { success: false, error: 'Cannot accept order' };
                }
                const res = await api.orders.updateOrderStatus(orderId, 'preparing');
                if (!res?.success) {
                    return { success: false, error: res?.message || 'Failed to accept order' };
                }
                await this.loadOrders();
                return { success: true };
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
                const order = this.pendingOrders.find((o) => o.id === orderId);
                if (!order) {
                    return { success: false, error: 'Order not found' };
                }
                const res = await api.orders.updateOrderStatus(orderId, 'cancelled', {});
                if (!res?.success) {
                    return { success: false, error: res?.message || 'Failed to reject order' };
                }
                await this.loadOrders();
                return { success: true };
            } catch (error) {
                console.error('Failed to reject order:', error);
                return { success: false, error: error.message };
            } finally {
                this.isProcessingOrder = false;
            }
        },

        async updateOrderStatus(orderId, status, location = null) {
            try {
                const order = this.activeOrders.find((o) => o.id === orderId);
                if (!order) {
                    return { success: false, error: 'Order not found' };
                }
                // Pass only fields that exist on `orders` in Supabase; extend when you add driver_location etc.
                const res = await api.orders.updateOrderStatus(orderId, status, {});
                if (!res?.success) {
                    return { success: false, error: res?.message || 'Failed to update status' };
                }
                await this.loadOrders();
                return { success: true };
            } catch (error) {
                console.error('Failed to update order status:', error);
                return { success: false, error: error.message };
            }
        },

        // Coverage area management
        isOrderInCoverage(location) {
            if (!location || !location.coordinates) return true;

            const distance = this.calculateDistance(this.coverageArea.center.lat, this.coverageArea.center.lng, location.coordinates.lat, location.coordinates.lng);

            return distance <= this.coverageArea.radius;
        },

        calculateDistance(lat1, lng1, lat2, lng2) {
            const R = 6371; // Earth's radius in km
            const dLat = ((lat2 - lat1) * Math.PI) / 180;
            const dLng = ((lng2 - lng1) * Math.PI) / 180;
            const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            return R * c;
        },

        // Update statistics
        updateStats() {
            this.stats.totalDeliveries = this.completedOrders.length;

            const today = new Date().toDateString();
            const todayOrders = this.completedOrders.filter((order) => {
                const d = order.completedAt || order.deliveryTime || order.updatedAt;
                return d && new Date(d).toDateString() === today;
            });

            this.stats.todayDeliveries = todayOrders.length;
            this.stats.todayEarnings = todayOrders.reduce((sum, order) => sum + (order.driverEarnings || 0), 0);
            this.stats.rating = this.driverProfile?.rating ?? 0;
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
