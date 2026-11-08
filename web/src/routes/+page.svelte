<script lang="ts">
	import { onMount } from 'svelte';
	import { ChevronDown, ChevronRight, Navigation, Power, Repeat, SlidersHorizontal } from '@lucide/svelte';
	import { css } from '#styled-system/css';
	import type { AppState, CommandRequest } from '#lib/api.ts';
	import { MODES, MODE_LABEL, normalizeSettings, stepTemperature, type AcSettings, type FanSpeed, type Mode } from '#lib/remote.ts';
	import FanRow from '#lib/components/FanRow.svelte';
	import ModeButton from '#lib/components/ModeButton.svelte';
	import StatusHeader from '#lib/components/StatusHeader.svelte';
	import StepRow from '#lib/components/StepRow.svelte';
	import TemperaturePanel from '#lib/components/TemperaturePanel.svelte';
	import TimerSection from '#lib/components/TimerSection.svelte';
	import { modeBadge } from '#lib/components/recipes.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// svelte-ignore state_referenced_locally
	let app: AppState = $state(data.state);
	// Settings shown on screen. Equal to app.settings except while a temperature change is debounced.
	// svelte-ignore state_referenced_locally
	let settings: AcSettings = $state(data.state.settings);
	let busy = $state(false);
	let message: string | null = $state(null);
	// Both sections start collapsed on every page load (DESIGN.md §4.7).
	let airOpen = $state(false);
	let timerOpen = $state(false);
	let timerTime = $state(defaultTimerTime());

	let pendingTemperature: ReturnType<typeof setTimeout> | null = null;
	const TEMPERATURE_DEBOUNCE_MS = 600;

	function defaultTimerTime(): string {
		const d = new Date(Date.now() + 60 * 60 * 1000);
		return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
	}

	async function call(method: 'GET' | 'POST' | 'DELETE', path: string, body?: unknown): Promise<boolean> {
		busy = method !== 'GET';
		try {
			const res = await fetch(path, {
				method,
				// Always JSON for non-GET: SvelteKit's CSRF check treats a mutating request without a
				// content type as a form post. JSON cannot be sent cross-site without a CORS preflight.
				headers: method === 'GET' ? undefined : { 'content-type': 'application/json' },
				body: body === undefined ? undefined : JSON.stringify(body)
			});
			const payload = await res.json();
			if (!res.ok) {
				message = payload.error ?? payload.message ?? `エラー (HTTP ${res.status})`;
				return false;
			}
			app = payload as AppState;
			if (pendingTemperature === null) settings = app.settings;
			if (method !== 'GET') message = app.lastError;
			return true;
		} catch {
			message = 'サーバーに接続できません';
			return false;
		} finally {
			busy = false;
		}
	}

	const command = (request: CommandRequest) => call('POST', '/api/command', request);
	const run = (s: AcSettings) => command({ action: 'run', settings: s });

	function selectMode(mode: Mode) {
		settings = normalizeSettings({ ...settings, mode });
		void run(settings);
	}

	function changeTemperature(direction: 1 | -1) {
		settings = { ...settings, temperature: stepTemperature(settings, direction) };
		// While stopped, only the display changes; the next mode press sends it.
		if (app.power !== 'on') return;
		if (pendingTemperature) clearTimeout(pendingTemperature);
		pendingTemperature = setTimeout(() => {
			pendingTemperature = null;
			void run(settings);
		}, TEMPERATURE_DEBOUNCE_MS);
	}

	function setTemperature(celsius: number) {
		if (pendingTemperature) clearTimeout(pendingTemperature);
		pendingTemperature = null;
		settings = { ...settings, temperature: celsius };
		if (app.power === 'on') void run(settings);
	}

	function selectFan(fan: FanSpeed) {
		settings = { ...settings, fan };
		if (app.power === 'on') void run(settings);
	}

	onMount(() => {
		// Poll only while the tab is visible; refresh once when it comes back.
		const refresh = () => void call('GET', '/api/state');
		const poll = setInterval(() => {
			if (!document.hidden) refresh();
		}, 15_000);
		const onVisible = () => {
			if (!document.hidden) refresh();
		};
		document.addEventListener('visibilitychange', onVisible);
		return () => {
			clearInterval(poll);
			document.removeEventListener('visibilitychange', onVisible);
		};
	});

	const badgeMode = $derived(app.power === 'on' ? app.settings.mode : 'off');
	const sectionPad = css({ px: '5', py: '4', display: 'flex', flexDirection: 'column', gap: '4' });
	const divider = css({ height: '[1px]', bg: 'divider' });
</script>

<main class={css({ maxWidth: 'column', mx: 'auto', minHeight: '[100dvh]', bg: 'page', pb: '7' })}>
	<StatusHeader online={app.device.online} mock={app.device.mock} />

	{#if message}
		<p
			role="alert"
			class={css({ mx: '5', mt: '3.5', px: '3.5', py: '3', borderRadius: 'panel', bg: 'cancel.bg', color: 'cancel.fg', fontSize: 'caption' })}
		>
			{message}
		</p>
	{/if}

	<nav class={css({ display: 'flex', justifyContent: 'center', gap: '2', px: '5', pt: '5', pb: '3.5' })} aria-label="運転モード">
		{#each MODES.filter((m) => m === 'cool' || m === 'dry' || m === 'heat') as mode (mode)}
			<ModeButton {mode} selected={app.power === 'on' && app.settings.mode === mode} onclick={() => selectMode(mode)} />
		{/each}
	</nav>

	<section class={css({ display: 'flex', flexDirection: 'column', alignItems: 'center', px: '7', py: '2.5' })} aria-label="運転">
		<span class={modeBadge({ mode: badgeMode })}>
			<span class={css({ width: '[8px]', height: '[8px]', borderRadius: 'full', bg: 'currentColor' })}></span>
			{app.power === 'on' ? MODE_LABEL[app.settings.mode] : '停止中'}
		</span>

		<TemperaturePanel {settings} onstep={changeTemperature} onset={setTemperature} />

		<button
			type="button"
			disabled={busy}
			onclick={() => command({ action: 'off' })}
			class={css({
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
				gap: '2.5',
				width: '[160px]',
				height: '[48px]',
				borderRadius: 'pill',
				bg: 'stop.bg',
				color: 'stop.fg',
				boxShadow: 'stop',
				fontSize: 'button',
				fontWeight: 'bold',
				_disabled: { opacity: '0.6' }
			})}
		>
			<Power size={18} />停 止
		</button>

		<div class={css({ display: 'flex', gap: '3', py: '4.5' })}>
			{#each MODES.filter((m) => m === 'fan' || m === 'auto') as mode (mode)}
				<ModeButton {mode} selected={app.power === 'on' && app.settings.mode === mode} onclick={() => selectMode(mode)} />
			{/each}
		</div>
	</section>

	<div class={divider}></div>

	<section aria-label="送風の調整">
		<button
			type="button"
			aria-expanded={airOpen}
			onclick={() => (airOpen = !airOpen)}
			class={css({ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: 'full', px: '5', py: '4', color: 'text.label' })}
		>
			<span class={css({ display: 'flex', alignItems: 'center', gap: '2.5', fontSize: 'heading', fontWeight: 'medium', color: 'text.heading' })}>
				<SlidersHorizontal size={16} />送風の調整
			</span>
			{#if airOpen}<ChevronDown size={20} />{:else}<ChevronRight size={20} />{/if}
		</button>
		{#if airOpen}
			<div class={[sectionPad, css({ pt: '0' })]}>
				<StepRow
					icon={Repeat}
					label="スイング"
					action="スイングを切り替える"
					hint="押すたびに ON / OFF が切り替わります"
					disabled={busy}
					onclick={() => command({ action: 'swing' })}
				/>
				<StepRow
					icon={Navigation}
					label="風向"
					action="風向を変える"
					hint="押すたびに1段階切り替え（現在の向きは表示できません）"
					disabled={busy}
					onclick={() => command({ action: 'direction' })}
				/>
				<FanRow mode={settings.mode} fan={settings.fan} onselect={selectFan} />
			</div>
		{/if}
	</section>

	<div class={divider}></div>

	<TimerSection
		bind:open={timerOpen}
		bind:time={timerTime}
		timers={app.timers}
		{busy}
		onadd={(kind) => call('POST', '/api/timers', kind === 'on' ? { kind, time: timerTime, settings } : { kind, time: timerTime })}
		oncancelall={() => call('DELETE', '/api/timers')}
		oncancel={(id) => call('DELETE', `/api/timers/${encodeURIComponent(id)}`)}
	/>
</main>
