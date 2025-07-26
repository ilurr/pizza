<script setup>
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, ref } from 'vue';

const toast = useToast();

// Available drivers for exchange
const nearbyDrivers = ref([
    {
        id: 'driver_002',
        name: 'Cak Gilang',
        avatar: 'https://voyee.id/assets/foto_seller/2024_06_17_18_28_06_1718623686_35496cf2d62376ca0ef0.jpg',
        distance: 1.2,
        rating: 4.8,
        isOnline: true,
        stock: [
            { id: 'cheese', name: 'Mozzarella Cheese', available: 5, unit: 'kg' },
            { id: 'pepperoni', name: 'Pepperoni', available: 3, unit: 'kg' },
            { id: 'mushrooms', name: 'Mushrooms', available: 2, unit: 'kg' }
        ]
    },
    {
        id: 'driver_003',
        name: 'Cak Bram',
        avatar: 'https://voyee.id/assets/foto_seller/2024_06_17_18_27_00_1718623620_0961d218aa38beb0aa77.jpg',
        distance: 2.8,
        rating: 4.9,
        isOnline: true,
        stock: [
            { id: 'flour', name: 'Pizza Flour', available: 8, unit: 'kg' },
            { id: 'tomato_sauce', name: 'Tomato Sauce', available: 6, unit: 'liters' },
            { id: 'olive_oil', name: 'Olive Oil', available: 3, unit: 'liters' }
        ]
    },
    {
        id: 'driver_004',
        name: 'Pak Joko',
        avatar: 'https://voyee.id/assets/foto_seller/2024_06_17_18_28_06_1718623686_35496cf2d62376ca0ef0.jpg',
        distance: 4.1,
        rating: 4.7,
        isOnline: false,
        stock: [
            { id: 'gas', name: 'Cooking Gas', available: 2, unit: 'tanks' },
            { id: 'cheese', name: 'Mozzarella Cheese', available: 4, unit: 'kg' }
        ]
    }
]);

// Exchange requests
const exchangeRequests = ref([
    {
        id: 'req_001',
        from: 'Cak Gilang',
        fromAvatar: 'https://voyee.id/assets/foto_seller/2024_06_17_18_28_06_1718623686_35496cf2d62376ca0ef0.jpg',
        requestedItem: 'Pizza Flour',
        requestedQuantity: 3,
        requestedUnit: 'kg',
        offeredItem: 'Mozzarella Cheese',
        offeredQuantity: 2,
        offeredUnit: 'kg',
        status: 'pending',
        createdAt: new Date(Date.now() - 1800000).toISOString(),
        meetingPoint: 'Jl. Diponegoro (Midpoint)',
        estimatedTime: '15 mins'
    },
    {
        id: 'req_002',
        to: 'Cak Bram',
        toAvatar: 'https://voyee.id/assets/foto_seller/2024_06_17_18_27_00_1718623620_0961d218aa38beb0aa77.jpg',
        requestedItem: 'Tomato Sauce',
        requestedQuantity: 2,
        requestedUnit: 'liters',
        offeredItem: 'Pepperoni',
        offeredQuantity: 1,
        offeredUnit: 'kg',
        status: 'sent',
        createdAt: new Date(Date.now() - 3600000).toISOString(),
        meetingPoint: 'Jl. Basuki Rahmat (Midpoint)',
        estimatedTime: '20 mins'
    }
]);

// My stock for offering
const myStock = ref([
    { id: 'flour', name: 'Pizza Flour', available: 15, unit: 'kg' },
    { id: 'cheese', name: 'Mozzarella Cheese', available: 8, unit: 'kg' },
    { id: 'tomato_sauce', name: 'Tomato Sauce', available: 12, unit: 'liters' },
    { id: 'pepperoni', name: 'Pepperoni', available: 3, unit: 'kg' },
    { id: 'mushrooms', name: 'Mushrooms', available: 2, unit: 'kg' },
    { id: 'olive_oil', name: 'Olive Oil', available: 5, unit: 'liters' }
]);

// Dialog states
const exchangeDialog = ref(false);
const selectedDriver = ref(null);
const selectedDriverItem = ref(null);
const requestedQuantity = ref(1);
const selectedMyItem = ref(null);
const offeredQuantity = ref(1);
const selectedTab = ref(0);

// Computed
const onlineDrivers = computed(() => {
    return nearbyDrivers.value.filter(driver => driver.isOnline);
});

const pendingRequests = computed(() => {
    return exchangeRequests.value.filter(req => req.status === 'pending');
});

const sentRequests = computed(() => {
    return exchangeRequests.value.filter(req => req.status === 'sent');
});

// Methods
const openExchangeDialog = (driver, item) => {
    selectedDriver.value = driver;
    selectedDriverItem.value = item;
    requestedQuantity.value = 1;
    selectedMyItem.value = null;
    offeredQuantity.value = 1;
    exchangeDialog.value = true;
};

const submitExchangeRequest = () => {
    if (!selectedMyItem.value || offeredQuantity.value <= 0 || requestedQuantity.value <= 0) {
        toast.add({
            severity: 'warn',
            summary: 'Invalid Request',
            detail: 'Please select items and quantities',
            life: 3000
        });
        return;
    }

    const newRequest = {
        id: `req_${Date.now()}`,
        to: selectedDriver.value.name,
        toAvatar: selectedDriver.value.avatar,
        requestedItem: selectedDriverItem.value.name,
        requestedQuantity: requestedQuantity.value,
        requestedUnit: selectedDriverItem.value.unit,
        offeredItem: selectedMyItem.value.name,
        offeredQuantity: offeredQuantity.value,
        offeredUnit: selectedMyItem.value.unit,
        status: 'sent',
        createdAt: new Date().toISOString(),
        meetingPoint: 'Auto-generated midpoint',
        estimatedTime: Math.ceil(selectedDriver.value.distance * 2) + ' mins'
    };

    exchangeRequests.value.push(newRequest);
    
    toast.add({
        severity: 'success',
        summary: 'Request Sent',
        detail: `Exchange request sent to ${selectedDriver.value.name}`,
        life: 3000
    });

    exchangeDialog.value = false;
};

const acceptRequest = (requestId) => {
    const request = exchangeRequests.value.find(req => req.id === requestId);
    if (request) {
        request.status = 'accepted';
        toast.add({
            severity: 'success',
            summary: 'Request Accepted',
            detail: 'Exchange meeting arranged',
            life: 3000
        });
    }
};

const rejectRequest = (requestId) => {
    const request = exchangeRequests.value.find(req => req.id === requestId);
    if (request) {
        request.status = 'rejected';
        toast.add({
            severity: 'info',
            summary: 'Request Rejected',
            detail: 'Exchange request declined',
            life: 3000
        });
    }
};

const formatTime = (dateString) => {
    return new Date(dateString).toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit'
    });
};

// Lifecycle
onMounted(() => {
    // Simulate loading nearby drivers
});
</script>

<template>
    <div class="grid">
        <!-- Header -->
        <div class="col-12">
            <div class="card">
                <h3>Stock Exchange</h3>
                <p class="text-600">Trade ingredients with nearby drivers</p>
            </div>
        </div>

        <!-- Exchange Tabs -->
        <div class="col-12">
            <div class="card">
                <TabView v-model:activeIndex="selectedTab">
                    <TabPanel header="Browse Drivers">
                        <template #header>
                            <div class="flex align-items-center gap-2">
                                <i class="pi pi-users"></i>
                                <span>Browse Drivers</span>
                                <Badge :value="onlineDrivers.length" severity="info" />
                            </div>
                        </template>

                        <div v-if="onlineDrivers.length === 0" class="text-center py-6 text-600">
                            <i class="pi pi-users text-4xl mb-3 block"></i>
                            <p class="text-lg mb-2">No drivers online nearby</p>
                            <p class="text-sm">Check back later for available exchanges</p>
                        </div>

                        <div v-else class="grid">
                            <div v-for="driver in onlineDrivers" :key="driver.id" class="col-12 lg:col-6">
                                <div class="card bg-blue-50 border-left-3 border-blue-500">
                                    <!-- Driver Header -->
                                    <div class="flex align-items-center justify-content-between mb-4">
                                        <div class="flex align-items-center gap-3">
                                            <Avatar :image="driver.avatar" size="large" shape="circle" />
                                            <div>
                                                <div class="font-semibold text-lg">{{ driver.name }}</div>
                                                <div class="flex align-items-center gap-2 text-sm text-600">
                                                    <i class="pi pi-map-marker"></i>
                                                    <span>{{ driver.distance }}km away</span>
                                                    <i class="pi pi-star-fill text-yellow-500 ml-2"></i>
                                                    <span>{{ driver.rating }}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <Tag value="Online" severity="success" />
                                    </div>

                                    <!-- Available Stock -->
                                    <div class="mb-4">
                                        <h6 class="text-sm font-medium text-700 mb-3">Available for Exchange:</h6>
                                        <div class="grid">
                                            <div v-for="item in driver.stock" :key="item.id" class="col-12">
                                                <div class="flex align-items-center justify-content-between p-2 bg-white border-round">
                                                    <div>
                                                        <div class="font-medium">{{ item.name }}</div>
                                                        <small class="text-600">{{ item.available }} {{ item.unit }} available</small>
                                                    </div>
                                                    <Button 
                                                        label="Request" 
                                                        icon="pi pi-arrow-right"
                                                        @click="openExchangeDialog(driver, item)"
                                                        size="small"
                                                        outlined
                                                        severity="info"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </TabPanel>

                    <TabPanel header="Pending Requests">
                        <template #header>
                            <div class="flex align-items-center gap-2">
                                <i class="pi pi-clock"></i>
                                <span>Pending Requests</span>
                                <Badge v-if="pendingRequests.length > 0" 
                                       :value="pendingRequests.length" 
                                       severity="warning" />
                            </div>
                        </template>

                        <div v-if="pendingRequests.length === 0" class="text-center py-6 text-600">
                            <i class="pi pi-inbox text-4xl mb-3 block"></i>
                            <p class="text-lg mb-2">No pending requests</p>
                            <p class="text-sm">Incoming exchange requests will appear here</p>
                        </div>

                        <div v-else class="grid">
                            <div v-for="request in pendingRequests" :key="request.id" class="col-12 lg:col-6">
                                <div class="card bg-orange-50 border-left-3 border-orange-500">
                                    <div class="flex align-items-center gap-3 mb-4">
                                        <Avatar :image="request.fromAvatar" size="large" shape="circle" />
                                        <div>
                                            <div class="font-semibold text-lg">{{ request.from }}</div>
                                            <small class="text-600">{{ formatTime(request.createdAt) }}</small>
                                        </div>
                                    </div>

                                    <div class="mb-4">
                                        <div class="grid">
                                            <div class="col-6">
                                                <div class="text-center p-3 bg-white border-round">
                                                    <div class="text-sm text-600 mb-1">They Want:</div>
                                                    <div class="font-semibold">{{ request.requestedItem }}</div>
                                                    <div class="text-sm">{{ request.requestedQuantity }} {{ request.requestedUnit }}</div>
                                                </div>
                                            </div>
                                            <div class="col-6">
                                                <div class="text-center p-3 bg-white border-round">
                                                    <div class="text-sm text-600 mb-1">They Offer:</div>
                                                    <div class="font-semibold">{{ request.offeredItem }}</div>
                                                    <div class="text-sm">{{ request.offeredQuantity }} {{ request.offeredUnit }}</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div class="mb-4 p-2 bg-white border-round">
                                        <div class="text-sm">
                                            <i class="pi pi-map-marker text-blue-500 mr-2"></i>
                                            Meeting point: {{ request.meetingPoint }}
                                        </div>
                                        <div class="text-sm mt-1">
                                            <i class="pi pi-clock text-blue-500 mr-2"></i>
                                            Estimated time: {{ request.estimatedTime }}
                                        </div>
                                    </div>

                                    <div class="flex gap-2">
                                        <Button 
                                            label="Accept" 
                                            icon="pi pi-check"
                                            @click="acceptRequest(request.id)"
                                            severity="success"
                                            class="flex-1"
                                        />
                                        <Button 
                                            label="Reject" 
                                            icon="pi pi-times"
                                            @click="rejectRequest(request.id)"
                                            severity="danger"
                                            outlined
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </TabPanel>

                    <TabPanel header="My Requests">
                        <template #header>
                            <div class="flex align-items-center gap-2">
                                <i class="pi pi-send"></i>
                                <span>My Requests</span>
                                <Badge v-if="sentRequests.length > 0" 
                                       :value="sentRequests.length" 
                                       severity="info" />
                            </div>
                        </template>

                        <div v-if="sentRequests.length === 0" class="text-center py-6 text-600">
                            <i class="pi pi-send text-4xl mb-3 block"></i>
                            <p class="text-lg mb-2">No sent requests</p>
                            <p class="text-sm">Your outgoing exchange requests will appear here</p>
                        </div>

                        <DataTable v-else :value="sentRequests" responsiveLayout="scroll" class="p-datatable-sm">
                            <Column header="To" style="min-width: 10rem">
                                <template #body="{ data }">
                                    <div class="flex align-items-center gap-2">
                                        <Avatar :image="data.toAvatar" size="normal" shape="circle" />
                                        <span class="font-medium">{{ data.to }}</span>
                                    </div>
                                </template>
                            </Column>
                            <Column header="Exchange" style="min-width: 15rem">
                                <template #body="{ data }">
                                    <div class="text-sm">
                                        <div class="mb-1">
                                            <span class="text-600">Want:</span> {{ data.requestedQuantity }} {{ data.requestedUnit }} {{ data.requestedItem }}
                                        </div>
                                        <div>
                                            <span class="text-600">Offer:</span> {{ data.offeredQuantity }} {{ data.offeredUnit }} {{ data.offeredItem }}
                                        </div>
                                    </div>
                                </template>
                            </Column>
                            <Column header="Status" style="min-width: 8rem">
                                <template #body="{ data }">
                                    <Tag :value="data.status" :severity="data.status === 'sent' ? 'info' : 'success'" />
                                </template>
                            </Column>
                            <Column header="Time" style="min-width: 8rem">
                                <template #body="{ data }">
                                    <span class="text-600">{{ formatTime(data.createdAt) }}</span>
                                </template>
                            </Column>
                            <Column header="Meeting" style="min-width: 10rem">
                                <template #body="{ data }">
                                    <div class="text-sm">
                                        <div>{{ data.meetingPoint }}</div>
                                        <small class="text-600">ETA: {{ data.estimatedTime }}</small>
                                    </div>
                                </template>
                            </Column>
                        </DataTable>
                    </TabPanel>
                </TabView>
            </div>
        </div>
    </div>

    <!-- Exchange Request Dialog -->
    <Dialog v-model:visible="exchangeDialog" header="Create Exchange Request" modal :style="{ width: '500px' }">
        <div v-if="selectedDriver && selectedDriverItem" class="flex flex-column gap-4">
            <!-- Request Summary -->
            <div class="p-3 bg-blue-50 border-round">
                <div class="flex align-items-center gap-3 mb-3">
                    <Avatar :image="selectedDriver.avatar" size="normal" shape="circle" />
                    <div>
                        <div class="font-semibold">{{ selectedDriver.name }}</div>
                        <small class="text-600">{{ selectedDriver.distance }}km away</small>
                    </div>
                </div>
                <div class="text-sm">
                    <span class="text-600">Requesting:</span> {{ selectedDriverItem.name }} ({{ selectedDriverItem.available }} {{ selectedDriverItem.unit }} available)
                </div>
            </div>

            <!-- Request Details -->
            <div>
                <label class="block text-900 font-medium mb-2">How much do you need?</label>
                <div class="flex align-items-center gap-2">
                    <InputNumber 
                        v-model="requestedQuantity" 
                        :min="1" 
                        :max="selectedDriverItem.available"
                        fluid
                    />
                    <span class="text-600">{{ selectedDriverItem.unit }}</span>
                </div>
            </div>

            <!-- Offer -->
            <div>
                <label class="block text-900 font-medium mb-2">What will you offer in return?</label>
                <Dropdown 
                    v-model="selectedMyItem" 
                    :options="myStock" 
                    optionLabel="name" 
                    placeholder="Select item to offer"
                    fluid
                >
                    <template #option="{ option }">
                        <div class="flex justify-content-between align-items-center w-full">
                            <span>{{ option.name }}</span>
                            <small class="text-600">{{ option.available }} {{ option.unit }}</small>
                        </div>
                    </template>
                </Dropdown>
            </div>

            <div v-if="selectedMyItem">
                <label class="block text-900 font-medium mb-2">Offer quantity</label>
                <div class="flex align-items-center gap-2">
                    <InputNumber 
                        v-model="offeredQuantity" 
                        :min="1" 
                        :max="selectedMyItem.available"
                        fluid
                    />
                    <span class="text-600">{{ selectedMyItem.unit }}</span>
                </div>
            </div>

            <!-- Meeting Point Preview -->
            <div v-if="selectedMyItem" class="p-3 bg-green-50 border-round">
                <div class="text-sm text-600 mb-2">Exchange Summary:</div>
                <div class="font-medium">
                    You give {{ offeredQuantity }} {{ selectedMyItem.unit }} {{ selectedMyItem.name }}
                </div>
                <div class="font-medium">
                    You get {{ requestedQuantity }} {{ selectedDriverItem.unit }} {{ selectedDriverItem.name }}
                </div>
                <div class="text-sm text-600 mt-2">
                    Meeting point will be calculated automatically
                </div>
            </div>
        </div>
        
        <template #footer>
            <Button label="Cancel" outlined @click="exchangeDialog = false" />
            <Button label="Send Request" @click="submitExchangeRequest" />
        </template>
    </Dialog>

</template>

<style scoped>
.border-left-3 {
    border-left: 3px solid;
}
</style>