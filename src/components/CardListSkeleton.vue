<script setup lang="ts">
interface Props {
	/** Number of skeleton cards to show. Default 3. */
	count?: number;
	/** Optional extra class on the wrapper (e.g. spacing). */
	wrapperClass?: string;
}

withDefaults(defineProps<Props>(), {
	count: 3
});
</script>

<template>
	<div :class="['space-y-4 animate-pulse', wrapperClass]">
		<div
			v-for="i in count"
			:key="i"
			class="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-transparent p-4"
		>
			<div class="flex justify-between items-start gap-4">
				<div class="flex-1 space-y-2">
					<div class="h-4 bg-gray-200 dark:bg-neutral-600 rounded w-32"></div>
					<div class="h-3 bg-gray-200 dark:bg-neutral-600 rounded w-48"></div>
					<div class="h-3 bg-gray-200 dark:bg-neutral-600 rounded w-36"></div>
				</div>
				<div class="h-5 bg-gray-200 dark:bg-neutral-600 rounded w-20"></div>
			</div>
		</div>
	</div>
</template>
