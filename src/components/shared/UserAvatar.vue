<script setup>
import { useAvatar } from '@/composables/useAvatar';
import { computed } from 'vue';

const props = defineProps({
    avatar: {
        type: String,
        default: ''
    },
    name: {
        type: String,
        default: ''
    },
    size: {
        type: String,
        default: 'small' // PrimeVue Avatar size: small, large, xlarge, etc.
    },
    shape: {
        type: String,
        default: 'circle'
    },
    extraClass: {
        type: String,
        default: ''
    }
});

// Shared avatar logic (initials + background color)
const { userInitials, bgColor } = useAvatar(computed(() => props.name));
</script>

<template>
    <span class="inline-flex items-center justify-center">
        <Avatar
            v-if="avatar"
            :image="avatar"
            :size="size"
            :shape="shape"
            :class="extraClass"
        />
        <Avatar
            v-else
            :label="userInitials"
            :size="size"
            :shape="shape"
            :style="{ backgroundColor: bgColor }"
            :class="extraClass"
        />
    </span>
</template>

