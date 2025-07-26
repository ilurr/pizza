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
	currentPassword: '',
	newPassword: '',
	confirmPassword: ''
});

const passwordErrors = ref({
	current: '',
	new: '',
	confirm: ''
});

const validateForm = () => {
	passwordErrors.value = {
		current: '',
		new: '',
		confirm: ''
	};

	let isValid = true;

	// Check current password
	if (!formData.value.currentPassword) {
		passwordErrors.value.current = 'Current password is required';
		isValid = false;
	}

	// Check new password
	if (!formData.value.newPassword) {
		passwordErrors.value.new = 'New password is required';
		isValid = false;
	} else if (formData.value.newPassword.length < 6) {
		passwordErrors.value.new = 'Password must be at least 6 characters';
		isValid = false;
	}

	// Check password confirmation
	if (!formData.value.confirmPassword) {
		passwordErrors.value.confirm = 'Please confirm your password';
		isValid = false;
	} else if (formData.value.newPassword !== formData.value.confirmPassword) {
		passwordErrors.value.confirm = 'Passwords do not match';
		isValid = false;
	}

	// Check if new password is different from current
	if (formData.value.currentPassword === formData.value.newPassword) {
		passwordErrors.value.new = 'New password must be different from current password';
		isValid = false;
	}

	return isValid;
};

const handleSubmit = async () => {
	if (!validateForm()) {
		return;
	}

	isLoading.value = true;
	
	try {
		await userStore.changePassword({
			currentPassword: formData.value.currentPassword,
			newPassword: formData.value.newPassword
		});
		
		toast.add({
			severity: 'success',
			summary: 'Password Changed',
			detail: 'Your password has been changed successfully.',
			life: 3000
		});
		
		closeModal();
		
	} catch (error: any) {
		console.error('Error changing password:', error);
		
		// Handle specific error cases
		if (error.message?.includes('current password')) {
			passwordErrors.value.current = 'Current password is incorrect';
		} else {
			errorMessage.value = error.message || 'Failed to change password. Please try again.';
		}
	} finally {
		isLoading.value = false;
	}
};

const resetForm = () => {
	formData.value = {
		currentPassword: '',
		newPassword: '',
		confirmPassword: ''
	};
	passwordErrors.value = {
		current: '',
		new: '',
		confirm: ''
	};
	errorMessage.value = '';
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
	<Dialog 
		v-model:visible="isVisible" 
		modal 
		header="Change Password" 
		:style="{ width: '90vw', maxWidth: '500px' }"
		class="change-password-modal"
		:closable="true"
		position="center">
		
		<form @submit.prevent="handleSubmit">
			<!-- Current Password -->
			<label for="currentPassword" class="block text-surface-900 dark:text-surface-0 text-xl font-medium mb-2">Current Password</label>
			<Password 
				id="currentPassword"
				v-model="formData.currentPassword"
				placeholder="Enter current password"
				:toggleMask="true"
				class="w-full mb-8"
				fluid 
				:feedback="false"
				:disabled="isLoading"
				:invalid="!!passwordErrors.current" />
			<small v-if="passwordErrors.current" class="p-error block -mt-6 mb-4">{{ passwordErrors.current }}</small>

			<!-- New Password -->
			<label for="newPassword" class="block text-surface-900 dark:text-surface-0 text-xl font-medium mb-2">New Password</label>
			<Password 
				id="newPassword"
				v-model="formData.newPassword"
				placeholder="Enter new password"
				:toggleMask="true"
				class="w-full mb-8"
				fluid 
				:feedback="false"
				:disabled="isLoading"
				:invalid="!!passwordErrors.new" />
			<small v-if="passwordErrors.new" class="p-error block -mt-6 mb-4">{{ passwordErrors.new }}</small>

			<!-- Confirm New Password -->
			<label for="confirmPassword" class="block text-surface-900 dark:text-surface-0 text-xl font-medium mb-2">Confirm New Password</label>
			<Password 
				id="confirmPassword"
				v-model="formData.confirmPassword"
				placeholder="Confirm new password"
				:toggleMask="true"
				class="w-full mb-8"
				fluid 
				:feedback="false"
				:disabled="isLoading"
				:invalid="!!passwordErrors.confirm" />
			<small v-if="passwordErrors.confirm" class="p-error block -mt-6 mb-4">{{ passwordErrors.confirm }}</small>

			<Button 
				label="Change Password" 
				@click="handleSubmit"
				:loading="isLoading"
				class="w-full" 
				type="submit" />
			<Message v-if="errorMessage" severity="error" variant="simple" size="small"
				class="w-full flex justify-center px-2 py-1 mt-2">{{ errorMessage }}</Message>
		</form>
		<template #footer>
			<div class="flex justify-center">
				<Button 
					label="Cancel" 
					text 
					@click="closeModal"
					:disabled="isLoading" />
			</div>
		</template>
	</Dialog>
</template>

<style scoped>
.change-password-modal :deep(.p-dialog-content) {
	padding: 1.5rem;
}

.pi-eye {
	transform: scale(1.6);
	margin-right: 1rem;
}

.pi-eye-slash {
	transform: scale(1.6);
	margin-right: 1rem;
}
</style>