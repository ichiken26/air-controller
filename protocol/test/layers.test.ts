import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { bitsToBytes, bytesToBits, fromHex, toHex } from '../src/bits.ts';
import { complement, sumChecksum } from '../src/checksum.ts';
import { buildChecksumFrame, buildPairFrame, parseChecksumFrame, parsePairFrame } from '../src/frame.ts';

describe('bits (wire order)', () => {
  it('is MSB first', () => {
    assert.deepEqual(bytesToBits([0xc2]), [1, 1, 0, 0, 0, 0, 1, 0]);
  });
  it('round-trips', () => {
    const bytes = fromHex('C23DBF4040BF');
    assert.deepEqual(bitsToBytes(bytesToBits(bytes)), bytes);
  });
  it('rejects partial bytes and non-bits', () => {
    assert.throws(() => bitsToBytes([1, 0, 1]));
    assert.throws(() => bitsToBytes([2, 0, 0, 0, 0, 0, 0, 0]));
    assert.throws(() => bytesToBits([256]));
  });
  it('formats hex', () => {
    assert.equal(toHex([0xd5, 0x06, 0x00]), 'D50600');
    assert.deepEqual(fromHex('0xD5'), [0xd5]);
  });
});

describe('checksum', () => {
  it('complement', () => {
    assert.equal(complement(0xc2), 0x3d);
    assert.equal(complement(0x00), 0xff);
  });
  it('sum of bytes, low 8 bits', () => {
    // D5+66+20+00+00 = 0x15B
    assert.equal(sumChecksum([0xd5, 0x66, 0x20, 0x00, 0x00]), 0x5b);
  });
});

describe('frames', () => {
  it('pair frame', () => {
    assert.equal(toHex(buildPairFrame(0xc2, 0xbf, 0x40)), 'C23DBF4040BF');
    assert.deepEqual(parsePairFrame(fromHex('C23DBF4040BF')), [0xc2, 0xbf, 0x40]);
    assert.equal(parsePairFrame(fromHex('C23DBF4040BE')), null);
  });
  it('checksum frame', () => {
    assert.equal(toHex(buildChecksumFrame([0xd5, 0x66, 0x20, 0x00, 0x00])), 'D5662000005B');
    assert.deepEqual(parseChecksumFrame(fromHex('D5662000005B')), [0xd5, 0x66, 0x20, 0x00, 0x00]);
    assert.equal(parseChecksumFrame(fromHex('D5662000005C')), null);
  });
  it('rejects wrong lengths', () => {
    assert.throws(() => buildChecksumFrame([0xd5]));
    assert.throws(() => parsePairFrame([0xc2]));
  });
});
