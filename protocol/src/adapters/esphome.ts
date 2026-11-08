// ESPHome-specific output. Pure formatting: no network access (the web app does the HTTP call).

import { toHex } from '../bits.ts';
import type { IrMessage } from '../frame.ts';
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

/**
 * Value for the firmware's "ir_frames" text entity (firmware/aircontroller.yaml):
 * "<seq>:<frame>,<frame>,..." with each frame as 12 hex digits. The device turns the frames into
 * marks/spaces with MEASURED_RG10J5 timing (its substitutions are checked against timing.ts).
 * `seq` must differ between consecutive sends so that repeating a command still fires on_value.
 */
export function toEsphomeFramesValue(message: IrMessage, seq: number): string {
  if (!Number.isSafeInteger(seq) || seq < 0) throw new RangeError(`seq must be a non-negative integer, got ${seq}`);
  if (message.frames.length === 0 || message.frames.length > 4) {
    throw new RangeError(`the firmware accepts 1-4 frames, got ${message.frames.length}`);
  }
  return `${seq}:${message.frames.map((f) => toHex(f)).join(',')}`;
}
