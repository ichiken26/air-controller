import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { toEsphomeFramesValue } from '../src/adapters/esphome.ts';
import { encode } from '../src/encoder.ts';
import { MEASURED_RG10J5 } from '../src/timing.ts';

const YAML = readFileSync(new URL('../../firmware/aircontroller.yaml', import.meta.url), 'utf8');

function substitution(name: string): number {
  const m = YAML.match(new RegExp(`^  ${name}: "(\\d+)"$`, 'm'));
  assert.ok(m, `substitution ${name} missing`);
  return Number(m[1]);
}

describe('firmware/aircontroller.yaml ir_frames entity', () => {
  it('uses the MEASURED_RG10J5 timing', () => {
    const t = MEASURED_RG10J5;
    assert.deepEqual(
      {
        carrier: substitution('ir_carrier_hz'),
        headerMark: substitution('ir_header_mark_us'),
        headerSpace: substitution('ir_header_space_us'),
        bitMark: substitution('ir_bit_mark_us'),
        zeroSpace: substitution('ir_zero_space_us'),
        oneSpace: substitution('ir_one_space_us'),
        endMark: substitution('ir_end_mark_us'),
        frameGap: substitution('ir_frame_gap_us'),
      },
      {
        carrier: t.carrierHz,
        headerMark: t.headerMarkUs,
        headerSpace: t.headerSpaceUs,
        bitMark: t.bitMarkUs,
        zeroSpace: t.zeroSpaceUs,
        oneSpace: t.oneSpaceUs,
        endMark: t.endMarkUs,
        frameGap: t.frameGapUs,
      },
    );
  });

  it('value format fits max_length and the lambda parser', () => {
    const maxLength = Number(YAML.match(/max_length: (\d+)/)?.[1]);
    const value = toEsphomeFramesValue(encode({ kind: 'run', mode: 'cool', temperature: 24.5, fan: 'auto' }), Number.MAX_SAFE_INTEGER);
    assert.match(value, /^\d+:[0-9A-F]{12}(,[0-9A-F]{12}){0,3}$/);
    assert.ok(value.length <= maxLength, `${value.length} > ${maxLength}`);
    assert.equal(toEsphomeFramesValue(encode({ kind: 'off' }), 7), '7:C23D7B84E01F,C23D7B84E01F');
  });

  it('rejects invalid seq', () => {
    assert.throws(() => toEsphomeFramesValue(encode({ kind: 'off' }), -1));
    assert.throws(() => toEsphomeFramesValue(encode({ kind: 'off' }), 1.5));
  });
});
