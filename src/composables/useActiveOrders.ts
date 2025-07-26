import { ProductService } from '@/service/ProductService.js';
import { useUserStore } from '@/stores/userStore';
import { isAuthenticated } from '@/utils/auth';
import { computed, ref, onMounted, onUnmounted } from 'vue';

export function useActiveOrders() {
    const userStore = useUserStore();
    const activeOrders = ref([]);
    const isLoading = ref(false);
    let intervalId: NodeJS.Timeout | null = null;

    // Define what statuses count as "active"
    const activeStatuses = ['waiting', 'preparing', 'on_delivery'];

    const activeOrdersCount = computed(() => {
        return activeOrders.value.length;
    });

    const hasActiveOrders = computed(() => {
        return activeOrdersCount.value > 0;
    });

    const fetchActiveOrders = async () => {
        if (!isAuthenticated()) {
            activeOrders.value = [];
            return;
        }

        try {
            isLoading.value = true;
            
            // Ensure user data is loaded
            if (!userStore.user) {
                await userStore.fetchUser();
            }

            // Get all orders and filter for active ones
            const orders = await ProductService.getOrders();
            
            // Filter orders for active statuses
            activeOrders.value = orders.filter(order => 
                activeStatuses.includes(order.status)
            );

        } catch (error) {
            console.error('Error fetching active orders:', error);
            activeOrders.value = [];
        } finally {
            isLoading.value = false;
        }
    };

    const startPolling = (intervalMs: number = 30000) => {
        // Initial fetch
        fetchActiveOrders();
        
        // Poll every 30 seconds
        intervalId = setInterval(fetchActiveOrders, intervalMs);
    };

    const stopPolling = () => {
        if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
        }
    };

    // Auto-start polling when authenticated
    onMounted(() => {
        if (isAuthenticated()) {
            startPolling();
        }
    });

    // Clean up on unmount
    onUnmounted(() => {
        stopPolling();
    });

    return {
        activeOrders: computed(() => activeOrders.value),
        activeOrdersCount,
        hasActiveOrders,
        isLoading: computed(() => isLoading.value),
        fetchActiveOrders,
        startPolling,
        stopPolling
    };
}