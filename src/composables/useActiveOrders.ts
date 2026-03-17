import { ProductService } from '@/service/ProductService.js';
import { useUserStore } from '@/stores/userStore';
import { isAuthenticated } from '@/utils/auth';
import { computed, onMounted, onUnmounted, ref } from 'vue';

export function useActiveOrders() {
    const userStore = useUserStore();
    const activeOrders = ref([]);
    const isLoading = ref(false);
    let intervalId: NodeJS.Timeout | null = null;

    // Active = not yet delivered/cancelled (simplified status set)
    const activeStatuses = ['pending', 'assigned', 'preparing', 'on_delivery'];

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

            // Get all orders for this user and filter for active ones
            const userId = userStore.user?.id ?? 'guest_user';
            const orders = await ProductService.getOrders(userId);
            
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
        // Avoid duplicate intervals
        if (intervalId) {
            clearInterval(intervalId);
        }

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

    const handleVisibilityChange = () => {
        if (typeof document === 'undefined') return;

        if (document.hidden) {
            stopPolling();
        } else if (isAuthenticated()) {
            startPolling();
        }
    };

    // Auto-start polling when authenticated
    onMounted(() => {
        if (isAuthenticated()) {
            startPolling();
        }

        if (typeof document !== 'undefined') {
            document.addEventListener('visibilitychange', handleVisibilityChange);
        }
    });

    // Clean up on unmount
    onUnmounted(() => {
        stopPolling();
        if (typeof document !== 'undefined') {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        }
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