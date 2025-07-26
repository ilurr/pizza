import { defineStore } from 'pinia';

export const useOrderStore = defineStore('order', {
    state: () => ({
        // Order progress tracking
        currentStep: 'location', // location -> driver -> menu -> checkout
        completedSteps: [],
        
        // Location data
        userLocation: null,
        availableDrivers: [],
        
        // Driver selection
        selectedDriver: null,
        showDriverList: false,
        
        // Loading states
        isLoadingLocation: false,
        isLoadingDrivers: false,
        
        // Order metadata
        orderStartedAt: null,
        lastActivityAt: null
    }),

    getters: {
        isStepCompleted: (state) => (step) => {
            return state.completedSteps.includes(step);
        },

        canProceedToStep: (state) => (step) => {
            const stepOrder = ['location', 'driver', 'menu', 'checkout'];
            const stepIndex = stepOrder.indexOf(step);
            const currentIndex = stepOrder.indexOf(state.currentStep);
            
            // Can proceed to current step or any completed step
            return stepIndex <= currentIndex || state.completedSteps.includes(step);
        },

        progressPercentage: (state) => {
            const totalSteps = 4; // location, driver, menu, checkout
            const completedCount = state.completedSteps.length;
            return Math.round((completedCount / totalSteps) * 100);
        },

        hasInProgressOrder: (state) => {
            return state.userLocation !== null || state.selectedDriver !== null;
        },

        orderSummary: (state) => {
            return {
                location: state.userLocation,
                driver: state.selectedDriver,
                step: state.currentStep,
                progress: state.completedSteps.length,
                startedAt: state.orderStartedAt
            };
        }
    },

    actions: {
        // Initialize or resume order
        initializeOrder() {
            if (!this.orderStartedAt) {
                this.orderStartedAt = new Date().toISOString();
            }
            this.updateActivity();
        },

        // Update last activity timestamp
        updateActivity() {
            this.lastActivityAt = new Date().toISOString();
        },

        // Step management
        setCurrentStep(step) {
            this.currentStep = step;
            this.updateActivity();
        },

        completeStep(step) {
            if (!this.completedSteps.includes(step)) {
                this.completedSteps.push(step);
            }
            this.updateActivity();
        },

        goToStep(step) {
            if (this.canProceedToStep(step)) {
                this.currentStep = step;
                this.updateActivity();
                return true;
            }
            return false;
        },

        // Location management
        setUserLocation(location) {
            this.userLocation = location;
            this.completeStep('location');
            
            // Auto proceed to driver selection
            if (this.currentStep === 'location') {
                this.setCurrentStep('driver');
            }
            this.updateActivity();
        },

        setAvailableDrivers(drivers) {
            this.availableDrivers = drivers;
            this.showDriverList = true;
            this.updateActivity();
        },

        selectDriver(driver) {
            this.selectedDriver = driver;
            this.showDriverList = false;
            this.completeStep('driver');
            
            // Auto proceed to menu
            if (this.currentStep === 'driver') {
                this.setCurrentStep('menu');
            }
            this.updateActivity();
        },

        // Reset specific parts
        resetLocation() {
            this.userLocation = null;
            this.availableDrivers = [];
            this.selectedDriver = null;
            this.showDriverList = false;
            this.completedSteps = this.completedSteps.filter(step => 
                !['location', 'driver', 'menu'].includes(step)
            );
            this.currentStep = 'location';
            this.updateActivity();
        },

        resetDriver() {
            this.selectedDriver = null;
            this.showDriverList = this.availableDrivers.length > 0;
            this.completedSteps = this.completedSteps.filter(step => 
                !['driver', 'menu'].includes(step)
            );
            this.currentStep = 'driver';
            this.updateActivity();
        },

        // Complete reset
        resetOrder() {
            this.currentStep = 'location';
            this.completedSteps = [];
            this.userLocation = null;
            this.availableDrivers = [];
            this.selectedDriver = null;
            this.showDriverList = false;
            this.isLoadingLocation = false;
            this.isLoadingDrivers = false;
            this.orderStartedAt = null;
            this.lastActivityAt = null;
        },

        // Resume order state (called when returning to OrderNow page)
        resumeOrder() {
            this.updateActivity();
            
            // If we have location but no driver, show driver selection
            if (this.userLocation && !this.selectedDriver && this.availableDrivers.length > 0) {
                this.showDriverList = true;
                this.setCurrentStep('driver');
            }
            
            // If we have both location and driver, allow menu access
            if (this.userLocation && this.selectedDriver) {
                this.setCurrentStep('menu');
            }
        },

        // Check if order is stale (more than 30 minutes old)
        isOrderStale() {
            if (!this.lastActivityAt) return false;
            
            const lastActivity = new Date(this.lastActivityAt);
            const now = new Date();
            const diffMinutes = (now - lastActivity) / (1000 * 60);
            
            return diffMinutes > 30; // 30 minutes timeout
        }
    },

    // Persist state to localStorage
    persist: {
        key: 'pizza-order-state',
        storage: localStorage,
        paths: [
            'currentStep',
            'completedSteps', 
            'userLocation',
            'availableDrivers',
            'selectedDriver',
            'orderStartedAt',
            'lastActivityAt'
        ]
    }
});