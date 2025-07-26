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
	visible: boolean;
	pizza: Pizza | null;
	showActions?: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{
	'update:visible': [value: boolean];
	'addToCart': [pizza: Pizza, quantity: number];
}>();

const closeModal = () => {
	emit('update:visible', false);
};

const addToCart = () => {
	if (props.pizza) {
		emit('addToCart', props.pizza, 1);
		closeModal();
	}
};
</script>

<template>
	<Dialog :visible="visible" modal :header="pizza?.name || ''" :style="{ width: '50rem' }"
		:breakpoints="{ '1199px': '75vw', '575px': '90vw' }" class="dialog-flex-end" @update:visible="closeModal">
		<div v-if="pizza" class="flex flex-col md:flex-row gap-6">
			<!-- Image Section -->
			<div class="flex-1">
				<ImageWithSkeleton :src="pizza.image" wrapperClass="relative mx-auto aspect-square rounded-xl overflow-hidden"
					width="100%" height="300px" />
			</div>

			<!-- Details Section -->
			<div class="flex-1">
				<div class="mb-4">
					<h2 class="text-2xl font-bold mb-2">{{ pizza.name }}</h2>
					<p class="text-gray-600 dark:text-gray-300 mb-4">{{ pizza.description }}</p>

					<div class="flex items-center mb-4">
						<span class="text-yellow-500 mr-2">★</span>
						<span class="text-sm mr-4">{{ pizza.rating }}</span>
						<span v-if="pizza.popular" class="bg-red-100 text-red-800 px-2 py-1 rounded-full text-xs">
							Popular
						</span>
					</div>

					<div class="mb-4">
						<span class="text-2xl font-bold text-green-600">Rp{{ pizza.price.toLocaleString() }}</span>
					</div>

					<!-- <div class="mb-6">
						<span :class="pizza.available ? 'text-green-600' : 'text-red-600'" class="text-sm font-medium">
							{{ pizza.available ? 'Available' : 'Unavailable' }}
						</span>
					</div> -->
				</div>



			</div>
		</div>
		<template #footer>
			<div class="flex justify-end gap-2">
				<!-- Add to Cart Button -->
				<Button v-if="showActions" label="Add to Cart" class="w-full" :disabled="!pizza.available" @click="addToCart" />
			</div>
		</template>
	</Dialog>
</template>