/** @type {import('tailwindcss').Config} */
import PrimeUI from 'tailwindcss-primeui';

export default {
    darkMode: ['selector', '[class*="app-dark"]'],
    content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
    plugins: [PrimeUI],
    theme: {
        screens: {
            sm: '576px',
            md: '768px',
            lg: '992px',
            xl: '1200px',
            '2xl': '1920px'
        },
        extend: {
            colors: {
                // Core brand colors (2-color identity)
                'brand-primary': '#E9282A',
                'brand-secondary': '#FFE81B',
                // Backwards-compatible aliases
                'papa-red': '#E9282A',
                'papa-yellow': '#FFE81B'
            }
        }
    }
};
