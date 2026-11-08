import { describe, expect, it } from 'vitest';
import { encode, isVerified } from '@air-controller/protocol';
import {
	FAN_SPEEDS,
	MODES,
	availableFans,
	fanSelectable,
	normalizeSettings,
	stepTemperature,
	temperatureRange,
	temperatureStep,
	toRunCommand
} from './remote.ts';

describe('remote rules', () => {
	it('temperature step: 0.5 in cool/dry/heat, 1 in auto, none in fan', () => {
		expect(temperatureStep('cool')).toBe(0.5);
		expect(temperatureStep('heat')).toBe(0.5);
		expect(temperatureStep('auto')).toBe(1);
		expect(temperatureStep('fan')).toBe(0);
		expect(temperatureRange('cool')).toEqual({ min: 18, max: 30 });
	});

	it('stepping clamps at the range ends', () => {
		expect(stepTemperature({ mode: 'cool', temperature: 30, fan: 'auto' }, 1)).toBe(30);
		expect(stepTemperature({ mode: 'cool', temperature: 18, fan: 'auto' }, -1)).toBe(18);
		expect(stepTemperature({ mode: 'cool', temperature: 26, fan: 'auto' }, 1)).toBe(26.5);
		expect(stepTemperature({ mode: 'auto', temperature: 26, fan: 'auto' }, -1)).toBe(25);
	});

	it('switching to auto snaps half degrees and fixes the fan', () => {
		// Ties go to the lower temperature.
		expect(normalizeSettings({ mode: 'auto', temperature: 26.5, fan: 'high' })).toEqual({ mode: 'auto', temperature: 26, fan: 'auto' });
		expect(normalizeSettings({ mode: 'dry', temperature: 24.5, fan: 'low' })).toEqual({ mode: 'dry', temperature: 24.5, fan: 'auto' });
	});

	it('heat offers only verified fan speeds', () => {
		expect(availableFans('heat')).toEqual(['auto', 'medium']);
		expect(normalizeSettings({ mode: 'heat', temperature: 24, fan: 'high' }).fan).toBe('auto');
		expect(fanSelectable('dry')).toBe(false);
		expect(fanSelectable('fan')).toBe(true);
	});

	it('every setting the UI can produce encodes with verified values only', () => {
		for (const mode of MODES) {
			for (const fan of FAN_SPEEDS) {
				for (let t = 16; t <= 32; t += 0.5) {
					const command = toRunCommand({ mode, temperature: t, fan });
					expect(() => encode(command)).not.toThrow();
					expect(isVerified(command)).toBe(true);
				}
			}
		}
	});
});
