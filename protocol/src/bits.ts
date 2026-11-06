// Bit order on the wire: bytes are sent in frame order, each byte MSB first.
// Verified by decoding the Pronto timing of every capture and matching ESPHome's
// "Received Toshiba AC: rc_code_1=0x..." output, which prints the frame MSB first.

export function assertByte(value: number): void {
  if (!Number.isInteger(value) || value < 0 || value > 0xff) {
    throw new RangeError(`not a byte: ${value}`);
  }
}

export function bytesToBits(bytes: readonly number[]): number[] {
  const bits: number[] = [];
  for (const byte of bytes) {
    assertByte(byte);
    for (let i = 7; i >= 0; i--) bits.push((byte >> i) & 1);
  }
  return bits;
}

export function bitsToBytes(bits: readonly number[]): number[] {
  if (bits.length % 8 !== 0) throw new RangeError(`bit count ${bits.length} is not a multiple of 8`);
  const bytes: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) {
      const bit = bits[i + j];
      if (bit !== 0 && bit !== 1) throw new RangeError(`not a bit: ${bit}`);
      byte = (byte << 1) | bit;
    }
    bytes.push(byte);
  }
  return bytes;
}

export function toHex(bytes: readonly number[]): string {
  return bytes.map((b) => b.toString(16).toUpperCase().padStart(2, '0')).join('');
}

export function fromHex(hex: string): number[] {
  const clean = hex.replace(/^0x/i, '');
  if (!/^([0-9a-fA-F]{2})*$/.test(clean)) throw new RangeError(`invalid hex: ${hex}`);
  const bytes: number[] = [];
  for (let i = 0; i < clean.length; i += 2) bytes.push(parseInt(clean.slice(i, i + 2), 16));
  return bytes;
}
