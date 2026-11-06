import { assertByte } from './bits.ts';
import { complement, sumChecksum } from './checksum.ts';

/** Every frame of this protocol is 6 bytes (48 bits). */
export const FRAME_LENGTH = 6;

export type Frame = readonly number[];

/** One IR transmission: the frames in the order they are sent. */
export interface IrMessage {
  readonly frames: readonly Frame[];
}

/** [a, ~a, b, ~b, c, ~c] */
export function buildPairFrame(a: number, b: number, c: number): Frame {
  return [a, complement(a), b, complement(b), c, complement(c)];
}

/** Returns [a, b, c] when the frame satisfies the complement rule, otherwise null. */
export function parsePairFrame(frame: Frame): [number, number, number] | null {
  assertFrame(frame);
  for (let i = 0; i < FRAME_LENGTH; i += 2) {
    if (frame[i + 1] !== complement(frame[i])) return null;
  }
  return [frame[0], frame[2], frame[4]];
}

/** [p0, p1, p2, p3, p4, sum(p0..p4) & 0xFF] */
export function buildChecksumFrame(payload: readonly number[]): Frame {
  if (payload.length !== FRAME_LENGTH - 1) {
    throw new RangeError(`checksum frame payload must be ${FRAME_LENGTH - 1} bytes, got ${payload.length}`);
  }
  payload.forEach(assertByte);
  return [...payload, sumChecksum(payload)];
}

/** Returns the 5-byte payload when the checksum matches, otherwise null. */
export function parseChecksumFrame(frame: Frame): number[] | null {
  assertFrame(frame);
  const payload = frame.slice(0, FRAME_LENGTH - 1);
  return sumChecksum(payload) === frame[FRAME_LENGTH - 1] ? payload : null;
}

export function framesEqual(a: Frame, b: Frame): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

function assertFrame(frame: Frame): void {
  if (frame.length !== FRAME_LENGTH) throw new RangeError(`frame must be ${FRAME_LENGTH} bytes, got ${frame.length}`);
  frame.forEach(assertByte);
}
