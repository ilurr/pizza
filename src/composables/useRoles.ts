import { computed } from 'vue';
import { useUserStore } from '@/stores/userStore';
import { ADMIN_PANEL_ROLES, DASHBOARD_ROLES, ROLES } from '@/constants/roles.js';

export function useRoles() {
    const userStore = useUserStore();

    // Role checks
    const isDriver = computed(() => userStore.role === ROLES.DRIVER);
    const isSuperAdmin = computed(() => userStore.role === ROLES.SUPERADMIN);
    const isMitra = computed(() => userStore.role === ROLES.MITRA);
    
    // Permission checks
    const canAccessDashboard = computed(() => 
        DASHBOARD_ROLES.includes(userStore.role)
    );
    
    const canManageDrivers = computed(() => 
        ADMIN_PANEL_ROLES.includes(userStore.role)
    );
    
    const canViewReports = computed(() => 
        ADMIN_PANEL_ROLES.includes(userStore.role)
    );
    
    const canManageMenu = computed(() => 
        ADMIN_PANEL_ROLES.includes(userStore.role)
    );

    // Helper methods
    const hasRole = (role: string) => userStore.role === role;
    const hasAnyRole = (roles: string[]) => roles.includes(userStore.role);
    const hasPermission = (permission: string) => {
        const permissions = {
            'dashboard': canAccessDashboard.value,
            'manage_drivers': canManageDrivers.value,
            'view_reports': canViewReports.value,
            'manage_menu': canManageMenu.value,
        };
        return permissions[permission] || false;
    };

    return {
        // Role checks
        isDriver,
        isSuperAdmin, 
        isMitra,
        
        // Permission checks
        canAccessDashboard,
        canManageDrivers,
        canViewReports,
        canManageMenu,
        
        // Helper methods
        hasRole,
        hasAnyRole,
        hasPermission,
        
        // Current role
        currentRole: computed(() => userStore.role)
    };
}