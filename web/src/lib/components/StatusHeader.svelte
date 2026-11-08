<script lang="ts">
	import { Wifi, WifiOff } from '@lucide/svelte';
	import { css } from '#styled-system/css';

	// Only the web app <-> microcontroller (ATOM Lite) link is shown; the AC's own state cannot be read.
	let { online, mock }: { online: boolean; mock: boolean } = $props();

	const text = $derived(mock ? 'モック送信（マイコンなし）' : online ? 'マイコン接続中' : 'マイコン未接続');
</script>

<header
	class={css({
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'space-between',
		height: '[56px]',
		px: '6',
		bg: 'sunken'
	})}
>
	<p
		class={[
			css({ display: 'flex', alignItems: 'center', gap: '2.5', fontSize: 'label', fontWeight: 'medium', color: 'accent.fg' }),
			!online && css({ color: 'cancel.fg' })
		]}
		role="status"
	>
		{#if online}<Wifi size={18} />{:else}<WifiOff size={18} />{/if}
		{text}
	</p>
	<p class={css({ fontSize: 'heading', color: 'text.muted' })}>東芝 RAS-2214T</p>
</header>

