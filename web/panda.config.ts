import { defineConfig } from '@pandacss/dev';

// Design tokens from ../DESIGN.md §2. Change values there and here together.
export default defineConfig({
	// preset-base gives the utilities; all tokens are defined below (no preset-panda palette).
	presets: ['@pandacss/preset-base'],
	preflight: true,
	// Only tokens are accepted for token-backed properties (colors, radii, shadows, font sizes, ...).
	// One-off values need the explicit escape hatch: css({ width: '[62px]' }).
	strictTokens: true,
	strictPropertyValues: true,
	include: ['./src/**/*.{js,ts,svelte}'],
	exclude: [],
	outdir: 'styled-system',
	outExtension: 'js',

	globalFontface: {
		'DSEG7 Classic': {
			src: 'url(/fonts/DSEG7Classic-Regular.woff2) format("woff2")',
			fontWeight: '400',
			fontStyle: 'normal',
			fontDisplay: 'swap'
		}
	},

	globalCss: {
		'html, body': {
			bg: 'page',
			color: 'text.heading',
			fontFamily: 'body',
			WebkitTapHighlightColor: 'transparent'
		},
		button: { cursor: 'pointer', _disabled: { cursor: 'not-allowed' } }
	},

	theme: {
		tokens: {
			colors: {
				page: { value: '#1a1a2e' },
				sunken: { value: '#12122a' },
				surface: { value: '#16213e' },
				border: { value: '#2a2a5a' },
				divider: { value: '#2a2a44' },
				track: { value: '#2a2a4a' },
				white: { value: '#ffffff' },
				transparent: { value: 'transparent' },
				text: {
					display: { value: '#e8e8ff' },
					displaySub: { value: '#b0b0dd' },
					heading: { value: '#aaaacc' },
					label: { value: '#8888bb' },
					muted: { value: '#8888aa' },
					caption: { value: '#6666aa' },
					faint: { value: '#555577' },
					empty: { value: '#444466' }
				},
				accent: { fg: { value: '#4fc3f7' }, bg: { value: '#1e3a5f' } },
				mode: {
					cool: { fg: { value: '#4fc3f7' }, bg: { value: '#1e3a5f' } },
					dry: { fg: { value: '#87fa81' }, bg: { value: '#1a3a1c' } },
					heat: { fg: { value: '#ff8a65' }, bg: { value: '#2e1a1a' } },
					fan: { fg: { value: '#a5d6a7' }, bg: { value: '#1e2a1e' } },
					auto: { fg: { value: '#ffd54f' }, bg: { value: '#2a2a1e' } },
					off: { fg: { value: '#8888aa' }, bg: { value: '#2a2a4a' } }
				},
				stop: { bg: { value: '#8b1a1a' }, fg: { value: '#ffdddd' }, glow: { value: 'rgba(255,0,0,0.27)' } },
				cancel: { bg: { value: '#2a1a1a' }, border: { value: '#4a2a2a' }, fg: { value: '#ef9a9a' } },
				timer: { on: { value: '#a5d6a7' }, off: { value: '#ff8a65' } }
			},
			fonts: {
				body: { value: '"Noto Sans JP", system-ui, sans-serif' },
				digits: { value: '"DSEG7 Classic", ui-monospace, monospace' }
			},
			fontSizes: {
				toggle: { value: '11px' },
				caption: { value: '13px' },
				label: { value: '14px' },
				heading: { value: '15px' },
				button: { value: '18px' },
				timer: { value: '20px' },
				unit: { value: '27px' },
				digitSub: { value: '32px' },
				step: { value: '34px' },
				digitColon: { value: '64px' },
				digit: { value: '80px' }
			},
			fontWeights: {
				light: { value: '300' },
				regular: { value: '400' },
				medium: { value: '500' },
				bold: { value: '700' }
			},
			radii: {
				hair: { value: '1px' },
				chip: { value: '8px' },
				panel: { value: '10px' },
				card: { value: '12px' },
				badge: { value: '14px' },
				display: { value: '20px' },
				pill: { value: '24px' },
				full: { value: '9999px' }
			},
			shadows: {
				display: { value: '0 8px 10px rgba(0,0,0,0.25)' },
				round: { value: '0 4px 6px rgba(0,0,0,0.4)' },
				stop: { value: '0 4px 8px rgba(255,0,0,0.27)' }
			},
			spacing: {
				0: { value: '0' },
				0.5: { value: '2px' },
				1: { value: '3px' },
				1.5: { value: '4px' },
				2: { value: '6px' },
				2.5: { value: '8px' },
				3: { value: '10px' },
				3.5: { value: '12px' },
				4: { value: '14px' },
				4.5: { value: '15px' },
				5: { value: '16px' },
				6: { value: '20px' },
				7: { value: '24px' }
			},
			sizes: {
				full: { value: '100%' },
				icon: { value: '16px' },
				iconLg: { value: '18px' },
				iconSm: { value: '14px' },
				chip: { value: '36px' },
				mode: { value: '48px' },
				round: { value: '72px' },
				column: { value: '480px' }
			}
		}
	}
});
