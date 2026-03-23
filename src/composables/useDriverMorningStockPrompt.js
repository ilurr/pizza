import { inject } from 'vue';

/** Injected by AppLayout; re-runs daily morning stock gate (opens modal if not confirmed today). */
export const DRIVER_MORNING_STOCK_PROMPT_KEY = Symbol('driverMorningStockPrompt');

const noop = async () => {};

export function useDriverMorningStockPrompt() {
	return inject(DRIVER_MORNING_STOCK_PROMPT_KEY, { promptIfUnconfirmedForToday: noop });
}
