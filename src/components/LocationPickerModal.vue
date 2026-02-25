<script setup lang="ts">
import { useLeaflet } from '@/composables/useLeaflet';
import { NotificationService } from '@/service/NotificationService.js';
import { useToast } from 'primevue/usetoast';
import { nextTick, onMounted, ref, watch } from 'vue';

const toast = useToast();

interface Location {
    lat: number;
    lng: number;
    address: string;
}

interface Props {
    visible: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{
    'update:visible': [value: boolean];
    'location-selected': [location: Location];
}>();

const selectedLocation = ref<Location | null>(null);
const isLoadingLocation = ref(false);
const mapContainer = ref<HTMLElement | null>(null);
const isWithinCoverage = ref(true);
const showNotificationRequest = ref(false);
const isSavingNotification = ref(false);

import coverageAreasData from '@/data/coverageAreas.json';

let map: any = null;
let marker: any = null;
let coveragePolygon: any = null;
let L: any = null;

// Coverage areas from central mock data (src/data/coverageAreas.json)
const coverageAreas = coverageAreasData as Array<{
    city: string;
    bounds: [number, number][];
    polygon: [number, number][];
}>;

let leafletLoaded = false;

const ensureLeafletLoaded = async () => {
    if (leafletLoaded && L) return;

    try {
        // Load Leaflet CSS once
        if (!document.querySelector('link[href*=\"leaflet.css\"]')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
            document.head.appendChild(link);
        }

        // Load Leaflet JS and wait until it's ready
        if (!(window as any).L) {
            await new Promise<void>((resolve, reject) => {
                const script = document.createElement('script');
                script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
                script.onload = () => {
                    L = (window as any).L;
                    console.log('Leaflet loaded successfully');
                    resolve();
                };
                script.onerror = (err) => {
                    console.error('Failed to load Leaflet:', err);
                    reject(err);
                };
                document.head.appendChild(script);
            });
        } else {
            L = (window as any).L;
        }

        leafletLoaded = true;
    } catch (error) {
        console.error('Failed to load Leaflet:', error);
    }
};

onMounted(async () => {
    if (props.visible) {
        await ensureLeafletLoaded();
    }
});

const initMap = () => {
    if (!mapContainer.value || !L) return;

    // Clean up existing map if it exists
    if (map) {
        map.remove();
        map = null;
        marker = null;
        coveragePolygon = null;
    }

    try {
        // Initialize map centered on Surabaya
        map = L.map(mapContainer.value).setView([-7.2575, 112.7521], 12);

        // Add tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(map);

        // Add coverage area overlay
        addCoverageOverlay();

        // Add click handler
        map.on('click', (e: any) => {
            setLocation(e.latlng.lat, e.latlng.lng);
        });

        console.log('Map initialized successfully');

        // Fix rendering when map is created inside a modal:
        // recalculate size after dialog animation completes
        setTimeout(() => {
            if (map) {
                map.invalidateSize();
            }
        }, 400);

        // Get user location
        getCurrentLocation();
    } catch (error) {
        console.error('Error initializing map:', error);
    }
};

const addCoverageOverlay = () => {
    if (!L || !map) return;

    // Add coverage area polygon for each city
    coverageAreas.forEach(area => {
        const polygon = L.polygon(area.polygon, {
            color: '#10b981',
            weight: 2,
            opacity: 0.8,
            fillColor: '#10b981',
            fillOpacity: 0.1,
            interactive: false  // Make polygon non-interactive so clicks pass through
        }).addTo(map);

        // Add popup with city name (but don't bind it since it's non-interactive)
        // polygon.bindPopup(`<b>Delivery Area: ${area.city}</b><br>We deliver here!`);

        if (area.city === 'Surabaya') {
            coveragePolygon = polygon;
        }
    });
};

const checkLocationCoverage = (lat: number, lng: number): boolean => {
    // Check if location is within any coverage area
    for (const area of coverageAreas) {
        if (isPointInPolygon([lat, lng], area.polygon)) {
            return true;
        }
    }
    return false;
};

const isPointInPolygon = (point: [number, number], polygon: number[][]): boolean => {
    const [lat, lng] = point;
    let inside = false;

    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const [latI, lngI] = polygon[i];
        const [latJ, lngJ] = polygon[j];

        if (((lngI > lng) !== (lngJ > lng)) &&
            (lat < (latJ - latI) * (lng - lngI) / (lngJ - lngI) + latI)) {
            inside = !inside;
        }
    }

    return inside;
};

const getCurrentLocation = () => {
    if (!navigator.geolocation) {
        console.warn('Geolocation is not supported by this browser');
        // Keep map centered on coverage area
        return;
    }

    isLoadingLocation.value = true;
    navigator.geolocation.getCurrentPosition(
        (position) => {
            const { latitude, longitude } = position.coords;
            setLocation(latitude, longitude);
            if (map) {
                map.setView([latitude, longitude], 15);
            }
            isLoadingLocation.value = false;
        },
        (error) => {
            console.error('Error getting location:', error);

            // Handle different error cases
            switch (error.code) {
                case error.PERMISSION_DENIED:
                    console.log('Location permission denied - showing coverage area');
                    break;
                case error.POSITION_UNAVAILABLE:
                    console.log('Location information unavailable - showing coverage area');
                    break;
                case error.TIMEOUT:
                    console.log('Location request timed out - showing coverage area');
                    break;
            }

            // Keep map centered on coverage area (Surabaya)
            if (map) {
                map.setView([-7.2575, 112.7521], 12);
            }

            isLoadingLocation.value = false;
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 60000
        }
    );
};

const setLocation = async (lat: number, lng: number) => {
    try {
        // Remove existing marker
        if (marker && map) {
            map.removeLayer(marker);
        }

        // Check if location is within coverage area
        const withinCoverage = checkLocationCoverage(lat, lng);
        isWithinCoverage.value = withinCoverage;

        console.log(`Location: ${lat}, ${lng} - Within coverage: ${withinCoverage}`);

        // Update selectedLocation immediately with coordinates
        selectedLocation.value = {
            lat,
            lng,
            address: 'Loading address...'
        };

        // Show/hide notification request based on coverage
        if (!withinCoverage) {
            showNotificationRequest.value = true;
        } else {
            showNotificationRequest.value = false;
        }

        // Add new marker with different color based on coverage
        if (L && map) {
            const { createMarkerIcon } = useLeaflet();
            const markerColor = withinCoverage ? '#10b981' : '#ef4444';
            const markerIcon = await createMarkerIcon({
                color: markerColor,
                size: 25,
                style: 'prominent'
            });

            marker = L.marker([lat, lng], { icon: markerIcon }).addTo(map);

            // Add popup only when outside coverage
            if (!withinCoverage) {
                const popupContent = '<b>❌ Outside coverage area</b>';
                marker.bindPopup(popupContent).openPopup();
            }
        }

        // Get address from coordinates (reverse geocoding) - async
        try {
            const address = await getAddressFromCoords(lat, lng);

            // Update the address once we have it
            selectedLocation.value = {
                lat,
                lng,
                address
            };
        } catch (addressError) {
            console.error('Error getting address:', addressError);
            // Keep coordinates if address fails
            selectedLocation.value = {
                lat,
                lng,
                address: `${lat.toFixed(6)}, ${lng.toFixed(6)}`
            };
        }

    } catch (error) {
        console.error('Error setting location:', error);
        // Still set the location with coordinates even if everything fails
        selectedLocation.value = {
            lat,
            lng,
            address: `${lat.toFixed(6)}, ${lng.toFixed(6)}`
        };
    }
};

const getAddressFromCoords = async (lat: number, lng: number): Promise<string> => {
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
        const data = await response.json();
        return data.display_name || `${lat}, ${lng}`;
    } catch (error) {
        console.error('Error getting address:', error);
        return `${lat}, ${lng}`;
    }
};


const confirmLocation = () => {
    if (selectedLocation.value) {
        emit('location-selected', selectedLocation.value);
        closeModal();
    }
};

const saveNotificationRequest = async () => {
    if (!selectedLocation.value) return;

    isSavingNotification.value = true;

    try {
        const notificationData = {
            userId: 'current-user-id', // TODO: Get from auth context
            location: selectedLocation.value,
            message: 'User interested in delivery coverage expansion',
            userAgent: navigator.userAgent,
            timestamp: new Date().toISOString()
        };

        // Save using NotificationService
        await NotificationService.saveExpansionRequest(notificationData);

        // Show success toast
        toast.add({
            severity: 'success',
            summary: 'Thank you!',
            detail: 'We\'ll notify you when we expand to your area.',
            life: 5000
        });

        // Reset form and close modal
        showNotificationRequest.value = false;

        // Auto-close modal after short delay
        setTimeout(() => {
            closeModal();
        }, 1500);

    } catch (error) {
        console.error('Error saving notification request:', error);

        // Show error toast
        toast.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Sorry, there was an error. Please try again.',
            life: 5000
        });
    } finally {
        isSavingNotification.value = false;
    }
};

const closeModal = () => {
    emit('update:visible', false);
    selectedLocation.value = null;
    showNotificationRequest.value = false;
    isWithinCoverage.value = true;
};

// Watch for modal visibility changes
watch(
    () => props.visible,
    async (newVal) => {
        if (newVal) {
            // Ensure Leaflet is loaded only when modal is shown
            await ensureLeafletLoaded();

            // Wait for modal to render, then initialize map
            nextTick(() => {
                setTimeout(() => {
                    initMap();
                }, 300);
            });
    } else {
        // Clean up map when modal closes
        if (map) {
            map.remove();
            map = null;
        }
        if (marker) {
            marker = null;
        }
        if (coveragePolygon) {
            coveragePolygon = null;
        }
        // Reset state
        selectedLocation.value = null;
        showNotificationRequest.value = false;
        isWithinCoverage.value = true;
    }
}
);
</script>

<template>
    <Dialog :visible="visible" modal header="Select Your Location" :style="{ width: '90vw', maxWidth: '800px' }"
        :breakpoints="{ '1199px': '75vw', '575px': '90vw' }" class="dialog-flex-end" @update:visible="closeModal">
        <div class="space-y-4">
            <!-- Current Location Button -->
            <div class="flex justify-center">
                <Button label="Use My Current Location" icon="pi pi-map-marker" severity="success"
                    :loading="isLoadingLocation" @click="getCurrentLocation" />
            </div>

            <!-- Map Container -->
            <div ref="mapContainer" class="w-full h-96 rounded-lg border border-gray-300 dark:border-gray-600"></div>

            <!-- Selected Location Info -->
            <!-- <div v-if="selectedLocation && isWithinCoverage"
                class="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                <h3 class="font-semibold text-green-900 dark:text-green-100 mb-2">✅ Great! We deliver here:</h3>
                <p class="text-sm text-green-700 dark:text-green-300">{{ selectedLocation.address }}</p>
                <p class="text-xs text-green-600 dark:text-green-400 mt-1">
                    Lat: {{ selectedLocation.lat.toFixed(6) }}, Lng: {{ selectedLocation.lng.toFixed(6) }}
                </p>
            </div> -->

            <!-- Out of Coverage Area Info -->
            <div v-if="selectedLocation && isWithinCoverage">
                <h3 class="text-base font-semibold"><i class="pi pi-map-marker text-green-600"></i> {{
                    selectedLocation.address }}</h3>
            </div>

            <!-- Notification Request -->
            <div v-if="showNotificationRequest && !isWithinCoverage">
                <h3 class="text-base font-semibold">
                    We don't deliver to this location yet, we will let you know when we start delivering to your area.
                </h3>
            </div>

            <!-- Instructions -->
            <!-- <div class="text-sm text-gray-600 dark:text-gray-400">
                <ul>
                    <li>📍 Click on the map to select your location</li>
                    <li>🎯 Allow location access for automatic detection</li>
                </ul>
            </div> -->
        </div>

        <template #footer>
            <div class="flex justify-end gap-2">
                <!-- Show notification buttons when outside coverage -->
                <template v-if="showNotificationRequest && !isWithinCoverage">
                    <Button label="No thanks" text severity="secondary" @click="closeModal" />
                    <Button label="Yes, please notify me!" icon="pi pi-bell" :loading="isSavingNotification"
                        @click="saveNotificationRequest" />
                </template>
                <!-- Show normal buttons when inside coverage or no location selected -->
                <template v-else>
                    <Button label="Cancel" outlined @click="closeModal" />
                    <Button label="Confirm Location" :disabled="!selectedLocation || !isWithinCoverage"
                        @click="confirmLocation" />
                </template>
            </div>
        </template>
    </Dialog>
</template>

<style scoped></style>