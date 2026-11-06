// Code tables for Toshiba RAS-2214T / remote RG10J5(B3H)/BGJ.
//
// Only values observed in ../captures are listed. ESPHome's RAS-2819T implementation
// (esphome/components/toshiba/toshiba.cpp, 2026.8) was used as a reference for naming;
// where its values differ from the captures, the captures win. Anything not listed here
// is deliberately unsupported: add it only after capturing the remote.

export interface Evidence {
  /** Capture files (relative to captures/) that contain this value. */
  readonly captures: readonly string[];
  readonly note?: string;
}

// Frame 1 (pair frame): [0xC2, fan, temperature<<4 | mode] with complements.
export const STATE_HEADER = 0xc2;
// Frame 2 (checksum frame): [0xD5, fan2, flags, 0x00, 0x00, checksum].
export const EXTENSION_HEADER = 0xd5;
// Airflow-direction command uses a different header byte.
export const AIRFLOW_HEADER = 0xc9;

/** Frame 2 byte 2. Not present in ESPHome's RAS-2819T (it always sends 0x00 there). */
export const HALF_DEGREE_FLAG = 0x20;
export const HALF_DEGREE_EVIDENCE: Evidence = {
  captures: ['reibo_on.log', 'jyoshitsu_on.log', 'danbo_on.log', 'temp_up_to_2.log', 'temp_down_to_1.log'],
  note: '+0.5°C. Set on 24.5/27.5/26.5 captures, clear on 27.0/26.0 captures.',
};

export type Mode = 'cool' | 'dry' | 'heat' | 'auto' | 'fan';
export type TemperatureMode = Exclude<Mode, 'fan'>;
export type FanSpeed = 'auto' | 'quiet' | 'low' | 'medium' | 'high';

/** Low nibble of frame 1 byte 4 (high nibble is the temperature code). */
export const MODE_NIBBLES: Readonly<Record<TemperatureMode, { nibble: number; evidence: Evidence }>> = {
  cool: { nibble: 0x0, evidence: { captures: ['reibo_on.log'] } },
  dry: {
    nibble: 0x4,
    evidence: { captures: ['jyoshitsu_on.log'], note: 'ESPHome RAS-2819T uses +0x24 here; this remote uses 0x04.' },
  },
  heat: { nibble: 0xc, evidence: { captures: ['danbo_on.log'] } },
  auto: { nibble: 0x8, evidence: { captures: ['auto.log'] } },
};

/** Fan-only mode replaces the whole temperature/mode byte. */
export const FAN_ONLY_MODE_BYTE = 0xe4;
export const FAN_ONLY_EVIDENCE: Evidence = { captures: ['send_wind.log'] };

/**
 * High nibble of frame 1 byte 4.
 * The codes form a non-monotonic sequence; absolute values come from ESPHome's RAS-2819T table
 * and are consistent with the capture order (27.0 -> 27.5 -> ... -> 26.5 -> 26.0).
 */
export const TEMPERATURE_CODES: ReadonlyArray<{ celsius: number; code: number; evidence: Evidence }> = [
  {
    celsius: 24,
    code: 0x4,
    evidence: { captures: ['reibo_on.log'], note: 'Matches the remote display photo (cool 24.5°C, fan auto).' },
  },
  {
    celsius: 26,
    code: 0xd,
    evidence: { captures: ['temp_down_to_1.log', 'temp_down_to_2.log', 'auto.log', 'wind_amount.log'], note: 'Absolute value per ESPHome table; not yet confirmed on the display.' },
  },
  {
    celsius: 27,
    code: 0x9,
    evidence: { captures: ['temp_up_to_1.log', 'temp_up_to_2.log'], note: 'Absolute value per ESPHome table; not yet confirmed on the display.' },
  },
];

export interface FanCode {
  /** Frame 1 byte 2. */
  readonly byte: number;
  /** Frame 2 byte 1. */
  readonly extension: number;
  readonly evidence: Evidence;
}

export const FAN_CODES: Readonly<Partial<Record<FanSpeed, FanCode>>> = {
  auto: { byte: 0xbf, extension: 0x66, evidence: { captures: ['reibo_on.log', 'danbo_on.log', 'send_wind.log'] } },
  medium: {
    byte: 0x5f,
    extension: 0x3c,
    evidence: { captures: ['wind_amount.log', 'temp_down_to_1.log'], note: 'Named "medium" after ESPHome RAS-2819T; not yet confirmed on the display.' },
  },
};

/** In dry and auto modes the remote sends this fixed fan code instead of FAN_CODES. */
export const DRY_AUTO_FAN_CODE: FanCode = {
  byte: 0x1f,
  extension: 0x65,
  evidence: { captures: ['jyoshitsu_on.log', 'auto.log'] },
};

/** Fan speeds observed per mode. Combinations outside this table are unsupported. */
export const SUPPORTED_FANS: Readonly<Record<Mode, readonly FanSpeed[]>> = {
  cool: ['auto', 'medium'],
  dry: ['auto'],
  heat: ['auto'],
  auto: ['auto'],
  fan: ['auto'],
};

/** Modes for which a half-degree setting was observed. */
export const HALF_DEGREE_MODES: readonly TemperatureMode[] = ['cool', 'dry', 'heat'];

export type FixedCommandKind = 'off' | 'swingToggle' | 'airflowDirection';

/** Single pair-frame commands, sent twice. Values are [a, b, c] of the pair frame. */
export const FIXED_COMMANDS: Readonly<Record<FixedCommandKind, { pair: readonly [number, number, number]; evidence: Evidence }>> = {
  off: { pair: [STATE_HEADER, 0x7b, 0xe0], evidence: { captures: ['stop.log'], note: 'Same as ESPHome RAS_2819T_POWER_OFF_COMMAND.' } },
  swingToggle: { pair: [STATE_HEADER, 0x6b, 0xe0], evidence: { captures: ['swing.log'], note: 'Same as ESPHome RAS_2819T_SWING_TOGGLE.' } },
  airflowDirection: {
    pair: [AIRFLOW_HEADER, 0xf5, 0x2b],
    evidence: { captures: ['wind_direction.log'], note: 'One press of the 風向 button. Its effect per press is not characterised.' },
  },
};

// ---------------------------------------------------------------------------
// Candidates: values from ESPHome's RAS-2819T table that have NOT been captured on this
// remote. encode()/decode() ignore them unless called with { allowCandidates: true }, which
// is meant only for on-device verification (firmware/ir_test_buttons.yaml, group C).
// Once a candidate is confirmed on the air conditioner, move it to the verified tables above.

export const CANDIDATE_REFERENCE =
  'esphome/components/toshiba/toshiba.cpp RAS_2819T_TEMP_CODES / RAS_2819T_FAN_* (dev branch, read 2026-11-07)';

/** RAS_2819T_TEMP_CODES >> 4, minus the entries already captured (24, 26, 27). */
export const CANDIDATE_TEMPERATURE_CODES: ReadonlyArray<{ celsius: number; code: number }> = [
  { celsius: 18, code: 0x1 },
  { celsius: 19, code: 0x3 },
  { celsius: 20, code: 0x2 },
  { celsius: 21, code: 0x6 },
  { celsius: 22, code: 0x7 },
  { celsius: 23, code: 0x5 },
  { celsius: 25, code: 0xc },
  { celsius: 28, code: 0x8 },
  { celsius: 29, code: 0xa },
  { celsius: 30, code: 0xb },
];

/**
 * RAS_2819T_FAN_* high byte / RAS_2819T_FAN2_*. ESPHome's medium (5F / 3C) matches the
 * capture, which is why the others are plausible; the remote's own names are unconfirmed.
 */
export const CANDIDATE_FAN_CODES: Readonly<Partial<Record<FanSpeed, { byte: number; extension: number }>>> = {
  quiet: { byte: 0xff, extension: 0x01 },
  low: { byte: 0x9f, extension: 0x28 },
  high: { byte: 0x3f, extension: 0x50 },
};

/** Modes that take a selectable fan speed (dry/auto always send DRY_AUTO_FAN_CODE). */
export const FAN_SELECTABLE_MODES: readonly Mode[] = ['cool', 'heat', 'fan'];

export function temperatureCodes(allowCandidates: boolean): ReadonlyArray<{ celsius: number; code: number }> {
  if (!allowCandidates) return TEMPERATURE_CODES;
  return [...TEMPERATURE_CODES, ...CANDIDATE_TEMPERATURE_CODES].sort((a, b) => a.celsius - b.celsius);
}

export function fanCodes(allowCandidates: boolean): Readonly<Partial<Record<FanSpeed, { byte: number; extension: number }>>> {
  return allowCandidates ? { ...CANDIDATE_FAN_CODES, ...FAN_CODES } : FAN_CODES;
}

/** Frame 1 is repeated this many times in every capture; frame 2 is sent once. */
export const PAIR_FRAME_REPEAT = 2;
