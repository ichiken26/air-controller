<script lang="ts">
	import type { Component } from 'svelte';
	import { css } from '#styled-system/css';
	import { chip, sectionLabel } from './recipes.ts';

	let { icon: Icon, label, action, hint, onclick, disabled = false }: {
		icon: Component<{ size?: number }>;
		label: string;
		action: string;
		hint: string;
		onclick: () => void;
		disabled?: boolean;
	} = $props();
</script>

<div class={css({ display: 'flex', flexDirection: 'column', gap: '2.5' })}>
	<p class={sectionLabel()}><Icon size={14} />{label}</p>
	<button type="button" class={chip({ width: 'full', action: true })} {disabled} {onclick}>{action}</button>
	<p class={css({ fontSize: 'caption', color: 'text.caption' })}>{hint}</p>
</div>
