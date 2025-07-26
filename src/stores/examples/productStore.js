// Example: Updated Product Store using centralized API services
// This demonstrates how to migrate existing stores to use the new API layer

import { defineStore } from 'pinia';
import { products } from '@/services/api';

export const useProductStore = defineStore('products', {
    state: () => ({
        // Product data
        pizzas: [],
        beverages: [],
        categories: [],
        popularProducts: [],
        
        // Loading states
        loading: {
            pizzas: false,
            beverages: false,
            menu: false,
            search: false
        },
        
        // Error handling
        errors: {
            pizzas: null,
            beverages: null,
            menu: null,
            search: null
        },
        
        // Search and filters
        searchQuery: '',
        searchResults: [],
        activeFilters: {
            category: null,
            maxPrice: null,
            popular: false
        },
        
        // Cache management
        lastFetched: {
            pizzas: null,
            beverages: null,
            menu: null
        },
        cacheTimeout: 5 * 60 * 1000 // 5 minutes
    }),

    getters: {
        // Get all products (pizzas + beverages)
        allProducts: (state) => [...state.pizzas, ...state.beverages],
        
        // Get products by category
        productsByCategory: (state) => {
            const grouped = {};
            
            state.pizzas.forEach(pizza => {
                if (!grouped[pizza.category]) grouped[pizza.category] = [];
                grouped[pizza.category].push(pizza);
            });
            
            state.beverages.forEach(beverage => {
                if (!grouped[beverage.category]) grouped[beverage.category] = [];
                grouped[beverage.category].push(beverage);
            });
            
            return grouped;
        },
        
        // Get filtered products
        filteredProducts: (state) => {
            let filtered = state.allProducts;
            
            if (state.activeFilters.category) {
                filtered = filtered.filter(product => 
                    product.category === state.activeFilters.category
                );
            }
            
            if (state.activeFilters.maxPrice) {
                filtered = filtered.filter(product => 
                    product.price <= state.activeFilters.maxPrice
                );
            }
            
            if (state.activeFilters.popular) {
                filtered = filtered.filter(product => product.popular);
            }
            
            return filtered;
        },
        
        // Check if data needs refresh
        needsRefresh: (state) => (dataType) => {
            const lastFetch = state.lastFetched[dataType];
            if (!lastFetch) return true;
            return Date.now() - lastFetch > state.cacheTimeout;
        },
        
        // Get loading state for any operation
        isLoading: (state) => Object.values(state.loading).some(loading => loading),
        
        // Get products by IDs (useful for cart)
        getProductsByIds: (state) => (productIds) => {
            return state.allProducts.filter(product => 
                productIds.includes(product.id)
            );
        }
    },

    actions: {
        // Load all pizzas
        async loadPizzas(filters = {}, forceRefresh = false) {
            if (!forceRefresh && !this.needsRefresh('pizzas')) {
                return { success: true, data: { pizzas: this.pizzas } };
            }
            
            this.loading.pizzas = true;
            this.errors.pizzas = null;
            
            try {
                const response = await products.getPizzas(filters);
                
                if (response.success) {
                    this.pizzas = response.data.pizzas;
                    this.lastFetched.pizzas = Date.now();
                    return response;
                } else {
                    this.errors.pizzas = response.error.message;
                    return response;
                }
            } catch (error) {
                this.errors.pizzas = error.message;
                return { success: false, error: { message: error.message } };
            } finally {
                this.loading.pizzas = false;
            }
        },

        // Load all beverages
        async loadBeverages(filters = {}, forceRefresh = false) {
            if (!forceRefresh && !this.needsRefresh('beverages')) {
                return { success: true, data: { beverages: this.beverages } };
            }
            
            this.loading.beverages = true;
            this.errors.beverages = null;
            
            try {
                const response = await products.getBeverages(filters);
                
                if (response.success) {
                    this.beverages = response.data.beverages;
                    this.lastFetched.beverages = Date.now();
                    return response;
                } else {
                    this.errors.beverages = response.error.message;
                    return response;
                }
            } catch (error) {
                this.errors.beverages = error.message;
                return { success: false, error: { message: error.message } };
            } finally {
                this.loading.beverages = false;
            }
        },

        // Load complete menu (pizzas + beverages + categories)
        async loadMenu(filters = {}, forceRefresh = false) {
            if (!forceRefresh && !this.needsRefresh('menu')) {
                return { 
                    success: true, 
                    data: { 
                        pizzas: this.pizzas, 
                        beverages: this.beverages,
                        categories: this.categories
                    } 
                };
            }
            
            this.loading.menu = true;
            this.errors.menu = null;
            
            try {
                const response = await products.getMenu(filters);
                
                if (response.success) {
                    this.pizzas = response.data.pizzas;
                    this.beverages = response.data.beverages;
                    this.categories = response.data.categories;
                    this.lastFetched.menu = Date.now();
                    // Update individual timestamps
                    this.lastFetched.pizzas = Date.now();
                    this.lastFetched.beverages = Date.now();
                    return response;
                } else {
                    this.errors.menu = response.error.message;
                    return response;
                }
            } catch (error) {
                this.errors.menu = error.message;
                return { success: false, error: { message: error.message } };
            } finally {
                this.loading.menu = false;
            }
        },

        // Load popular products
        async loadPopularProducts(limit = 6) {
            try {
                const response = await products.getPopularProducts(limit);
                
                if (response.success) {
                    this.popularProducts = response.data.products;
                    return response;
                }
                
                return response;
            } catch (error) {
                return { success: false, error: { message: error.message } };
            }
        },

        // Search products
        async searchProducts(query, filters = {}) {
            if (!query.trim()) {
                this.searchResults = [];
                this.searchQuery = '';
                return { success: true, data: { results: [] } };
            }
            
            this.loading.search = true;
            this.errors.search = null;
            this.searchQuery = query;
            
            try {
                const response = await products.searchProducts(query, filters);
                
                if (response.success) {
                    this.searchResults = [
                        ...response.data.results.pizzas,
                        ...response.data.results.beverages
                    ];
                    return response;
                } else {
                    this.errors.search = response.error.message;
                    this.searchResults = [];
                    return response;
                }
            } catch (error) {
                this.errors.search = error.message;
                this.searchResults = [];
                return { success: false, error: { message: error.message } };
            } finally {
                this.loading.search = false;
            }
        },

        // Get specific product by ID
        async getProduct(productId) {
            // First check if we have it in cache
            const cachedProduct = this.allProducts.find(p => p.id === productId);
            if (cachedProduct) {
                return { success: true, data: { product: cachedProduct } };
            }
            
            // If not in cache, fetch from API
            try {
                const response = await products.getProduct(productId);
                
                if (response.success) {
                    // Add to appropriate cache
                    const { product, type } = response.data;
                    if (type === 'pizza') {
                        const existingIndex = this.pizzas.findIndex(p => p.id === productId);
                        if (existingIndex >= 0) {
                            this.pizzas[existingIndex] = product;
                        } else {
                            this.pizzas.push(product);
                        }
                    } else if (type === 'beverage') {
                        const existingIndex = this.beverages.findIndex(b => b.id === productId);
                        if (existingIndex >= 0) {
                            this.beverages[existingIndex] = product;
                        } else {
                            this.beverages.push(product);
                        }
                    }
                }
                
                return response;
            } catch (error) {
                return { success: false, error: { message: error.message } };
            }
        },

        // Check product availability
        async checkAvailability(productId, quantity = 1) {
            try {
                const response = await products.checkAvailability(productId, quantity);
                
                // Update local product availability if needed
                if (response.success && !response.data.available) {
                    const product = this.allProducts.find(p => p.id === productId);
                    if (product) {
                        product.available = false;
                    }
                }
                
                return response;
            } catch (error) {
                return { success: false, error: { message: error.message } };
            }
        },

        // Batch check availability for multiple products (useful for cart validation)
        async checkMultipleAvailability(items) {
            try {
                const response = await products.checkMultipleAvailability(items);
                
                // Update local availability based on results
                if (response.success) {
                    response.data.items.forEach(result => {
                        const product = this.allProducts.find(p => p.id === result.productId);
                        if (product) {
                            product.available = result.available;
                        }
                    });
                }
                
                return response;
            } catch (error) {
                return { success: false, error: { message: error.message } };
            }
        },

        // Update filters
        updateFilters(filters) {
            this.activeFilters = { ...this.activeFilters, ...filters };
        },

        // Clear filters
        clearFilters() {
            this.activeFilters = {
                category: null,
                maxPrice: null,
                popular: false
            };
        },

        // Clear search
        clearSearch() {
            this.searchQuery = '';
            this.searchResults = [];
            this.errors.search = null;
        },

        // Clear all errors
        clearErrors() {
            this.errors = {
                pizzas: null,
                beverages: null,
                menu: null,
                search: null
            };
        },

        // Reset store state
        reset() {
            this.pizzas = [];
            this.beverages = [];
            this.categories = [];
            this.popularProducts = [];
            this.searchQuery = '';
            this.searchResults = [];
            this.clearFilters();
            this.clearErrors();
            
            Object.keys(this.loading).forEach(key => {
                this.loading[key] = false;
            });
            
            Object.keys(this.lastFetched).forEach(key => {
                this.lastFetched[key] = null;
            });
        },

        // Initialize store with default data
        async initialize() {
            try {
                // Load menu and popular products in parallel
                const [menuResponse, popularResponse] = await Promise.all([
                    this.loadMenu(),
                    this.loadPopularProducts()
                ]);

                return {
                    success: menuResponse.success && popularResponse.success,
                    menu: menuResponse,
                    popular: popularResponse
                };
            } catch (error) {
                console.error('Failed to initialize product store:', error);
                return { success: false, error: error.message };
            }
        }
    }
});