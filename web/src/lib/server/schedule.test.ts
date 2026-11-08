import { describe, expect, it } from 'vitest';
import { nextOccurrence } from './schedule.ts';

describe('nextOccurrence', () => {
	it('is today when the time is still ahead, tomorrow otherwise', () => {
		const now = new Date(2026, 10, 7, 4, 0, 0);
		expect(nextOccurrence('05:26', now)).toEqual(new Date(2026, 10, 7, 5, 26));
		expect(nextOccurrence('03:00', now)).toEqual(new Date(2026, 10, 8, 3, 0));
		expect(nextOccurrence('04:00', now)).toEqual(new Date(2026, 10, 8, 4, 0));
	});
	it('rolls over month ends', () => {
		expect(nextOccurrence('00:30', new Date(2026, 10, 30, 23, 0))).toEqual(new Date(2026, 11, 1, 0, 30));
	});
});
