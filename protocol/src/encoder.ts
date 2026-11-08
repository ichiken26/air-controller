import {
  DRY_AUTO_FAN_CODE,
  EXTENSION_HEADER,
  FAN_ONLY_MODE_BYTE,
  FAN_SELECTABLE_MODES,
  FIXED_COMMANDS,
  HALF_DEGREE_FLAG,
  HALF_DEGREE_MODES,
  MAX_TEMPERATURE,
  MODE_NIBBLES,
  PAIR_FRAME_REPEAT,
  STATE_HEADER,
  SUPPORTED_FANS,
  fanCodes,
  temperatureCodes,
  type FanSpeed,
  type FixedCommandKind,
  type Mode,
  type TemperatureMode,
} from './codes.ts';
import { buildChecksumFrame, buildPairFrame, type Frame, type IrMessage } from './frame.ts';
import { UnsupportedCommandError, type Command } from './model.ts';

export interface EncodeOptions {
  /**
   * Also accept CANDIDATE_* values (ESPHome RAS-2819T table, not captured on this remote).
   * For on-device verification only; the default rejects anything not backed by a capture.
   */
  readonly allowCandidates?: boolean;
}

/** Command -> frames. Throws UnsupportedCommandError for anything not backed by a capture. */
export function encode(command: Command, options: EncodeOptions = {}): IrMessage {
  const allow = options.allowCandidates ?? false;
  if (command.kind === 'run') {
    const fan = fanCode(command.mode, command.fan, allow);
    let modeByte = FAN_ONLY_MODE_BYTE;
    let half = false;
    if (command.mode !== 'fan') {
      const temperature = splitTemperature(command.mode, command.temperature, allow);
      modeByte = (temperature.code << 4) | MODE_NIBBLES[command.mode].nibble;
      half = temperature.half;
    }
    const first = buildPairFrame(STATE_HEADER, fan.byte, modeByte);
    const second = buildChecksumFrame([EXTENSION_HEADER, fan.extension, half ? HALF_DEGREE_FLAG : 0x00, 0x00, 0x00]);
    return { frames: [...repeat(first), second] };
  }
  return encodeFixed(command.kind);
}

/** True when every value in the command is backed by a capture (encode() without candidates accepts it). */
export function isVerified(command: Command): boolean {
  try {
    encode(command);
    return true;
  } catch (e) {
    if (e instanceof UnsupportedCommandError) return false;
    throw e;
  }
}

function encodeFixed(kind: FixedCommandKind): IrMessage {
  const entry = FIXED_COMMANDS[kind];
  if (!entry) throw new UnsupportedCommandError(`unknown command kind: ${String(kind)}`);
  return { frames: repeat(buildPairFrame(...entry.pair)) };
}

function repeat(frame: Frame): Frame[] {
  return Array.from({ length: PAIR_FRAME_REPEAT }, () => frame);
}

function fanCode(mode: Mode, fan: FanSpeed, allow: boolean): { byte: number; extension: number } {
  if (mode === 'dry' || mode === 'auto') {
    if (fan !== 'auto') throw new UnsupportedCommandError(`mode "${mode}" always sends the fixed fan code; fan must be "auto"`);
    return DRY_AUTO_FAN_CODE;
  }
  const code = fanCodes(allow)[fan];
  const captured = SUPPORTED_FANS[mode]?.includes(fan) ?? false;
  if (!code || (!captured && !(allow && FAN_SELECTABLE_MODES.includes(mode)))) {
    throw new UnsupportedCommandError(`fan "${fan}" in mode "${mode}" has not been captured`);
  }
  return code;
}

function splitTemperature(mode: TemperatureMode, celsius: number, allow: boolean): { code: number; half: boolean } {
  const whole = Math.floor(celsius);
  const fraction = celsius - whole;
  if (fraction !== 0 && fraction !== 0.5) {
    throw new UnsupportedCommandError(`temperature must be in 0.5°C steps, got ${celsius}`);
  }
  const half = fraction === 0.5;
  if (half && !HALF_DEGREE_MODES.includes(mode)) {
    throw new UnsupportedCommandError(`half-degree setting in mode "${mode}" has not been captured`);
  }
  if (celsius > MAX_TEMPERATURE) throw new UnsupportedCommandError(`temperature above ${MAX_TEMPERATURE}°C: ${celsius}`);
  const table = temperatureCodes(allow);
  const entry = table.find((t) => t.celsius === whole);
  if (!entry) {
    const known = table.map((t) => t.celsius).join(', ');
    throw new UnsupportedCommandError(`temperature ${whole}°C has not been captured (known: ${known})`);
  }
  return { code: entry.code, half };
}

/** Temperatures accepted by encode() for a mode. */
export function supportedTemperatures(mode: TemperatureMode, options: EncodeOptions = {}): number[] {
  const halves = HALF_DEGREE_MODES.includes(mode);
  return temperatureCodes(options.allowCandidates ?? false).flatMap((t) => (halves ? [t.celsius, t.celsius + 0.5] : [t.celsius]))
    .filter((t) => t <= MAX_TEMPERATURE);
}
