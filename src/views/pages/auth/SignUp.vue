<script setup>
import bg from '@/assets/images/BgMain.svg';
import logo from '@/assets/images/LogoCircleRedSVG.svg';
import { useToast } from 'primevue/usetoast';
import { ref } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const toast = useToast();

const fullName = ref('');
const email = ref('');
const whatsapp = ref('');
const password = ref('');
const confirmPassword = ref('');
const acceptedTerms = ref(false);

const errorMessage = ref('');
const fieldErrors = ref({
	email: '',
	fullName: '',
	whatsapp: '',
	password: '',
	confirmPassword: '',
	terms: ''
});

const validateForm = () => {
	fieldErrors.value = {
		email: '',
		fullName: '',
		whatsapp: '',
		password: '',
		confirmPassword: '',
		terms: ''
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

	// Full name validation
	if (!fullName.value) {
		fieldErrors.value.fullName = 'Full name is required';
		isValid = false;
	}

	// WhatsApp validation
	if (!whatsapp.value) {
		fieldErrors.value.whatsapp = 'WhatsApp number is required';
		isValid = false;
	} else if (!/^\+?[1-9]\d{1,14}$/.test(whatsapp.value.replace(/\s/g, ''))) {
		fieldErrors.value.whatsapp = 'Please enter a valid WhatsApp number';
		isValid = false;
	}

	// Password validation
	if (!password.value) {
		fieldErrors.value.password = 'Password is required';
		isValid = false;
	} else if (password.value.length < 6) {
		fieldErrors.value.password = 'Password must be at least 6 characters';
		isValid = false;
	}

	// Confirm password validation
	if (!confirmPassword.value) {
		fieldErrors.value.confirmPassword = 'Please confirm your password';
		isValid = false;
	} else if (password.value !== confirmPassword.value) {
		fieldErrors.value.confirmPassword = 'Passwords do not match';
		isValid = false;
	}

	// Terms validation
	if (!acceptedTerms.value) {
		fieldErrors.value.terms = 'You must accept the terms and conditions';
		isValid = false;
	}

	return isValid;
};

const handleRegister = async () => {
	if (!validateForm()) {
		return;
	}

	try {
		// Replace with your actual backend endpoint
		// const response = await axios.post('/api/auth/local/register', {
		//     fullName: fullName.value,
		//     username: username.value,
		//     email: email.value,
		//     whatsapp: whatsapp.value,
		//     password: password.value
		// });

		toast.add({ severity: 'success', summary: 'Success', detail: 'Pendaftaran berhasil! Anda akan diarahkan ke halaman login', life: 3000 });
		setTimeout(() => router.push('/auth/login'), 2000);
	} catch (error) {
		errorMessage.value = error?.response?.data?.error?.message || 'Terjadi kesalahan saat mendaftar.';
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
		<div class="max-w-xl flex flex-col items-center justify-center mt-20 mb-8 px-4 sm:px-0 z-[2]">
			<div
				class="w-full bg-surface-0 dark:bg-surface-900 py-6 px-6 sm:px-10 sm:py-10 rounded-xl shadow-lg md:shadow-2xl">
				<div class="flex justify-center flex-col items-center mb-8">
					<div class="flex justify-center items-center w-24 mb-6 -mt-20 md:-mt-24">
						<ImageWithSkeleton :src="logo" wrapperClass="relative mx-auto aspect-square md:rounded-xl" width="84px"
							height="84px" />
					</div>
					<div class="text-surface-900 dark:text-surface-0 text-3xl font-medium mb-4 text-left w-full">Sign Up</div>
					<span class="text-muted-color font-medium">Daftar dulu, setelah itu kamu bisa panggil papa pizza untuk dateng
						ke tempatmu!</span>
				</div>

				<form @submit.prevent="handleRegister">
					<label for="email" class="block text-surface-900 dark:text-surface-0 text-xl font-medium mb-2">Email *</label>
					<InputText id="email" type="email" placeholder="Your email" class="w-full mb-8" v-model="email"
						:class="{ 'p-invalid': fieldErrors.email }" />
					<small v-if="fieldErrors.email" class="p-error block -mt-6 mb-4">{{ fieldErrors.email }}</small>

					<label for="fullName" class="block text-surface-900 dark:text-surface-0 text-xl font-medium mb-2">Fullname
						*</label>
					<InputText id="fullName" type="text" placeholder="Your full name" class="w-full mb-8" v-model="fullName"
						:class="{ 'p-invalid': fieldErrors.fullName }" />
					<small v-if="fieldErrors.fullName" class="p-error block -mt-6 mb-4">{{ fieldErrors.fullName }}</small>

					<label for="whatsapp" class="block text-surface-900 dark:text-surface-0 text-xl font-medium mb-2">No. Whatsapp
						*</label>
					<InputText id="whatsapp" type="tel" placeholder="Your WhatsApp number" class="w-full mb-8" v-model="whatsapp"
						:class="{ 'p-invalid': fieldErrors.whatsapp }" />
					<small v-if="fieldErrors.whatsapp" class="p-error block -mt-6 mb-4">{{ fieldErrors.whatsapp }}</small>

					<label for="password" class="block text-surface-900 dark:text-surface-0 font-medium text-xl mb-2">Password
						*</label>
					<Password id="password" v-model="password" placeholder="Your password" :toggleMask="true" class="w-full mb-8"
						fluid :feedback="false" :invalid="!!fieldErrors.password"></Password>
					<small v-if="fieldErrors.password" class="p-error block -mt-6 mb-4">{{ fieldErrors.password }}</small>

					<label for="confirmPassword"
						class="block text-surface-900 dark:text-surface-0 font-medium text-xl mb-2">Confirm Password *</label>
					<Password id="confirmPassword" v-model="confirmPassword" placeholder="Confirm your password"
						:toggleMask="true" class="w-full mb-8" fluid :feedback="false" :invalid="!!fieldErrors.confirmPassword">
					</Password>
					<small v-if="fieldErrors.confirmPassword" class="p-error block -mt-6 mb-4">{{ fieldErrors.confirmPassword
					}}</small>

					<label class="block text-surface-900 dark:text-surface-0 font-medium text-xl mb-2">Terms and Condition</label>
					<div class="terms flex items-center justify-between p-2 mb-6 gap-8 border rounded border-gray-500">
						<ScrollPanel :style="{ width: '100%', height: '200px' }">
							<ol>
								<li>Dengan mendaftar di website kami, Anda menyetujui untuk mematuhi dan terikat oleh syarat dan
									ketentuan berikut, yang dapat kami perbarui dari waktu ke waktu tanpa pemberitahuan sebelumnya.</li>
								<li>Kami menghargai privasi Anda. Semua informasi pribadi yang dikumpulkan selama proses pendaftaran
									akan digunakan sesuai dengan kebijakan privasi kami.</li>
								<li>Kontak yang anda cantumkan akan mempermudah kami untuk konfirmasi pengiriman pesanan anda.</li>
								<li>Anda tidak boleh menggunakan website kami untuk tujuan yang melanggar hukum atau tidak sah.</li>
								<li>
									Kami berhak untuk mengubah syarat dan ketentuan ini kapan saja. Perubahan akan efektif segera setelah
									diposting di website kami. Penggunaan terus-menerus Anda atas website setelah perubahan diposting akan
									dianggap
									sebagai penerimaan Anda terhadap perubahan tersebut.
								</li>
								<li>
									Kami berhak untuk mengakhiri atau menangguhkan akses Anda ke website kami tanpa pemberitahuan
									sebelumnya atau kewajiban apa pun, jika Anda melanggar syarat dan ketentuan ini atau terlibat dalam
									aktivitas yang
									dianggap tidak sesuai oleh kami.
								</li>
							</ol>
							<Checkbox v-model="acceptedTerms" id="terms" binary class="mr-2"
								:class="{ 'p-invalid': fieldErrors.terms }"></Checkbox>
							<label for="terms">Setuju & Lanjutkan</label>

							<ScrollTop target="parent" :threshold="100" icon="pi pi-arrow-up"></ScrollTop>
						</ScrollPanel>
					</div>
					<small v-if="fieldErrors.terms" class="p-error block -mt-4 mb-4">{{ fieldErrors.terms }}</small>
					<Button label="Sign Up" class="w-full" type="submit"></Button>
					<Message v-if="errorMessage" severity="error" variant="simple" size="small"
						class="w-full flex justify-center px-2 py-1">{{ errorMessage }}</Message>
				</form>

				<Divider layout="horizontal" class="flex !mt-6 !mb-8">Atau, sudah punya akun? Log In di sini</Divider>

				<router-link to="/auth/login">
					<Button label="Log In" class="w-full" type="link" severity="contrast" outlined></Button>
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
.pi-eye {
	transform: scale(1.6);
	margin-right: 1rem;
}

.pi-eye-slash {
	transform: scale(1.6);
	margin-right: 1rem;
}

.terms ol,
.terms ul {
	list-style: disc;
	padding: 0 0 0 1rem;
}

.terms ol {
	list-style: decimal;
}

.terms li {
	list-style: inherit;
	display: list-item;
	margin: 0 0 0.75em;
}
</style>
