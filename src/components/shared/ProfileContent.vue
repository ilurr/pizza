<script setup>
import ChangePasswordModal from '@/components/ChangePasswordModal.vue';
import EditProfileModal from '@/components/EditProfileModal.vue';
import { useAuth } from '@/composables/useAuth';
import { useAvatar } from '@/composables/useAvatar';
import { useUserStore } from '@/stores/userStore';
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();
const userStore = useUserStore();
const { confirmLogout } = useAuth();

const props = defineProps({
    variant: {
        type: String,
        default: 'auto', // 'auto', 'dashboard', 'customer'
        validator: (value) => ['auto', 'dashboard', 'customer'].includes(value)
    },
    showStats: {
        type: Boolean,
        default: true
    }
});

// Auto-detect layout context
const layoutContext = computed(() => {
    if (props.variant !== 'auto') return props.variant;
    return route.path.startsWith('/dashboard') ? 'dashboard' : 'customer';
});

const isDashboard = computed(() => layoutContext.value === 'dashboard');

// Use shared avatar composable
const { userInitials, bgColor } = useAvatar(computed(() => userStore.user?.username));

// Modal states
const showEditProfileModal = ref(false);
const showChangePasswordModal = ref(false);

const handleEditProfile = () => {
    showEditProfileModal.value = true;
};

const handleChangePassword = () => {
    showChangePasswordModal.value = true;
};

const handleLogout = () => {
    confirmLogout('/auth/login');
};

// Menu items for PanelMenu (duplicated from existing)
const menuItems = ref([
    {
        label: 'Account',
        separator: true
    },
    {
        label: 'Change Password',
        desc: 'Change your password at any time',
        icon: 'pi pi-lock',
        command: handleChangePassword
    },
    {
        label: 'Logout',
        desc: 'Logout from this site',
        icon: 'pi pi-sign-out',
        command: handleLogout,
        class: 'text-red-600 dark:text-red-400'
    }
]);

onMounted(async () => {
    // Fetch user data from Strapi if not already loaded
    if (!userStore.user) {
        await userStore.fetchUser();
    }
});
</script>

<template>
    <div class="profile-content">

        <div class="relative p-4 md:max-w-xl md:mx-auto">
            <!-- Top Profile Section (duplicated from existing) -->
            <div
                class="relative z-50 bg-white dark:bg-neutral-800 rounded-lg shadow-lg border border-gray-200 dark:border-transparent p-4 mb-6">
                <div class="flex items-center gap-4">
                    <!-- Avatar -->
                    <div class="relative basis-1/6 w-1/6 grow-0">
                        <div v-if="userStore.user?.avatar" class="w-auto overflow-hidden">
                            <Avatar :image="userStore.user.avatar" size="large" shape="circle" />
                            <!-- <img :src="userStore.user.avatar" :alt="userStore.user.username" class="w-full h-full object-cover" /> -->
                        </div>
                        <div v-else
                            class="w-full aspect-square rounded-full flex items-center justify-center text-white text-2xl"
                            :style="{ backgroundColor: bgColor }">
                            {{ userInitials }}
                        </div>
                    </div>

                    <!-- User Info -->
                    <div class="flex flex-col basis-4/6 w-1/6 grow truncate">
                        <h2 class="font-medium text-lg text-gray-900 dark:text-white mb-0 truncate">
                            {{ userStore.user?.fullname || 'Loading...' }}
                        </h2>
                        <p class="text-gray-600 dark:text-gray-400 truncate">
                            {{ userStore.user?.email || 'Loading...' }}
                        </p>
                    </div>

                    <!-- Edit Icon -->
                    <Button icon="pi pi-pencil" severity="secondary" text size="small" @click="handleEditProfile"
                        class="h-10 basis-1/6 grow-0 !w-1/6" />
                </div>
            </div>

            <!-- Menu Sections (duplicated from existing) -->
            <PanelMenu :model="menuItems">
                <template #item="{ item }">
                    <a v-if="!item.separator" v-ripple class="flex items-center p-4 cursor-pointer group"
                        @click="item.command">
                        <span :class="[item.icon, '!text-xl group-hover:text-inherit']" />
                        <span :class="['ml-6', item.class]">{{ item.label }} <i class="flex text-xs not-italic mt-1">{{
                            item.desc }}</i></span>
                        <Badge v-if="item.badge" class="ml-auto" :value="item.badge" />
                        <span v-if="item.shortcut"
                            class="ml-auto border border-surface rounded bg-emphasis text-muted-color text-xs p-1">{{
                                item.shortcut }}</span>
                    </a>
                    <div v-else
                        class="px-4 py-3 text-base font-semibold text-gray-700 dark:text-gray-300 hover:bg-transparent">
                        {{ item.label }}
                    </div>
                </template>
            </PanelMenu>

            <!-- Modals -->
            <EditProfileModal v-model:visible="showEditProfileModal" />
            <ChangePasswordModal v-model:visible="showChangePasswordModal" />
        </div>
    </div>
</template>