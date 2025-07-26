import { ref } from 'vue';

// Global Leaflet instance
let L: any = null;
const isLoaded = ref(false);
const isLoading = ref(false);

export function useLeaflet() {
	// Load Leaflet dynamically
	const loadLeaflet = async (): Promise<any> => {
		if (L && isLoaded.value) return L;
		
		if (isLoading.value) {
			// Wait for existing load to complete
			return new Promise((resolve) => {
				const checkLoaded = () => {
					if (isLoaded.value) {
						resolve(L);
					} else {
						setTimeout(checkLoaded, 100);
					}
				};
				checkLoaded();
			});
		}
		
		isLoading.value = true;
		
		try {
			// Load Leaflet CSS
			if (!document.querySelector('link[href*="leaflet.css"]')) {
				const link = document.createElement('link');
				link.rel = 'stylesheet';
				link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
				document.head.appendChild(link);
			}

			// Load Leaflet JS
			if (!(window as any).L) {
				await new Promise((resolve, reject) => {
					const script = document.createElement('script');
					script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
					script.onload = () => {
						L = (window as any).L;
						isLoaded.value = true;
						isLoading.value = false;
						resolve(L);
					};
					script.onerror = () => {
						isLoading.value = false;
						reject(new Error('Failed to load Leaflet'));
					};
					document.head.appendChild(script);
				});
			} else {
				L = (window as any).L;
				isLoaded.value = true;
				isLoading.value = false;
			}
			
			return L;
		} catch (error) {
			isLoading.value = false;
			console.error('Failed to load Leaflet:', error);
			throw error;
		}
	};

	// Create a standard map with OpenStreetMap tiles
	const createMap = async (container: HTMLElement, center: [number, number], zoom: number = 13) => {
		await loadLeaflet();
		
		if (!L) throw new Error('Leaflet not loaded');
		
		const map = L.map(container).setView(center, zoom);
		
		// Add OpenStreetMap tile layer
		L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
			attribution: '© OpenStreetMap contributors'
		}).addTo(map);
		
		return map;
	};

	// Create custom marker icons with consistent styling
	const createMarkerIcon = async (options: {
		color: string;
		size?: number;
		className?: string;
		style?: 'default' | 'prominent';
	}) => {
		await loadLeaflet();
		
		const { color, size = 20, className = 'custom-marker', style = 'default' } = options;
		
		// Consistent styling for all markers
		const markerHtml = style === 'prominent' 
			? `<div style="background-color: ${color}; width: ${size}px; height: ${size}px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3);"></div>`
			: `<div style="background-color: ${color}; width: ${size}px; height: ${size}px; border-radius: 50%; border: 2px solid white; box-shadow: 0 1px 3px rgba(0,0,0,0.3);"></div>`;
		
		return L.divIcon({
			html: markerHtml,
			className,
			iconSize: [size, size],
			iconAnchor: [size/2, size/2]
		});
	};

	// Create polygon overlay
	const createPolygon = async (coordinates: number[][], options: any = {}) => {
		await loadLeaflet();
		
		const defaultOptions = {
			color: '#10b981',
			weight: 2,
			opacity: 0.8,
			fillColor: '#10b981',
			fillOpacity: 0.1,
			interactive: false
		};
		
		return L.polygon(coordinates, { ...defaultOptions, ...options });
	};

	// Add marker to map
	const addMarker = async (map: any, lat: number, lng: number, options: {
		icon?: any;
		popup?: string;
		draggable?: boolean;
	} = {}) => {
		await loadLeaflet();
		
		const marker = L.marker([lat, lng], options).addTo(map);
		
		if (options.popup) {
			marker.bindPopup(options.popup);
		}
		
		return marker;
	};

	// Fit map to show multiple markers
	const fitBounds = async (map: any, markers: any[]) => {
		await loadLeaflet();
		
		if (markers.length === 0) return;
		
		const group = L.featureGroup(markers);
		map.fitBounds(group.getBounds().pad(0.1));
	};

	// Calculate distance between two points
	const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
		const R = 6371; // Earth's radius in kilometers
		const dLat = (lat2 - lat1) * Math.PI / 180;
		const dLng = (lng2 - lng1) * Math.PI / 180;
		
		const a = 
			Math.sin(dLat/2) * Math.sin(dLat/2) +
			Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
			Math.sin(dLng/2) * Math.sin(dLng/2);
		
		const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
		const distance = R * c;
		
		return distance;
	};

	// Get address from coordinates using Nominatim
	const getAddressFromCoords = async (lat: number, lng: number): Promise<string> => {
		try {
			const response = await fetch(
				`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
			);
			const data = await response.json();
			return data.display_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
		} catch (error) {
			console.error('Error getting address:', error);
			return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
		}
	};

	// Check if point is inside polygon
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

	// Get user's current location
	const getCurrentLocation = (): Promise<{ lat: number; lng: number }> => {
		return new Promise((resolve, reject) => {
			if (!navigator.geolocation) {
				reject(new Error('Geolocation is not supported by this browser'));
				return;
			}

			navigator.geolocation.getCurrentPosition(
				(position) => {
					resolve({
						lat: position.coords.latitude,
						lng: position.coords.longitude
					});
				},
				(error) => {
					console.error('Geolocation error:', error);
					// Fallback to Surabaya center
					resolve({
						lat: -7.2575,
						lng: 112.7521
					});
				},
				{
					enableHighAccuracy: true,
					timeout: 10000,
					maximumAge: 300000 // 5 minutes
				}
			);
		});
	};

	// Remove all markers from map
	const clearMarkers = async (map: any) => {
		await loadLeaflet();
		
		map.eachLayer((layer: any) => {
			if (layer instanceof L.Marker) {
				map.removeLayer(layer);
			}
		});
	};

	// Draw route between two points using OpenRouteService
	const drawRoute = async (
		map: any, 
		startLat: number, 
		startLng: number, 
		endLat: number, 
		endLng: number,
		options: {
			color?: string;
			weight?: number;
			opacity?: number;
		} = {}
	) => {
		await loadLeaflet();
		
		try {
			// Get API key from environment variables
			const apiKey = import.meta.env.VITE_OPENROUTESERVICE_API_KEY;
			
			if (!apiKey) {
				console.warn('OpenRouteService API key not found, falling back to straight line');
				return null;
			}
			
			console.log('Drawing route with OpenRouteService...');

			const response = await fetch(
				`https://api.openrouteservice.org/v2/directions/driving-car?start=${startLng},${startLat}&end=${endLng},${endLat}`,
				{
					headers: {
						'Accept': 'application/json, application/geo+json, application/gpx+xml, img/png; charset=utf-8',
						'Authorization': apiKey
					}
				}
			);

			if (!response.ok) {
				// Don't draw anything if routing service fails
				console.warn('Routing service unavailable, no route will be displayed');
				return null;
			}

			const data = await response.json();
			const coordinates = data.features[0].geometry.coordinates;
			
			// Convert coordinates to Leaflet format [lat, lng]
			const routePoints = coordinates.map((coord: number[]) => [coord[1], coord[0]]);
			
			const defaultOptions = {
				color: '#3b82f6',
				weight: 4,
				opacity: 0.8
			};
			
			const routeLine = L.polyline(routePoints, { ...defaultOptions, ...options });
			routeLine.addTo(map);
			
			return {
				polyline: routeLine,
				distance: data.features[0].properties.segments[0].distance / 1000, // Convert to km
				duration: data.features[0].properties.segments[0].duration / 60 // Convert to minutes
			};
			
		} catch (error) {
			console.warn('Error fetching route, no route will be displayed:', error);
			return null;
		}
	};

	// Fallback: Draw straight line between two points
	const drawStraightLine = async (
		map: any,
		startLat: number,
		startLng: number, 
		endLat: number,
		endLng: number,
		options: {
			color?: string;
			weight?: number;
			opacity?: number;
			dashArray?: string;
		} = {}
	) => {
		await loadLeaflet();
		
		const defaultOptions = {
			color: '#6b7280',
			weight: 3,
			opacity: 0.6,
			dashArray: '10, 10'
		};
		
		const straightLine = L.polyline(
			[[startLat, startLng], [endLat, endLng]], 
			{ ...defaultOptions, ...options }
		);
		straightLine.addTo(map);
		
		const distance = calculateDistance(startLat, startLng, endLat, endLng);
		
		return {
			polyline: straightLine,
			distance,
			duration: distance * 2 // Estimate 2 minutes per km
		};
	};

	// Remove all polylines (routes) from map
	const clearRoutes = async (map: any) => {
		await loadLeaflet();
		
		map.eachLayer((layer: any) => {
			if (layer instanceof L.Polyline && !(layer instanceof L.Polygon)) {
				map.removeLayer(layer);
			}
		});
	};

	return {
		// State
		isLoaded,
		isLoading,
		
		// Core functions
		loadLeaflet,
		createMap,
		createMarkerIcon,
		createPolygon,
		addMarker,
		fitBounds,
		clearMarkers,
		
		// Route functions
		drawRoute,
		drawStraightLine,
		clearRoutes,
		
		// Utility functions
		calculateDistance,
		getAddressFromCoords,
		isPointInPolygon,
		getCurrentLocation,
		
		// Direct Leaflet access
		getLeaflet: () => L
	};
}