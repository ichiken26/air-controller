// Prints ESPHome template buttons for transmit experiments (P0: timing / carrier hypotheses).
// Usage: npm run esphome-yaml -- [--command cool24.5|off] [--carrier 38000,36000,40000] [--format raw|pronto]
// Paste the output under `button:` in aircontroller.yaml.

import { parseArgs } from 'node:util';
import { toEsphomeButtonYaml } from '../src/adapters/esphome.ts';
import { encode } from '../src/encoder.ts';
import type { Command } from '../src/model.ts';
import { TIMING_PROFILES, withCarrier } from '../src/timing.ts';
import { messageToSignal } from '../src/waveform.ts';

const PRESETS: Record<string, Command> = {
  'cool24.5': { kind: 'run', mode: 'cool', temperature: 24.5, fan: 'auto' },
  off: { kind: 'off' },
};

const { values } = parseArgs({
  options: {
    command: { type: 'string', default: 'cool24.5' },
    carrier: { type: 'string', default: '38000' },
    format: { type: 'string', default: 'raw' },
  },
});

const command = PRESETS[values.command];
if (!command) throw new Error(`unknown --command ${values.command}; choose from ${Object.keys(PRESETS).join(', ')}`);
if (values.format !== 'raw' && values.format !== 'pronto') throw new Error('--format must be raw or pronto');
const carriers = values.carrier.split(',').map(Number);

const message = encode(command);
const buttons: string[] = [];
for (const base of TIMING_PROFILES) {
  for (const hz of carriers) {
    const profile = hz === base.carrierHz ? base : withCarrier(base, hz);
    buttons.push(
      toEsphomeButtonYaml(messageToSignal(message, profile), {
        name: `${values.command} ${base.id} ${hz / 1000}kHz`,
        format: values.format,
      }),
    );
  }
}
console.log(`button:\n${buttons.join('\n\n')}`);
