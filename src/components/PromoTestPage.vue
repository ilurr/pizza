<template>
    <div class="p-8">
        <h2 class="text-2xl font-bold mb-6">Promo System Test</h2>
        
        <!-- Test Cart Modal Button -->
        <div class="mb-6">
            <Button 
                label="Open Cart (Test Promo)" 
                @click="showCart = true"
                class="bg-red-500 hover:bg-red-600 border-red-500"
            />
        </div>

        <!-- Add Test Items to Cart -->
        <div class="mb-6">
            <h3 class="text-lg font-semibold mb-4">Add Test Items to Cart</h3>
            <div class="flex gap-2 flex-wrap">
                <Button 
                    label="Add Margherita Pizza" 
                    @click="addTestPizza"
                    outlined
                />
                <Button 
                    label="Add Beverage" 
                    @click="addTestBeverage"
                    outlined
                />
                <Button 
                    label="Clear Cart" 
                    @click="clearCart"
                    severity="secondary"
                    outlined
                />
            </div>
        </div>

        <!-- Cart Summary -->
        <div class="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
            <h3 class="text-lg font-semibold mb-2">Current Cart</h3>
            <p><strong>Items:</strong> {{ cartStore.totalItems }}</p>
            <p><strong>Total:</strong> {{ cartStore.formattedTotalPrice }}</p>
            
            <div v-if="cartStore.items.length > 0" class="mt-2">
                <div v-for="item in cartStore.items" :key="item.id" class="text-sm">
                    {{ item.name }} - {{ item.quantity }}x {{ formatCurrency(item.price) }}
                </div>
            </div>
        </div>

        <!-- Test Promo API Directly -->
        <div class="mt-8">
            <h3 class="text-lg font-semibold mb-4">Test Promo API</h3>
            <div class="space-y-4">
                <Button 
                    label="Load Available Promos" 
                    @click="testLoadPromos"
                    :loading="loading"
                />
                
                <div class="flex gap-2">
                    <InputText 
                        v-model="testCode" 
                        placeholder="Enter promo code to test"
                        class="flex-1"
                    />
                    <Button 
                        label="Validate Code" 
                        @click="testValidateCode"
                        :loading="validating"
                    />
                </div>
            </div>
            
            <div v-if="promoResults.length > 0" class="mt-4">
                <h4 class="font-semibold mb-2">Available Promos:</h4>
                <div class="space-y-2">
                    <div 
                        v-for="promo in promoResults" 
                        :key="promo.id"
                        class="p-2 border rounded bg-white dark:bg-gray-700"
                    >
                        <div class="font-medium">{{ promo.title }}</div>
                        <div class="text-sm text-gray-600 dark:text-gray-400">{{ promo.code }} - {{ promo.description }}</div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Cart Modal -->
    <CartModal 
        :visible="showCart"
        @update:visible="showCart = $event"
    />
</template>

<script setup>
import { ref } from 'vue';
import { useCartStore } from '@/stores/cartStore.js';
import { useToast } from 'primevue/usetoast';
import CartModal from '@/components/CartModal.vue';
import { promos } from '@/services/api';

const cartStore = useCartStore();
const toast = useToast();

// State
const showCart = ref(false);
const loading = ref(false);
const validating = ref(false);
const testCode = ref('WELCOME20');
const promoResults = ref([]);

// Format currency helper
const formatCurrency = (amount) => {
    const formatted = new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(amount);
    return formatted.replace(/\s/g, ''); // Remove spaces
};

// Test methods
const addTestPizza = () => {
    const testPizza = {
        id: 'pizza_test_001',
        name: 'Test Margherita Pizza',
        price: 55000,
        image: null,
        description: 'Test pizza for promo functionality',
        category: 'Classic Pizza'
    };
    
    cartStore.addToCart(testPizza, 1);
    
    toast.add({
        severity: 'success',
        summary: 'Added to Cart',
        detail: 'Test pizza added successfully',
        life: 3000
    });
};

const addTestBeverage = () => {
    const testBeverage = {
        id: 'beverage_test_001', 
        name: 'Test Coca Cola',
        price: 12000,
        image: null,
        description: 'Test beverage for combo promo',
        category: 'Soft Drinks'
    };
    
    cartStore.addToCart(testBeverage, 2);
    
    toast.add({
        severity: 'success',
        summary: 'Added to Cart',
        detail: 'Test beverage added successfully',
        life: 3000
    });
};

const clearCart = () => {
    cartStore.clearCart();
    
    toast.add({
        severity: 'info',
        summary: 'Cart Cleared',
        detail: 'All items removed from cart',
        life: 3000
    });
};

const testLoadPromos = async () => {
    loading.value = true;
    
    try {
        const response = await promos.getAvailablePromos('customer_001', {
            orderAmount: cartStore.totalPrice,
            categories: ['Classic Pizza', 'Soft Drinks']
        });
        
        if (response.success) {
            promoResults.value = response.data.promos;
            toast.add({
                severity: 'success',
                summary: 'Promos Loaded',
                detail: `Found ${response.data.promos.length} available promos`,
                life: 3000
            });
        } else {
            toast.add({
                severity: 'error',
                summary: 'Error',
                detail: response.error.message,
                life: 3000
            });
        }
    } catch (error) {
        toast.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to load promos',
            life: 3000
        });
    } finally {
        loading.value = false;
    }
};

const testValidateCode = async () => {
    if (!testCode.value.trim()) {
        toast.add({
            severity: 'warn',
            summary: 'Invalid Input',
            detail: 'Please enter a promo code',
            life: 3000
        });
        return;
    }
    
    validating.value = true;
    
    try {
        const response = await promos.validatePromoCode(testCode.value, {
            userId: 'customer_001',
            orderAmount: cartStore.totalPrice,
            categories: ['Classic Pizza', 'Soft Drinks']
        });
        
        if (response.success) {
            toast.add({
                severity: 'success',
                summary: 'Valid Promo!',
                detail: `${response.data.promo.title} - Discount: ${response.data.discount.formattedAmount}`,
                life: 5000
            });
        } else {
            toast.add({
                severity: 'error',
                summary: 'Invalid Promo',
                detail: response.error.message,
                life: 3000
            });
        }
    } catch (error) {
        toast.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to validate promo code',
            life: 3000
        });
    } finally {
        validating.value = false;
    }
};
</script>