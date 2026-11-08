<script lang="ts">
	import { css } from '#styled-system/css';
	import { parseTemperatureInput } from '#lib/input.ts';
	import { formatTemperature, hasTemperature, temperatureRange, temperatureStep, type AcSettings } from '#lib/remote.ts';
	import EditableDisplay from './EditableDisplay.svelte';

	let {
		settings,
		onstep,
		onset
	}: { settings: AcSettings; onstep: (direction: 1 | -1) => void; onset: (celsius: number) => void } = $props();

	const enabled = $derived(hasTemperature(settings.mode));
	const range = $derived(temperatureRange(settings.mode));
	const step = $derived(temperatureStep(settings.mode));
	const value = $derived(formatTemperature(settings.temperature));

	const roundButton = css({
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		width: 'round',
		height: 'round',
		borderRadius: 'full',
		bg: 'surface',
		borderWidth: '[1px]',
		borderStyle: 'solid',
		borderColor: 'border',
		boxShadow: 'round',
		color: 'accent.fg',
		fontSize: 'step',
		fontWeight: 'light',
		_disabled: { opacity: '0.35' },
		_active: { transform: 'scale(0.96)' }
	});
</script>

<div class={css({ display: 'flex', flexDirection: 'column', alignItems: 'center', pt: '3.5' })}>
	<p class={css({ fontSize: 'caption', color: 'text.caption' })}>設定温度</p>
	<EditableDisplay
		label="設定温度"
		editText={settings.temperature.toFixed(1)}
		placeholder={`${range.min}〜${range.max}`}
		inputmode="decimal"
		width="temperature"
		disabled={!enabled}
		parse={(text) => parseTemperatureInput(text, settings.mode)}
		oncommit={onset}
	>
		<span class={css({ display: 'flex', alignItems: 'baseline', gap: '1.5' })} aria-live="polite">
			<span class={css({ fontSize: 'digit', color: 'text.display' })}>{enabled ? value.whole : '--'}</span>
			<span class={css({ fontSize: 'digitSub', color: 'text.displaySub' })}>{enabled ? value.fraction : ''}</span>
		</span>
		<span class={css({ alignSelf: 'flex-end', mb: '2.5', fontFamily: 'body', fontSize: 'unit', fontWeight: 'bold', color: 'text.label', letterSpacing: '[0.5px]' })}>°C</span>
	</EditableDisplay>
	<div class={css({ display: 'flex', alignItems: 'center', gap: '6', py: '2.5' })}>
		<button type="button" class={roundButton} aria-label="温度を下げる" disabled={!enabled || settings.temperature <= range.min} onclick={() => onstep(-1)}>－</button>
		<span class={css({ minWidth: '[40px]', textAlign: 'center', fontSize: 'caption', color: 'text.caption' })}>{enabled ? `${step}℃` : ''}</span>
		<button type="button" class={roundButton} aria-label="温度を上げる" disabled={!enabled || settings.temperature >= range.max} onclick={() => onstep(1)}>＋</button>
	</div>
</div>
