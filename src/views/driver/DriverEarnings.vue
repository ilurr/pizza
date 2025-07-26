<script setup>
import { computed, onMounted, ref } from 'vue';

// Earnings data
const earnings = ref({
    today: {
        deliveries: 12,
        grossEarnings: 180000,
        commission: 27000, // 15%
        expenses: 35000, // gas, maintenance
        netEarnings: 145000,
        tips: 25000,
        bonus: 15000
    },
    week: {
        deliveries: 78,
        grossEarnings: 1170000,
        commission: 175500,
        expenses: 245000,
        netEarnings: 925000,
        tips: 156000,
        bonus: 75000
    },
    month: {
        deliveries: 312,
        grossEarnings: 4680000,
        commission: 702000,
        expenses: 890000,
        netEarnings: 3790000,
        tips: 624000,
        bonus: 300000
    }
});

const selectedPeriod = ref('today');
const chartData = ref({});
const chartOptions = ref({});

// Recent transactions
const recentTransactions = ref([
    {
        id: 'TXN001',
        type: 'delivery',
        orderId: 'PZ-2024-156',
        amount: 15000,
        customerTip: 5000,
        date: new Date().toISOString(),
        status: 'completed'
    },
    {
        id: 'TXN002',
        type: 'delivery',
        orderId: 'PZ-2024-155',
        amount: 22500,
        customerTip: 0,
        date: new Date(Date.now() - 3600000).toISOString(),
        status: 'completed'
    },
    {
        id: 'TXN003',
        type: 'bonus',
        description: 'Peak hours bonus',
        amount: 15000,
        date: new Date(Date.now() - 7200000).toISOString(),
        status: 'completed'
    },
    {
        id: 'TXN004',
        type: 'expense',
        description: 'Gas refill',
        amount: -25000,
        date: new Date(Date.now() - 10800000).toISOString(),
        status: 'completed'
    }
]);

// Computed
const currentEarnings = computed(() => {
    return earnings.value[selectedPeriod.value];
});

const earningsSummary = computed(() => [
    {
        title: 'Gross Earnings',
        value: currentEarnings.value.grossEarnings,
        icon: 'pi pi-dollar',
        color: 'blue',
        subtitle: `${currentEarnings.value.deliveries} deliveries`
    },
    {
        title: 'Commission (15%)',
        value: currentEarnings.value.commission,
        icon: 'pi pi-percentage',
        color: 'purple',
        subtitle: 'Platform fee'
    },
    {
        title: 'Tips & Bonus',
        value: currentEarnings.value.tips + currentEarnings.value.bonus,
        icon: 'pi pi-star',
        color: 'orange',
        subtitle: 'Extra income'
    },
    {
        title: 'Net Earnings',
        value: currentEarnings.value.netEarnings,
        icon: 'pi pi-wallet',
        color: 'green',
        subtitle: 'After expenses'
    }
]);

// Methods
const formatCurrency = (amount) => {
    const formatted = new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(amount);
    return formatted.replace(/\s/g, ''); // Remove spaces
};

const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
    });
};

const getTransactionIcon = (type) => {
    const icons = {
        'delivery': 'pi pi-truck',
        'bonus': 'pi pi-star',
        'expense': 'pi pi-minus-circle',
        'tip': 'pi pi-heart'
    };
    return icons[type] || 'pi pi-circle';
};

const getTransactionColor = (type) => {
    const colors = {
        'delivery': 'success',
        'bonus': 'warn',
        'expense': 'danger',
        'tip': 'info'
    };
    return colors[type] || 'info';
};

const initChart = () => {
    const documentStyle = getComputedStyle(document.documentElement);

    chartData.value = {
        labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        datasets: [
            {
                label: 'Daily Earnings',
                data: [125000, 145000, 98000, 167000, 189000, 234000, 156000],
                backgroundColor: documentStyle.getPropertyValue('--blue-500'),
                borderColor: documentStyle.getPropertyValue('--blue-700'),
                borderWidth: 2,
                fill: false,
                tension: 0.4
            },
            {
                label: 'Expenses',
                data: [35000, 28000, 42000, 31000, 45000, 38000, 33000],
                backgroundColor: documentStyle.getPropertyValue('--red-500'),
                borderColor: documentStyle.getPropertyValue('--red-700'),
                borderWidth: 2,
                fill: false,
                tension: 0.4
            }
        ]
    };

    chartOptions.value = {
        responsive: true,
        plugins: {
            legend: {
                position: 'top'
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                ticks: {
                    callback: function (value) {
                        return 'Rp' + value.toLocaleString('id-ID');
                    }
                }
            }
        }
    };
};

// Lifecycle
onMounted(() => {
    initChart();
});
</script>

<template>
    <div class="grid">
        <!-- Header with Period Selection -->
        <div class="col-12">
            <div class="card">
                <div class="flex flex-column md:flex-row justify-content-between align-items-center mb-4">
                    <div>
                        <h3>Earnings Dashboard</h3>
                        <p class="text-600 mb-0">Track your income and expenses</p>
                    </div>
                    <SelectButton v-model="selectedPeriod" :options="[
                        { label: 'Today', value: 'today' },
                        { label: 'This Week', value: 'week' },
                        { label: 'This Month', value: 'month' }
                    ]" optionLabel="label" optionValue="value" />
                </div>
            </div>
        </div>

        <!-- Earnings Summary Cards -->
        <div class="col-12 md:col-6 lg:col-3" v-for="summary in earningsSummary" :key="summary.title">
            <div class="card text-center">
                <div class="flex align-items-center justify-content-center mb-3">
                    <i :class="[summary.icon, `text-${summary.color}-500`]" class="text-3xl"></i>
                </div>
                <div class="text-2xl font-bold mb-2" :class="`text-${summary.color}-600`">
                    {{ formatCurrency(summary.value) }}
                </div>
                <div class="text-600 font-medium mb-1">{{ summary.title }}</div>
                <div class="text-500 text-sm">{{ summary.subtitle }}</div>
            </div>
        </div>

        <!-- Earnings Chart -->
        <div class="col-12 lg:col-8">
            <div class="card">
                <h5>Weekly Earnings Trend</h5>
                <Chart type="line" :data="chartData" :options="chartOptions" height="300" />
            </div>
        </div>

        <!-- Performance Metrics -->
        <div class="col-12 lg:col-4">
            <div class="card">
                <h5>Performance Metrics</h5>
                <div class="flex flex-column gap-4">
                    <div class="flex justify-content-between align-items-center">
                        <span class="text-600">Average per Delivery</span>
                        <span class="font-bold">
                            {{ formatCurrency(Math.round(currentEarnings.grossEarnings / currentEarnings.deliveries)) }}
                        </span>
                    </div>
                    <Divider />
                    <div class="flex justify-content-between align-items-center">
                        <span class="text-600">Commission Rate</span>
                        <span class="font-bold">15%</span>
                    </div>
                    <Divider />
                    <div class="flex justify-content-between align-items-center">
                        <span class="text-600">Tip Rate</span>
                        <span class="font-bold">
                            {{ Math.round((currentEarnings.tips / currentEarnings.grossEarnings) * 100) }}%
                        </span>
                    </div>
                    <Divider />
                    <div class="flex justify-content-between align-items-center">
                        <span class="text-600">Profit Margin</span>
                        <span class="font-bold text-green-600">
                            {{ Math.round((currentEarnings.netEarnings / currentEarnings.grossEarnings) * 100) }}%
                        </span>
                    </div>
                </div>
            </div>
        </div>

        <!-- Recent Transactions -->
        <div class="col-12">
            <div class="card">
                <div class="flex justify-content-between align-items-center mb-4">
                    <h5>Recent Transactions</h5>
                    <Button label="View All" outlined size="small" />
                </div>

                <DataTable :value="recentTransactions" responsiveLayout="scroll" class="p-datatable-sm">
                    <Column header="Type" style="min-width: 8rem">
                        <template #body="{ data }">
                            <div class="flex align-items-center gap-2">
                                <i :class="[getTransactionIcon(data.type), `text-${getTransactionColor(data.type) === 'success' ? 'green' : getTransactionColor(data.type) === 'danger' ? 'red' : getTransactionColor(data.type) === 'warn' ? 'orange' : 'blue'}-500`]"></i>
                                <span class="font-medium capitalize">{{ data.type }}</span>
                            </div>
                        </template>
                    </Column>

                    <Column header="Description" style="min-width: 12rem">
                        <template #body="{ data }">
                            <div>
                                <div class="font-medium">
                                    {{ data.orderId || data.description }}
                                </div>
                                <small v-if="data.customerTip > 0" class="text-600">
                                    + {{ formatCurrency(data.customerTip) }} tip
                                </small>
                            </div>
                        </template>
                    </Column>

                    <Column header="Amount" style="min-width: 8rem">
                        <template #body="{ data }">
                            <span class="font-bold" :class="data.amount > 0 ? 'text-green-600' : 'text-red-600'">
                                {{ formatCurrency(data.amount) }}
                            </span>
                        </template>
                    </Column>

                    <Column header="Date" style="min-width: 10rem">
                        <template #body="{ data }">
                            <span class="text-600">{{ formatDate(data.date) }}</span>
                        </template>
                    </Column>

                    <Column header="Status" style="min-width: 8rem">
                        <template #body="{ data }">
                            <Tag :value="data.status" severity="success" />
                        </template>
                    </Column>
                </DataTable>
            </div>
        </div>

        <!-- Expense Breakdown -->
        <div class="col-12 md:col-6">
            <div class="card">
                <h5>Expense Breakdown ({{ selectedPeriod }})</h5>
                <div class="flex flex-column gap-3">
                    <div class="flex justify-content-between align-items-center p-3 bg-red-50 border-round">
                        <div class="flex align-items-center gap-2">
                            <i class="pi pi-car text-red-500"></i>
                            <span>Fuel & Maintenance</span>
                        </div>
                        <span class="font-bold text-red-600">{{ formatCurrency(currentEarnings.expenses * 0.7) }}</span>
                    </div>
                    <div class="flex justify-content-between align-items-center p-3 bg-orange-50 border-round">
                        <div class="flex align-items-center gap-2">
                            <i class="pi pi-box text-orange-500"></i>
                            <span>Ingredient Restocking</span>
                        </div>
                        <span class="font-bold text-orange-600">{{ formatCurrency(currentEarnings.expenses * 0.3)
                            }}</span>
                    </div>
                    <Divider />
                    <div class="flex justify-content-between align-items-center">
                        <span class="font-medium">Total Expenses</span>
                        <span class="font-bold text-900">{{ formatCurrency(currentEarnings.expenses) }}</span>
                    </div>
                </div>
            </div>
        </div>

        <!-- Goals & Targets -->
        <div class="col-12 md:col-6">
            <div class="card">
                <h5>Daily Goals</h5>
                <div class="flex flex-column gap-3">
                    <div>
                        <div class="flex justify-content-between align-items-center mb-2">
                            <span class="text-600">Deliveries Target</span>
                            <span class="font-bold">{{ currentEarnings.deliveries }}/15</span>
                        </div>
                        <ProgressBar :value="(currentEarnings.deliveries / 15) * 100" />
                    </div>
                    <div>
                        <div class="flex justify-content-between align-items-center mb-2">
                            <span class="text-600">Earnings Target</span>
                            <span class="font-bold">{{ formatCurrency(currentEarnings.grossEarnings) }}/{{
                                formatCurrency(200000) }}</span>
                        </div>
                        <ProgressBar :value="(currentEarnings.grossEarnings / 200000) * 100" />
                    </div>
                    <div>
                        <div class="flex justify-content-between align-items-center mb-2">
                            <span class="text-600">Customer Rating</span>
                            <span class="font-bold">4.8/5.0</span>
                        </div>
                        <ProgressBar :value="96" severity="success" />
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.capitalize {
    text-transform: capitalize;
}
</style>