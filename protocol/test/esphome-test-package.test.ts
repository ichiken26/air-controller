import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fromHex, toHex } from '../src/bits.ts';
import { decode } from '../src/decoder.ts';
import { parsePronto } from '../src/pronto.ts';
import { signalToFrames } from '../src/waveform.ts';

const PACKAGE = new URL('../../firmware/ir_test_buttons.yaml', import.meta.url);

interface Button {
  name: string;
  expect: string[];
  durationsUs: number[];
}

/** Minimal reader for the generated file (one transmit per button). */
function readButtons(): Button[] {
  const buttons: Button[] = [];
  let current: Button | null = null;
  for (const line of readFileSync(PACKAGE, 'utf8').split('\n')) {
    const name = line.match(/^ {4}name: "(.+)"$/);
    if (name) buttons.push((current = { name: name[1], expect: [], durationsUs: [] }));
    const expect = line.match(/expect rc_code_1=0x(\w+)(?:, rc_code_2=0x(\w+))?/);
    if (expect && current) current.expect = expect.slice(1).filter(Boolean);
    const pronto = line.match(/^ {10}data: "(.+)"$/);
    if (pronto && current) current.durationsUs = [...parsePronto(pronto[1]).onceUs];
    const raw = line.match(/^ {10}code: \[(.+)\]$/);
    if (raw && current) current.durationsUs = raw[1].split(', ').map((v) => Math.abs(Number(v)));
  }
  return buttons;
}

describe('firmware/ir_test_buttons.yaml', () => {
  it('is up to date with the encoder', () => {
    execFileSync(process.execPath, ['--experimental-strip-types', '--no-warnings', 'scripts/esphome-test-package.ts', '--check'], {
      cwd: new URL('..', import.meta.url),
    });
  });

  const buttons = readButtons();
  it('has unique names and one signal per button', () => {
    assert.equal(new Set(buttons.map((b) => b.name)).size, buttons.length);
    assert.ok(buttons.length > 0 && buttons.every((b) => b.durationsUs.length > 0));
  });

  for (const b of buttons) {
    it(`${b.name}: transmitted signal demodulates to the logged frames and decodes`, () => {
      const frames = signalToFrames(b.durationsUs);
      const [first, ...rest] = frames.map(toHex);
      const extension = rest.find((f) => f !== first);
      assert.deepEqual([first, extension].filter(Boolean), b.expect);
      const allowCandidates = b.name.startsWith('C');
      assert.equal(decode(frames, { allowCandidates }).kind, 'command');
      if (!allowCandidates) assert.equal(decode(frames.map(toHex).map(fromHex)).kind, 'command');
    });
  }
});
