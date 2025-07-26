<script setup lang="ts">
import ChangePasswordModal from '@/components/ChangePasswordModal.vue';
import EditProfileModal from '@/components/EditProfileModal.vue';
import { useAuth } from '@/composables/useAuth';
import { useAvatar } from '@/composables/useAvatar';
import AppTopbar from '@/layout/AppTopbar.vue';
import { useUserStore } from '@/stores/userStore';
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const userStore = useUserStore();
const { goToLogin, goToSignUp, confirmLogout } = useAuth();

// Use shared avatar composable
const { userInitials, bgColor } = useAvatar(computed(() => userStore.user?.fullname));

// Modal states
const showEditProfileModal = ref(false);
const showChangePasswordModal = ref(false);

const goBack = () => {
	router.push('/');
};

const handleEditProfile = () => {
	showEditProfileModal.value = true;
};

const handleChangePassword = () => {
	showChangePasswordModal.value = true;
};

const handleLogout = () => {
	confirmLogout('/auth/login');
};

// Menu items for PanelMenu
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
	<div class="bg-white dark:bg-neutral-900">
		<div class="landing-wrapper overflow-hidden">
			<app-topbar variant="page-header" page-title="Profile" @back="goBack"></app-topbar>
			<FloatingMenu />
			<div class="relative lg:mx-80 mx-auto pt-16 md:pt-16 mb-32">
				<div class="relative p-4 md:max-w-xl md:mx-auto">

					<!-- Top Profile Section -->

					<div
						class="relative z-50 bg-white dark:bg-neutral-800 rounded-lg shadow-lg border border-gray-200 dark:border-transparent p-4 mb-6">
						<div class="flex items-center gap-4">
							<!-- Avatar -->
							<div class="relative basis-1/6 w-1/6 grow-0">
								<div v-if="userStore.user?.avatar" class="w-auto ratio-square rounded-full overflow-hidden">
									<img :src="userStore.user.avatar" :alt="userStore.user.username" class="w-full h-full object-cover" />
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

					<!-- Menu Sections -->
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
				</div>
			</div>
		</div>

		<!-- Modals -->
		<EditProfileModal v-model:visible="showEditProfileModal" />

		<ChangePasswordModal v-model:visible="showChangePasswordModal" />
	</div>
</template>

<style scoped>
.landing-wrapper {
	min-height: 100vh;
}
</style>