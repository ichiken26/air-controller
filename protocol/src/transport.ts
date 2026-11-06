import { encode } from './encoder.ts';
import type { Command } from './model.ts';
import type { TimingProfile } from './timing.ts';
import { messageToSignal, type IrSignal } from './waveform.ts';

/** Hardware boundary. Implementations decide how an IrSignal reaches an IR LED (ESPHome, Linux LIRC, ...). */
export interface IrTransmitter {
  transmit(signal: IrSignal): Promise<void>;
}

/** Protocol + timing on one side, transmitter on the other. */
export class AirConditionerRemote {
  readonly transmitter: IrTransmitter;
  readonly timing: TimingProfile;

  constructor(transmitter: IrTransmitter, timing: TimingProfile) {
    this.transmitter = transmitter;
    this.timing = timing;
  }

  /** Throws UnsupportedCommandError before anything is transmitted. */
  async send(command: Command): Promise<IrSignal> {
    const signal = messageToSignal(encode(command), this.timing);
    await this.transmitter.transmit(signal);
    return signal;
  }
}

/** Keeps signals in memory; for tests and dry runs. */
export class RecordingTransmitter implements IrTransmitter {
  readonly sent: IrSignal[] = [];

  async transmit(signal: IrSignal): Promise<void> {
    this.sent.push(signal);
  }
}
