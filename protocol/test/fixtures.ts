import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseEsphomeLog, type EsphomeCapture } from '../src/capture.ts';
import type { Command } from '../src/model.ts';

export const CAPTURE_DIR = new URL('../../captures/', import.meta.url).pathname;

export function loadCapture(relativePath: string): EsphomeCapture {
  return parseEsphomeLog(readFileSync(join(CAPTURE_DIR, relativePath), 'utf8'));
}

/** Every top-level capture and the command it is expected to represent. */
export const SUPPORTED_CAPTURES: ReadonlyArray<{ file: string; command: Command }> = [
  { file: 'reibo_on.log', command: { kind: 'run', mode: 'cool', temperature: 24.5, fan: 'auto' } },
  { file: 'jyoshitsu_on.log', command: { kind: 'run', mode: 'dry', temperature: 24.5, fan: 'auto' } },
  { file: 'danbo_on.log', command: { kind: 'run', mode: 'heat', temperature: 24.5, fan: 'auto' } },
  { file: 'temp_up_to_1.log', command: { kind: 'run', mode: 'cool', temperature: 27, fan: 'auto' } },
  { file: 'temp_up_to_2.log', command: { kind: 'run', mode: 'cool', temperature: 27.5, fan: 'auto' } },
  // Re-captured 05:14 after wind_amount.log (fan medium, 26.0°C), so this is +0.5°C with fan medium.
  { file: 'temp_down_to_1.log', command: { kind: 'run', mode: 'cool', temperature: 26.5, fan: 'medium' } },
  { file: 'temp_down_to_2.log', command: { kind: 'run', mode: 'cool', temperature: 26, fan: 'auto' } },
  { file: 'auto.log', command: { kind: 'run', mode: 'auto', temperature: 26, fan: 'auto' } },
  { file: 'send_wind.log', command: { kind: 'run', mode: 'fan', fan: 'auto' } },
  { file: 'wind_amount.log', command: { kind: 'run', mode: 'cool', temperature: 26, fan: 'medium' } },
  { file: 'stop.log', command: { kind: 'off' } },
  { file: 'swing.log', command: { kind: 'swingToggle' } },
  { file: 'wind_direction.log', command: { kind: 'airflowDirection' } },
];

/** Captures deliberately left unsupported (timers are handled by the app's queue). */
export const UNSUPPORTED_CAPTURES: readonly string[] = [
  'dont.log',
  ...readdirSync(join(CAPTURE_DIR, 'on_timer')).map((f) => join('on_timer', f)),
];

export function allTopLevelCaptures(): string[] {
  return readdirSync(CAPTURE_DIR).filter((f) => f.endsWith('.log'));
}
