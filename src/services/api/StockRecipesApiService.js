import { BaseApiService } from './ApiClient.js';
import { getSupabaseClient } from '@/services/supabase/client.js';

/**
 * Admin stock + recipe (BOM) management:
 * - stock_products: master list (base/topping)
 * - product_stock_recipe: mapping (product_id -> stock_product_id + quantity per 1 portion)
 */
export class StockRecipesApiService extends BaseApiService {
    constructor() {
        super();
        this.endpoint = '/stock-recipes';
    }

    // Master list: stock_products
    async getStockProducts(filters = {}) {
        if (this.dataSource === 'supabase') {
            const supabase = getSupabaseClient();
            if (!supabase) return this.createMockError('Supabase not configured', 500);

            let q = supabase.from('stock_products').select('*');
            if (filters.type) q = q.eq('type', filters.type);

            q = q.order('type', { ascending: true }).order('name', { ascending: true });

            const { data, error } = await q;
            if (error) return this.createMockError(error.message || 'Failed to fetch stock products', error.code || 500);
            return this.createMockResponse({ products: data || [] });
        }

        if (this.useMockApi) {
            await this.mockDelay();
            return this.createMockResponse({ products: [] });
        }

        return await this.get(`${this.endpoint}/products`, filters);
    }

    async upsertStockProduct(product) {
        if (this.dataSource === 'supabase') {
            const supabase = getSupabaseClient();
            if (!supabase) return this.createMockError('Supabase not configured', 500);

            const payload = {
                name: (product?.name || '').trim(),
                type: product?.type,
                unit: (product?.unit || 'pcs').trim()
            };

            if (!payload.name) return this.createMockError('Name is required', 400);
            if (!['base', 'topping'].includes(payload.type)) return this.createMockError('Type must be base or topping', 400);

            const { data, error } = product?.id ? await supabase.from('stock_products').update(payload).eq('id', product.id).select().single() : await supabase.from('stock_products').insert(payload).select().single();

            if (error) return this.createMockError(error.message || 'Failed to save stock product', error.code || 500);
            return this.createMockResponse({ product: data, message: 'Saved' });
        }

        if (this.useMockApi) {
            await this.mockDelay();
            return this.createMockResponse({ product: product || {}, message: 'Saved' });
        }

        return await this.post(`${this.endpoint}/products`, product);
    }

    async deleteStockProduct(stockProductId) {
        if (this.dataSource === 'supabase') {
            const supabase = getSupabaseClient();
            if (!supabase) return this.createMockError('Supabase not configured', 500);
            const { error } = await supabase.from('stock_products').delete().eq('id', stockProductId);
            if (error) return this.createMockError(error.message || 'Failed to delete stock product', error.code || 500);
            return this.createMockResponse({ message: 'Deleted' });
        }

        if (this.useMockApi) {
            await this.mockDelay();
            return this.createMockResponse({ message: 'Deleted' });
        }

        return await this.delete(`${this.endpoint}/products/${stockProductId}`);
    }

    // BOM: product_stock_recipe
    async getProductStockRecipe(productId) {
        if (this.dataSource === 'supabase') {
            const supabase = getSupabaseClient();
            if (!supabase) return this.createMockError('Supabase not configured', 500);

            const { data, error } = await supabase.from('product_stock_recipe').select('stock_product_id, quantity, stock_products(id, name, type, unit)').eq('product_id', String(productId));

            if (error) return this.createMockError(error.message || 'Failed to fetch recipe', error.code || 500);

            const lines = (data || []).map((r) => ({
                stockProductId: r.stock_product_id,
                quantity: Number(r.quantity),
                stockProduct: r.stock_products
                    ? {
                          id: r.stock_products.id,
                          name: r.stock_products.name,
                          type: r.stock_products.type,
                          unit: r.stock_products.unit
                      }
                    : null
            }));

            return this.createMockResponse({ lines });
        }

        if (this.useMockApi) {
            await this.mockDelay();
            return this.createMockResponse({ lines: [] });
        }

        return await this.get(`${this.endpoint}/recipes/${productId}`);
    }

    /**
     * MVP: Admin replaces the whole recipe for productId.
     * @param {string} productId
     * @param {Array<{stockProductId: string, quantity: number}>} lines
     */
    async setProductStockRecipe(productId, lines) {
        if (this.dataSource === 'supabase') {
            const supabase = getSupabaseClient();
            if (!supabase) return this.createMockError('Supabase not configured', 500);

            const pid = String(productId);
            const normalized = (Array.isArray(lines) ? lines : [])
                .map((l) => ({
                    stock_product_id: l.stockProductId,
                    quantity: Number(l.quantity)
                }))
                .filter((l) => !!l.stock_product_id && Number.isFinite(l.quantity) && l.quantity > 0);

            const { error: delErr } = await supabase.from('product_stock_recipe').delete().eq('product_id', pid);
            if (delErr) return this.createMockError(delErr.message || 'Failed to delete old recipe', delErr.code || 500);

            if (normalized.length) {
                const { error: insErr } = await supabase.from('product_stock_recipe').insert(
                    normalized.map((l) => ({
                        product_id: pid,
                        stock_product_id: l.stock_product_id,
                        quantity: l.quantity
                    }))
                );
                if (insErr) return this.createMockError(insErr.message || 'Failed to save recipe', insErr.code || 500);
            }

            return this.createMockResponse({ message: 'Recipe saved' });
        }

        if (this.useMockApi) {
            await this.mockDelay();
            return this.createMockResponse({ message: 'Recipe saved' });
        }

        return await this.post(`${this.endpoint}/recipes/${productId}`, { lines });
    }
}

export default new StockRecipesApiService();
