<script setup>
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, ref } from 'vue';

const toast = useToast();

// Stock data
const stockItems = ref([
    {
        id: 'flour',
        name: 'Pizza Flour',
        category: 'Base',
        currentStock: 15,
        maxCapacity: 25,
        unit: 'kg',
        criticalLevel: 5,
        estimatedUsage: 2.5, // per pizza
        cost: 15000
    },
    {
        id: 'cheese',
        name: 'Mozzarella Cheese',
        category: 'Toppings',
        currentStock: 8,
        maxCapacity: 15,
        unit: 'kg',
        criticalLevel: 3,
        estimatedUsage: 0.8,
        cost: 85000
    },
    {
        id: 'tomato_sauce',
        name: 'Tomato Sauce',
        category: 'Base',
        currentStock: 12,
        maxCapacity: 20,
        unit: 'liters',
        criticalLevel: 4,
        estimatedUsage: 0.3,
        cost: 25000
    },
    {
        id: 'pepperoni',
        name: 'Pepperoni',
        category: 'Toppings',
        currentStock: 3,
        maxCapacity: 8,
        unit: 'kg',
        criticalLevel: 2,
        estimatedUsage: 0.5,
        cost: 120000
    },
    {
        id: 'mushrooms',
        name: 'Fresh Mushrooms',
        category: 'Toppings',
        currentStock: 2,
        maxCapacity: 6,
        unit: 'kg',
        criticalLevel: 1,
        estimatedUsage: 0.3,
        cost: 45000
    },
    {
        id: 'olive_oil',
        name: 'Olive Oil',
        category: 'Base',
        currentStock: 5,
        maxCapacity: 8,
        unit: 'liters',
        criticalLevel: 2,
        estimatedUsage: 0.1,
        cost: 65000
    },
    {
        id: 'gas',
        name: 'Cooking Gas',
        category: 'Equipment',
        currentStock: 2,
        maxCapacity: 4,
        unit: 'tanks',
        criticalLevel: 1,
        estimatedUsage: 0.1,
        cost: 35000
    }
]);

const selectedItems = ref([]);
const restockDialog = ref(false);
const selectedRestockItem = ref(null);
const restockQuantity = ref(0);

// Computed
const criticalStockItems = computed(() => {
    return stockItems.value.filter(item => item.currentStock <= item.criticalLevel);
});

const stockByCategory = computed(() => {
    const categories = {};
    stockItems.value.forEach(item => {
        if (!categories[item.category]) {
            categories[item.category] = [];
        }
        categories[item.category].push(item);
    });
    return categories;
});

const totalStockValue = computed(() => {
    return stockItems.value.reduce((total, item) => {
        return total + (item.currentStock * item.cost);
    }, 0);
});

const maxPizzasFromStock = computed(() => {
    return Math.min(...stockItems.value.map(item => {
        if (item.category === 'Equipment') return 999;
        return Math.floor(item.currentStock / item.estimatedUsage);
    }));
});

// Methods
const getStockPercentage = (item) => {
    return Math.round((item.currentStock / item.maxCapacity) * 100);
};

const getStockSeverity = (item) => {
    const percentage = getStockPercentage(item);
    if (percentage <= 20) return 'danger';
    if (percentage <= 40) return 'warn';
    return 'success';
};

const openRestockDialog = (item) => {
    selectedRestockItem.value = item;
    restockQuantity.value = item.maxCapacity - item.currentStock;
    restockDialog.value = true;
};

const confirmRestock = () => {
    if (selectedRestockItem.value && restockQuantity.value > 0) {
        const newStock = Math.min(
            selectedRestockItem.value.currentStock + restockQuantity.value,
            selectedRestockItem.value.maxCapacity
        );
        
        selectedRestockItem.value.currentStock = newStock;
        
        toast.add({
            severity: 'success',
            summary: 'Stock Updated',
            detail: `${selectedRestockItem.value.name} restocked to ${newStock} ${selectedRestockItem.value.unit}`,
            life: 3000
        });
        
        restockDialog.value = false;
        selectedRestockItem.value = null;
        restockQuantity.value = 0;
    }
};

const formatCurrency = (amount) => {
    const formatted = new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(amount);
    return formatted.replace(/\s/g, ''); // Remove spaces
};

const updateStock = (item, newQuantity) => {
    if (newQuantity >= 0 && newQuantity <= item.maxCapacity) {
        item.currentStock = newQuantity;
        toast.add({
            severity: 'info',
            summary: 'Stock Updated',
            detail: `${item.name} quantity updated`,
            life: 2000
        });
    }
};

// Lifecycle
onMounted(() => {
    // Simulate getting driver's current stock from API
});
</script>

<template>
    <div class="grid">
        <!-- Stock Overview -->
        <div class="col-12">
            <div class="card">
                <h3>Stock Management</h3>
                <p class="text-600">Manage your mobile kitchen inventory</p>
                
                <div class="grid">
                    <div class="col-12 md:col-3">
                        <div class="card bg-blue-50 border-left-3 border-blue-500">
                            <div class="text-center">
                                <div class="text-2xl font-bold text-blue-600">{{ maxPizzasFromStock }}</div>
                                <div class="text-sm text-600">Pizzas Possible</div>
                            </div>
                        </div>
                    </div>
                    <div class="col-12 md:col-3">
                        <div class="card bg-green-50 border-left-3 border-green-500">
                            <div class="text-center">
                                <div class="text-2xl font-bold text-green-600">{{ formatCurrency(totalStockValue) }}</div>
                                <div class="text-sm text-600">Total Stock Value</div>
                            </div>
                        </div>
                    </div>
                    <div class="col-12 md:col-3">
                        <div class="card bg-orange-50 border-left-3 border-orange-500">
                            <div class="text-center">
                                <div class="text-2xl font-bold text-orange-600">{{ criticalStockItems.length }}</div>
                                <div class="text-sm text-600">Critical Items</div>
                            </div>
                        </div>
                    </div>
                    <div class="col-12 md:col-3">
                        <div class="card bg-purple-50 border-left-3 border-purple-500">
                            <div class="text-center">
                                <div class="text-2xl font-bold text-purple-600">{{ stockItems.length }}</div>
                                <div class="text-sm text-600">Total Items</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Critical Stock Alert -->
        <div class="col-12" v-if="criticalStockItems.length > 0">
            <Message severity="warn" :closable="false">
                <div class="flex align-items-center gap-3">
                    <i class="pi pi-exclamation-triangle text-2xl"></i>
                    <div>
                        <div class="font-medium">Low Stock Alert</div>
                        <div class="text-sm">
                            {{ criticalStockItems.length }} item(s) need restocking: 
                            {{ criticalStockItems.map(item => item.name).join(', ') }}
                        </div>
                    </div>
                </div>
            </Message>
        </div>

        <!-- Stock Items by Category -->
        <div class="col-12" v-for="(items, category) in stockByCategory" :key="category">
            <div class="card">
                <div class="flex align-items-center justify-content-between mb-4">
                    <h5>{{ category }}</h5>
                    <Button label="Restock Category" outlined size="small" />
                </div>
                
                <DataTable :value="items" responsiveLayout="scroll" class="p-datatable-sm">
                    <Column field="name" header="Item" style="min-width: 12rem">
                        <template #body="{ data }">
                            <div class="flex align-items-center gap-2">
                                <div>
                                    <div class="font-medium">{{ data.name }}</div>
                                    <small class="text-600">{{ formatCurrency(data.cost) }}/{{ data.unit }}</small>
                                </div>
                                <Tag v-if="data.currentStock <= data.criticalLevel" 
                                     value="Low" 
                                     severity="danger" 
                                     size="small" />
                            </div>
                        </template>
                    </Column>
                    
                    <Column header="Current Stock" style="min-width: 10rem">
                        <template #body="{ data }">
                            <div class="flex align-items-center gap-2">
                                <InputNumber 
                                    v-model="data.currentStock" 
                                    :min="0" 
                                    :max="data.maxCapacity"
                                    @input="updateStock(data, $event.value)"
                                    size="small"
                                    style="width: 4rem"
                                />
                                <span class="text-sm text-600">{{ data.unit }}</span>
                            </div>
                        </template>
                    </Column>
                    
                    <Column header="Capacity" style="min-width: 8rem">
                        <template #body="{ data }">
                            <div class="text-center">
                                <div class="text-sm font-medium">{{ data.currentStock }} / {{ data.maxCapacity }}</div>
                                <ProgressBar 
                                    :value="getStockPercentage(data)" 
                                    :severity="getStockSeverity(data)"
                                    style="height: 6px"
                                    class="mt-1"
                                />
                            </div>
                        </template>
                    </Column>
                    
                    <Column header="Usage Rate" style="min-width: 8rem">
                        <template #body="{ data }">
                            <div class="text-center text-sm">
                                {{ data.estimatedUsage }} {{ data.unit }}/pizza
                            </div>
                        </template>
                    </Column>
                    
                    <Column header="Value" style="min-width: 8rem">
                        <template #body="{ data }">
                            <div class="text-center font-medium">
                                {{ formatCurrency(data.currentStock * data.cost) }}
                            </div>
                        </template>
                    </Column>
                    
                    <Column header="Actions" style="min-width: 8rem">
                        <template #body="{ data }">
                            <div class="flex gap-1">
                                <Button 
                                    icon="pi pi-plus" 
                                    severity="success"
                                    outlined
                                    size="small"
                                    @click="openRestockDialog(data)"
                                    v-tooltip.top="'Restock'"
                                />
                                <Button 
                                    icon="pi pi-arrow-right-arrow-left" 
                                    severity="info"
                                    outlined
                                    size="small"
                                    v-tooltip.top="'Exchange'"
                                />
                            </div>
                        </template>
                    </Column>
                </DataTable>
            </div>
        </div>
    </div>

    <!-- Restock Dialog -->
    <Dialog v-model:visible="restockDialog" header="Restock Item" modal :style="{ width: '450px' }">
        <div v-if="selectedRestockItem" class="flex flex-column gap-4">
            <div>
                <label class="block text-900 font-medium mb-2">Item</label>
                <div class="text-lg font-semibold">{{ selectedRestockItem.name }}</div>
                <small class="text-600">Current: {{ selectedRestockItem.currentStock }} {{ selectedRestockItem.unit }}</small>
            </div>
            
            <div>
                <label class="block text-900 font-medium mb-2">Restock Quantity</label>
                <InputNumber 
                    v-model="restockQuantity" 
                    :min="1" 
                    :max="selectedRestockItem.maxCapacity - selectedRestockItem.currentStock"
                    fluid
                />
                <small class="text-600">
                    Max capacity: {{ selectedRestockItem.maxCapacity }} {{ selectedRestockItem.unit }}
                </small>
            </div>
            
            <div>
                <label class="block text-900 font-medium mb-2">Cost Estimate</label>
                <div class="text-lg font-semibold text-green-600">
                    {{ formatCurrency(restockQuantity * selectedRestockItem.cost) }}
                </div>
            </div>
        </div>
        
        <template #footer>
            <Button label="Cancel" outlined @click="restockDialog = false" />
            <Button label="Confirm Restock" @click="confirmRestock" />
        </template>
    </Dialog>

</template>

<style scoped>
.border-left-3 {
    border-left: 3px solid;
}
</style>