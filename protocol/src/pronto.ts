import type { IrSignal } from './waveform.ts';

// Pronto "learned, unmodulated-header" format (0000):
//   0000 FFFF N1 N2 <N1 pairs once> <N2 pairs repeat>
// FFFF is the carrier period in units of 0.241246 µs; every duration is a count of carrier periods.

const PRONTO_CLOCK_US = 0.241246;

export function prontoFrequencyCode(carrierHz: number): number {
  return Math.round(1e6 / (carrierHz * PRONTO_CLOCK_US));
}

export function prontoCarrierHz(frequencyCode: number): number {
  return 1e6 / (frequencyCode * PRONTO_CLOCK_US);
}

/** The signal is placed in the "once" sequence; the repeat sequence is empty. */
export function signalToPronto(signal: IrSignal): string {
  if (signal.durationsUs.length % 2 !== 0) throw new RangeError('signal must end with a space');
  const code = prontoFrequencyCode(signal.carrierHz);
  const unitUs = code * PRONTO_CLOCK_US;
  const words = [0x0000, code, signal.durationsUs.length / 2, 0x0000, ...signal.durationsUs.map((d) => Math.max(1, Math.round(d / unitUs)))];
  if (words.some((w) => w > 0xffff)) throw new RangeError('duration too long for Pronto');
  return words.map((w) => w.toString(16).toUpperCase().padStart(4, '0')).join(' ');
}

export interface ProntoData {
  readonly frequencyCode: number;
  /** Nominal value implied by the header, not a measurement. */
  readonly carrierHz: number;
  readonly onceUnits: readonly number[];
  readonly repeatUnits: readonly number[];
  readonly onceUs: readonly number[];
  readonly repeatUs: readonly number[];
}

export function parsePronto(text: string): ProntoData {
  const words = text.trim().split(/\s+/).map((w) => {
    if (!/^[0-9a-fA-F]{4}$/.test(w)) throw new RangeError(`invalid Pronto word: ${w}`);
    return parseInt(w, 16);
  });
  if (words.length < 4) throw new RangeError('Pronto header missing');
  const [format, frequencyCode, onceCount, repeatCount] = words;
  if (format !== 0x0000) throw new RangeError(`unsupported Pronto format 0x${format.toString(16)}`);
  const expected = 4 + 2 * (onceCount + repeatCount);
  if (words.length !== expected) throw new RangeError(`Pronto length mismatch: expected ${expected} words, got ${words.length}`);
  const unitUs = frequencyCode * PRONTO_CLOCK_US;
  const onceUnits = words.slice(4, 4 + 2 * onceCount);
  const repeatUnits = words.slice(4 + 2 * onceCount);
  return {
    frequencyCode,
    carrierHz: prontoCarrierHz(frequencyCode),
    onceUnits,
    repeatUnits,
    onceUs: onceUnits.map((u) => u * unitUs),
    repeatUs: repeatUnits.map((u) => u * unitUs),
  };
}
