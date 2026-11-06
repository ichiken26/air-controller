import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { decode } from '../src/decoder.ts';
import { toHex } from '../src/bits.ts';
import { encode, isVerified, supportedTemperatures } from '../src/encoder.ts';
import { UnsupportedCommandError, type Command } from '../src/model.ts';

describe('unsupported commands are rejected, not guessed', () => {
  const cases: Array<[string, Command]> = [
    ['uncaptured temperature', { kind: 'run', mode: 'cool', temperature: 25, fan: 'auto' }],
    ['non 0.5 step', { kind: 'run', mode: 'cool', temperature: 24.3, fan: 'auto' }],
    ['half degree in auto mode', { kind: 'run', mode: 'auto', temperature: 26.5, fan: 'auto' }],
    ['medium fan in heat mode', { kind: 'run', mode: 'heat', temperature: 24, fan: 'medium' }],
    ['medium fan in dry mode', { kind: 'run', mode: 'dry', temperature: 24, fan: 'medium' }],
  ];
  for (const [name, command] of cases) {
    it(name, () => assert.throws(() => encode(command), UnsupportedCommandError));
  }
});

describe('supportedTemperatures', () => {
  it('lists half degrees only where captured', () => {
    assert.deepEqual(supportedTemperatures('cool'), [24, 24.5, 26, 26.5, 27, 27.5]);
    assert.deepEqual(supportedTemperatures('auto'), [24, 26, 27]);
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

describe('candidates (ESPHome RAS-2819T values not captured on this remote)', () => {
  const cool25: Command = { kind: 'run', mode: 'cool', temperature: 25, fan: 'auto' };
  const coolHigh: Command = { kind: 'run', mode: 'cool', temperature: 24, fan: 'high' };

  it('are rejected by default', () => {
    assert.throws(() => encode(cool25), UnsupportedCommandError);
    assert.throws(() => encode(coolHigh), UnsupportedCommandError);
    assert.equal(isVerified(cool25), false);
    assert.equal(isVerified({ kind: 'run', mode: 'cool', temperature: 24.5, fan: 'auto' }), true);
  });

  it('encode with allowCandidates', () => {
    // 25°C = 0xC per RAS_2819T_TEMP_CODES; high fan = 0x3F / 0x50.
    assert.deepEqual(encode(cool25, { allowCandidates: true }).frames.map(toHex), ['C23DBF40C03F', 'C23DBF40C03F', 'D5660000003B']);
    assert.deepEqual(encode(coolHigh, { allowCandidates: true }).frames.map(toHex), ['C23D3FC040BF', 'C23D3FC040BF', 'D55000000025']);
  });

  it('decode only with allowCandidates', () => {
    const frames = encode(cool25, { allowCandidates: true }).frames;
    assert.equal(decode(frames).kind, 'unknown');
    assert.deepEqual(decode(frames, { allowCandidates: true }), { kind: 'command', command: cool25 });
  });

  it('still reject what the remote never sends', () => {
    const allow = { allowCandidates: true };
    assert.throws(() => encode({ kind: 'run', mode: 'dry', temperature: 24, fan: 'high' }, allow), UnsupportedCommandError);
    assert.throws(() => encode({ kind: 'run', mode: 'cool', temperature: 17, fan: 'auto' }, allow), UnsupportedCommandError);
    assert.throws(() => encode({ kind: 'run', mode: 'auto', temperature: 25.5, fan: 'auto' }, allow), UnsupportedCommandError);
  });

  it('cover 18-30°C', () => {
    assert.deepEqual(supportedTemperatures('auto', { allowCandidates: true }), [18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30]);
  });
});
