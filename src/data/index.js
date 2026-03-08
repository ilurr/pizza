/**
 * Central export for all mock/dummy data.
 * Driver earnings use Supabase (driver_daily_deposits); driver stock uses Supabase (driver_stock, stock_products).
 * No local driverStock JSON.
 */

import driversData from './drivers.json';
import driverNearbyDriversData from './driverNearbyDrivers.json';

export { driversData, driverNearbyDriversData };

export default {
    drivers: driversData,
    driverNearbyDrivers: driverNearbyDriversData
};
