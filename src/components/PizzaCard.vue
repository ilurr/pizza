<script setup lang="ts">
interface Pizza {
	id: string;
	name: string;
	description: string;
	price: number;
	category: string;
	image: string;
	rating: number;
	popular?: boolean;
	available: boolean;
}

interface Props {
	pizza: Pizza;
	showActions?: boolean;
	variant?: 'default' | 'popular';
}

const props = defineProps<Props>();
const emit = defineEmits<{
	addToCart: [pizza: Pizza];
	showDetail: [pizza: Pizza];
}>();

const addToCart = () => {
	// Emit event to parent component
	emit('addToCart', props.pizza);
};

const showDetail = () => {
	// Emit event to show detail modal
	emit('showDetail', props.pizza);
};
</script>

<template>
	<div :class="[
		'card-item relative flex gap-4 border border-gray-300 dark:border-transparent dark:bg-neutral-800 rounded-xl p-4 shadow-sm cursor-pointer md:basis-[calc(50%-(1.5rem/2))]',
		{ 'unavailable': !pizza.available }
	]" @click="showDetail">
		<div class="card-body">
			<h3 class="font-semibold text-xl mb-2">{{ pizza.name }}</h3>
			<p :class="['text-gray-600 dark:text-white text-sm mb-2', variant === 'popular' ? 'line-clamp-2' : '']">{{
				pizza.description }}</p>
			<div class="flex justify-between items-center">
				<span class="text-green-600 font-bold text-lg">Rp{{ pizza.price.toLocaleString() }}</span>
				<!-- <span class="text-sm text-gray-500">{{ pizza.category }}</span> -->
			</div>
			<div class="mt-2 flex items-center">
				<span class="text-yellow-500">★</span>
				<span class="ml-1 text-sm">{{ pizza.rating }}</span>
				<span v-if="pizza.popular" class="ml-2 bg-red-100 text-red-800 px-2 py-1 rounded-full text-xs">
					🔥 Popular
				</span>
			</div>
			<div v-if="!pizza.available" class="mt-2">
				<span class="text-red-600 text-sm">
					Unavailable
				</span>
			</div>
		</div>
		<div class="card-footer">
			<ImageWithSkeleton :src="pizza.image" wrapperClass="relative mx-auto aspect-square md:rounded-xl" width="120px"
				height="120px" />
			<Button v-if="showActions" label="Add" size="small" class="w-full mt-2" :disabled="!pizza.available"
				@click.stop="addToCart" />
		</div>
	</div>
</template>

<style scoped>
.unavailable {
	opacity: 0.5;
	filter: grayscale(1);
	pointer-events: none;
}

/* Popular variant styling - can be customized later */
.pizza-card-popular {
	/* Add any special styling for popular cards here */
	/* Examples: different shadows, borders, etc. */
}
</style>