import { computed } from 'vue';
import { useUserStore } from '@/stores/userStore';

export function useRoles() {
    const userStore = useUserStore();

    // Role checks
    const isDriver = computed(() => userStore.role === 'drivers');
    const isSuperAdmin = computed(() => userStore.role === 'superadmin');
    const isMitra = computed(() => userStore.role === 'mitra');
    
    // Permission checks
    const canAccessDashboard = computed(() => 
        ['superadmin', 'drivers', 'mitra'].includes(userStore.role)
    );
    
    const canManageDrivers = computed(() => 
        ['superadmin', 'mitra'].includes(userStore.role)
    );
    
    const canViewReports = computed(() => 
        ['superadmin', 'mitra'].includes(userStore.role)
    );
    
    const canManageMenu = computed(() => 
        ['superadmin', 'mitra'].includes(userStore.role)
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