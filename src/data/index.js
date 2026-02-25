/**
 * Central export for all mock/dummy data.
 * Use this when you need to reference mock data from a single place.
 * API services and auth should import from here or from the specific JSON files.
 */

import pizzasData from './pizzas.json';
import beveragesData from './beverages.json';
import ordersData from './orders.json';
import coverageAreasData from './coverageAreas.json';
import authUsersData from './authUsers.json';
import driversData from './drivers.json';
import driverStockData from './driverStock.json';
import driverEarningsData from './driverEarnings.json';
import driverTransactionsData from './driverTransactions.json';
import driverNearbyDriversData from './driverNearbyDrivers.json';

export {
    pizzasData,
    beveragesData,
    ordersData,
    coverageAreasData,
    authUsersData,
    driversData,
    driverStockData,
    driverEarningsData,
    driverTransactionsData,
    driverNearbyDriversData
};

export default {
    pizzas: pizzasData,
    beverages: beveragesData,
    orders: ordersData,
    coverageAreas: coverageAreasData,
    authUsers: authUsersData,
    drivers: driversData,
    driverStock: driverStockData,
    driverEarnings: driverEarningsData,
    driverTransactions: driverTransactionsData,
    driverNearbyDrivers: driverNearbyDriversData
};

