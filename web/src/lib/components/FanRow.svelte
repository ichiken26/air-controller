<script lang="ts">
	import { Wind } from '@lucide/svelte';
	import { css } from '#styled-system/css';
	import { FAN_LABEL, FAN_SPEEDS, availableFans, fanSelectable, type FanSpeed, type Mode } from '#lib/remote.ts';
	import { chip, sectionLabel } from './recipes.ts';

	let { mode, fan, onselect }: { mode: Mode; fan: FanSpeed; onselect: (fan: FanSpeed) => void } = $props();
	const selectable = $derived(fanSelectable(mode));
	const allowed = $derived(availableFans(mode));
</script>

<div class={css({ display: 'flex', flexDirection: 'column', gap: '2.5' })}>
	<p class={sectionLabel()}><Wind size={14} />風量</p>
	<div class={css({ display: 'flex', gap: '2' })} role="radiogroup" aria-label="風量">
		{#each FAN_SPEEDS as speed (speed)}
			<button
				type="button"
				role="radio"
				aria-checked={fan === speed}
				class={chip({ selected: fan === speed, width: speed === 'auto' ? 'auto' : 'fixed' })}
				disabled={!selectable || !allowed.includes(speed)}
				onclick={() => onselect(speed)}>{FAN_LABEL[speed]}</button
			>
		{/each}
	</div>
	{#if !selectable}
		<p class={css({ fontSize: 'caption', color: 'text.caption' })}>このモードでは風量は自動で固定です</p>
	{/if}
</div>
