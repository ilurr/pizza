import api from '@/services/api/index.js';
import { computed, ref, unref } from 'vue';

export function localDayKeyEnCA() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toLocaleDateString('en-CA');
}

/**
 * Morning check-in (opening) must be done before showing Close day; optional sessionStorage fallback
 * right after confirm before API round-trip.
 */
export function useDriverDailyCloseDay(getDriverId) {
    const openingConfirmed = ref(false);
    const closingConfirmed = ref(false);
    const loading = ref(false);

    function sessionMorningConfirmedForToday() {
        const id = unref(getDriverId);
        if (id == null || String(id) === '') return false;
        try {
            const dk = localDayKeyEnCA();
            return sessionStorage.getItem(`morningStockConfirmed_${String(id)}_${dk}`) === '1';
        } catch {
            return false;
        }
    }

    async function refresh() {
        const id = unref(getDriverId);
        if (id == null || String(id) === '') {
            openingConfirmed.value = false;
            closingConfirmed.value = false;
            return;
        }
        loading.value = true;
        try {
            const dateKey = localDayKeyEnCA();
            const res = await api.drivers.getDriverDailyConfirmationStatus(String(id), { stockDate: dateKey });
            openingConfirmed.value = !!(res?.success && res.data?.confirmed);
            closingConfirmed.value = !!(res?.success && res.data?.closingConfirmed);
        } catch (e) {
            console.warn('[useDriverDailyCloseDay] refresh failed:', e);
            openingConfirmed.value = false;
            closingConfirmed.value = false;
        } finally {
            loading.value = false;
        }
    }

    const canShowCloseDay = computed(() => {
        const morningOk = openingConfirmed.value || sessionMorningConfirmedForToday();
        return morningOk && !closingConfirmed.value;
    });

    return {
        openingConfirmed,
        closingConfirmed,
        loading,
        refresh,
        canShowCloseDay
    };
}
