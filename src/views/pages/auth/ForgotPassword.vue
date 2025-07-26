<script setup>
import bg from '@/assets/images/BgMain.svg';
import logo from '@/assets/images/LogoCircleRedSVG.svg';
import { useToast } from 'primevue/usetoast';
import { ref } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const toast = useToast();

const email = ref('');
const isLoading = ref(false);
const isSuccess = ref(false);
const errorMessage = ref('');
const fieldErrors = ref({
    email: ''
});

const validateForm = () => {
    fieldErrors.value = {
        email: ''
    };

    let isValid = true;

    // Email validation
    if (!email.value) {
        fieldErrors.value.email = 'Email is required';
        isValid = false;
    } else if (!/\S+@\S+\.\S+/.test(email.value)) {
        fieldErrors.value.email = 'Please enter a valid email address';
        isValid = false;
    }

    return isValid;
};

const handleForgotPassword = async () => {
    if (!validateForm()) {
        return;
    }

    isLoading.value = true;
    errorMessage.value = '';

    try {
        // TODO: Replace with actual API call to your backend
        // const response = await axios.post('/api/auth/forgot-password', {
        //     email: email.value
        // });

        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 2000));

        isSuccess.value = true;
        toast.add({
            severity: 'success',
            summary: 'Email Sent',
            detail: 'Password reset instructions have been sent to your email.',
            life: 5000
        });

    } catch (error) {
        errorMessage.value = error?.response?.data?.error?.message || 'Failed to send reset email. Please try again.';
        toast.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to send reset email. Please try again.',
            life: 3000
        });
    } finally {
        isLoading.value = false;
    }
};

const goToLogin = () => {
    router.push('/auth/login');
};
</script>

<template>
    <div
        class="bg-surface-50 dark:bg-surface-950 flex items-center justify-center min-h-screen min-w-[100vw] overflow-hidden">
        <div class="fixed bottom-0 size-full z-[1] overflow-hidden">
            <img :src="bg" alt=""
                class="absolute top-0 w-[100vw] h-[100vw] md:w-full md:h-full opacity-50 md:opacity-100 -rotate-90 md:rotate-180 object-cover" />
        </div>
        <div class="min-w-[425px] hidden md:block"></div>
        <div class="max-w-lg flex flex-col items-center justify-center mt-16 mb-8 px-4 sm:px-0 z-[2]">
            <div
                class="w-full bg-surface-0 dark:bg-surface-900 py-6 px-6 sm:px-10 sm:py-10 rounded-xl shadow-lg md:shadow-2xl">

                <!-- Header Section -->
                <div class="flex justify-center flex-col items-center mb-8">
                    <div class="flex justify-center items-center w-24 mb-6 -mt-20 md:-mt-24">
                        <ImageWithSkeleton :src="logo" wrapperClass="relative mx-auto aspect-square md:rounded-xl"
                            width="84px" height="84px" />
                    </div>
                    <div class="text-surface-900 dark:text-surface-0 text-3xl font-medium mb-4 text-left w-full">
                        {{ isSuccess ? 'Check Your Email' : 'Forgot Password' }}
                    </div>
                    <span class="text-muted-color font-medium text-center">
                        {{ isSuccess
                            ? 'We have sent password reset instructions to your email address.'
                            : 'Enter your email address and we\'ll send you instructions to reset your password.'
                        }}
                    </span>
                </div>

                <!-- Success State -->
                <div v-if="isSuccess" class="text-center">
                    <div class="mb-6">
                        <i class="pi pi-check-circle text-green-500 text-6xl mb-4"></i>
                        <p class="text-surface-600 dark:text-surface-400 mb-2">
                            Password reset email sent to:
                        </p>
                        <p class="font-semibold text-surface-900 dark:text-surface-0">
                            {{ email }}
                        </p>
                    </div>

                    <div class="space-y-4">
                        <p class="text-sm text-surface-600 dark:text-surface-400">
                            Didn't receive the email? Check your spam folder or try again.
                        </p>

                        <Button label="Send Again" outlined class="w-full" @click="isSuccess = false; email = ''" />

                        <Button label="Back to Login" class="w-full" @click="goToLogin" />
                    </div>
                </div>

                <!-- Form State -->
                <form v-else @submit.prevent="handleForgotPassword">
                    <label for="email" class="block text-surface-900 dark:text-surface-0 text-xl font-medium mb-2">
                        Email Address
                    </label>
                    <InputText id="email" type="email" placeholder="Enter your email address" class="w-full mb-8"
                        v-model="email" :class="{ 'p-invalid': fieldErrors.email }" :disabled="isLoading" />
                    <small v-if="fieldErrors.email" class="p-error block -mt-6 mb-4">
                        {{ fieldErrors.email }}
                    </small>

                    <Button label="Send Reset Instructions" class="w-full mb-4" type="submit" :loading="isLoading"
                        :disabled="isLoading" />

                    <Message v-if="errorMessage" severity="error" variant="simple" size="small"
                        class="w-full flex justify-center px-2 py-1 mb-4">
                        {{ errorMessage }}
                    </Message>
                </form>

                <!-- Footer Links -->
                <Divider layout="horizontal" class="flex !mt-6 !mb-8">
                    Remember your password?
                </Divider>

                <router-link to="/auth/login">
                    <Button label="Back to Login" class="w-full" type="link" severity="contrast" outlined></Button>
                </router-link>

                <router-link to="/" class="flex w-full justify-center pt-4">
                    <Button label="Back to home" class="p-button-link"></Button>
                </router-link>
            </div>
        </div>
    </div>
    <Toast position="bottom-right" />
</template>

<style scoped>
.pi-check-circle {
    display: block;
    margin: 0 auto;
}
</style>