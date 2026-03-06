/**
 * Central export for all mock/dummy data.
 * Use this when you need to reference mock data from a single place.
 * API services and auth should import from here or from the specific JSON files.
 */

import driversData from './drivers.json';
import driverStockData from './driverStock.json';
import driverEarningsData from './driverEarnings.json';
import driverTransactionsData from './driverTransactions.json';
import driverNearbyDriversData from './driverNearbyDrivers.json';

export { driversData, driverStockData, driverEarningsData, driverTransactionsData, driverNearbyDriversData };

export default {
    drivers: driversData,
    driverStock: driverStockData,
    driverEarnings: driverEarningsData,
    driverTransactions: driverTransactionsData,
    driverNearbyDrivers: driverNearbyDriversData
};
