import { BaseApiService } from './ApiClient.js';
import { getSupabaseClient } from '@/services/supabase/client.js';

export class LocationApiService extends BaseApiService {
    constructor() {
        super();
        this.endpoint = '/locations';
        this.initializeMockData();
    }

    initializeMockData() {
        // Mock coverage areas - centralized from LocationPickerModal
        this.mockCoverageAreas = [
            {
                id: 'surabaya',
                city: 'Surabaya',
                province: 'Jawa Timur',
                country: 'Indonesia',
                active: true,
                bounds: {
                    southwest: { lat: -7.3549, lng: 112.6094 },
                    northeast: { lat: -7.1554, lng: 112.8375 }
                },
                center: { lat: -7.2575, lng: 112.7521 },
                polygon: [
                    [-7.1554, 112.6094], // Northwest
                    [-7.1554, 112.8375], // Northeast
                    [-7.3549, 112.8375], // Southeast
                    [-7.3549, 112.6094], // Southwest
                    [-7.1554, 112.6094] // Close polygon
                ],
                deliveryFee: 5000,
                minimumOrder: 50000,
                estimatedDeliveryTime: 30, // minutes
                maxDeliveryRadius: 15, // km from center
                timezone: 'Asia/Jakarta',
                currency: 'IDR'
            },
            {
                id: 'tangerang_selatan',
                city: 'Tangerang Selatan',
                province: 'Banten',
                country: 'Indonesia',
                active: true,
                bounds: {
                    southwest: { lat: -6.3676, lng: 106.6924 },
                    northeast: { lat: -6.184, lng: 106.8304 }
                },
                center: { lat: -6.2758, lng: 106.7614 },
                polygon: [
                    [-6.184, 106.6924], // Northwest
                    [-6.184, 106.8304], // Northeast
                    [-6.3676, 106.8304], // Southeast
                    [-6.3676, 106.6924], // Southwest
                    [-6.184, 106.6924] // Close polygon
                ],
                deliveryFee: 8000,
                minimumOrder: 75000,
                estimatedDeliveryTime: 35,
                maxDeliveryRadius: 20,
                timezone: 'Asia/Jakarta',
                currency: 'IDR'
            }
        ];

        // Mock address data for geocoding
        this.mockAddresses = [
            {
                id: 'addr_001',
                address: 'Jl. Diponegoro No. 123, Surabaya',
                coordinates: { lat: -7.2575, lng: 112.7521 },
                city: 'Surabaya',
                province: 'Jawa Timur',
                postalCode: '60245',
                country: 'Indonesia',
                formatted: 'Jl. Diponegoro No. 123, Surabaya, Jawa Timur 60245',
                type: 'street_address'
            },
            {
                id: 'addr_002',
                address: 'Jl. Basuki Rahmat No. 456, Surabaya',
                coordinates: { lat: -7.2504, lng: 112.7688 },
                city: 'Surabaya',
                province: 'Jawa Timur',
                postalCode: '60271',
                country: 'Indonesia',
                formatted: 'Jl. Basuki Rahmat No. 456, Surabaya, Jawa Timur 60271',
                type: 'street_address'
            },
            {
                id: 'addr_003',
                address: 'Jl. Bintaro Raya No. 789, Tangerang Selatan',
                coordinates: { lat: -6.2758, lng: 106.7614 },
                city: 'Tangerang Selatan',
                province: 'Banten',
                postalCode: '15221',
                country: 'Indonesia',
                formatted: 'Jl. Bintaro Raya No. 789, Tangerang Selatan, Banten 15221',
                type: 'street_address'
            }
        ];

        // Mock districts/subdistricts for more detailed coverage
        this.mockDistricts = [
            {
                id: 'district_001',
                name: 'Gubeng',
                city: 'Surabaya',
                coverageAreaId: 'surabaya',
                active: true,
                center: { lat: -7.2652, lng: 112.7519 },
                deliveryFee: 5000,
                estimatedDeliveryTime: 25
            },
            {
                id: 'district_002',
                name: 'Wonokromo',
                city: 'Surabaya',
                coverageAreaId: 'surabaya',
                active: true,
                center: { lat: -7.2951, lng: 112.7214 },
                deliveryFee: 5000,
                estimatedDeliveryTime: 30
            },
            {
                id: 'district_003',
                name: 'Pondok Aren',
                city: 'Tangerang Selatan',
                coverageAreaId: 'tangerang_selatan',
                active: true,
                center: { lat: -6.2654, lng: 106.699 },
                deliveryFee: 8000,
                estimatedDeliveryTime: 30
            },
            {
                id: 'district_004',
                name: 'Bintaro',
                city: 'Tangerang Selatan',
                coverageAreaId: 'tangerang_selatan',
                active: true,
                center: { lat: -6.2758, lng: 106.7614 },
                deliveryFee: 8000,
                estimatedDeliveryTime: 35
            }
        ];
    }

    // Resolve user location to a kelurahan (nearest by center distance). Uses Supabase kelurahan table.
    async getKelurahanForLocation(lat, lng) {
        const supabase = getSupabaseClient();
        if (supabase) {
            const { data: rows, error } = await supabase.from('kelurahan').select('id, name, city, province, center_lat, center_lng').eq('active', true);
            if (!error && rows && rows.length > 0) {
                let nearest = rows[0];
                let minD = 1e9;
                const R = 6371;
                for (const k of rows) {
                    const kLat = k.center_lat;
                    const kLng = k.center_lng;
                    const dLat = ((kLat - lat) * Math.PI) / 180;
                    const dLng = ((kLng - lng) * Math.PI) / 180;
                    const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat * Math.PI) / 180) * Math.cos((kLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
                    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                    const d = R * c;
                    if (d < minD) {
                        minD = d;
                        nearest = k;
                    }
                }
                return this.createMockResponse({
                    kelurahanId: nearest.id,
                    kelurahanName: nearest.name,
                    city: nearest.city
                });
            }
            if (error) return this.createMockError(error.message || 'Failed to fetch kelurahan', error.code || 500);
        }
        return this.createMockError('No kelurahan data. Run supabase-schema-kelurahan.sql and add kelurahan rows.', 500);
    }

    async getCoverageAreasFromSupabase(filters = {}) {
        const supabase = getSupabaseClient();
        if (!supabase) {
            return this.createMockError('Supabase not configured', 500);
        }

        let query = supabase.from('coverage_areas').select('*').order('city', { ascending: true });

        if (filters.active !== undefined) query = query.eq('active', filters.active);
        if (filters.city) query = query.ilike('city', `%${filters.city}%`);
        if (filters.province) query = query.ilike('province', `%${filters.province}%`);

        const { data: rows, error } = await query;
        if (error) {
            return this.createMockError(error.message || 'Failed to fetch coverage areas', 500);
        }

        const areas = (rows || []).map((row) => ({
            id: row.id,
            city: row.city,
            province: row.province,
            country: row.country,
            active: row.active,
            bounds: {
                southwest: { lat: row.bounds_southwest_lat, lng: row.bounds_southwest_lng },
                northeast: { lat: row.bounds_northeast_lat, lng: row.bounds_northeast_lng }
            },
            center: { lat: row.center_lat, lng: row.center_lng },
            polygon: row.polygon || [],
            deliveryFee: row.delivery_fee,
            minimumOrder: row.minimum_order,
            estimatedDeliveryTime: row.estimated_delivery_time,
            maxDeliveryRadius: row.max_delivery_radius,
            timezone: row.timezone,
            currency: row.currency
        }));

        return this.createMockResponse({
            coverageAreas: areas,
            total: areas.length,
            filters
        });
    }

    // Get all coverage areas
    async getCoverageAreas(filters = {}) {
        if (this.dataSource === 'supabase') {
            return await this.getCoverageAreasFromSupabase(filters);
        }
        if (this.useMockApi) {
            await this.mockDelay();

            let filteredAreas = [...this.mockCoverageAreas];

            // Apply filters
            if (filters.active !== undefined) {
                filteredAreas = filteredAreas.filter((area) => area.active === filters.active);
            }

            if (filters.city) {
                filteredAreas = filteredAreas.filter((area) => area.city.toLowerCase().includes(filters.city.toLowerCase()));
            }

            if (filters.province) {
                filteredAreas = filteredAreas.filter((area) => area.province.toLowerCase().includes(filters.province.toLowerCase()));
            }

            return this.createMockResponse({
                coverageAreas: filteredAreas,
                total: filteredAreas.length,
                filters: filters
            });
        }

        return await this.get(`${this.endpoint}/coverage`, filters);
    }

    // Get specific coverage area by ID
    async getCoverageArea(areaId) {
        if (this.dataSource === 'supabase') {
            const supabase = getSupabaseClient();
            if (!supabase) {
                return this.createMockError('Supabase not configured', 500);
            }
            const { data: row, error } = await supabase.from('coverage_areas').select('*').eq('id', areaId).maybeSingle();
            if (error || !row) {
                return this.createMockError('Coverage area not found', 404);
            }
            const area = {
                id: row.id,
                city: row.city,
                province: row.province,
                country: row.country,
                active: row.active,
                bounds: {
                    southwest: { lat: row.bounds_southwest_lat, lng: row.bounds_southwest_lng },
                    northeast: { lat: row.bounds_northeast_lat, lng: row.bounds_northeast_lng }
                },
                center: { lat: row.center_lat, lng: row.center_lng },
                polygon: row.polygon || [],
                deliveryFee: row.delivery_fee,
                minimumOrder: row.minimum_order,
                estimatedDeliveryTime: row.estimated_delivery_time,
                maxDeliveryRadius: row.max_delivery_radius,
                timezone: row.timezone,
                currency: row.currency
            };
            const districts = this.mockDistricts.filter((d) => d.coverageAreaId === area.id);
            return this.createMockResponse({
                coverageArea: area,
                districts,
                totalDistricts: districts.length
            });
        }
        if (this.useMockApi) {
            await this.mockDelay();

            const area = this.mockCoverageAreas.find((a) => a.id === areaId);

            if (!area) {
                return this.createMockError('Coverage area not found', 404);
            }

            // Include districts within this area
            const districts = this.mockDistricts.filter((d) => d.coverageAreaId === areaId);

            return this.createMockResponse({
                coverageArea: area,
                districts: districts,
                totalDistricts: districts.length
            });
        }

        return await this.get(`${this.endpoint}/coverage/${areaId}`);
    }

    // Check if location is within coverage
    async checkCoverage(location) {
        if (this.dataSource === 'supabase') {
            const res = await this.getCoverageAreasFromSupabase({ active: true });
            if (!res.success) return res;
            const areas = res.data.coverageAreas || [];

            const { lat, lng } = location;
            let coverageArea = null;
            let isWithinCoverage = false;
            let nearestDistrict = null;
            let estimatedDeliveryTime = null;
            let deliveryFee = null;

            for (const area of areas) {
                if (!area.active) continue;
                if (this.isPointInPolygon({ lat, lng }, area.polygon)) {
                    coverageArea = area;
                    isWithinCoverage = true;

                    let minDistance = Infinity;
                    for (const district of this.mockDistricts) {
                        if (district.coverageAreaId === area.id && district.active) {
                            const distance = this.calculateDistance(lat, lng, district.center.lat, district.center.lng);
                            if (distance < minDistance) {
                                minDistance = distance;
                                nearestDistrict = district;
                            }
                        }
                    }

                    estimatedDeliveryTime = nearestDistrict?.estimatedDeliveryTime || area.estimatedDeliveryTime;
                    deliveryFee = nearestDistrict?.deliveryFee || area.deliveryFee;
                    break;
                }
            }

            return this.createMockResponse({
                isWithinCoverage,
                coverageArea,
                nearestDistrict,
                estimatedDeliveryTime,
                deliveryFee,
                location: { lat, lng },
                checkedAt: new Date().toISOString()
            });
        }
        if (this.useMockApi) {
            await this.mockDelay();

            const { lat, lng } = location;
            let coverageArea = null;
            let isWithinCoverage = false;
            let nearestDistrict = null;
            let estimatedDeliveryTime = null;
            let deliveryFee = null;

            // Check each coverage area
            for (const area of this.mockCoverageAreas) {
                if (!area.active) continue;

                if (this.isPointInPolygon({ lat, lng }, area.polygon)) {
                    coverageArea = area;
                    isWithinCoverage = true;

                    // Find nearest district
                    let minDistance = Infinity;
                    for (const district of this.mockDistricts) {
                        if (district.coverageAreaId === area.id && district.active) {
                            const distance = this.calculateDistance(lat, lng, district.center.lat, district.center.lng);
                            if (distance < minDistance) {
                                minDistance = distance;
                                nearestDistrict = district;
                            }
                        }
                    }

                    estimatedDeliveryTime = nearestDistrict?.estimatedDeliveryTime || area.estimatedDeliveryTime;
                    deliveryFee = nearestDistrict?.deliveryFee || area.deliveryFee;
                    break;
                }
            }

            return this.createMockResponse({
                isWithinCoverage,
                coverageArea,
                nearestDistrict,
                estimatedDeliveryTime,
                deliveryFee,
                location: { lat, lng },
                checkedAt: new Date().toISOString()
            });
        }

        return await this.post(`${this.endpoint}/check-coverage`, { location });
    }

    // Geocode address to coordinates
    async geocodeAddress(address) {
        if (this.useMockApi) {
            await this.mockDelay(800); // Simulate geocoding delay

            // Simple mock geocoding - find matching address
            const matchingAddress = this.mockAddresses.find((addr) => addr.address.toLowerCase().includes(address.toLowerCase()) || addr.formatted.toLowerCase().includes(address.toLowerCase()));

            if (matchingAddress) {
                return this.createMockResponse({
                    coordinates: matchingAddress.coordinates,
                    formattedAddress: matchingAddress.formatted,
                    addressComponents: {
                        streetAddress: matchingAddress.address,
                        city: matchingAddress.city,
                        province: matchingAddress.province,
                        postalCode: matchingAddress.postalCode,
                        country: matchingAddress.country
                    },
                    confidence: 0.95,
                    source: 'mock_geocoder'
                });
            }

            // Generate approximate coordinates for unknown addresses
            // Default to Surabaya area for Indonesian addresses
            const mockCoordinates = {
                lat: -7.2575 + (Math.random() - 0.5) * 0.1,
                lng: 112.7521 + (Math.random() - 0.5) * 0.1
            };

            return this.createMockResponse({
                coordinates: mockCoordinates,
                formattedAddress: address,
                addressComponents: {
                    streetAddress: address,
                    city: 'Surabaya',
                    province: 'Jawa Timur',
                    postalCode: '60000',
                    country: 'Indonesia'
                },
                confidence: 0.7,
                source: 'mock_geocoder',
                isApproximate: true
            });
        }

        return await this.post(`${this.endpoint}/geocode`, { address });
    }

    // Reverse geocode coordinates to address
    async reverseGeocode(coordinates) {
        if (this.useMockApi) {
            await this.mockDelay(600);

            const { lat, lng } = coordinates;

            // Find nearest known address
            let nearestAddress = null;
            let minDistance = Infinity;

            for (const addr of this.mockAddresses) {
                const distance = this.calculateDistance(lat, lng, addr.coordinates.lat, addr.coordinates.lng);
                if (distance < minDistance) {
                    minDistance = distance;
                    nearestAddress = addr;
                }
            }

            if (nearestAddress && minDistance < 1) {
                // Within 1km
                return this.createMockResponse({
                    formattedAddress: nearestAddress.formatted,
                    addressComponents: {
                        streetAddress: nearestAddress.address,
                        city: nearestAddress.city,
                        province: nearestAddress.province,
                        postalCode: nearestAddress.postalCode,
                        country: nearestAddress.country
                    },
                    confidence: 0.9,
                    distance: minDistance,
                    source: 'mock_geocoder'
                });
            }

            // Generate approximate address
            const mockAddress = {
                streetAddress: `Jl. Mock Street No. ${Math.floor(Math.random() * 999) + 1}`,
                city: 'Surabaya',
                province: 'Jawa Timur',
                postalCode: '60000',
                country: 'Indonesia'
            };

            return this.createMockResponse({
                formattedAddress: `${mockAddress.streetAddress}, ${mockAddress.city}, ${mockAddress.province} ${mockAddress.postalCode}`,
                addressComponents: mockAddress,
                confidence: 0.6,
                source: 'mock_geocoder',
                isApproximate: true
            });
        }

        return await this.post(`${this.endpoint}/reverse-geocode`, { coordinates });
    }

    // Get districts within a coverage area
    async getDistricts(coverageAreaId, filters = {}) {
        if (this.useMockApi) {
            await this.mockDelay();

            let districts = this.mockDistricts.filter((d) => d.coverageAreaId === coverageAreaId);

            // Apply filters
            if (filters.active !== undefined) {
                districts = districts.filter((d) => d.active === filters.active);
            }

            if (filters.name) {
                districts = districts.filter((d) => d.name.toLowerCase().includes(filters.name.toLowerCase()));
            }

            return this.createMockResponse({
                districts: districts,
                coverageAreaId: coverageAreaId,
                total: districts.length,
                filters: filters
            });
        }

        return await this.get(`${this.endpoint}/coverage/${coverageAreaId}/districts`, filters);
    }

    // Calculate delivery fee and time for a location
    async calculateDeliveryInfo(location, orderValue = 0) {
        if (this.useMockApi) {
            await this.mockDelay();

            const coverageCheck = await this.checkCoverage(location);

            if (!coverageCheck.data.isWithinCoverage) {
                return this.createMockError('Location outside delivery area', 400);
            }

            const { coverageArea, nearestDistrict, estimatedDeliveryTime, deliveryFee } = coverageCheck.data;

            // Apply minimum order checks
            let finalDeliveryFee = deliveryFee;
            let minimumOrderMet = orderValue >= coverageArea.minimumOrder;

            // Free delivery for orders above certain threshold
            if (orderValue >= 100000) {
                finalDeliveryFee = 0;
            }

            return this.createMockResponse({
                deliveryFee: finalDeliveryFee,
                originalDeliveryFee: deliveryFee,
                estimatedDeliveryTime: estimatedDeliveryTime,
                minimumOrder: coverageArea.minimumOrder,
                minimumOrderMet: minimumOrderMet,
                freeDeliveryThreshold: 100000,
                location: location,
                coverageArea: {
                    id: coverageArea.id,
                    city: coverageArea.city,
                    province: coverageArea.province
                },
                district: nearestDistrict
                    ? {
                          id: nearestDistrict.id,
                          name: nearestDistrict.name
                      }
                    : null
            });
        }

        return await this.post(`${this.endpoint}/calculate-delivery`, { location, orderValue });
    }

    // Helper method to check if point is inside polygon
    isPointInPolygon(point, polygon) {
        const { lat, lng } = point;
        let inside = false;

        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            const [lat1, lng1] = polygon[i];
            const [lat2, lng2] = polygon[j];

            if (lat1 > lat !== lat2 > lat && lng < ((lng2 - lng1) * (lat - lat1)) / (lat2 - lat1) + lng1) {
                inside = !inside;
            }
        }

        return inside;
    }

    // Helper method to calculate distance between two points
    calculateDistance(lat1, lng1, lat2, lng2) {
        const R = 6371; // Earth's radius in km
        const dLat = ((lat2 - lat1) * Math.PI) / 180;
        const dLng = ((lng2 - lng1) * Math.PI) / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    // Search locations (addresses, landmarks, etc.)
    async searchLocations(query, filters = {}) {
        if (this.useMockApi) {
            await this.mockDelay(400);

            const searchLower = query.toLowerCase();
            let results = [];

            // Search in addresses
            const matchingAddresses = this.mockAddresses.filter(
                (addr) => addr.address.toLowerCase().includes(searchLower) || addr.formatted.toLowerCase().includes(searchLower) || addr.city.toLowerCase().includes(searchLower) || addr.province.toLowerCase().includes(searchLower)
            );

            results = results.concat(
                matchingAddresses.map((addr) => ({
                    type: 'address',
                    id: addr.id,
                    name: addr.formatted,
                    address: addr.address,
                    coordinates: addr.coordinates,
                    city: addr.city,
                    province: addr.province,
                    relevance: this.calculateSearchRelevance(searchLower, addr.formatted)
                }))
            );

            // Search in districts
            const matchingDistricts = this.mockDistricts.filter((district) => district.name.toLowerCase().includes(searchLower) || district.city.toLowerCase().includes(searchLower));

            results = results.concat(
                matchingDistricts.map((district) => ({
                    type: 'district',
                    id: district.id,
                    name: district.name,
                    address: `${district.name}, ${district.city}`,
                    coordinates: district.center,
                    city: district.city,
                    relevance: this.calculateSearchRelevance(searchLower, district.name)
                }))
            );

            // Sort by relevance
            results.sort((a, b) => b.relevance - a.relevance);

            // Apply limit
            const limit = filters.limit || 10;
            results = results.slice(0, limit);

            return this.createMockResponse({
                results: results,
                query: query,
                total: results.length,
                filters: filters
            });
        }

        return await this.get(`${this.endpoint}/search`, { q: query, ...filters });
    }

    // Helper method to calculate search relevance
    calculateSearchRelevance(query, text) {
        const textLower = text.toLowerCase();
        if (textLower === query) return 1.0;
        if (textLower.startsWith(query)) return 0.9;
        if (textLower.includes(query)) return 0.7;

        // Calculate word matches
        const queryWords = query.split(' ');
        const textWords = textLower.split(' ');
        const matches = queryWords.filter((word) => textWords.some((textWord) => textWord.includes(word)));

        return (matches.length / queryWords.length) * 0.5;
    }
}

// Export singleton instance
export default new LocationApiService();
