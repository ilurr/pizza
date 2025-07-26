import { ref } from 'vue';

export function useTrackingService() {
    const userPosition = ref<{ lat: number; lng: number } | null>(null);
    const driverPosition = ref<{ lat: number; lng: number } | null>(null);
    const isLoading = ref(false);
    const error = ref<string | null>(null);

    // Get user's current location
    const getLocation = async (): Promise<void> => {
        isLoading.value = true;
        error.value = null;

        try {
            if (!navigator.geolocation) {
                throw new Error('Geolocation is not supported by this browser');
            }

            const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 300000 // 5 minutes
                });
            });

            userPosition.value = {
                lat: position.coords.latitude,
                lng: position.coords.longitude
            };
        } catch (err: any) {
            error.value = err.message || 'Failed to get location';
            console.error('Geolocation error:', err);

            // Fallback to Surabaya center if geolocation fails
            userPosition.value = {
                lat: -7.2575,
                lng: 112.7521
            };
        } finally {
            isLoading.value = false;
        }
    };

    // Add delivery simulation state
    const deliveryState = ref<'normal' | 'near' | 'arrived'>('normal');
    
    // Simulate driver position updates (in real app, this would come from real-time API)
    const updateDriverPosition = (simulateState?: 'normal' | 'near' | 'arrived'): void => {
        if (!userPosition.value) return;

        // Allow manual state override for testing
        if (simulateState) {
            deliveryState.value = simulateState;
        }

        let distanceKm: number;
        
        // Set distance based on delivery state
        switch (deliveryState.value) {
            case 'arrived':
                distanceKm = 0; // Driver has arrived (0-50 meters)
                break;
            case 'near':
                distanceKm = Math.random() * 0.4 + 0.1; // 0.1-0.5 km (near, under 3 minutes)
                break;
            default:
                distanceKm = Math.random() * 3 + 2; // 2-5 km away (normal delivery)
        }

        const bearing = Math.random() * 360; // Random direction

        const lat1 = (userPosition.value.lat * Math.PI) / 180;
        const lng1 = (userPosition.value.lng * Math.PI) / 180;
        const d = distanceKm / 6371; // Earth radius in km
        const bearingRad = (bearing * Math.PI) / 180;

        const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(bearingRad));

        const lng2 = lng1 + Math.atan2(Math.sin(bearingRad) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));

        driverPosition.value = {
            lat: (lat2 * 180) / Math.PI,
            lng: (lng2 * 180) / Math.PI
        };

        console.log(`Driver position updated - State: ${deliveryState.value}, Distance: ${distanceKm.toFixed(2)}km`);
    };

    // Simulate driver states for testing
    const simulateDriverNear = (): void => {
        updateDriverPosition('near');
    };

    const simulateDriverArrived = (): void => {
        updateDriverPosition('arrived');
    };

    const simulateDriverNormal = (): void => {
        updateDriverPosition('normal');
    };

    // Calculate distance between two points using Haversine formula
    const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
        const R = 6371; // Earth's radius in kilometers
        const dLat = ((lat2 - lat1) * Math.PI) / 180;
        const dLng = ((lng2 - lng1) * Math.PI) / 180;

        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = R * c;

        return distance;
    };

    // Calculate bearing between two points
    const calculateBearing = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
        const dLng = ((lng2 - lng1) * Math.PI) / 180;
        const lat1Rad = (lat1 * Math.PI) / 180;
        const lat2Rad = (lat2 * Math.PI) / 180;

        const y = Math.sin(dLng) * Math.cos(lat2Rad);
        const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng);

        const bearing = (Math.atan2(y, x) * 180) / Math.PI;
        return (bearing + 360) % 360;
    };

    // Get estimated travel time (simplified calculation)
    const getEstimatedTravelTime = (): number | null => {
        if (!userPosition.value || !driverPosition.value) return null;

        const distance = calculateDistance(driverPosition.value.lat, driverPosition.value.lng, userPosition.value.lat, userPosition.value.lng);

        // Assume average speed of 30 km/h in city traffic
        const avgSpeedKmh = 30;
        const timeHours = distance / avgSpeedKmh;
        const timeMinutes = Math.ceil(timeHours * 60);

        return timeMinutes;
    };

    // Start real-time tracking simulation
    const startTracking = (orderId: string): void => {
        // In real app, this would start WebSocket connection or polling
        console.log(`Starting tracking for order ${orderId}`);

        // Simulate periodic driver position updates
        const interval = setInterval(() => {
            if (userPosition.value && driverPosition.value) {
                // Move driver slightly closer to user
                const currentDistance = calculateDistance(driverPosition.value.lat, driverPosition.value.lng, userPosition.value.lat, userPosition.value.lng);

                // If driver is very close, stop moving
                if (currentDistance < 0.1) {
                    clearInterval(interval);
                    return;
                }

                // Move driver 10% closer each update
                const bearing = calculateBearing(driverPosition.value.lat, driverPosition.value.lng, userPosition.value.lat, userPosition.value.lng);

                const moveDistance = currentDistance * 0.1; // Move 10% closer
                const newLat = driverPosition.value.lat + (moveDistance / 111) * Math.cos((bearing * Math.PI) / 180);
                const newLng = driverPosition.value.lng + (moveDistance / 111) * Math.sin((bearing * Math.PI) / 180);

                driverPosition.value = {
                    lat: newLat,
                    lng: newLng
                };
            }
        }, 10000); // Update every 10 seconds
    };

    // Stop tracking
    const stopTracking = (): void => {
        console.log('Stopping tracking');
        // In real app, this would close WebSocket connection
    };

    // Mock driver data
    const getCurrentDriver = () => {
        return {
            id: 'driver_001',
            name: 'Pak Agus',
            phone: '081234567899',
            vehicle: 'Honda Beat - B 1234 XY',
            rating: 4.8,
            position: driverPosition.value
        };
    };

    return {
        // State
        userPosition,
        driverPosition,
        isLoading,
        error,
        deliveryState,

        // Methods
        getLocation,
        updateDriverPosition,
        calculateDistance,
        calculateBearing,
        getEstimatedTravelTime,
        startTracking,
        stopTracking,
        getCurrentDriver,
        
        // Simulation methods for testing
        simulateDriverNear,
        simulateDriverArrived,
        simulateDriverNormal
    };
}
