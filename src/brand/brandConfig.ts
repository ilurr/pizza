export const brandConfig = {
    name: 'Panggil Papa Pizza',
    shortName: 'Papa Pizza',
    colors: {
        primary: '#E9282A', // main red
        secondary: '#FFE81B' // accent yellow
    },
    logos: {
        square: new URL('@/assets/images/LogoSquareRedSVG.svg', import.meta.url).href,
        circle: new URL('@/assets/images/LogoCircleRedSVG.svg', import.meta.url).href
    }
};

export default brandConfig;

