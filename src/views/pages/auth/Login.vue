<script setup>
import bg from '@/assets/images/BgMain.svg';
import logo from '@/assets/images/LogoCircleRedSVG.svg';
import { useUserStore } from '@/stores/userStore.ts';
import { login } from '@/utils/auth';
import { ref } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const userStore = useUserStore();
const identifier = ref('');
const password = ref('');
const errorMessage = ref('');
const checked = ref(false);
const fieldErrors = ref({
    identifier: '',
    password: ''
});

const validateForm = () => {
    fieldErrors.value = {
        identifier: '',
        password: ''
    };

    let isValid = true;

    // Email/identifier validation
    if (!identifier.value) {
        fieldErrors.value.identifier = 'Email is required';
        isValid = false;
    } else if (!/\S+@\S+\.\S+/.test(identifier.value)) {
        fieldErrors.value.identifier = 'Please enter a valid email address';
        isValid = false;
    }

    // Password validation
    if (!password.value) {
        fieldErrors.value.password = 'Password is required';
        isValid = false;
    }

    return isValid;
};

const handleLogin = async () => {
    if (!validateForm()) {
        return;
    }

    try {
        await login(identifier.value, password.value);

        // Check if there's a specific redirect URL in query params
        const redirectPath = router.currentRoute.value.query.redirect;
        if (redirectPath && typeof redirectPath === 'string') {
            router.push(redirectPath); // Go back to where user came from
            return;
        }

        // Wait for user data to be fetched to determine role-based redirect
        await userStore.fetchUser();

        // Determine default redirect based on user role
        const userRole = userStore.role;

        if (userRole === 'superadmin' || userRole === 'mitra') {
            // Admin users go to dashboard
            router.push('/dashboard');
        } else if (userRole === 'drivers') {
            // Driver users go to driver dashboard
            router.push('/driver');
        } else {
            // Regular customers go to home page
            router.push('/');
        }
    } catch (error) {
        // Ensure error is treated as an Axios error
        if (error instanceof Error) {
            errorMessage.value = error?.response?.data?.error?.message || error.message;
        } else {
            errorMessage.value = 'An unknown error occurred';
        }
    }
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
                class="w-full bg-white dark:bg-neutral-900 py-6 px-6 sm:px-10 sm:py-10 rounded-xl shadow-lg md:shadow-2xl">
                <div class="flex justify-center flex-col items-center mb-8">
                    <div class="flex justify-center items-center w-24 mb-6 -mt-20 md:-mt-24">
                        <ImageWithSkeleton :src="logo" wrapperClass="relative mx-auto aspect-square md:rounded-xl"
                            width="84px" height="84px" />
                    </div>
                    <div class="text-surface-900 dark:text-surface-0 text-3xl font-medium mb-4 text-left w-full">Sign In
                    </div>
                    <span class="text-muted-color font-medium">Setelah login, Kamu bisa panggil papa pizza untuk dateng
                        ke tempat kamu!</span>
                </div>

                <form @submit.prevent="handleLogin">
                    <label for="identifier"
                        class="block text-surface-900 dark:text-surface-0 text-xl font-medium mb-2">Email</label>
                    <InputText id="identifier" type="email" placeholder="Your email" class="w-full mb-8"
                        v-model="identifier" :class="{ 'p-invalid': fieldErrors.identifier }" />
                    <small v-if="fieldErrors.identifier" class="p-error block -mt-6 mb-4">{{ fieldErrors.identifier
                        }}</small>

                    <label for="password"
                        class="block text-surface-900 dark:text-surface-0 font-medium text-xl mb-2">Password</label>
                    <Password id="password" v-model="password" placeholder="Your password" :toggleMask="true"
                        class="mb-8" fluid :feedback="false" :invalid="!!fieldErrors.password"></Password>
                    <small v-if="fieldErrors.password" class="p-error block -mt-6 mb-4">{{ fieldErrors.password
                        }}</small>

                    <div class="flex items-center justify-between mt-2 mb-8 gap-8">
                        <!-- <div class="flex items-center">
                            <Checkbox v-model="checked" id="rememberme1" binary class="mr-2"></Checkbox>
                            <label for="rememberme1">Remember me</label>
                        </div> -->
                        <router-link to="/auth/forgot-password"
                            class="font-medium no-underline ml-2 text-right cursor-pointer text-primary hover:underline">
                            Forgot password?
                        </router-link>
                    </div>
                    <Button label="Log In" class="w-full" type="submit"></Button>
                    <Message v-if="errorMessage" severity="error" variant="simple" size="small"
                        class="w-full flex justify-center px-2 py-1">{{ errorMessage }}</Message>
                </form>

                <Divider layout="horizontal" class="flex !mt-6 !mb-8">Atau, kamu bisa daftar dulu</Divider>

                <router-link to="/auth/signup">
                    <Button label="Sign Up" class="w-full" type="link" severity="contrast" outlined></Button>
                </router-link>

                <router-link to="/" class="flex w-full justify-center pt-4">
                    <Button label="Back to home" class="p-button-link"></Button>
                </router-link>
            </div>
        </div>
    </div>
</template>

<style scoped>
.pi-eye {
    transform: scale(1.6);
    margin-right: 1rem;
}

.pi-eye-slash {
    transform: scale(1.6);
    margin-right: 1rem;
}
</style>
