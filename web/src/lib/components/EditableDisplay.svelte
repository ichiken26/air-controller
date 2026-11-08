<script lang="ts" generics="T">
	import { tick, type Snippet } from 'svelte';
	import { css } from '#styled-system/css';
	import type { ParseResult } from '#lib/input.ts';

	// A big 7-segment display that turns into a text field when tapped.
	// Enter or leaving the field commits; Escape cancels. Invalid input keeps the old value and
	// shows the parser's message under the field.
	let {
		label,
		editText,
		placeholder,
		inputmode,
		parse,
		oncommit,
		disabled = false,
		width = 'full',
		children
	}: {
		label: string;
		/** Text placed in the field when editing starts. */
		editText: string;
		placeholder: string;
		inputmode: 'decimal' | 'numeric';
		parse: (text: string) => ParseResult<T>;
		oncommit: (value: T) => void;
		disabled?: boolean;
		width?: 'full' | 'temperature';
		children: Snippet;
	} = $props();

	let editing = $state(false);
	let draft = $state('');
	let error: string | null = $state(null);
	let input: HTMLInputElement | undefined = $state();

	async function start() {
		if (disabled) return;
		draft = editText;
		error = null;
		editing = true;
		await tick();
		input?.focus();
		input?.select();
	}

	function commit() {
		if (!editing) return;
		const result = parse(draft);
		if (!result.ok) {
			error = result.error;
			editing = false;
			return;
		}
		error = null;
		editing = false;
		oncommit(result.value);
	}

	function onkeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			commit();
		} else if (e.key === 'Escape') {
			editing = false;
			error = null;
		}
	}

	const frame = css({
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		gap: '2.5',
		height: '[123px]',
		px: '5',
		bg: 'surface',
		borderWidth: '[1px]',
		borderStyle: 'solid',
		borderColor: 'border',
		borderRadius: 'display',
		boxShadow: 'display',
		color: 'text.display',
		fontFamily: 'digits',
		lineHeight: '[1]',
		_disabled: { cursor: 'default' },
		_focusVisible: { outlineWidth: '[2px]', outlineStyle: 'solid', outlineColor: 'accent.fg' }
	});
	const widths = { full: css({ width: 'full' }), temperature: css({ width: '[256px]' }) };
</script>

<div class={[css({ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5' }), widths[width]]}>
	{#if editing}
		<div class={[frame, widths[width], css({ borderColor: 'accent.fg' })]}>
			<input
				bind:this={input}
				bind:value={draft}
				{inputmode}
				{placeholder}
				aria-label={label}
				enterkeyhint="done"
				autocomplete="off"
				onblur={commit}
				{onkeydown}
				class={css({
					width: 'full',
					bg: 'transparent',
					color: 'text.display',
					fontFamily: 'digits',
					fontSize: 'digitColon',
					textAlign: 'center',
					caretColor: 'accent.fg',
					outline: 'none',
					_placeholder: { color: 'text.empty' }
				})}
			/>
		</div>
	{:else}
		<button type="button" class={[frame, widths[width]]} {disabled} aria-label="{label}（タップして入力）" onclick={start}>
			{@render children()}
		</button>
	{/if}
	{#if error}
		<p role="alert" class={css({ fontSize: 'caption', color: 'cancel.fg' })}>{error}</p>
	{/if}
</div>
