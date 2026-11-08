// Remote-control rules shared by the UI and the server. Everything here is derived from
// @air-controller/protocol so the UI never offers a setting the encoder would reject.

import {
	MAX_TEMPERATURE,
	SUPPORTED_FANS,
	isVerified,
	supportedTemperatures,
	type Command,
	type FanSpeed,
	type Mode
} from '@air-controller/protocol';

export type { FanSpeed, Mode };

/** What the app believes the AC is set to: the last settings it sent (the AC cannot be read). */
export interface AcSettings {
	readonly mode: Mode;
	/** °C. Ignored in fan-only mode, but kept so switching back restores it. */
	readonly temperature: number;
	readonly fan: FanSpeed;
}

export const DEFAULT_SETTINGS: AcSettings = { mode: 'cool', temperature: 26, fan: 'auto' };

export const MODES: readonly Mode[] = ['cool', 'dry', 'heat', 'fan', 'auto'];
export const FAN_SPEEDS: readonly FanSpeed[] = ['auto', 'low', 'medium', 'high'];

export const MODE_LABEL: Readonly<Record<Mode, string>> = {
	cool: '冷房',
	dry: '除湿',
	heat: '暖房',
	fan: '送風',
	auto: '自動'
};
export const FAN_LABEL: Readonly<Record<FanSpeed, string>> = { auto: '自動', low: '弱', medium: '中', high: '強' };

/** Fan-only has no set temperature. */
export function hasTemperature(mode: Mode): mode is Exclude<Mode, 'fan'> {
	return mode !== 'fan';
}

/** Temperatures the encoder accepts in this mode (empty for fan-only). */
function temperaturesFor(mode: Mode): number[] {
	return hasTemperature(mode) ? supportedTemperatures(mode) : [];
}

/** Dry and auto send a fixed fan code; the fan row is disabled there. */
export function fanSelectable(mode: Mode): boolean {
	return SUPPORTED_FANS[mode].length > 1;
}

/** Fan speeds the encoder accepts for this mode (verified values only). */
export function availableFans(mode: Mode): readonly FanSpeed[] {
	return SUPPORTED_FANS[mode];
}

export function temperatureStep(mode: Mode): number {
	const temps = temperaturesFor(mode);
	if (temps.length === 0) return 0;
	return temps.length > 1 ? temps[1] - temps[0] : 1;
}

export function temperatureRange(mode: Mode): { min: number; max: number } {
	const temps = temperaturesFor(mode);
	return { min: temps[0] ?? 18, max: temps.at(-1) ?? MAX_TEMPERATURE };
}

/** Nearest temperature the mode supports (auto mode has 1°C steps). Ties go to the lower one. */
export function snapTemperature(mode: Mode, celsius: number): number {
	const temps = temperaturesFor(mode);
	if (temps.length === 0) return celsius;
	return temps.reduce((best, t) => (Math.abs(t - celsius) < Math.abs(best - celsius) ? t : best), temps[0]);
}

export function stepTemperature(settings: AcSettings, direction: 1 | -1): number {
	const { min, max } = temperatureRange(settings.mode);
	const next = settings.temperature + direction * temperatureStep(settings.mode);
	return Math.min(max, Math.max(min, snapTemperature(settings.mode, next)));
}

/**
 * Makes settings valid for their mode: snaps the temperature and, where the fan is fixed or the
 * speed is unsupported, falls back to auto. Use whenever the mode changes.
 */
export function normalizeSettings(settings: AcSettings): AcSettings {
	const fan = availableFans(settings.mode).includes(settings.fan) ? settings.fan : 'auto';
	const temperature = hasTemperature(settings.mode) ? snapTemperature(settings.mode, settings.temperature) : settings.temperature;
	return { mode: settings.mode, temperature, fan };
}

export function toRunCommand(settings: AcSettings): Command {
	const s = normalizeSettings(settings);
	return s.mode === 'fan' ? { kind: 'run', mode: 'fan', fan: s.fan } : { kind: 'run', mode: s.mode, temperature: s.temperature, fan: s.fan };
}

/** True when the settings encode with verified values only. */
export function isSendable(settings: AcSettings): boolean {
	return isVerified(toRunCommand(settings));
}

export function formatTemperature(celsius: number): { whole: string; fraction: string } {
	const [whole, fraction = '0'] = celsius.toFixed(1).split('.');
	return { whole, fraction: `.${fraction}` };
}

export function describeSettings(s: AcSettings): string {
	const parts = [MODE_LABEL[s.mode]];
	if (hasTemperature(s.mode)) parts.push(`${s.temperature.toFixed(1)}℃`);
	if (fanSelectable(s.mode)) parts.push(`風量${FAN_LABEL[s.fan]}`);
	return parts.join(' ');
}
