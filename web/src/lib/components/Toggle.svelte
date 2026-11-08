<script lang="ts">
	import { Check } from '@lucide/svelte';
	import { css } from '#styled-system/css';

	// Material 3 (Android) style switch: 52×32 track.
	// Off: outlined track, small 16px thumb. On: filled track, 24px thumb with a check mark.
	let { checked = $bindable(), label }: { checked: boolean; label: string } = $props();
</script>

<button
	type="button"
	role="switch"
	aria-checked={checked}
	aria-label={label}
	onclick={() => (checked = !checked)}
	class={[
		css({
			position: 'relative',
			flexShrink: '0',
			width: '[52px]',
			height: '[32px]',
			borderRadius: 'full',
			borderWidth: '[2px]',
			borderStyle: 'solid',
			transition: '[background-color 0.2s, border-color 0.2s]',
			_focusVisible: { outlineWidth: '[2px]', outlineStyle: 'solid', outlineColor: 'accent.fg', outlineOffset: '[2px]' }
		}),
		checked ? css({ bg: 'accent.fg', borderColor: 'accent.fg' }) : css({ bg: 'track', borderColor: 'text.caption' })
	]}
>
	<span
		class={[
			css({
				position: 'absolute',
				top: '[50%]',
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
				borderRadius: 'full',
				transform: 'translateY(-50%)',
				transition: '[left 0.2s, width 0.2s, height 0.2s, background-color 0.2s]'
			}),
			checked
				? css({ left: '[22px]', width: '[24px]', height: '[24px]', bg: 'sunken', color: 'accent.fg' })
				: css({ left: '[6px]', width: '[16px]', height: '[16px]', bg: 'text.caption' })
		]}
	>
		{#if checked}<Check size={16} strokeWidth={3} />{/if}
	</span>
</button>
