import { describe, expect, it } from 'vitest';
import { parseTemperatureInput, parseTimeInput } from './input.ts';

describe('parseTemperatureInput', () => {
	it.each([
		['26', 26],
		['26.5', 26.5],
		['２６．５', 26.5],
		['26.5℃', 26.5],
		[' 18 ', 18],
		['30', 30]
	])('%s -> %s in cool', (text, value) => {
		expect(parseTemperatureInput(text, 'cool')).toEqual({ ok: true, value });
	});

	it.each([['17.5'], ['30.5'], ['26.3'], ['abc'], [''], ['265']])('rejects %s in cool', (text) => {
		expect(parseTemperatureInput(text, 'cool').ok).toBe(false);
	});

	it('auto mode is whole degrees only, fan mode has no temperature', () => {
		expect(parseTemperatureInput('25', 'auto')).toEqual({ ok: true, value: 25 });
		expect(parseTemperatureInput('25.5', 'auto')).toEqual({ ok: false, error: 'このモードは1℃刻みです' });
		expect(parseTemperatureInput('25', 'fan').ok).toBe(false);
	});
});

describe('parseTimeInput', () => {
	it.each([
		['9:30', '09:30'],
		['09:30', '09:30'],
		['930', '09:30'],
		['0930', '09:30'],
		['2359', '23:59'],
		['9', '09:00'],
		['0', '00:00'],
		['９時３０分', '09:30'],
		['９：３０', '09:30'],
		['7時', '07:00']
	])('%s -> %s', (text, value) => {
		expect(parseTimeInput(text)).toEqual({ ok: true, value });
	});

	it.each([['24:00'], ['12:60'], ['12345'], ['abc'], ['']])('rejects %s', (text) => {
		expect(parseTimeInput(text).ok).toBe(false);
	});
});
