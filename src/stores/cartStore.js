import { defineStore } from 'pinia';

export const useCartStore = defineStore('cart', {
    state: () => ({
        items: [],
        appliedPromo: null,
        promoDiscount: null
    }),

    getters: {
        totalItems: (state) => {
            return state.items.reduce((total, item) => total + item.quantity, 0);
        },

        totalPrice: (state) => {
            return state.items.reduce((total, item) => {
                return total + (item.price * item.quantity);
            }, 0);
        },

        formattedTotalPrice: (state) => {
            const total = state.items.reduce((total, item) => {
                return total + (item.price * item.quantity);
            }, 0);
            const formatted = new Intl.NumberFormat('id-ID', {
                style: 'currency',
                currency: 'IDR',
                minimumFractionDigits: 0
            }).format(total);
            return formatted.replace(/\s/g, ''); // Remove spaces
        },

        isEmpty: (state) => {
            return state.items.length === 0;
        },

        discountAmount: (state) => {
            return state.promoDiscount?.amount || 0;
        },

        finalTotal: (state) => {
            const subtotal = state.items.reduce((total, item) => {
                return total + (item.price * item.quantity);
            }, 0);
            const discount = state.promoDiscount?.amount || 0;
            return Math.max(0, subtotal - discount);
        },

        formattedFinalTotal: (state) => {
            const subtotal = state.items.reduce((total, item) => {
                return total + (item.price * item.quantity);
            }, 0);
            const discount = state.promoDiscount?.amount || 0;
            const finalTotal = Math.max(0, subtotal - discount);
            const formatted = new Intl.NumberFormat('id-ID', {
                style: 'currency',
                currency: 'IDR',
                minimumFractionDigits: 0
            }).format(finalTotal);
            return formatted.replace(/\s/g, ''); // Remove spaces
        },

        formattedDiscount: (state) => {
            if (!state.promoDiscount) {
                const formatted = new Intl.NumberFormat('id-ID', {
                    style: 'currency',
                    currency: 'IDR',
                    minimumFractionDigits: 0
                }).format(0);
                return formatted.replace(/\s/g, ''); // Remove spaces
            }
            return state.promoDiscount.formattedAmount;
        },

        cartCategories: (state) => {
            const categories = new Set();
            state.items.forEach(item => {
                if (item.category) {
                    categories.add(item.category);
                }
            });
            return Array.from(categories);
        }
    },

    actions: {
        addToCart(pizza, quantity = 1) {
            const existingItem = this.items.find(item => item.id === pizza.id);
            
            if (existingItem) {
                existingItem.quantity += quantity;
            } else {
                this.items.push({
                    id: pizza.id,
                    name: pizza.name,
                    price: pizza.price,
                    image: pizza.image,
                    description: pizza.description,
                    quantity: quantity
                });
            }
        },

        removeFromCart(itemId) {
            const index = this.items.findIndex(item => item.id === itemId);
            if (index > -1) {
                this.items.splice(index, 1);
            }
        },

        updateQuantity(itemId, quantity) {
            const item = this.items.find(item => item.id === itemId);
            if (item) {
                if (quantity <= 0) {
                    this.removeFromCart(itemId);
                } else {
                    item.quantity = quantity;
                }
            }
        },

        clearCart() {
            this.items = [];
            this.appliedPromo = null;
            this.promoDiscount = null;
        },

        applyPromo(promo, discount) {
            this.appliedPromo = promo;
            this.promoDiscount = discount;
        },

        removePromo() {
            this.appliedPromo = null;
            this.promoDiscount = null;
        },

        async validateCurrentPromo() {
            if (!this.appliedPromo) return { valid: true };

            // Import here to avoid circular dependency
            const promoApi = (await import('@/services/api/PromoApiService.js')).default;
            
            try {
                const response = await promoApi.validatePromoCode(this.appliedPromo.code, {
                    userId: 'customer_001',
                    orderAmount: this.totalPrice,
                    categories: this.cartCategories
                });

                if (!response.success) {
                    // Promo is no longer valid
                    const removedCode = this.appliedPromo.code;
                    this.removePromo();
                    return { 
                        valid: false, 
                        message: `${removedCode} is no longer valid and has been removed` 
                    };
                } else {
                    // Update discount amount if promo is still valid
                    this.promoDiscount = response.data.discount;
                    return { valid: true };
                }
            } catch (error) {
                console.error('Error validating promo:', error);
                return { valid: true }; // Don't remove promo on network errors
            }
        }
    }
});