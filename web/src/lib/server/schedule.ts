// Time arithmetic for timers, kept pure for tests.

import { TIME_RE } from '../api.ts';

/** Next occurrence of local "HH:MM" strictly after `now` (today if still ahead, else tomorrow). */
export function nextOccurrence(time: string, now: Date): Date {
	const m = TIME_RE.exec(time);
	if (!m) throw new RangeError(`time must be HH:MM, got ${time}`);
	const at = new Date(now);
	at.setHours(Number(m[1]), Number(m[2]), 0, 0);
	if (at.getTime() <= now.getTime()) at.setDate(at.getDate() + 1);
	return at;
}

/** setTimeout cannot wait longer than ~24.8 days; timers here are < 24 h but clamp anyway. */
export const MAX_TIMEOUT_MS = 2 ** 31 - 1;

export function delayUntil(at: Date, now: Date): number {
	return Math.min(MAX_TIMEOUT_MS, Math.max(0, at.getTime() - now.getTime()));
}
