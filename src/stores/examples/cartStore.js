// Example: Updated Cart Store using centralized API services
// This demonstrates how to integrate cart functionality with the new API layer

import { defineStore } from 'pinia';
import { products } from '@/services/api';

export const useCartStore = defineStore('cart', {
    state: () => ({
        items: [],
        
        // Loading states
        loading: {
            addItem: false,
            removeItem: false,
            updateQuantity: false,
            validateCart: false,
            clearCart: false
        },
        
        // Error handling
        errors: {
            addItem: null,
            availability: null,
            validation: null
        },
        
        // Cart validation state
        isValid: true,
        validationResults: [],
        lastValidated: null,
        
        // Delivery and pricing
        deliveryFee: 0,
        discount: 0,
        minimumOrder: 50000,
        freeDeliveryThreshold: 100000,
        
        // Cart persistence
        persistToStorage: true
    }),

    getters: {
        // Total items count
        totalItems: (state) => {
            return state.items.reduce((total, item) => total + item.quantity, 0);
        },

        // Subtotal (before delivery and discount)
        subtotal: (state) => {
            return state.items.reduce((total, item) => {
                return total + (item.price * item.quantity);
            }, 0);
        },

        // Total after delivery fee and discount
        total: (state) => {
            const subtotal = state.subtotal;
            const deliveryFee = subtotal >= state.freeDeliveryThreshold ? 0 : state.deliveryFee;
            return subtotal + deliveryFee - state.discount;
        },

        // Formatted total price
        formattedTotal: (state) => {
            const formatted = new Intl.NumberFormat('id-ID', {
                style: 'currency',
                currency: 'IDR',
                minimumFractionDigits: 0
            }).format(state.total);
            return formatted.replace(/\s/g, ''); // Remove spaces
        },

        // Formatted subtotal
        formattedSubtotal: (state) => {
            const formatted = new Intl.NumberFormat('id-ID', {
                style: 'currency',
                currency: 'IDR',
                minimumFractionDigits: 0
            }).format(state.subtotal);
            return formatted.replace(/\s/g, ''); // Remove spaces
        },

        // Check if cart is empty
        isEmpty: (state) => state.items.length === 0,

        // Check if minimum order is met
        minimumOrderMet: (state) => state.subtotal >= state.minimumOrder,

        // Check if eligible for free delivery
        freeDeliveryEligible: (state) => state.subtotal >= state.freeDeliveryThreshold,

        // Get delivery fee (0 if free delivery eligible)
        finalDeliveryFee: (state) => {
            return state.subtotal >= state.freeDeliveryThreshold ? 0 : state.deliveryFee;
        },

        // Check if any operation is loading
        isLoading: (state) => Object.values(state.loading).some(loading => loading),

        // Get cart summary for order creation
        cartSummary: (state) => ({
            items: state.items.map(item => ({
                productId: item.id,
                name: item.name,
                price: item.price,
                quantity: item.quantity,
                subtotal: item.price * item.quantity
            })),
            subtotal: state.subtotal,
            deliveryFee: state.finalDeliveryFee,
            discount: state.discount,
            total: state.total,
            totalItems: state.totalItems
        })
    },

    actions: {
        // Add item to cart with availability check
        async addToCart(product, quantity = 1) {
            this.loading.addItem = true;
            this.errors.addItem = null;
            
            try {
                // Check product availability first
                const availabilityResponse = await products.checkAvailability(product.id, quantity);
                
                if (!availabilityResponse.success) {
                    this.errors.addItem = availabilityResponse.error.message;
                    return availabilityResponse;
                }
                
                if (!availabilityResponse.data.available) {
                    this.errors.addItem = `${product.name} is currently not available`;
                    return {
                        success: false,
                        error: { message: this.errors.addItem }
                    };
                }
                
                // Check if requested quantity is available
                if (quantity > availabilityResponse.data.maxQuantity) {
                    this.errors.addItem = `Only ${availabilityResponse.data.maxQuantity} ${product.name} available`;
                    return {
                        success: false,
                        error: { message: this.errors.addItem }
                    };
                }
                
                // Add or update item in cart
                const existingItem = this.items.find(item => item.id === product.id);
                
                if (existingItem) {
                    const newQuantity = existingItem.quantity + quantity;
                    
                    // Check if new quantity is still available
                    if (newQuantity > availabilityResponse.data.maxQuantity) {
                        this.errors.addItem = `Maximum ${availabilityResponse.data.maxQuantity} items allowed`;
                        return {
                            success: false,
                            error: { message: this.errors.addItem }
                        };
                    }
                    
                    existingItem.quantity = newQuantity;
                } else {
                    // Add new item
                    this.items.push({
                        id: product.id,
                        name: product.name,
                        price: product.price,
                        image: product.image,
                        description: product.description,
                        category: product.category,
                        quantity: quantity,
                        addedAt: new Date().toISOString()
                    });
                }
                
                // Save to storage if enabled
                if (this.persistToStorage) {
                    this.saveToStorage();
                }
                
                // Mark cart as potentially invalid for next validation
                this.isValid = false;
                
                return {
                    success: true,
                    data: {
                        item: existingItem || this.items[this.items.length - 1],
                        totalItems: this.totalItems,
                        subtotal: this.subtotal
                    }
                };
                
            } catch (error) {
                this.errors.addItem = error.message;
                return { success: false, error: { message: error.message } };
            } finally {
                this.loading.addItem = false;
            }
        },

        // Remove item from cart
        async removeFromCart(itemId) {
            this.loading.removeItem = true;
            
            try {
                const index = this.items.findIndex(item => item.id === itemId);
                if (index > -1) {
                    this.items.splice(index, 1);
                    
                    // Save to storage
                    if (this.persistToStorage) {
                        this.saveToStorage();
                    }
                    
                    return { success: true, data: { removedItemId: itemId } };
                }
                
                return { success: false, error: { message: 'Item not found in cart' } };
            } catch (error) {
                return { success: false, error: { message: error.message } };
            } finally {
                this.loading.removeItem = false;
            }
        },

        // Update item quantity with availability check
        async updateQuantity(itemId, quantity) {
            this.loading.updateQuantity = true;
            
            try {
                if (quantity <= 0) {
                    return await this.removeFromCart(itemId);
                }
                
                const item = this.items.find(item => item.id === itemId);
                if (!item) {
                    return { success: false, error: { message: 'Item not found in cart' } };
                }
                
                // Check availability for new quantity
                const availabilityResponse = await products.checkAvailability(itemId, quantity);
                
                if (!availabilityResponse.success) {
                    return availabilityResponse;
                }
                
                if (!availabilityResponse.data.available) {
                    return {
                        success: false,
                        error: { message: `${item.name} is no longer available` }
                    };
                }
                
                if (quantity > availabilityResponse.data.maxQuantity) {
                    return {
                        success: false,
                        error: { message: `Only ${availabilityResponse.data.maxQuantity} ${item.name} available` }
                    };
                }
                
                // Update quantity
                const oldQuantity = item.quantity;
                item.quantity = quantity;
                item.updatedAt = new Date().toISOString();
                
                // Save to storage
                if (this.persistToStorage) {
                    this.saveToStorage();
                }
                
                return {
                    success: true,
                    data: {
                        item: item,
                        oldQuantity: oldQuantity,
                        newQuantity: quantity,
                        subtotal: this.subtotal
                    }
                };
                
            } catch (error) {
                return { success: false, error: { message: error.message } };
            } finally {
                this.loading.updateQuantity = false;
            }
        },

        // Validate entire cart availability
        async validateCart() {
            this.loading.validateCart = true;
            this.errors.validation = null;
            
            try {
                if (this.isEmpty) {
                    this.isValid = true;
                    this.validationResults = [];
                    return { success: true, data: { valid: true, issues: [] } };
                }
                
                // Prepare items for batch availability check
                const itemsToCheck = this.items.map(item => ({
                    productId: item.id,
                    quantity: item.quantity
                }));
                
                const response = await products.checkMultipleAvailability(itemsToCheck);
                
                if (!response.success) {
                    this.errors.validation = response.error.message;
                    return response;
                }
                
                // Process validation results
                const issues = [];
                const validItems = [];
                
                response.data.items.forEach(result => {
                    const cartItem = this.items.find(item => item.id === result.productId);
                    if (!cartItem) return;
                    
                    if (!result.available) {
                        issues.push({
                            type: 'unavailable',
                            itemId: result.productId,
                            itemName: cartItem.name,
                            message: `${cartItem.name} is no longer available`
                        });
                    } else if (cartItem.quantity > result.maxQuantity) {
                        issues.push({
                            type: 'quantity_reduced',
                            itemId: result.productId,
                            itemName: cartItem.name,
                            requestedQuantity: cartItem.quantity,
                            maxQuantity: result.maxQuantity,
                            message: `${cartItem.name} quantity reduced to ${result.maxQuantity}`
                        });
                        
                        // Auto-adjust quantity
                        cartItem.quantity = result.maxQuantity;
                        cartItem.updatedAt = new Date().toISOString();
                    } else {
                        validItems.push(cartItem);
                    }
                });
                
                // Remove unavailable items
                const unavailableItems = issues.filter(issue => issue.type === 'unavailable');
                unavailableItems.forEach(issue => {
                    const index = this.items.findIndex(item => item.id === issue.itemId);
                    if (index > -1) {
                        this.items.splice(index, 1);
                    }
                });
                
                this.isValid = issues.length === 0;
                this.validationResults = issues;
                this.lastValidated = new Date().toISOString();
                
                // Save changes if any
                if (issues.length > 0 && this.persistToStorage) {
                    this.saveToStorage();
                }
                
                return {
                    success: true,
                    data: {
                        valid: this.isValid,
                        issues: issues,
                        validItems: validItems.length,
                        totalItems: this.totalItems
                    }
                };
                
            } catch (error) {
                this.errors.validation = error.message;
                return { success: false, error: { message: error.message } };
            } finally {
                this.loading.validateCart = false;
            }
        },

        // Clear cart
        async clearCart() {
            this.loading.clearCart = true;
            
            try {
                this.items = [];
                this.isValid = true;
                this.validationResults = [];
                this.clearErrors();
                
                // Clear storage
                if (this.persistToStorage) {
                    this.removeFromStorage();
                }
                
                return { success: true, data: { message: 'Cart cleared successfully' } };
            } catch (error) {
                return { success: false, error: { message: error.message } };
            } finally {
                this.loading.clearCart = false;
            }
        },

        // Update delivery settings
        updateDeliverySettings(settings) {
            if (settings.deliveryFee !== undefined) {
                this.deliveryFee = settings.deliveryFee;
            }
            if (settings.minimumOrder !== undefined) {
                this.minimumOrder = settings.minimumOrder;
            }
            if (settings.freeDeliveryThreshold !== undefined) {
                this.freeDeliveryThreshold = settings.freeDeliveryThreshold;
            }
        },

        // Apply discount
        applyDiscount(discountAmount) {
            this.discount = Math.max(0, discountAmount);
        },

        // Clear all errors
        clearErrors() {
            this.errors = {
                addItem: null,
                availability: null,
                validation: null
            };
        },

        // Storage methods
        saveToStorage() {
            if (typeof localStorage === 'undefined') return;
            
            try {
                localStorage.setItem('cart', JSON.stringify({
                    items: this.items,
                    savedAt: new Date().toISOString()
                }));
            } catch (error) {
                console.error('Failed to save cart to storage:', error);
            }
        },

        loadFromStorage() {
            if (typeof localStorage === 'undefined') return;
            
            try {
                const saved = localStorage.getItem('cart');
                if (saved) {
                    const data = JSON.parse(saved);
                    
                    // Check if saved data is not too old (24 hours)
                    const savedTime = new Date(data.savedAt);
                    const now = new Date();
                    const hoursDiff = (now - savedTime) / (1000 * 60 * 60);
                    
                    if (hoursDiff < 24) {
                        this.items = data.items || [];
                        
                        // Validate loaded cart
                        this.validateCart();
                    } else {
                        // Clear old cart data
                        this.removeFromStorage();
                    }
                }
            } catch (error) {
                console.error('Failed to load cart from storage:', error);
                this.removeFromStorage();
            }
        },

        removeFromStorage() {
            if (typeof localStorage === 'undefined') return;
            
            try {
                localStorage.removeItem('cart');
            } catch (error) {
                console.error('Failed to remove cart from storage:', error);
            }
        },

        // Initialize cart store
        async initialize() {
            try {
                // Load from storage if enabled
                if (this.persistToStorage) {
                    this.loadFromStorage();
                }
                
                // Validate loaded cart
                if (!this.isEmpty) {
                    await this.validateCart();
                }
                
                return { success: true };
            } catch (error) {
                console.error('Failed to initialize cart store:', error);
                return { success: false, error: error.message };
            }
        }
    }
});