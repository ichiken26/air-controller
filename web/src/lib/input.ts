// Parsing of free-text input for the temperature and timer fields.

import { hasTemperature, temperatureRange, temperatureStep, type Mode } from './remote.ts';

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

/** Full-width digits and punctuation (common with Japanese IMEs) to ASCII. */
export function normalizeDigits(text: string): string {
	return text
		.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
		.replace(/[．。，、,]/g, '.')
		.replace(/[：時]/g, ':')
		.replace(/[分℃°Cc\s]/g, '');
}

/** "26", "26.5", "２６．５", "26.5℃" -> 26.5, if the mode supports it. */
export function parseTemperatureInput(text: string, mode: Mode): ParseResult<number> {
	if (!hasTemperature(mode)) return { ok: false, error: 'このモードでは温度を設定できません' };
	const clean = normalizeDigits(text);
	if (!/^\d{1,2}(\.\d)?$/.test(clean)) return { ok: false, error: '数字で入力してください（例: 26.5）' };
	const value = Number(clean);
	const { min, max } = temperatureRange(mode);
	if (value < min || value > max) return { ok: false, error: `${min}〜${max}℃の範囲で入力してください` };
	const step = temperatureStep(mode);
	if (Math.abs(value / step - Math.round(value / step)) > 1e-9) {
		return { ok: false, error: step === 1 ? 'このモードは1℃刻みです' : `${step}℃刻みで入力してください` };
	}
	return { ok: true, value };
}

/** "9:30", "09:30", "930", "0930", "9", "９時３０分" -> "09:30". */
export function parseTimeInput(text: string): ParseResult<string> {
	const clean = normalizeDigits(text).replace(/:$/, '');
	let hh: number;
	let mm: number;
	const colon = /^(\d{1,2}):(\d{1,2})$/.exec(clean);
	if (colon) {
		hh = Number(colon[1]);
		mm = Number(colon[2]);
	} else if (/^\d{1,2}$/.test(clean)) {
		hh = Number(clean);
		mm = 0;
	} else if (/^\d{3,4}$/.test(clean)) {
		hh = Number(clean.slice(0, -2));
		mm = Number(clean.slice(-2));
	} else {
		return { ok: false, error: '時刻で入力してください（例: 9:30 / 0930）' };
	}
	if (hh > 23 || mm > 59) return { ok: false, error: '00:00〜23:59 で入力してください' };
	return { ok: true, value: `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}` };
}
