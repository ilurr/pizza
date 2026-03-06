import { BaseApiService } from './ApiClient.js';
import { getSupabaseClient } from '@/services/supabase/client.js';

export class ProductsApiService extends BaseApiService {
    constructor() {
        super();
        this.endpoint = '/products';
    }

    async getPizzasFromSupabase(filters = {}) {
        const supabase = getSupabaseClient();
        if (!supabase) {
            return this.createMockError('Supabase not configured', 500);
        }

        let query = supabase.from('pizzas').select('*').order('name', { ascending: true });

        if (filters.category) query = query.ilike('category', filters.category);
        if (filters.available !== undefined) query = query.eq('available', filters.available);
        if (filters.popular) query = query.eq('popular', true);
        if (filters.maxPrice) query = query.lte('price', filters.maxPrice);

        // Search: simple & reliable for small datasets → filter client-side
        const { data: rows, error } = await query;
        if (error) {
            return this.createMockError(error.message || 'Failed to fetch pizzas', 500);
        }

        let pizzas = rows || [];
        if (filters.search) {
            const s = String(filters.search).toLowerCase();
            pizzas = pizzas.filter((p) => {
                const ingredients = Array.isArray(p.ingredients) ? p.ingredients : [];
                return (
                    String(p.name || '')
                        .toLowerCase()
                        .includes(s) ||
                    String(p.description || '')
                        .toLowerCase()
                        .includes(s) ||
                    ingredients.some((i) => String(i).toLowerCase().includes(s))
                );
            });
        }

        // Map columns back to the UI shape (keep same as pizzas.json)
        const mapped = pizzas.map((p) => ({
            id: p.id,
            name: p.name,
            description: p.description,
            category: p.category,
            price: p.price,
            image: p.image,
            ingredients: p.ingredients || [],
            sizes: p.sizes || [],
            available: p.available,
            popular: p.popular,
            rating: p.rating,
            cookingTime: p.cooking_time
        }));

        return this.createMockResponse({ pizzas: mapped, total: mapped.length, filters });
    }

    async getBeveragesFromSupabase(filters = {}) {
        const supabase = getSupabaseClient();
        if (!supabase) {
            return this.createMockError('Supabase not configured', 500);
        }

        let query = supabase.from('beverages').select('*').order('name', { ascending: true });

        if (filters.category) query = query.ilike('category', filters.category);
        if (filters.type) query = query.eq('type', filters.type);
        if (filters.available !== undefined) query = query.eq('available', filters.available);
        if (filters.maxPrice) query = query.lte('price', filters.maxPrice);

        const { data: rows, error } = await query;
        if (error) {
            return this.createMockError(error.message || 'Failed to fetch beverages', 500);
        }

        const mapped = (rows || []).map((b) => ({
            id: b.id,
            name: b.name,
            description: b.description,
            category: b.category,
            price: b.price,
            image: b.image,
            sizes: b.sizes || [],
            available: b.available,
            type: b.type
        }));

        return this.createMockResponse({ beverages: mapped, total: mapped.length, filters });
    }

    // Get all pizzas with optional filtering
    async getPizzas(filters = {}) {
        if (this.dataSource === 'supabase') {
            return await this.getPizzasFromSupabase(filters);
        }
        
        // Real API call
        return await this.get(`${this.endpoint}/pizzas`, filters);
    }

    // Get all beverages with optional filtering
    async getBeverages(filters = {}) {
        if (this.dataSource === 'supabase') {
            return await this.getBeveragesFromSupabase(filters);
        }
        
        // Real API call
        return await this.get(`${this.endpoint}/beverages`, filters);
    }

    // Get combined menu (pizzas + beverages)
    async getMenu(filters = {}) {
        if (this.dataSource === 'supabase') {
            const [pizzasResponse, beveragesResponse] = await Promise.all([this.getPizzasFromSupabase(filters), this.getBeveragesFromSupabase(filters)]);
            if (pizzasResponse.success && beveragesResponse.success) {
                return this.createMockResponse({
                    pizzas: pizzasResponse.data.pizzas,
                    beverages: beveragesResponse.data.beverages,
                    categories: await this.getCategories(),
                    total: pizzasResponse.data.total + beveragesResponse.data.total
                });
            }
            return this.createMockError('Failed to load menu');
        }
        if (this.useMockApi) {
            const [pizzasResponse, beveragesResponse] = await Promise.all([this.getPizzas(filters), this.getBeverages(filters)]);
            
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
        if (this.dataSource === 'supabase') {
            const [pizzaRes, beverageRes] = await Promise.all([this.getPizzasFromSupabase({}), this.getBeveragesFromSupabase({})]);
            if (!pizzaRes.success || !beverageRes.success) {
                return this.createMockError('Failed to load products', 500);
            }
            const pizza = (pizzaRes.data.pizzas || []).find((p) => p.id === productId);
            if (pizza) return this.createMockResponse({ product: pizza, type: 'pizza' });
            const beverage = (beverageRes.data.beverages || []).find((b) => b.id === productId);
            if (beverage) return this.createMockResponse({ product: beverage, type: 'beverage' });
            return this.createMockError('Product not found', 404);
        }
        
        // Real API call
        return await this.get(`${this.endpoint}/${productId}`);
    }

    // Get product categories
    async getCategories() {
        if (this.dataSource === 'supabase') {
            const [pizzasRes, beveragesRes] = await Promise.all([this.getPizzasFromSupabase({}), this.getBeveragesFromSupabase({})]);
            if (!pizzasRes.success || !beveragesRes.success) {
                return this.createMockError('Failed to load categories', 500);
            }
            const pizzaCategories = [...new Set((pizzasRes.data.pizzas || []).map((p) => p.category).filter(Boolean))];
            const beverageCategories = [...new Set((beveragesRes.data.beverages || []).map((b) => b.category).filter(Boolean))];
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
        if (this.dataSource === 'supabase') {
            const pizzasRes = await this.getPizzasFromSupabase({ popular: true });
            const beveragesRes = await this.getBeveragesFromSupabase({});
            if (!pizzasRes.success || !beveragesRes.success) {
                return this.createMockError('Failed to load popular products', 500);
            }
            const popularPizzas = (pizzasRes.data.pizzas || []).sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, Math.ceil(limit * 0.8));
            const popularBeverages = (beveragesRes.data.beverages || []).slice(0, Math.floor(limit * 0.2));
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
        if (this.dataSource === 'supabase') {
            const [pizzasRes, beveragesRes] = await Promise.all([this.getPizzasFromSupabase({ search: query, ...filters }), this.getBeveragesFromSupabase(filters)]);
            if (!pizzasRes.success || !beveragesRes.success) {
                return this.createMockError('Failed to search products', 500);
            }
            const searchLower = String(query).toLowerCase();
            const matchingBeverages = (beveragesRes.data.beverages || []).filter(
                (b) =>
                    String(b.name || '')
                        .toLowerCase()
                        .includes(searchLower) ||
                    String(b.description || '')
                        .toLowerCase()
                        .includes(searchLower)
            );
            return this.createMockResponse({
                results: {
                    pizzas: pizzasRes.data.pizzas || [],
                    beverages: matchingBeverages,
                    total: (pizzasRes.data.pizzas || []).length + matchingBeverages.length
                },
                query,
                filters
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
            
            const allAvailable = results.every((result) => result.available);
            
            return this.createMockResponse({
                allAvailable: allAvailable,
                items: results,
                unavailableCount: results.filter((r) => !r.available).length
            });
        }
        
        // Real API call
        return await this.post(`${this.endpoint}/availability/batch`, { items });
    }
}

// Export singleton instance
export default new ProductsApiService();
