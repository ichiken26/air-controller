import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { decode } from '../src/decoder.ts';
import { toHex } from '../src/bits.ts';
import { encode, isVerified, supportedTemperatures } from '../src/encoder.ts';
import { UnsupportedCommandError, type Command } from '../src/model.ts';

describe('unsupported commands are rejected, not guessed', () => {
  const cases: Array<[string, Command]> = [
    ['below range', { kind: 'run', mode: 'cool', temperature: 17, fan: 'auto' }],
    ['above range', { kind: 'run', mode: 'cool', temperature: 30.5, fan: 'auto' }],
    ['non 0.5 step', { kind: 'run', mode: 'cool', temperature: 24.3, fan: 'auto' }],
    ['half degree in auto mode', { kind: 'run', mode: 'auto', temperature: 26.5, fan: 'auto' }],
    ['high fan in heat mode (candidate)', { kind: 'run', mode: 'heat', temperature: 24, fan: 'high' }],
    ['medium fan in dry mode', { kind: 'run', mode: 'dry', temperature: 24, fan: 'medium' }],
  ];
  for (const [name, command] of cases) {
    it(name, () => assert.throws(() => encode(command), UnsupportedCommandError));
  }
});

describe('supportedTemperatures', () => {
  it('lists half degrees only where captured', () => {
    const cool = supportedTemperatures('cool');
    assert.equal(cool[0], 18);
    assert.equal(cool.at(-1), 30);
    assert.equal(cool.length, 25);
    assert.deepEqual(supportedTemperatures('auto'), [18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30]);
  });
  it('every listed temperature encodes and decodes', () => {
    for (const mode of ['cool', 'dry', 'heat', 'auto'] as const) {
      for (const temperature of supportedTemperatures(mode)) {
        const command: Command = { kind: 'run', mode, temperature, fan: 'auto' };
        assert.deepEqual(decode(encode(command).frames), { kind: 'command', command });
      }
    }
  });
});

describe('decode', () => {
  it('rejects a corrupted checksum', () => {
    const frames = encode({ kind: 'run', mode: 'cool', temperature: 24.5, fan: 'auto' }).frames.map((f) => [...f]);
    frames[2][5] ^= 1;
    assert.equal(decode(frames).kind, 'unknown');
  });
  it('rejects a missing repeat', () => {
    const frames = encode({ kind: 'off' }).frames.slice(0, 1);
    assert.equal(decode(frames).kind, 'unknown');
  });
});

describe('values confirmed on the AC (2026-11-07, group C)', () => {
  it('ESPHome RAS-2819T temperature and fan codes', () => {
    // 25°C = 0xC per RAS_2819T_TEMP_CODES; high fan = 0x3F / 0x50.
    const cool25: Command = { kind: 'run', mode: 'cool', temperature: 25, fan: 'auto' };
    const coolHigh: Command = { kind: 'run', mode: 'cool', temperature: 24, fan: 'high' };
    assert.deepEqual(encode(cool25).frames.map(toHex), ['C23DBF40C03F', 'C23DBF40C03F', 'D5660000003B']);
    assert.deepEqual(encode(coolHigh).frames.map(toHex), ['C23D3FC040BF', 'C23D3FC040BF', 'D55000000025']);
    assert.deepEqual(decode(encode(coolHigh).frames), { kind: 'command', command: coolHigh });
  });
});

describe('candidates', () => {
  const heatQuiet: Command = { kind: 'run', mode: 'heat', temperature: 24.5, fan: 'high' };

  it('are rejected by default and accepted with allowCandidates', () => {
    assert.equal(isVerified(heatQuiet), false);
    assert.equal(isVerified({ kind: 'run', mode: 'heat', temperature: 24.5, fan: 'medium' }), true);
    const frames = encode(heatQuiet, { allowCandidates: true }).frames;
    assert.equal(decode(frames).kind, 'unknown');
    assert.deepEqual(decode(frames, { allowCandidates: true }), { kind: 'command', command: heatQuiet });
  });

  it('still reject what the remote never sends', () => {
    const allow = { allowCandidates: true };
    assert.throws(() => encode({ kind: 'run', mode: 'dry', temperature: 24, fan: 'high' }, allow), UnsupportedCommandError);
    assert.throws(() => encode({ kind: 'run', mode: 'cool', temperature: 17, fan: 'auto' }, allow), UnsupportedCommandError);
    assert.throws(() => encode({ kind: 'run', mode: 'auto', temperature: 25.5, fan: 'auto' }, allow), UnsupportedCommandError);
  });
});

describe('timer family (fan byte 0xFF) is never produced', () => {
  it('no run command encodes to the とりけし frames or uses fan byte 0xFF', () => {
    for (const mode of ['cool', 'dry', 'heat', 'auto', 'fan'] as const) {
      for (const fan of ['auto', 'low', 'medium', 'high'] as const) {
        const temps = mode === 'fan' ? [0] : supportedTemperatures(mode);
        for (const temperature of temps) {
          const command: Command = mode === 'fan' ? { kind: 'run', mode, fan } : { kind: 'run', mode, temperature, fan };
          let frames;
          try {
            frames = encode(command, { allowCandidates: true }).frames;
          } catch {
            continue;
          }
          assert.notEqual(frames[0][2], 0xff, JSON.stringify(command));
        }
      }
    }
  });
});
