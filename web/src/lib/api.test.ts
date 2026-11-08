import { describe, expect, it } from 'vitest';
import { ValidationError, parseCommandRequest, parseTimerRequest } from './api.ts';

describe('request validation', () => {
	it('accepts valid commands', () => {
		expect(parseCommandRequest({ action: 'off' })).toEqual({ action: 'off' });
		expect(parseCommandRequest({ action: 'run', settings: { mode: 'cool', temperature: 24.5, fan: 'auto' } })).toEqual({
			action: 'run',
			settings: { mode: 'cool', temperature: 24.5, fan: 'auto' }
		});
	});

	it.each([
		[null],
		[{ action: 'explode' }],
		[{ action: 'run', settings: { mode: 'turbo', temperature: 24, fan: 'auto' } }],
		[{ action: 'run', settings: { mode: 'cool', temperature: '24', fan: 'auto' } }],
		[{ action: 'run', settings: { mode: 'cool', temperature: 24, fan: 'quiet' } }]
	])('rejects %j', (body) => {
		expect(() => parseCommandRequest(body)).toThrow(ValidationError);
	});

	it('timer time must be HH:MM', () => {
		expect(parseTimerRequest({ kind: 'off', time: '05:26' })).toEqual({ kind: 'off', time: '05:26' });
		expect(() => parseTimerRequest({ kind: 'off', time: '5:26' })).toThrow(ValidationError);
		expect(() => parseTimerRequest({ kind: 'off', time: '24:00' })).toThrow(ValidationError);
		expect(() => parseTimerRequest({ kind: 'on', time: '05:26' })).toThrow(ValidationError);
	});
});
