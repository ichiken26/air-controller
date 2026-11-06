import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { fromHex, toHex } from '../src/bits.ts';
import { decode } from '../src/decoder.ts';
import { encode } from '../src/encoder.ts';
import { parsePronto } from '../src/pronto.ts';
import { signalToFrames } from '../src/waveform.ts';
import { SUPPORTED_CAPTURES, UNSUPPORTED_CAPTURES, allTopLevelCaptures, loadCapture } from './fixtures.ts';

function capturedFrames(file: string): string[] {
  const capture = loadCapture(file);
  assert.equal(capture.prontos.length, 1, `${file}: expected exactly one Pronto block`);
  return signalToFrames(parsePronto(capture.prontos[0]).onceUs).map(toHex);
}

describe('captures', () => {
  it('every top-level capture is classified', () => {
    const classified = new Set([...SUPPORTED_CAPTURES.map((c) => c.file), ...UNSUPPORTED_CAPTURES]);
    assert.deepEqual(allTopLevelCaptures().filter((f) => !classified.has(f)), []);
  });

  for (const { file, command } of SUPPORTED_CAPTURES) {
    describe(file, () => {
      it('Pronto timing demodulates to the frames ESPHome decoded', () => {
        const frames = capturedFrames(file);
        const { toshibaAc } = loadCapture(file);
        assert.ok(toshibaAc, 'Toshiba AC line missing');
        // ESPHome prints the first distinct frame as code1 and the extension frame as code2.
        assert.equal(frames[0], toshibaAc.code1);
        assert.equal(frames[1], toshibaAc.code1);
        assert.equal(frames[2] ?? null, toshibaAc.code2);
      });

      it('encode() reproduces every captured frame exactly', () => {
        assert.deepEqual(encode(command).frames.map(toHex), capturedFrames(file));
      });

      it('decode() recovers the command', () => {
        assert.deepEqual(decode(capturedFrames(file).map(fromHex)), { kind: 'command', command });
      });
    });
  }

  for (const file of UNSUPPORTED_CAPTURES) {
    it(`${file} is reported as unknown, not guessed`, () => {
      const capture = loadCapture(file);
      if (capture.prontos.length === 0) return; // e.g. on_timer/9.5h.log has no data
      const result = decode(signalToFrames(parsePronto(capture.prontos[0]).onceUs));
      assert.equal(result.kind, 'unknown');
    });
  }
});
