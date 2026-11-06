import {
  DRY_AUTO_FAN_CODE,
  EXTENSION_HEADER,
  FAN_ONLY_MODE_BYTE,
  FIXED_COMMANDS,
  HALF_DEGREE_FLAG,
  MODE_NIBBLES,
  STATE_HEADER,
  fanCodes,
  temperatureCodes,
  type FanSpeed,
  type FixedCommandKind,
  type TemperatureMode,
} from './codes.ts';
import { encode, type EncodeOptions } from './encoder.ts';
import { framesEqual, parseChecksumFrame, parsePairFrame, type Frame } from './frame.ts';
import { UnsupportedCommandError, type Command } from './model.ts';

export type DecodeResult =
  | { readonly kind: 'command'; readonly command: Command }
  | { readonly kind: 'unknown'; readonly reason: string };

/**
 * Frames -> command (e.g. for tracking state changes made with the physical remote).
 * A command is returned only if encode() reproduces the frames exactly.
 */
export function decode(frames: readonly Frame[], options: EncodeOptions = {}): DecodeResult {
  const allow = options.allowCandidates ?? false;
  const candidate = candidateCommand(frames, allow);
  if (typeof candidate === 'string') return { kind: 'unknown', reason: candidate };
  let reencoded;
  try {
    reencoded = encode(candidate, options).frames;
  } catch (e) {
    if (e instanceof UnsupportedCommandError) return { kind: 'unknown', reason: e.message };
    throw e;
  }
  if (reencoded.length !== frames.length || !reencoded.every((f, i) => framesEqual(f, frames[i]))) {
    return { kind: 'unknown', reason: 'frames differ from the canonical encoding of the decoded command' };
  }
  return { kind: 'command', command: candidate };
}

function candidateCommand(frames: readonly Frame[], allow: boolean): Command | string {
  if (frames.length === 0) return 'no frames';
  const pair = parsePairFrame(frames[0]);
  if (!pair) return 'first frame violates the complement rule';

  for (const [kind, entry] of Object.entries(FIXED_COMMANDS) as [FixedCommandKind, (typeof FIXED_COMMANDS)[FixedCommandKind]][]) {
    if (entry.pair.every((v, i) => v === pair[i])) return { kind };
  }

  const [header, fanByte, modeByte] = pair;
  if (header !== STATE_HEADER) return `unknown first-frame header 0x${hex(header)}`;
  const extension = frames.length === 3 ? parseChecksumFrame(frames[2]) : null;
  if (!extension) return 'missing or invalid checksum frame';
  if (extension[0] !== EXTENSION_HEADER) return `unknown second-frame header 0x${hex(extension[0])}`;

  if (modeByte === FAN_ONLY_MODE_BYTE) {
    const fan = fanFromCodes(fanByte, extension[1], allow);
    if (!fan) return `unknown fan code 0x${hex(fanByte)}/0x${hex(extension[1])}`;
    return { kind: 'run', mode: 'fan', fan };
  }

  const mode = (Object.keys(MODE_NIBBLES) as TemperatureMode[]).find((m) => MODE_NIBBLES[m].nibble === (modeByte & 0x0f));
  if (!mode) return `unknown mode nibble 0x${hex(modeByte & 0x0f)}`;
  const temperature = temperatureCodes(allow).find((t) => t.code === modeByte >> 4);
  if (!temperature) return `unknown temperature code 0x${hex(modeByte >> 4)}`;
  const half = extension[2] === HALF_DEGREE_FLAG ? 0.5 : 0;

  let fan: FanSpeed | null;
  if (mode === 'dry' || mode === 'auto') {
    fan = fanByte === DRY_AUTO_FAN_CODE.byte && extension[1] === DRY_AUTO_FAN_CODE.extension ? 'auto' : null;
  } else {
    fan = fanFromCodes(fanByte, extension[1], allow);
  }
  if (!fan) return `unknown fan code 0x${hex(fanByte)}/0x${hex(extension[1])} for mode ${mode}`;
  return { kind: 'run', mode, temperature: temperature.celsius + half, fan };
}

function fanFromCodes(byte: number, extension: number, allow: boolean): FanSpeed | null {
  const codes = fanCodes(allow);
  const found = (Object.keys(codes) as FanSpeed[]).find((f) => codes[f]?.byte === byte && codes[f]?.extension === extension);
  return found ?? null;
}

function hex(v: number): string {
  return v.toString(16).toUpperCase().padStart(2, '0');
}
