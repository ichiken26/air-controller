// Shared Panda recipes. Mode colors come from DESIGN.md §2.1.
import { cva } from '#styled-system/css';

const modeVariants = {
	cool: { bg: 'mode.cool.bg', color: 'mode.cool.fg' },
	dry: { bg: 'mode.dry.bg', color: 'mode.dry.fg' },
	heat: { bg: 'mode.heat.bg', color: 'mode.heat.fg' },
	fan: { bg: 'mode.fan.bg', color: 'mode.fan.fg' },
	auto: { bg: 'mode.auto.bg', color: 'mode.auto.fg' },
	off: { bg: 'mode.off.bg', color: 'mode.off.fg' }
} as const;

/** 62×48 mode button. Selected: Bold + 2px ring in the mode color (DESIGN.md §7-3). */
export const modeButton = cva({
	base: {
		display: 'flex',
		flexDirection: 'column',
		alignItems: 'center',
		justifyContent: 'center',
		gap: '1',
		width: '[62px]',
		height: 'mode',
		borderRadius: 'card',
		fontSize: 'caption',
		fontWeight: 'medium',
		outlineWidth: '[2px]',
		outlineStyle: 'solid',
		outlineColor: 'transparent',
		outlineOffset: '[-2px]',
		transition: '[outline-color 0.15s]',
		_disabled: { opacity: '0.5' }
	},
	variants: {
		mode: modeVariants,
		selected: { true: { fontWeight: 'bold', outlineColor: 'currentColor' }, false: {} }
	},
	defaultVariants: { selected: false }
});

export const modeBadge = cva({
	base: {
		display: 'inline-flex',
		alignItems: 'center',
		gap: '2',
		height: '[28px]',
		px: '5',
		borderRadius: 'badge',
		fontSize: 'label',
		fontWeight: 'bold'
	},
	variants: { mode: modeVariants }
});

/** 36px chip / full-width step button. */
export const chip = cva({
	base: {
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		height: 'chip',
		borderRadius: 'chip',
		fontSize: 'label',
		borderWidth: '[1px]',
		borderStyle: 'solid',
		_disabled: { opacity: '0.4' }
	},
	variants: {
		selected: {
			true: { bg: 'accent.bg', color: 'accent.fg', fontWeight: 'bold', borderColor: 'transparent' },
			false: { bg: 'surface', color: 'text.muted', fontWeight: 'medium', borderColor: 'border' }
		},
		width: { auto: { width: '[70px]' }, fixed: { width: '[58px]' }, full: { width: 'full' } },
		action: { true: { color: 'accent.fg' }, false: {} }
	},
	defaultVariants: { selected: false, width: 'fixed', action: false }
});

export const sectionLabel = cva({
	base: { display: 'flex', alignItems: 'center', gap: '2', color: 'text.label', fontWeight: 'medium' },
	variants: {
		level: {
			heading: { fontSize: 'heading', color: 'text.heading', gap: '2.5' },
			row: { fontSize: 'label' }
		}
	},
	defaultVariants: { level: 'row' }
});
