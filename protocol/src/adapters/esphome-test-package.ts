// Builds an ESPHome package with one Web-UI test button per IR operation.
// Pure function: the script in scripts/esphome-test-package.ts does the file I/O.
//
// Groups (each one answers a different question when pressed with Unit IR on the receiver):
//   A  Captured replay: the remote's own Pronto, as received.     -> Does this operation work at all?
//   B  Encoder, verified: encode() output, every value captured.  -> Does our encoder match the remote?
//   C  Encoder, candidates: ESPHome RAS-2819T values not captured. -> Is the candidate value right?
// A works but B fails => encoder or timing bug. B works but C fails => candidate value is wrong.

import { toHex } from '../bits.ts';
import type { Frame } from '../frame.ts';
import type { IrSignal } from '../waveform.ts';
import { toEsphomeRawCode } from './esphome.ts';

export type TestGroup = 'A' | 'B' | 'C';

export interface TestButton {
  readonly group: TestGroup;
  readonly label: string;
  /** Frames the air conditioner should receive (also what remote_receiver should log). */
  readonly frames: readonly Frame[];
  readonly transmit: { readonly kind: 'pronto'; readonly data: string } | { readonly kind: 'raw'; readonly signal: IrSignal };
  readonly note?: string;
}

export const GROUP_TITLES: Readonly<Record<TestGroup, string>> = {
  A: 'A 実測リプレイ（純正リモコンのPronto）',
  B: 'B エンコーダー（実測済みの値）',
  C: 'C エンコーダー（ESPHome表由来・要検証）',
};

export interface TestPackageOptions {
  /** Lines placed at the top of the file as YAML comments. */
  readonly header: readonly string[];
}

export function buildTestPackageYaml(buttons: readonly TestButton[], options: TestPackageOptions): string {
  const groups = (Object.keys(GROUP_TITLES) as TestGroup[]).filter((g) => buttons.some((b) => b.group === g));
  const out: string[] = [...options.header.map((l) => (l ? `# ${l}` : '#')), ''];

  out.push('web_server:', '  sorting_groups:');
  groups.forEach((g, i) => {
    out.push(`    - id: ir_test_group_${g.toLowerCase()}`, `      name: ${q(GROUP_TITLES[g])}`, `      sorting_weight: ${(i + 1) * 10}`);
  });
  out.push('', 'button:');

  for (const g of groups) {
    buttons
      .filter((b) => b.group === g)
      .forEach((b, i) => {
        const code = `${g}${String(i + 1).padStart(2, '0')}`;
        const [first, ...rest] = b.frames.map(toHex);
        const extension = rest.find((f) => f !== first);
        const expect = `rc_code_1=0x${first}${extension ? `, rc_code_2=0x${extension}` : ''}`;
        out.push(
          '',
          ...(b.note ? [`  # ${b.note}`] : []),
          '  - platform: template',
          `    id: ir_test_${code.toLowerCase()}`,
          `    name: ${q(`${code} ${b.label}`)}`,
          '    icon: mdi:remote',
          '    web_server:',
          `      sorting_group_id: ir_test_group_${g.toLowerCase()}`,
          `      sorting_weight: ${i + 1}`,
          '    on_press:',
          `      - logger.log: ${q(`IR ${code} ${b.label} / expect ${expect}`)}`,
        );
        if (b.transmit.kind === 'pronto') {
          out.push('      - remote_transmitter.transmit_pronto:', `          data: ${q(b.transmit.data)}`);
        } else {
          const s = b.transmit.signal;
          out.push(
            `      # timing=${s.timingProfileId} carrier=${s.carrierHz}Hz (measured: ${s.carrierMeasured})`,
            '      - remote_transmitter.transmit_raw:',
            `          carrier_frequency: ${s.carrierHz}Hz`,
            `          code: [${toEsphomeRawCode(s).join(', ')}]`,
          );
        }
      });
  }
  return out.join('\n') + '\n';
}

function q(text: string): string {
  return JSON.stringify(text);
}
