<script lang="ts">
	import { Droplet, Snowflake, Sun, Wind, Zap } from '@lucide/svelte';
	import { MODE_LABEL, type Mode } from '#lib/remote.ts';
	import { modeButton } from './recipes.ts';

	let { mode, selected, onclick }: { mode: Mode; selected: boolean; onclick: () => void } = $props();
	const Icon = $derived({ cool: Snowflake, dry: Droplet, heat: Sun, fan: Wind, auto: Zap }[mode]);
</script>

<button type="button" class={modeButton({ mode, selected })} aria-pressed={selected} {onclick}>
	<Icon size={16} />
	{MODE_LABEL[mode]}
</button>
