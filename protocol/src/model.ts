import type { FanSpeed, FixedCommandKind, TemperatureMode } from './codes.ts';

/** Run in a mode that has a set temperature (°C, 0.5 steps). */
export interface RunWithTemperature {
  readonly kind: 'run';
  readonly mode: TemperatureMode;
  readonly temperature: number;
  readonly fan: FanSpeed;
}

/** Fan-only (送風) has no set temperature. */
export interface RunFanOnly {
  readonly kind: 'run';
  readonly mode: 'fan';
  readonly fan: FanSpeed;
}

export interface FixedCommand {
  readonly kind: FixedCommandKind;
}

export type Command = RunWithTemperature | RunFanOnly | FixedCommand;

/** Thrown for anything not backed by a capture. */
export class UnsupportedCommandError extends Error {
  override name = 'UnsupportedCommandError';
}
