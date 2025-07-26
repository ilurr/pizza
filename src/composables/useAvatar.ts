import { computed, type ComputedRef, unref } from 'vue';

export function useAvatar(username: string | undefined | ComputedRef<string | undefined>) {
	// Generate user initials
	const userInitials = computed(() => {
		const name = unref(username);
		if (!name) return 'U';
		const nameParts = name.split(' ');
		return nameParts
			.map(part => part.charAt(0))
			.join('')
			.toUpperCase()
			.slice(0, 2);
	});

	// Generate HSL background color based on initials
	const bgColor = computed(() => {
		if (!userInitials.value) return 'hsl(0, 30%, 80%)';
		return stringToHslColor(userInitials.value);
	});

	function stringToHslColor(str: string) {
		const upperStr = str.toUpperCase();
		const range = 360 / 26; // 26 chars
		const csMax = 30; // range saturation 30 - 95
		const clMin = 80; // range lightness 50 - 80
		let hash = 0;
		let h = 0;
		let s = csMax;
		let l = clMin;
		
		for (let i = 0; i < upperStr.length; i++) {
			hash = upperStr.charCodeAt(i);
			const int = hash - 64;
			if (i > 0) {
				h = (h + ((hash << 5) - hash)) % 360;
				s = s + int * Math.floor(65 / 26);
				l = l - int * Math.floor(30 / 26);
			} else {
				h = Math.floor(range * int);
				s = csMax;
				l = clMin;
			}
		}
		
		return `hsl(${h}, ${s}%, ${l}%)`;
	}

	return {
		userInitials,
		bgColor
	};
}