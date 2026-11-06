import { assertByte } from './bits.ts';

// Two integrity rules are used by this remote, one per frame type.

/** Pair frames (frame 1, fixed commands): every data byte is followed by its bitwise complement. */
export function complement(byte: number): number {
  assertByte(byte);
  return ~byte & 0xff;
}

/** Checksum frames (frame 2): the last byte is the low 8 bits of the sum of the preceding bytes. */
export function sumChecksum(bytes: readonly number[]): number {
  let sum = 0;
  for (const byte of bytes) {
    assertByte(byte);
    sum += byte;
  }
  return sum & 0xff;
}
