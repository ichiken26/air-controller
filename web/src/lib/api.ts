// JSON shapes exchanged between the page and /api/*, plus request validation.

import { FAN_SPEEDS, MODES, type AcSettings } from './remote.ts';

export type Power = 'on' | 'off';

export interface TimerEntry {
	readonly id: string;
	/** on: send `settings` (snapshot taken when the timer was added). off: send stop. */
	readonly kind: 'on' | 'off';
	/** ISO 8601 instant. */
	readonly at: string;
	/** "HH:MM" as entered. */
	readonly time: string;
	readonly settings?: AcSettings;
}

export interface AppState {
	readonly settings: AcSettings;
	/** Last power state the app sent (the AC itself cannot be read). */
	readonly power: Power;
	readonly lastSentAt: string | null;
	readonly lastError: string | null;
	readonly timers: readonly TimerEntry[];
	readonly device: { readonly online: boolean; readonly mock: boolean };
}

export type CommandRequest =
	| { readonly action: 'run'; readonly settings: AcSettings }
	| { readonly action: 'off' }
	| { readonly action: 'swing' }
	| { readonly action: 'direction' };

export interface TimerRequest {
	readonly kind: 'on' | 'off';
	readonly time: string;
	readonly settings?: AcSettings;
}

export class ValidationError extends Error {
	override name = 'ValidationError';
}

function isRecord(v: unknown): v is Record<string, unknown> {
	return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function parseSettings(v: unknown): AcSettings {
	if (!isRecord(v)) throw new ValidationError('settings must be an object');
	const { mode, temperature, fan } = v;
	if (!MODES.includes(mode as never)) throw new ValidationError(`invalid mode: ${String(mode)}`);
	if (typeof temperature !== 'number' || !Number.isFinite(temperature)) throw new ValidationError('temperature must be a number');
	if (!FAN_SPEEDS.includes(fan as never)) throw new ValidationError(`invalid fan: ${String(fan)}`);
	return { mode: mode as AcSettings['mode'], temperature, fan: fan as AcSettings['fan'] };
}

export function parseCommandRequest(v: unknown): CommandRequest {
	if (!isRecord(v)) throw new ValidationError('body must be an object');
	switch (v.action) {
		case 'run':
			return { action: 'run', settings: parseSettings(v.settings) };
		case 'off':
		case 'swing':
		case 'direction':
			return { action: v.action };
		default:
			throw new ValidationError(`invalid action: ${String(v.action)}`);
	}
}

export const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function parseTimerRequest(v: unknown): TimerRequest {
	if (!isRecord(v)) throw new ValidationError('body must be an object');
	if (v.kind !== 'on' && v.kind !== 'off') throw new ValidationError(`invalid kind: ${String(v.kind)}`);
	if (typeof v.time !== 'string' || !TIME_RE.test(v.time)) throw new ValidationError('time must be HH:MM');
	if (v.kind === 'on') return { kind: 'on', time: v.time, settings: parseSettings(v.settings) };
	return { kind: 'off', time: v.time };
}
