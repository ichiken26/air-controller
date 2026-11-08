// Code tables for Toshiba RAS-2214T / remote RG10J5(B3H)/BGJ.
//
// Only values backed by evidence are listed: a capture in ../captures, or an on-device check of
// a value taken from ESPHome's RAS-2819T implementation (esphome/components/toshiba/toshiba.cpp).
// Where ESPHome's values differ from the captures, the captures win. Anything not listed here
// is deliberately unsupported: add it only after capturing the remote or checking it on the AC.

export interface Evidence {
  /** Capture files (relative to captures/) that contain this value. */
  readonly captures: readonly string[];
  /** On-device check of a non-captured value: date, test button and what was observed. */
  readonly onDevice?: string;
  readonly note?: string;
}

/**
 * 2026-11-07: every group-C button of firmware/ir_test_buttons.yaml was sent with Unit IR taped
 * onto the AC's receiver; the user reported the result as expected by airflow temperature,
 * strength and sound. There is no display readout, so set temperatures were not read back.
 */
const C_GROUP_2026_11_07 = '2026-11-07 group C test (airflow temperature/strength/sound; no display readout)';

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
export type FanSpeed = 'auto' | 'low' | 'medium' | 'high';

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
  ...esphomeTemperature(18, 0x1),
  ...esphomeTemperature(19, 0x3),
  ...esphomeTemperature(20, 0x2),
  ...esphomeTemperature(21, 0x6),
  ...esphomeTemperature(22, 0x7),
  ...esphomeTemperature(23, 0x5),
  {
    celsius: 24,
    code: 0x4,
    evidence: { captures: ['reibo_on.log'], note: 'Matches the remote display photo (cool 24.5°C, fan auto).' },
  },
  ...esphomeTemperature(25, 0xc),
  {
    celsius: 26,
    code: 0xd,
    evidence: { captures: ['temp_down_to_1.log', 'temp_down_to_2.log', 'auto.log', 'wind_amount.log'], note: 'Absolute value per ESPHome table.' },
  },
  {
    celsius: 27,
    code: 0x9,
    evidence: { captures: ['temp_up_to_1.log', 'temp_up_to_2.log'], note: 'Absolute value per ESPHome table.' },
  },
  ...esphomeTemperature(28, 0x8),
  ...esphomeTemperature(29, 0xa),
  ...esphomeTemperature(30, 0xb),
];

/** Highest set temperature; 30.5 is not offered (ESPHome RAS-2819T range is 18-30°C). */
export const MAX_TEMPERATURE = 30;

function esphomeTemperature(celsius: number, code: number) {
  return [{ celsius, code, evidence: { captures: [], onDevice: C_GROUP_2026_11_07, note: 'RAS_2819T_TEMP_CODES >> 4.' } }];
}

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
    evidence: { captures: ['wind_amount.log', 'temp_down_to_1.log'], note: 'Named "medium" after ESPHome RAS-2819T.' },
  },
  // RAS_2819T_FAN_* high byte / RAS_2819T_FAN2_*; names are ESPHome's, the remote's own labels are unconfirmed.
  low: { byte: 0x9f, extension: 0x28, evidence: { captures: [], onDevice: C_GROUP_2026_11_07, note: 'Checked in cool and fan-only.' } },
  high: { byte: 0x3f, extension: 0x50, evidence: { captures: [], onDevice: C_GROUP_2026_11_07, note: 'Checked in cool and fan-only.' } },
};

/** In dry and auto modes the remote sends this fixed fan code instead of FAN_CODES. */
export const DRY_AUTO_FAN_CODE: FanCode = {
  byte: 0x1f,
  extension: 0x65,
  evidence: { captures: ['jyoshitsu_on.log', 'auto.log'] },
};

/** Fan speeds observed per mode. Combinations outside this table are unsupported. */
export const SUPPORTED_FANS: Readonly<Record<Mode, readonly FanSpeed[]>> = {
  cool: ['auto', 'low', 'medium', 'high'],
  dry: ['auto'],
  // medium: group C 2026-11-07. low/high in heat are still candidates (not yet sent in heat).
  heat: ['auto', 'medium'],
  auto: ['auto'],
  fan: ['auto', 'low', 'medium', 'high'],
};

/**
 * Not a fan speed on this remote. ESPHome RAS-2819T calls fan byte 0xFF / ext 0x01 "quiet", but on
 * RG10J5 it is the timer family: とりけし (captures/dont.log) is exactly "fan-only + 0xFF/0x01"
 * (C23DFF00E41B, D501000000D6), and every on_timer capture starts with C23DFF00. The remote has
 * no 静音 setting (one 風量 button). Never encode it as a fan speed.
 */
export const TIMER_FAMILY_FAN_BYTE = 0xff;

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
// Candidates: values not yet backed by a capture or an on-device check. encode()/decode()
// ignore them unless called with { allowCandidates: true }, which is meant only for on-device
// verification (firmware/ir_test_buttons.yaml, group C). Once confirmed on the air
// conditioner, move them to the tables above.
//
// The ESPHome RAS-2819T temperatures and fan codes were confirmed on 2026-11-07 and moved up.
// What remains a candidate is a combination: any FAN_CODES speed in a FAN_SELECTABLE_MODES
// mode that SUPPORTED_FANS does not list (currently low/high in heat).

export const CANDIDATE_REFERENCE = 'esphome/components/toshiba/toshiba.cpp RAS_2819T_* (dev branch, read 2026-11-07)';

export const CANDIDATE_TEMPERATURE_CODES: ReadonlyArray<{ celsius: number; code: number }> = [];

export const CANDIDATE_FAN_CODES: Readonly<Partial<Record<FanSpeed, { byte: number; extension: number }>>> = {};

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
