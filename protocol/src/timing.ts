// Timing profiles: how frames become mark/space durations.
//
// Two kinds of source are kept strictly apart:
//  - 'protocol-definition': nominal values taken from an implementation's source code.
//  - 'measured-capture':    medians of the demodulated envelope recorded by the Unit IR receiver
//                           (ESPHome remote_receiver -> Pronto). These include the receiver's own
//                           mark/space bias, and say nothing about the carrier frequency.
//
// Carrier frequency has NOT been measured for any profile. The 38 kHz in captures is the value
// ESPHome assumes when it writes Pronto (frequency code 0x006D); the receiver module demodulates
// the carrier away, so the original remote's frequency is unknown.

export type TimingSource = 'protocol-definition' | 'measured-capture';

export interface TimingProfile {
  readonly id: string;
  readonly source: TimingSource;
  readonly reference: string;
  readonly carrierHz: number;
  readonly carrierMeasured: boolean;
  readonly headerMarkUs: number;
  readonly headerSpaceUs: number;
  readonly bitMarkUs: number;
  readonly zeroSpaceUs: number;
  readonly oneSpaceUs: number;
  /** Mark that terminates each frame. */
  readonly endMarkUs: number;
  /** Space after each frame, including the last one. */
  readonly frameGapUs: number;
}

/** ESPHome remote_base ToshibaAcProtocol::encode (used by remote_transmitter.transmit_toshiba_ac). */
export const ESPHOME_TRANSMIT_TOSHIBA_AC: TimingProfile = {
  id: 'esphome-transmit-toshiba-ac',
  source: 'protocol-definition',
  reference: 'esphome/components/remote_base/toshiba_ac_protocol.cpp',
  carrierHz: 38000,
  carrierMeasured: false,
  headerMarkUs: 4500,
  headerSpaceUs: 4500,
  bitMarkUs: 560,
  zeroSpaceUs: 560,
  oneSpaceUs: 1690,
  endMarkUs: 560,
  frameGapUs: 4500,
};

/** ESPHome toshiba climate TOSHIBA_TIMINGS (used by model RAS-2819T). */
export const ESPHOME_TOSHIBA_CLIMATE: TimingProfile = {
  id: 'esphome-toshiba-climate',
  source: 'protocol-definition',
  reference: 'esphome/components/toshiba/toshiba.{h,cpp} TOSHIBA_TIMINGS',
  carrierHz: 38000,
  carrierMeasured: false,
  headerMarkUs: 4380,
  headerSpaceUs: 4370,
  bitMarkUs: 540,
  zeroSpaceUs: 540,
  oneSpaceUs: 1620,
  endMarkUs: 540,
  frameGapUs: 5480,
};

/** ESPHome writes received Pronto with frequency code 0x006D; one unit is this many µs. */
export const ESPHOME_PRONTO_UNIT_US = 0x6d * 0.241246;

/** Medians over every frame in captures/*.log, in Pronto units (see test/timing.test.ts). */
export const MEASURED_PRONTO_UNITS = {
  headerMark: 168,
  headerSpace: 170,
  bitMark: 19,
  zeroSpace: 22,
  oneSpace: 63,
  endMark: 19,
  frameGap: 202,
} as const;

/** RG10J5(B3H)/BGJ as seen by Unit IR. The final space in captures (~10.1 ms) is the receiver's idle timeout and is not used. */
export const MEASURED_RG10J5: TimingProfile = {
  id: 'measured-rg10j5',
  source: 'measured-capture',
  reference: 'captures/*.log (Unit IR U002 receiver via ESPHome Pronto dump)',
  carrierHz: 38000,
  carrierMeasured: false,
  headerMarkUs: units(MEASURED_PRONTO_UNITS.headerMark),
  headerSpaceUs: units(MEASURED_PRONTO_UNITS.headerSpace),
  bitMarkUs: units(MEASURED_PRONTO_UNITS.bitMark),
  zeroSpaceUs: units(MEASURED_PRONTO_UNITS.zeroSpace),
  oneSpaceUs: units(MEASURED_PRONTO_UNITS.oneSpace),
  endMarkUs: units(MEASURED_PRONTO_UNITS.endMark),
  frameGapUs: units(MEASURED_PRONTO_UNITS.frameGap),
};

export const TIMING_PROFILES: readonly TimingProfile[] = [MEASURED_RG10J5, ESPHOME_TRANSMIT_TOSHIBA_AC, ESPHOME_TOSHIBA_CLIMATE];

/** Same profile with another carrier frequency (for carrier-frequency experiments). */
export function withCarrier(profile: TimingProfile, carrierHz: number): TimingProfile {
  return { ...profile, id: `${profile.id}@${Math.round(carrierHz / 100) / 10}kHz`, carrierHz };
}

function units(n: number): number {
  return Math.round(n * ESPHOME_PRONTO_UNIT_US);
}
