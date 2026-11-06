import { bitsToBytes, bytesToBits } from './bits.ts';
import { FRAME_LENGTH, type Frame, type IrMessage } from './frame.ts';
import type { TimingProfile } from './timing.ts';

/** Hardware-independent IR signal: alternating mark/space durations, starting with a mark. */
export interface IrSignal {
  readonly carrierHz: number;
  readonly carrierMeasured: boolean;
  readonly timingProfileId: string;
  readonly durationsUs: readonly number[];
}

/** frame := header mark, header space, 48 × (bit mark, bit space), end mark, frame gap */
export function messageToSignal(message: IrMessage, profile: TimingProfile): IrSignal {
  const durations: number[] = [];
  for (const frame of message.frames) {
    durations.push(profile.headerMarkUs, profile.headerSpaceUs);
    for (const bit of bytesToBits(frame)) {
      durations.push(profile.bitMarkUs, bit ? profile.oneSpaceUs : profile.zeroSpaceUs);
    }
    durations.push(profile.endMarkUs, profile.frameGapUs);
  }
  return {
    carrierHz: profile.carrierHz,
    carrierMeasured: profile.carrierMeasured,
    timingProfileId: profile.id,
    durationsUs: durations,
  };
}

export interface DemodulateOptions {
  /** Marks longer than this start a frame. */
  readonly headerMarkMinUs?: number;
  /** Bit spaces longer than this are 1. */
  readonly oneSpaceMinUs?: number;
}

/**
 * Mark/space durations -> frames. Works for any profile above and for captured envelopes.
 * Defaults sit between all known profiles' values (header ≥ 4380 µs, bit marks ≤ 560 µs,
 * zero spaces ≤ 579 µs, one spaces ≥ 1620 µs).
 */
export function signalToFrames(durationsUs: readonly number[], options: DemodulateOptions = {}): Frame[] {
  const headerMarkMinUs = options.headerMarkMinUs ?? 2500;
  const oneSpaceMinUs = options.oneSpaceMinUs ?? 1100;
  const frames: Frame[] = [];
  let i = 0;
  while (i < durationsUs.length) {
    if (durationsUs[i] < headerMarkMinUs) {
      throw new Error(`expected a header mark at index ${i}, got ${durationsUs[i]} µs`);
    }
    i += 2;
    const bits: number[] = [];
    for (let b = 0; b < FRAME_LENGTH * 8; b++, i += 2) {
      const mark = durationsUs[i];
      const space = durationsUs[i + 1];
      if (mark === undefined || space === undefined) throw new Error(`signal ended inside frame ${frames.length + 1}`);
      if (mark >= headerMarkMinUs) throw new Error(`unexpected header mark inside frame ${frames.length + 1}`);
      bits.push(space >= oneSpaceMinUs ? 1 : 0);
    }
    i += 2; // end mark + gap
    frames.push(bitsToBytes(bits));
  }
  return frames;
}
