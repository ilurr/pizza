import { createPinia } from 'pinia';
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate';
import { createApp } from 'vue';
import App from './App.vue';
import router from './router';

import { definePreset } from '@primeuix/themes';
import Lara from '@primeuix/themes/lara';
import PrimeVue from 'primevue/config';
import ConfirmationService from 'primevue/confirmationservice';
import ToastService from 'primevue/toastservice';

import '@/assets/styles.scss';

const app = createApp(App);
const pinia = createPinia();
pinia.use(piniaPluginPersistedstate);

const MyPreset = definePreset(Lara, {
    semantic: {
        primary: {
            50: '#ffe5e6',
            100: '#fbbfc1',
            200: '#f58a8e',
            300: '#ef545c',
            400: '#ea1f2a',
            500: '#ff0009',
            600: '#d40008',
            700: '#aa0007',
            800: '#800005',
            900: '#550004',
            950: '#2b0002'
        }
    }
    // components: {
    //     toolbar: {
    //         extend: {
    //             accent: {
    //                 background: '#f59e0b'
    //             }
    //         }
    //     }
    // }
});

app.use(pinia);
app.use(router);
app.use(PrimeVue, {
    theme: {
        preset: MyPreset,
        options: {
            darkModeSelector: '.app-dark'
        }
    }
});
app.use(ToastService);
app.use(ConfirmationService);

app.mount('#app');
