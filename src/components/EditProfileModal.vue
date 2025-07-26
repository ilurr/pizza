<script setup lang="ts">
import { useUserStore } from '@/stores/userStore';
import { useToast } from 'primevue/usetoast';
import { computed, ref, watch } from 'vue';

const props = defineProps({
	visible: {
		type: Boolean,
		default: false
	}
});

const emit = defineEmits(['update:visible']);

const userStore = useUserStore();
const toast = useToast();

const isVisible = computed({
	get: () => props.visible,
	set: (value) => emit('update:visible', value)
});

const isLoading = ref(false);
const errorMessage = ref('');
const formData = ref({
	username: '',
	email: '',
	phone: '',
	fullname: ''
});

const resetForm = () => {
	if (userStore.user) {
		formData.value = {
			username: userStore.user.username || '',
			email: userStore.user.email || '',
			phone: userStore.user.phone || '',
			fullname: userStore.user.fullname || ''
		};
	}
	errorMessage.value = '';
};

const handleSave = async () => {
	isLoading.value = true;

	try {
		await userStore.updateProfile(formData.value);

		toast.add({
			severity: 'success',
			summary: 'Profile Updated',
			detail: 'Your profile has been updated successfully.',
			life: 3000
		});

		closeModal();

	} catch (error) {
		console.error('Error updating profile:', error);

		errorMessage.value = error.message || 'Failed to update profile. Please try again.';
	} finally {
		isLoading.value = false;
	}
};

const closeModal = () => {
	isVisible.value = false;
	resetForm();
};

watch(() => props.visible, (newVal) => {
	if (newVal) {
		resetForm();
	}
});
</script>

<template>
	<Dialog v-model:visible="isVisible" modal header="Edit Profile" :style="{ width: '90vw', maxWidth: '500px' }"
		class="edit-profile-modal" :closable="true" position="center">

		<form @submit.prevent="handleSave">
			<!-- Username -->
			<label for="username" class="block text-surface-900 dark:text-surface-0 text-xl font-medium mb-2">Username</label>
			<InputText id="username" v-model="formData.username" class="w-full mb-8" placeholder="Enter username"
				:disabled="isLoading" required />

			<!-- Full Name -->
			<label for="fullname" class="block text-surface-900 dark:text-surface-0 text-xl font-medium mb-2">Full
				Name</label>
			<InputText id="fullname" v-model="formData.fullname" class="w-full mb-8" placeholder="Enter full name"
				:disabled="isLoading" />

			<!-- Email -->
			<label for="email" class="block text-surface-900 dark:text-surface-0 text-xl font-medium mb-2">Email</label>
			<InputText id="email" v-model="formData.email" type="email" class="w-full mb-8" placeholder="Enter email address"
				:disabled="isLoading" required />

			<!-- Phone -->
			<label for="phone" class="block text-surface-900 dark:text-surface-0 text-xl font-medium mb-2">Phone
				Number</label>
			<InputText id="phone" v-model="formData.phone" type="tel" class="w-full mb-8" placeholder="Enter phone number"
				:disabled="isLoading" />

			<Button label="Save Changes" @click="handleSave" :loading="isLoading" class="w-full" type="submit" />
			<Message v-if="errorMessage" severity="error" variant="simple" size="small"
				class="w-full flex justify-center px-2 py-1 mt-2">{{ errorMessage }}</Message>
		</form>

		<template #footer>
			<div class="flex justify-center">
				<Button label="Cancel" text @click="closeModal" :disabled="isLoading" />
			</div>
		</template>
	</Dialog>
</template>

<style scoped>
.edit-profile-modal :deep(.p-dialog-content) {
	padding: 1.5rem;
}
</style>