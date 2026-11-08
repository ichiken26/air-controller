<script lang="ts">
	import { CircleX, Clock, X } from '@lucide/svelte';
	import { css } from '#styled-system/css';
	import type { TimerEntry } from '#lib/api.ts';
	import { parseTimeInput } from '#lib/input.ts';
	import { describeSettings } from '#lib/remote.ts';
	import { sectionLabel } from './recipes.ts';
	import EditableDisplay from './EditableDisplay.svelte';
	import Toggle from './Toggle.svelte';

	let {
		open = $bindable(),
		time = $bindable(),
		timers,
		busy,
		onadd,
		oncancelall,
		oncancel
	}: {
		open: boolean;
		time: string;
		timers: readonly TimerEntry[];
		busy: boolean;
		onadd: (kind: 'on' | 'off') => void;
		oncancelall: () => void;
		oncancel: (id: string) => void;
	} = $props();

	const [hh, mm] = $derived(time.split(':'));

	const timerButton = css({
		flex: '1',
		height: '[68px]',
		borderRadius: 'card',
		bg: 'surface',
		borderWidth: '[1px]',
		borderStyle: 'solid',
		borderColor: 'border',
		fontSize: 'timer',
		fontWeight: 'bold',
		_disabled: { opacity: '0.5' }
	});
</script>

<section class={css({ display: 'flex', flexDirection: 'column', gap: '3.5', px: '5', pt: '4', pb: '5' })} aria-label="タイマー予約">
	<div class={css({ display: 'flex', alignItems: 'center', justifyContent: 'space-between' })}>
		<h2 class={sectionLabel({ level: 'heading' })}>
			<Clock size={14} />タイマー予約
			{#if timers.length > 0}
				<span class={css({ px: '2', borderRadius: 'badge', bg: 'accent.bg', color: 'accent.fg', fontSize: 'caption', fontWeight: 'bold' })}>
					{timers.length}件
				</span>
			{/if}
		</h2>
		<Toggle bind:checked={open} label="タイマー予約を表示" />
	</div>

	{#if open}
		<p class={css({ fontSize: 'caption', color: 'text.caption' })}>実行時刻（この時刻に送信）</p>
		<EditableDisplay label="実行時刻" editText={time} placeholder="9:30" inputmode="numeric" parse={parseTimeInput} oncommit={(v) => (time = v)}>
			<span class={css({ fontSize: 'digit' })}>{hh}</span>
			<span class={css({ fontSize: 'digitColon' })}>:</span>
			<span class={css({ fontSize: 'digit' })}>{mm}</span>
		</EditableDisplay>
		<div class={css({ display: 'flex', gap: '2.5' })}>
			<button type="button" class={[timerButton, css({ color: 'timer.on' })]} disabled={busy} onclick={() => onadd('on')}>入タイマー</button>
			<button type="button" class={[timerButton, css({ color: 'timer.off' })]} disabled={busy} onclick={() => onadd('off')}>切タイマー</button>
			<button
				type="button"
				disabled={busy || timers.length === 0}
				onclick={oncancelall}
				class={css({
					display: 'flex',
					flexDirection: 'column',
					alignItems: 'center',
					justifyContent: 'center',
					gap: '1.5',
					width: '[80px]',
					height: '[68px]',
					borderRadius: 'card',
					bg: 'cancel.bg',
					borderWidth: '[1px]',
					borderStyle: 'solid',
					borderColor: 'cancel.border',
					color: 'cancel.fg',
					fontSize: 'caption',
					fontWeight: 'medium',
					_disabled: { opacity: '0.5' }
				})}
			>
				<CircleX size={16} />取り消し
			</button>
		</div>
		<div class={css({ display: 'flex', flexDirection: 'column', gap: '1.5', px: '3.5', py: '3', bg: 'sunken', borderRadius: 'panel' })}>
			<p class={css({ fontSize: 'caption', color: 'text.faint' })}>予約キュー</p>
			{#if timers.length === 0}
				<p class={css({ fontSize: 'label', color: 'text.empty' })}>予約なし</p>
			{:else}
				<ul class={css({ display: 'flex', flexDirection: 'column', gap: '1.5' })}>
					{#each timers as t (t.id)}
						<li class={css({ display: 'flex', alignItems: 'center', gap: '2.5', fontSize: 'label', color: 'text.heading' })}>
							<span class={css({ fontFamily: 'digits', color: 'text.display' })}>{t.time}</span>
							<span class={t.kind === 'on' ? css({ color: 'timer.on', fontWeight: 'bold' }) : css({ color: 'timer.off', fontWeight: 'bold' })}>
								{t.kind === 'on' ? '入' : '切'}
							</span>
							<span class={css({ flex: '1', color: 'text.muted' })}>{t.kind === 'on' && t.settings ? describeSettings(t.settings) : '停止'}</span>
							<button type="button" aria-label="{t.time} の予約を取り消す" onclick={() => oncancel(t.id)} class={css({ color: 'text.caption', p: '1' })}>
								<X size={16} />
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	{/if}
</section>
