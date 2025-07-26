import { BaseApiService } from './ApiClient.js';

export class PromoApiService extends BaseApiService {
    constructor() {
        super();
        this.endpoint = '/promos';
        this.initializeMockData();
    }

    initializeMockData() {
        // Mock promo codes
        this.mockPromos = [
            {
                id: 'promo_001',
                code: 'WELCOME20',
                title: 'Welcome Discount',
                description: 'Get 20% off on your first order',
                type: 'percentage',
                value: 20,
                minOrderAmount: 50000,
                maxDiscountAmount: 25000,
                active: true,
                usageLimit: 1,
                validFrom: '2025-01-01T00:00:00Z',
                validUntil: '2025-12-31T23:59:59Z',
                applicableProducts: [], // Empty means all products
                applicableCategories: [],
                userRestrictions: {
                    firstOrderOnly: true,
                    maxUsagePerUser: 1
                },
                image: '🎉',
                featured: true
            },
            {
                id: 'promo_002',
                code: 'PIZZA30',
                title: 'Pizza Lover Special',
                description: '30% off on all pizza orders above Rp75.000',
                type: 'percentage',
                value: 30,
                minOrderAmount: 75000,
                maxDiscountAmount: 50000,
                active: true,
                usageLimit: null,
                validFrom: '2025-01-01T00:00:00Z',
                validUntil: '2025-09-31T23:59:59Z',
                applicableProducts: [],
                applicableCategories: ['Classic Pizza', 'Premium Pizza', 'Specialty Pizza'],
                userRestrictions: {
                    firstOrderOnly: false,
                    maxUsagePerUser: 3
                },
                image: '🍕',
                featured: true
            },
            {
                id: 'promo_003',
                code: 'FLAT15K',
                title: 'Flat Discount',
                description: 'Flat Rp15.000 off on orders above Rp100.000',
                type: 'fixed',
                value: 15000,
                minOrderAmount: 100000,
                maxDiscountAmount: 15000,
                active: true,
                usageLimit: 100,
                validFrom: '2025-01-01T00:00:00Z',
                validUntil: '2025-12-29T23:59:59Z',
                applicableProducts: [],
                applicableCategories: [],
                userRestrictions: {
                    firstOrderOnly: false,
                    maxUsagePerUser: 2
                },
                image: '💰',
                featured: true
            },
            {
                id: 'promo_004',
                code: 'WEEKEND50',
                title: 'Weekend Special',
                description: '50% off on weekend orders (Saturday & Sunday)',
                type: 'percentage',
                value: 50,
                minOrderAmount: 60000,
                maxDiscountAmount: 40000,
                active: true,
                usageLimit: null,
                validFrom: '2024-01-01T00:00:00Z',
                validUntil: '2024-12-31T23:59:59Z',
                applicableProducts: [],
                applicableCategories: [],
                userRestrictions: {
                    firstOrderOnly: false,
                    maxUsagePerUser: null,
                    weekendOnly: true
                },
                image: '🎊',
                featured: true
            },
            {
                id: 'promo_005',
                code: 'COMBO25',
                title: 'Combo Deal',
                description: '25% off when you order pizza + beverage',
                type: 'percentage',
                value: 25,
                minOrderAmount: 70000,
                maxDiscountAmount: 30000,
                active: true,
                usageLimit: null,
                validFrom: '2024-01-01T00:00:00Z',
                validUntil: '2024-06-30T23:59:59Z',
                applicableProducts: [],
                applicableCategories: [],
                userRestrictions: {
                    firstOrderOnly: false,
                    maxUsagePerUser: 5,
                    requiresBothPizzaAndBeverage: true
                },
                image: '🥤',
                featured: false
            },
            {
                id: 'promo_006',
                code: 'STUDENT15',
                title: 'Student Discount',
                description: '15% off for students (valid with student ID)',
                type: 'percentage',
                value: 15,
                minOrderAmount: 40000,
                maxDiscountAmount: 20000,
                active: true,
                usageLimit: null,
                validFrom: '2024-01-01T00:00:00Z',
                validUntil: '2024-12-31T23:59:59Z',
                applicableProducts: [],
                applicableCategories: [],
                userRestrictions: {
                    firstOrderOnly: false,
                    maxUsagePerUser: null,
                    studentOnly: true
                },
                image: '🎓',
                featured: false
            }
        ];

        // Mock user promo usage history
        this.mockUserUsage = {
            customer_001: [
                {
                    promoId: 'promo_001',
                    code: 'WELCOME20',
                    usedAt: '2024-01-15T10:30:00Z',
                    orderId: 'order_123',
                    discountAmount: 12000
                }
            ]
        };
    }

    // Get all available promos for a user
    async getAvailablePromos(userId, filters = {}) {
        if (this.useMockApi) {
            await this.mockDelay();

            let promos = this.mockPromos.filter((promo) => promo.active);

            // Apply featured filter if specified
            if (filters.featured) {
                promos = promos.filter((promo) => promo.featured);
            }

            // Check date validity first - hide expired promos
            const now = new Date();
            promos = promos.filter((promo) => {
                const validFrom = new Date(promo.validFrom);
                const validUntil = new Date(promo.validUntil);
                return now >= validFrom && now <= validUntil;
            });

            // Add applicability status to each promo instead of filtering them out
            const userUsage = this.mockUserUsage[userId] || [];
            promos = promos.map((promo) => {
                const promoWithStatus = { ...promo };
                promoWithStatus.applicable = true;
                promoWithStatus.disabledReason = null;

                // Check minimum order amount
                if (filters.orderAmount && filters.orderAmount < promo.minOrderAmount) {
                    promoWithStatus.applicable = false;
                    promoWithStatus.disabledReason = `Minimum order: ${this.formatCurrency(promo.minOrderAmount)}`;
                }

                // Check category restrictions
                if (filters.categories && filters.categories.length > 0 && promo.applicableCategories.length > 0) {
                    const hasApplicableCategory = promo.applicableCategories.some((cat) => filters.categories.includes(cat));
                    if (!hasApplicableCategory) {
                        promoWithStatus.applicable = false;
                        promoWithStatus.disabledReason = `Not applicable to items in your cart`;
                    }
                }

                // Check user usage restrictions
                if (promo.userRestrictions.maxUsagePerUser) {
                    const userCount = userUsage.filter((usage) => usage.promoId === promo.id).length;
                    if (userCount >= promo.userRestrictions.maxUsagePerUser) {
                        promoWithStatus.applicable = false;
                        promoWithStatus.disabledReason = `Usage limit reached (${userCount}/${promo.userRestrictions.maxUsagePerUser})`;
                    }
                }

                // Check first order only restriction
                if (promo.userRestrictions.firstOrderOnly && userUsage.length > 0) {
                    promoWithStatus.applicable = false;
                    promoWithStatus.disabledReason = `For first-time orders only`;
                }

                // Check weekend only restriction
                if (promo.userRestrictions.weekendOnly) {
                    const day = now.getDay();
                    if (day !== 0 && day !== 6) {
                        promoWithStatus.applicable = false;
                        promoWithStatus.disabledReason = `Valid on weekends only`;
                    }
                }

                // Check combo requirement (pizza + beverage)
                if (promo.userRestrictions.requiresBothPizzaAndBeverage) {
                    const categories = filters.categories || [];
                    const hasPizza = categories.some((cat) => cat.includes('Pizza'));
                    const hasBeverage = categories.some((cat) => cat.includes('Beverage') || cat.includes('Drink'));

                    if (!hasPizza || !hasBeverage) {
                        promoWithStatus.applicable = false;
                        promoWithStatus.disabledReason = `Requires both pizza and beverage`;
                    }
                }

                return promoWithStatus;
            });

            // Sort by applicable first, then featured, then by discount value
            promos.sort((a, b) => {
                // Applicable promos first
                if (a.applicable !== b.applicable) {
                    return b.applicable ? 1 : -1;
                }
                // Then by featured
                if (a.featured !== b.featured) {
                    return b.featured ? 1 : -1;
                }
                // Then by discount value
                return b.value - a.value;
            });

            return this.createMockResponse({
                promos: promos,
                total: promos.length,
                featured: promos.filter((p) => p.featured).length,
                applicable: promos.filter((p) => p.applicable).length
            });
        }

        return await this.get(this.endpoint, { userId, ...filters });
    }

    // Validate promo code
    async validatePromoCode(code, validationData) {
        if (this.useMockApi) {
            await this.mockDelay();

            const promo = this.mockPromos.find((p) => p.code.toLowerCase() === code.toLowerCase() && p.active);

            if (!promo) {
                return this.createMockError('Invalid promo code', 404);
            }

            // Check date validity
            const now = new Date();
            const validFrom = new Date(promo.validFrom);
            const validUntil = new Date(promo.validUntil);

            if (now < validFrom) {
                return this.createMockError('Promo code is not yet valid', 400);
            }

            if (now > validUntil) {
                return this.createMockError('Promo code has expired', 400);
            }

            // Check minimum order amount
            if (validationData.orderAmount < promo.minOrderAmount) {
                return this.createMockError(`Minimum order amount is ${this.formatCurrency(promo.minOrderAmount)}`, 400);
            }

            // Check user restrictions
            const userId = validationData.userId;
            const userUsage = this.mockUserUsage[userId] || [];

            if (promo.userRestrictions.firstOrderOnly && userUsage.length > 0) {
                return this.createMockError('This promo is only valid for first-time orders', 400);
            }

            if (promo.userRestrictions.maxUsagePerUser) {
                const userCount = userUsage.filter((usage) => usage.promoId === promo.id).length;
                if (userCount >= promo.userRestrictions.maxUsagePerUser) {
                    return this.createMockError('You have reached the usage limit for this promo', 400);
                }
            }

            // Check weekend restriction
            if (promo.userRestrictions.weekendOnly) {
                const day = now.getDay();
                if (day !== 0 && day !== 6) {
                    return this.createMockError('This promo is only valid on weekends', 400);
                }
            }

            // Check combo requirement (pizza + beverage)
            if (promo.userRestrictions.requiresBothPizzaAndBeverage) {
                const categories = validationData.categories || [];
                const hasPizza = categories.some((cat) => cat.includes('Pizza'));
                const hasBeverage = categories.some((cat) => cat.includes('Beverage') || cat.includes('Drink'));

                if (!hasPizza || !hasBeverage) {
                    return this.createMockError('This promo requires both pizza and beverage in your order', 400);
                }
            }

            // Check category restrictions
            if (promo.applicableCategories.length > 0) {
                const orderCategories = validationData.categories || [];
                const hasApplicableCategory = promo.applicableCategories.some((cat) => orderCategories.includes(cat));

                if (!hasApplicableCategory) {
                    return this.createMockError('This promo is not applicable to items in your cart', 400);
                }
            }

            // Calculate discount
            const discountResult = this.calculateDiscount(promo, validationData);

            return this.createMockResponse({
                promo: promo,
                valid: true,
                discount: discountResult,
                message: 'Promo code applied successfully!'
            });
        }

        return await this.post(`${this.endpoint}/validate`, { code, ...validationData });
    }

    // Apply promo code to order
    async applyPromoCode(code, orderData) {
        if (this.useMockApi) {
            await this.mockDelay();

            // First validate the promo
            const validationResult = await this.validatePromoCode(code, {
                userId: orderData.userId,
                orderAmount: orderData.subtotal,
                categories: orderData.categories || []
            });

            if (!validationResult.success) {
                return validationResult;
            }

            const { promo, discount } = validationResult.data;

            // Record usage
            if (!this.mockUserUsage[orderData.userId]) {
                this.mockUserUsage[orderData.userId] = [];
            }

            this.mockUserUsage[orderData.userId].push({
                promoId: promo.id,
                code: promo.code,
                usedAt: new Date().toISOString(),
                orderId: orderData.orderId || 'temp_order',
                discountAmount: discount.amount
            });

            return this.createMockResponse({
                promo: promo,
                discount: discount,
                appliedAt: new Date().toISOString(),
                message: `${promo.title} applied! You saved ${this.formatCurrency(discount.amount)}`
            });
        }

        return await this.post(`${this.endpoint}/apply`, { code, ...orderData });
    }

    // Get promo by code
    async getPromoByCode(code) {
        if (this.useMockApi) {
            await this.mockDelay();

            const promo = this.mockPromos.find((p) => p.code.toLowerCase() === code.toLowerCase());

            if (!promo) {
                return this.createMockError('Promo code not found', 404);
            }

            return this.createMockResponse({ promo });
        }

        return await this.get(`${this.endpoint}/code/${code}`);
    }

    // Get user's promo usage history
    async getUserPromoHistory(userId, filters = {}) {
        if (this.useMockApi) {
            await this.mockDelay();

            let history = this.mockUserUsage[userId] || [];

            // Apply date filters
            if (filters.fromDate) {
                history = history.filter((usage) => new Date(usage.usedAt) >= new Date(filters.fromDate));
            }

            if (filters.toDate) {
                history = history.filter((usage) => new Date(usage.usedAt) <= new Date(filters.toDate));
            }

            // Sort by usage date (newest first)
            history.sort((a, b) => new Date(b.usedAt) - new Date(a.usedAt));

            // Calculate total savings
            const totalSavings = history.reduce((sum, usage) => sum + usage.discountAmount, 0);

            return this.createMockResponse({
                history: history,
                totalUsage: history.length,
                totalSavings: totalSavings,
                formattedSavings: this.formatCurrency(totalSavings)
            });
        }

        return await this.get(`${this.endpoint}/user/${userId}/history`, filters);
    }

    // Calculate discount amount
    calculateDiscount(promo, orderData) {
        let discountAmount = 0;

        if (promo.type === 'percentage') {
            discountAmount = (orderData.orderAmount * promo.value) / 100;
        } else if (promo.type === 'fixed') {
            discountAmount = promo.value;
        }

        // Apply maximum discount limit
        if (promo.maxDiscountAmount && discountAmount > promo.maxDiscountAmount) {
            discountAmount = promo.maxDiscountAmount;
        }

        // Ensure discount doesn't exceed order amount
        if (discountAmount > orderData.orderAmount) {
            discountAmount = orderData.orderAmount;
        }

        return {
            type: promo.type,
            value: promo.value,
            amount: discountAmount,
            maxAmount: promo.maxDiscountAmount,
            formattedAmount: this.formatCurrency(discountAmount),
            percentage: promo.type === 'percentage' ? promo.value : Math.round((discountAmount / orderData.orderAmount) * 100)
        };
    }

    // Format currency
    formatCurrency(amount) {
        const formatted = new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        }).format(amount);
        return formatted.replace(/\s/g, ''); // Remove spaces
    }

    // Remove applied promo (for cart updates)
    async removePromoCode(userId, code) {
        if (this.useMockApi) {
            await this.mockDelay();

            return this.createMockResponse({
                message: 'Promo code removed successfully',
                removedAt: new Date().toISOString()
            });
        }

        return await this.delete(`${this.endpoint}/remove`, { userId, code });
    }
}

// Export singleton instance
export default new PromoApiService();
