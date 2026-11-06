import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { toHex } from '../src/bits.ts';
import { encode } from '../src/encoder.ts';
import { parsePronto, prontoCarrierHz, signalToPronto } from '../src/pronto.ts';
import { ESPHOME_TOSHIBA_CLIMATE, ESPHOME_TRANSMIT_TOSHIBA_AC, MEASURED_PRONTO_UNITS, MEASURED_RG10J5, TIMING_PROFILES, withCarrier } from '../src/timing.ts';
import { messageToSignal, signalToFrames } from '../src/waveform.ts';
import { SUPPORTED_CAPTURES, loadCapture } from './fixtures.ts';

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

/** Captured Pronto units split by role, per frame: header, 48 bits, end mark, gap. */
function capturedUnits() {
  const roles = { headerMark: [] as number[], headerSpace: [] as number[], bitMark: [] as number[], zeroSpace: [] as number[], oneSpace: [] as number[], endMark: [] as number[], frameGap: [] as number[] };
  for (const { file } of SUPPORTED_CAPTURES) {
    const units = parsePronto(loadCapture(file).prontos[0]).onceUnits;
    for (let start = 0; start < units.length; start += 100) {
      const frame = units.slice(start, start + 100);
      roles.headerMark.push(frame[0]);
      roles.headerSpace.push(frame[1]);
      for (let b = 0; b < 48; b++) {
        roles.bitMark.push(frame[2 + 2 * b]);
        const space = frame[3 + 2 * b];
        (space > 42 ? roles.oneSpace : roles.zeroSpace).push(space);
      }
      roles.endMark.push(frame[98]);
      // The last space of a capture is the receiver's idle timeout, not a protocol gap.
      if (start + 100 < units.length) roles.frameGap.push(frame[99]);
    }
  }
  return roles;
}

describe('measured profile', () => {
  it('equals the medians of all captures', () => {
    const roles = capturedUnits();
    for (const key of Object.keys(MEASURED_PRONTO_UNITS) as (keyof typeof MEASURED_PRONTO_UNITS)[]) {
      assert.equal(median(roles[key]), MEASURED_PRONTO_UNITS[key], key);
    }
  });

  it('is labelled as measured, with an unmeasured carrier', () => {
    assert.equal(MEASURED_RG10J5.source, 'measured-capture');
    assert.equal(MEASURED_RG10J5.carrierMeasured, false);
  });

  it('reproduces the captured Pronto within ±3 units (except the trailing idle space)', () => {
    for (const { file, command } of SUPPORTED_CAPTURES) {
      const captured = parsePronto(loadCapture(file).prontos[0]);
      const generated = parsePronto(signalToPronto(messageToSignal(encode(command), MEASURED_RG10J5)));
      assert.equal(generated.frequencyCode, captured.frequencyCode, file);
      assert.equal(generated.onceUnits.length, captured.onceUnits.length, file);
      generated.onceUnits.slice(0, -1).forEach((u, i) => {
        assert.ok(Math.abs(u - captured.onceUnits[i]) <= 3, `${file}[${i}]: generated ${u}, captured ${captured.onceUnits[i]}`);
      });
    }
  });
});

describe('protocol-definition profiles', () => {
  it('are labelled as definitions', () => {
    assert.equal(ESPHOME_TRANSMIT_TOSHIBA_AC.source, 'protocol-definition');
    assert.equal(ESPHOME_TOSHIBA_CLIMATE.source, 'protocol-definition');
  });
});

describe('every profile', () => {
  const command = { kind: 'run', mode: 'cool', temperature: 24.5, fan: 'auto' } as const;
  for (const profile of TIMING_PROFILES) {
    it(`${profile.id}: signal and Pronto demodulate back to the same frames`, () => {
      const signal = messageToSignal(encode(command), profile);
      assert.equal(signal.timingProfileId, profile.id);
      const expected = encode(command).frames.map(toHex);
      assert.deepEqual(signalToFrames(signal.durationsUs).map(toHex), expected);
      assert.deepEqual(signalToFrames(parsePronto(signalToPronto(signal)).onceUs).map(toHex), expected);
    });
  }
});

describe('Pronto', () => {
  it('38 kHz maps to frequency code 0x006D, as written by ESPHome', () => {
    const pronto = signalToPronto(messageToSignal(encode({ kind: 'off' }), MEASURED_RG10J5));
    assert.match(pronto, /^0000 006D 0064 0000 /);
    assert.ok(Math.abs(prontoCarrierHz(0x6d) - 38000) < 50);
  });
  it('carrier override changes only the frequency code', () => {
    const signal = messageToSignal(encode({ kind: 'off' }), withCarrier(MEASURED_RG10J5, 36000));
    assert.equal(signal.carrierHz, 36000);
    assert.match(signalToPronto(signal), /^0000 0073 /);
  });
  it('rejects malformed data', () => {
    assert.throws(() => parsePronto('0000 006D 0001 0000 0010'));
    assert.throws(() => parsePronto('0100 006D 0000 0000'));
  });
});
