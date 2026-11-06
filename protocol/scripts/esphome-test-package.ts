// Writes ../firmware/ir_test_buttons.yaml: Web-UI test buttons for every IR operation.
// Usage: npm run esphome-test-package          (write the file)
//        npm run esphome-test-package -- --check  (exit 1 if the file is stale)

import { readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { buildTestPackageYaml, type TestButton } from '../src/adapters/esphome-test-package.ts';
import { parseEsphomeLog } from '../src/capture.ts';
import { CANDIDATE_REFERENCE, type FanSpeed, type Mode } from '../src/codes.ts';
import { encode, isVerified, supportedTemperatures } from '../src/encoder.ts';
import type { Command } from '../src/model.ts';
import { parsePronto } from '../src/pronto.ts';
import { MEASURED_RG10J5 } from '../src/timing.ts';
import { messageToSignal, signalToFrames } from '../src/waveform.ts';

const CAPTURE_DIR = new URL('../../captures/', import.meta.url);
const OUTPUT = new URL('../../firmware/ir_test_buttons.yaml', import.meta.url);
const TIMING = MEASURED_RG10J5;

const MODE_LABEL: Record<Mode, string> = { cool: '冷房', dry: '除湿', heat: '暖房', auto: '自動運転', fan: '送風' };
const FAN_LABEL: Record<FanSpeed, string> = { auto: '風量自動', quiet: '風量静音?', low: '風量弱?', medium: '風量中', high: '風量強?' };

/** Captures replayed in group A, in remote-button order. */
const REPLAYS: ReadonlyArray<{ file: string; label: string }> = [
  { file: 'reibo_on.log', label: '冷房ボタン (冷房24.5℃ 風量自動)' },
  { file: 'jyoshitsu_on.log', label: '除湿ボタン (除湿24.5℃)' },
  { file: 'danbo_on.log', label: '暖房ボタン (暖房24.5℃ 風量自動)' },
  { file: 'auto.log', label: '自動ボタン (自動26℃)' },
  { file: 'send_wind.log', label: '送風ボタン' },
  { file: 'stop.log', label: '停止ボタン' },
  { file: 'temp_up_to_1.log', label: '温度上げ (冷房27.0℃)' },
  { file: 'temp_up_to_2.log', label: '温度上げ (冷房27.5℃)' },
  { file: 'temp_down_to_1.log', label: '温度下げ (冷房26.5℃ 風量中)' },
  { file: 'temp_down_to_2.log', label: '温度下げ (冷房26.0℃)' },
  { file: 'wind_amount.log', label: '風量ボタン (冷房26℃ 風量中)' },
  { file: 'swing.log', label: 'スイングボタン' },
  { file: 'wind_direction.log', label: '風向ボタン' },
];

function replayButton(file: string, label: string): TestButton {
  const capture = parseEsphomeLog(readFileSync(new URL(file, CAPTURE_DIR), 'utf8'));
  if (capture.prontos.length !== 1) throw new Error(`${file}: expected one Pronto block`);
  const pronto = capture.prontos[0];
  return {
    group: 'A',
    label,
    frames: signalToFrames(parsePronto(pronto).onceUs),
    transmit: { kind: 'pronto', data: pronto },
    note: `captures/${file}`,
  };
}

function commandLabel(c: Command): string {
  switch (c.kind) {
    case 'run':
      if (c.mode === 'fan') return `${MODE_LABEL.fan} ${FAN_LABEL[c.fan]}`;
      return `${MODE_LABEL[c.mode]} ${c.temperature.toFixed(1)}℃${c.mode === 'dry' || c.mode === 'auto' ? '' : ` ${FAN_LABEL[c.fan]}`}`;
    case 'off':
      return '停止';
    case 'swingToggle':
      return 'スイング切替';
    case 'airflowDirection':
      return '風向 (1回押し)';
  }
}

function encoderButton(command: Command, group: 'B' | 'C', note?: string): TestButton {
  const message = encode(command, { allowCandidates: group === 'C' });
  return {
    group,
    label: commandLabel(command),
    frames: message.frames,
    transmit: { kind: 'raw', signal: messageToSignal(message, TIMING) },
    note,
  };
}

function run(mode: Mode, fan: FanSpeed, temperature = 0): Command {
  return mode === 'fan' ? { kind: 'run', mode, fan } : { kind: 'run', mode, temperature, fan };
}

// Group B: every command encode() accepts without candidates.
const verified: Command[] = [];
for (const mode of ['cool', 'dry', 'heat', 'auto'] as const) {
  for (const fan of ['auto', 'medium'] as const) {
    for (const t of supportedTemperatures(mode)) {
      const c = run(mode, fan, t);
      if (isVerified(c)) verified.push(c);
    }
  }
}
verified.push(run('fan', 'auto'), { kind: 'off' }, { kind: 'swingToggle' }, { kind: 'airflowDirection' });

// Group C: candidates. Temperatures are checked in cool mode (the mode nibble is independent of
// the temperature code, so a confirmed code carries over to dry/heat/auto); fan speeds in cool and fan-only.
const candidates: Array<{ command: Command; note?: string }> = [];
// ESPHome's RAS-2819T range is 18-30°C; 30.5 is not offered.
for (const t of supportedTemperatures('cool', { allowCandidates: true }).filter((t) => t <= 30)) {
  const c = run('cool', 'auto', t);
  if (!isVerified(c)) candidates.push({ command: c, note: '温度コード: リモコン/本体の表示温度と一致するか確認' });
}
for (const fan of ['quiet', 'low', 'high'] as const) {
  candidates.push({ command: run('cool', fan, 24.5), note: `風量 ${fan}: 本体の風量表示・風の強さを確認` });
}
for (const fan of ['quiet', 'low', 'medium', 'high'] as const) {
  candidates.push({ command: run('fan', fan), note: `送風 + 風量 ${fan}` });
}
candidates.push({ command: run('heat', 'medium', 24.5), note: '暖房 + 風量中 (コード自体は実測済み、組み合わせが未実測)' });

const buttons: TestButton[] = [
  ...REPLAYS.map((r) => replayButton(r.file, r.label)),
  ...verified.map((c) => encoderButton(c, 'B')),
  ...candidates.map(({ command, note }) => encoderButton(command, 'C', note)),
];

const yaml = buildTestPackageYaml(buttons, {
  header: [
    'GENERATED by protocol/scripts/esphome-test-package.ts. Do not edit by hand:',
    'change protocol/src/codes.ts (or the script) and run `npm run esphome-test-package`.',
    '',
    'A: replays the remote\'s captured Pronto. B: encode() output, every value captured.',
    `C: candidate values from ${CANDIDATE_REFERENCE}.`,
    `B/C timing: ${TIMING.id} (${TIMING.reference}), carrier ${TIMING.carrierHz} Hz (measured: ${TIMING.carrierMeasured}).`,
    'Each button logs the frames the AC should receive; with dump: toshiba_ac the receiver',
    'logs what it actually saw ("Received Toshiba AC: ...") for comparison.',
  ],
});

const { values } = parseArgs({ options: { check: { type: 'boolean', default: false } } });
if (values.check) {
  let current = '';
  try {
    current = readFileSync(OUTPUT, 'utf8');
  } catch {}
  if (current !== yaml) {
    console.error('firmware/ir_test_buttons.yaml is stale; run npm run esphome-test-package');
    process.exit(1);
  }
  console.log('firmware/ir_test_buttons.yaml is up to date');
} else {
  writeFileSync(OUTPUT, yaml);
  const count = (g: string) => buttons.filter((b) => b.group === g).length;
  console.log(`wrote firmware/ir_test_buttons.yaml: A=${count('A')} B=${count('B')} C=${count('C')} buttons`);
}
