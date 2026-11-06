// ESPHome-specific output. Pure formatting: no network access.
// A networked IrTransmitter for ESPHome is left for the web app (P2), once the device
// exposes an action that accepts raw timings.

import { signalToPronto } from '../pronto.ts';
import type { IrSignal } from '../waveform.ts';

/** remote_transmitter.transmit_raw code list: marks positive, spaces negative (µs). */
export function toEsphomeRawCode(signal: IrSignal): number[] {
  return signal.durationsUs.map((d, i) => (i % 2 === 0 ? Math.round(d) : -Math.round(d)));
}

export interface EsphomeButtonOptions {
  readonly name: string;
  readonly format: 'raw' | 'pronto';
  /** Indentation of the "- platform:" line. */
  readonly indent?: number;
}

/** YAML for one template button under `button:`. */
export function toEsphomeButtonYaml(signal: IrSignal, options: EsphomeButtonOptions): string {
  const pad = ' '.repeat(options.indent ?? 2);
  const lines = [
    `${pad}# timing=${signal.timingProfileId} carrier=${signal.carrierHz}Hz (measured: ${signal.carrierMeasured})`,
    `${pad}- platform: template`,
    `${pad}  name: ${JSON.stringify(options.name)}`,
    `${pad}  on_press:`,
  ];
  if (options.format === 'raw') {
    lines.push(
      `${pad}    - remote_transmitter.transmit_raw:`,
      `${pad}        carrier_frequency: ${signal.carrierHz}Hz`,
      `${pad}        code: [${toEsphomeRawCode(signal).join(', ')}]`,
    );
  } else {
    lines.push(`${pad}    - remote_transmitter.transmit_pronto:`, `${pad}        data: "${signalToPronto(signal)}"`);
  }
  return lines.join('\n');
}
