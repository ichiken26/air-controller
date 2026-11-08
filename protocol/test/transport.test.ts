import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { toEsphomeButtonYaml, toEsphomeRawCode } from '../src/adapters/esphome.ts';
import { UnsupportedCommandError } from '../src/model.ts';
import { ESPHOME_TRANSMIT_TOSHIBA_AC, MEASURED_RG10J5 } from '../src/timing.ts';
import { AirConditionerRemote, RecordingTransmitter } from '../src/transport.ts';

describe('AirConditionerRemote', () => {
  it('hands a hardware-independent signal to the transmitter', async () => {
    const transmitter = new RecordingTransmitter();
    const remote = new AirConditionerRemote(transmitter, MEASURED_RG10J5);
    await remote.send({ kind: 'off' });
    assert.equal(transmitter.sent.length, 1);
    assert.equal(transmitter.sent[0].timingProfileId, 'measured-rg10j5');
    assert.equal(transmitter.sent[0].durationsUs.length, 2 * 100);
  });

  it('transmits nothing for unsupported commands', async () => {
    const transmitter = new RecordingTransmitter();
    const remote = new AirConditionerRemote(transmitter, MEASURED_RG10J5);
    await assert.rejects(remote.send({ kind: 'run', mode: 'cool', temperature: 31, fan: 'auto' }), UnsupportedCommandError);
    assert.equal(transmitter.sent.length, 0);
  });
});

describe('ESPHome adapter', () => {
  it('raw code: marks positive, spaces negative', async () => {
    const transmitter = new RecordingTransmitter();
    await new AirConditionerRemote(transmitter, ESPHOME_TRANSMIT_TOSHIBA_AC).send({ kind: 'off' });
    const code = toEsphomeRawCode(transmitter.sent[0]);
    assert.deepEqual(code.slice(0, 4), [4500, -4500, 560, -1690]);
    assert.ok(code.every((v, i) => (i % 2 === 0 ? v > 0 : v < 0)));
  });

  it('button YAML names the timing profile and carrier provenance', async () => {
    const transmitter = new RecordingTransmitter();
    await new AirConditionerRemote(transmitter, MEASURED_RG10J5).send({ kind: 'off' });
    const yaml = toEsphomeButtonYaml(transmitter.sent[0], { name: 'off test', format: 'pronto' });
    assert.match(yaml, /timing=measured-rg10j5 carrier=38000Hz \(measured: false\)/);
    assert.match(yaml, /transmit_pronto:\n\s+data: "0000 006D 0064 0000 /);
  });
});
