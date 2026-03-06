<script setup lang="ts">
import { computed, ref } from 'vue';

const props = withDefaults(
	defineProps<{
		modelValue?: number;
		readonly?: boolean;
		size?: 'sm' | 'md' | 'lg' | 'xl';
	}>(),
	{ modelValue: 0, readonly: false, size: 'md' }
);

const emit = defineEmits<{
	(e: 'update:modelValue', value: number): void;
}>();

const hoverScore = ref(0);

const sizeClass = computed(() => {
	switch (props.size) {
		case 'sm':
			return '!text-sm';
		case 'lg':
			return '!text-xl';
		case 'xl':
			return '!text-2xl';
		default:
			return '!text-base';
	}
});

const displayScore = computed(() => hoverScore.value || props.modelValue);

const setRating = (score: number) => {
	if (props.readonly) return;
	emit('update:modelValue', score);
};

const setHover = (score: number) => {
	if (props.readonly) return;
	hoverScore.value = score;
};

const clearHover = () => {
	hoverScore.value = 0;
};
</script>

<template>
	<div class="inline-flex items-center gap-0.5" role="group"
		:aria-label="readonly ? `Rated ${modelValue} out of 5` : 'Rate 1 to 5 stars'">
		<button v-for="star in 5" :key="star" type="button"
			class="p-0.5 rounded focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-offset-1 transition-colors flex items-center justify-center"
			:class="readonly ? 'cursor-default' : 'cursor-pointer hover:opacity-90'" :disabled="readonly"
			:aria-label="`${star} star${star > 1 ? 's' : ''}`" @click.stop="setRating(star)" @mouseenter="setHover(star)"
			@mouseleave="clearHover">
			<i :class="`${sizeClass} ${star <= displayScore ? 'pi pi-star-fill text-yellow-400' : 'pi pi-star text-gray-300 dark:text-gray-500'}`"
				:aria-hidden="true"></i>
		</button>
	</div>
</template>
