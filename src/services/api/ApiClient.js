import axios from 'axios';

// Environment configuration for API switching
const API_CONFIG = {
    USE_MOCK_API: import.meta.env.VITE_USE_MOCK_API !== 'false', // Default to true for development
    DATA_SOURCE: import.meta.env.VITE_DATA_SOURCE || 'supabase', // 'supabase' | 'api'
    BASE_URL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1',
    SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL || '',
    SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
    TIMEOUT: 10000
};

// Create axios instance for real API
const apiClient = axios.create({
    baseURL: API_CONFIG.BASE_URL,
    timeout: API_CONFIG.TIMEOUT,
    headers: {
        'Content-Type': 'application/json'
    }
});

// Request interceptors for authentication
const addAuthInterceptors = (client) => {
    client.interceptors.request.use(
        (config) => {
            const token = localStorage.getItem('token');
            if (token) {
                config.headers.Authorization = `Bearer ${token}`;
            }
            return config;
        },
        (error) => {
            return Promise.reject(error);
        }
    );
};

// Response interceptors for error handling
const addResponseInterceptors = (client) => {
    client.interceptors.response.use(
        (response) => {
            return response;
        },
        (error) => {
            // Handle common error scenarios
            if (error.response) {
                switch (error.response.status) {
                    case 401:
                        // Unauthorized - redirect to login
                        localStorage.removeItem('token');
                        window.location.href = '/auth/login';
                        break;
                    case 403:
                        // Forbidden - show access denied
                        console.error('Access denied');
                        break;
                    case 404:
                        // Not found
                        console.error('Resource not found');
                        break;
                    case 500:
                        // Server error
                        console.error('Server error occurred');
                        break;
                    default:
                        console.error('API Error:', error.response.data);
                }
            } else if (error.request) {
                // Network error
                console.error('Network error - please check your connection');
            } else {
                console.error('Request error:', error.message);
            }
            return Promise.reject(error);
        }
    );
};

// Apply interceptors
addAuthInterceptors(apiClient);
addResponseInterceptors(apiClient);

// Base API service class
export class BaseApiService {
    constructor(client = apiClient) {
        this.client = client;
        this.useMockApi = API_CONFIG.USE_MOCK_API;
        this.dataSource = API_CONFIG.DATA_SOURCE; // 'supabase' | 'api'
    }

    // Generic request methods
    async get(endpoint, params = {}) {
        try {
            const response = await this.client.get(endpoint, { params });
            return this.handleResponse(response);
        } catch (error) {
            return this.handleError(error);
        }
    }

    async post(endpoint, data = {}) {
        try {
            const response = await this.client.post(endpoint, data);
            return this.handleResponse(response);
        } catch (error) {
            return this.handleError(error);
        }
    }

    async patch(endpoint, data = {}) {
        try {
            const response = await this.client.patch(endpoint, data);
            return this.handleResponse(response);
        } catch (error) {
            return this.handleError(error);
        }
    }

    async put(endpoint, data = {}) {
        try {
            const response = await this.client.put(endpoint, data);
            return this.handleResponse(response);
        } catch (error) {
            return this.handleError(error);
        }
    }

    async delete(endpoint) {
        try {
            const response = await this.client.delete(endpoint);
            return this.handleResponse(response);
        } catch (error) {
            return this.handleError(error);
        }
    }

    // Response handler
    handleResponse(response) {
        return {
            success: true,
            data: response.data,
            status: response.status,
            headers: response.headers
        };
    }

    // Error handler
    handleError(error) {
        const errorResponse = {
            success: false,
            error: {
                message: error.message,
                status: error.response?.status,
                data: error.response?.data
            }
        };

        // Log error for debugging
        console.error('API Error:', errorResponse);

        return errorResponse;
    }

    // Utility method to simulate API delay for mock data
    async mockDelay(ms = 500) {
        if (this.useMockApi) {
            await new Promise((resolve) => setTimeout(resolve, ms));
        }
    }

    // Mock response helper
    createMockResponse(data, status = 200) {
        return {
            success: true,
            data: data,
            status: status,
            headers: {}
        };
    }

    // Mock error helper
    createMockError(message, status = 400) {
        return {
            success: false,
            error: {
                message: message,
                status: status,
                data: null
            }
        };
    }
}

// Export configured client and config
export { apiClient, API_CONFIG };
export default new BaseApiService();
