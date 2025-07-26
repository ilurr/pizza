import { BaseApiService } from './ApiClient.js';
import pizzasData from '@/data/pizzas.json';
import beveragesData from '@/data/beverages.json';

export class ProductsApiService extends BaseApiService {
    constructor() {
        super();
        this.endpoint = '/products';
    }

    // Get all pizzas with optional filtering
    async getPizzas(filters = {}) {
        if (this.useMockApi) {
            await this.mockDelay();
            
            let filteredPizzas = [...pizzasData];
            
            // Apply filters
            if (filters.category) {
                filteredPizzas = filteredPizzas.filter(pizza => 
                    pizza.category.toLowerCase() === filters.category.toLowerCase()
                );
            }
            
            if (filters.available !== undefined) {
                filteredPizzas = filteredPizzas.filter(pizza => pizza.available === filters.available);
            }
            
            if (filters.popular) {
                filteredPizzas = filteredPizzas.filter(pizza => pizza.popular === true);
            }
            
            if (filters.maxPrice) {
                filteredPizzas = filteredPizzas.filter(pizza => pizza.price <= filters.maxPrice);
            }

            if (filters.search) {
                const searchLower = filters.search.toLowerCase();
                filteredPizzas = filteredPizzas.filter(pizza => 
                    pizza.name.toLowerCase().includes(searchLower) ||
                    pizza.description.toLowerCase().includes(searchLower) ||
                    pizza.ingredients.some(ingredient => 
                        ingredient.toLowerCase().includes(searchLower)
                    )
                );
            }
            
            return this.createMockResponse({
                pizzas: filteredPizzas,
                total: filteredPizzas.length,
                filters: filters
            });
        }
        
        // Real API call
        return await this.get(`${this.endpoint}/pizzas`, filters);
    }

    // Get all beverages with optional filtering
    async getBeverages(filters = {}) {
        if (this.useMockApi) {
            await this.mockDelay();
            
            let filteredBeverages = [...beveragesData];
            
            // Apply filters
            if (filters.category) {
                filteredBeverages = filteredBeverages.filter(beverage => 
                    beverage.category.toLowerCase() === filters.category.toLowerCase()
                );
            }
            
            if (filters.type) {
                filteredBeverages = filteredBeverages.filter(beverage => 
                    beverage.type === filters.type
                );
            }
            
            if (filters.available !== undefined) {
                filteredBeverages = filteredBeverages.filter(beverage => 
                    beverage.available === filters.available
                );
            }

            if (filters.maxPrice) {
                filteredBeverages = filteredBeverages.filter(beverage => 
                    beverage.price <= filters.maxPrice
                );
            }
            
            return this.createMockResponse({
                beverages: filteredBeverages,
                total: filteredBeverages.length,
                filters: filters
            });
        }
        
        // Real API call
        return await this.get(`${this.endpoint}/beverages`, filters);
    }

    // Get combined menu (pizzas + beverages)
    async getMenu(filters = {}) {
        if (this.useMockApi) {
            const [pizzasResponse, beveragesResponse] = await Promise.all([
                this.getPizzas(filters),
                this.getBeverages(filters)
            ]);
            
            if (pizzasResponse.success && beveragesResponse.success) {
                return this.createMockResponse({
                    pizzas: pizzasResponse.data.pizzas,
                    beverages: beveragesResponse.data.beverages,
                    categories: this.getCategories(),
                    total: pizzasResponse.data.total + beveragesResponse.data.total
                });
            }
            
            return this.createMockError('Failed to load menu');
        }
        
        // Real API call
        return await this.get(`${this.endpoint}/menu`, filters);
    }

    // Get specific product by ID
    async getProduct(productId) {
        if (this.useMockApi) {
            await this.mockDelay();
            
            // Search in pizzas first
            const pizza = pizzasData.find(p => p.id === productId);
            if (pizza) {
                return this.createMockResponse({
                    product: pizza,
                    type: 'pizza'
                });
            }
            
            // Search in beverages
            const beverage = beveragesData.find(b => b.id === productId);
            if (beverage) {
                return this.createMockResponse({
                    product: beverage,
                    type: 'beverage'
                });
            }
            
            return this.createMockError('Product not found', 404);
        }
        
        // Real API call
        return await this.get(`${this.endpoint}/${productId}`);
    }

    // Get product categories
    async getCategories() {
        if (this.useMockApi) {
            await this.mockDelay();
            
            const pizzaCategories = [...new Set(pizzasData.map(p => p.category))];
            const beverageCategories = [...new Set(beveragesData.map(b => b.category))];
            
            return this.createMockResponse({
                categories: {
                    pizzas: pizzaCategories,
                    beverages: beverageCategories,
                    all: [...pizzaCategories, ...beverageCategories]
                }
            });
        }
        
        // Real API call
        return await this.get(`${this.endpoint}/categories`);
    }

    // Get popular products
    async getPopularProducts(limit = 6) {
        if (this.useMockApi) {
            await this.mockDelay();
            
            const popularPizzas = pizzasData
                .filter(p => p.popular)
                .sort((a, b) => b.rating - a.rating)
                .slice(0, Math.ceil(limit * 0.8)); // 80% pizzas
            
            const popularBeverages = beveragesData
                .slice(0, Math.floor(limit * 0.2)); // 20% beverages
            
            return this.createMockResponse({
                products: [...popularPizzas, ...popularBeverages].slice(0, limit),
                total: limit
            });
        }
        
        // Real API call
        return await this.get(`${this.endpoint}/popular`, { limit });
    }

    // Search products
    async searchProducts(query, filters = {}) {
        if (this.useMockApi) {
            await this.mockDelay();
            
            const searchLower = query.toLowerCase();
            
            const matchingPizzas = pizzasData.filter(pizza =>
                pizza.name.toLowerCase().includes(searchLower) ||
                pizza.description.toLowerCase().includes(searchLower) ||
                pizza.ingredients.some(ingredient => 
                    ingredient.toLowerCase().includes(searchLower)
                )
            );
            
            const matchingBeverages = beveragesData.filter(beverage =>
                beverage.name.toLowerCase().includes(searchLower) ||
                beverage.description.toLowerCase().includes(searchLower)
            );
            
            return this.createMockResponse({
                results: {
                    pizzas: matchingPizzas,
                    beverages: matchingBeverages,
                    total: matchingPizzas.length + matchingBeverages.length
                },
                query: query,
                filters: filters
            });
        }
        
        // Real API call
        return await this.get(`${this.endpoint}/search`, { q: query, ...filters });
    }

    // Check product availability
    async checkAvailability(productId, quantity = 1) {
        if (this.useMockApi) {
            await this.mockDelay();
            
            const product = await this.getProduct(productId);
            if (!product.success) {
                return product;
            }
            
            const isAvailable = product.data.product.available;
            
            return this.createMockResponse({
                available: isAvailable,
                maxQuantity: isAvailable ? 10 : 0, // Mock stock level
                productId: productId,
                requestedQuantity: quantity
            });
        }
        
        // Real API call
        return await this.get(`${this.endpoint}/${productId}/availability`, { quantity });
    }

    // Batch check availability for multiple products (for cart validation)
    async checkMultipleAvailability(items) {
        if (this.useMockApi) {
            await this.mockDelay();
            
            const results = [];
            
            for (const item of items) {
                const availabilityCheck = await this.checkAvailability(item.productId, item.quantity);
                results.push({
                    productId: item.productId,
                    requested: item.quantity,
                    available: availabilityCheck.data.available,
                    maxQuantity: availabilityCheck.data.maxQuantity
                });
            }
            
            const allAvailable = results.every(result => result.available);
            
            return this.createMockResponse({
                allAvailable: allAvailable,
                items: results,
                unavailableCount: results.filter(r => !r.available).length
            });
        }
        
        // Real API call
        return await this.post(`${this.endpoint}/availability/batch`, { items });
    }
}

// Export singleton instance
export default new ProductsApiService();