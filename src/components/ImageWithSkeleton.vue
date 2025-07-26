<template>
	<div :class="['relative overflow-hidden', wrapperClass]" :style="wrapperStyle">
		<Skeleton v-if="!loaded" :width="skeletonWidth" :height="skeletonHeight" :class="skeletonClass"
			class="absolute inset-0" />
		<img v-show="loaded" :src="src" :alt="alt"
			:class="['w-full h-full object-cover transition-opacity duration-300', imgClass]" @load="onLoad"
			@error="onError" />
	</div>
</template>

<script setup>
import Skeleton from 'primevue/skeleton';
import { computed, ref } from 'vue';

const props = defineProps({
	src: { type: String, required: true },
	alt: { type: String, default: '' },

	width: { type: String, default: '100%' },         // Inline width (optional)
	height: { type: String, default: '200px' },        // Inline height (optional)
	borderRadius: { type: String, default: '' },    // Border-radius in px or %
	wrapperClass: { type: String, default: '' },       // Extra Tailwind classes for wrapper
	imgClass: { type: String, default: '' },           // Extra classes for <img>
	skeletonClass: { type: String, default: '' },      // Custom skeleton styling
	fallback: { type: String, default: '' },           // Fallback image on error
});

const loaded = ref(false);

const wrapperStyle = computed(() => ({
	width: props.width,
	height: props.height,
	borderRadius: props.borderRadius,
}));

const skeletonWidth = computed(() => props.width);
const skeletonHeight = computed(() => props.height);

const onLoad = () => {
	loaded.value = true;
};

const onError = (e) => {
	if (props.fallback) {
		e.target.src = props.fallback;
		loaded.value = true;
	}
};
</script>
