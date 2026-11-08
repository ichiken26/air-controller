// The one Controller for this server process, configured from the environment:
//   ESPHOME_URL  e.g. http://aircontroller.local  (unset: mock transmitter, nothing is sent)
//   DATA_DIR     where state.json is kept (default ./data)

import { join } from 'node:path';
import { Controller } from './controller.ts';
import { EsphomeHttpTransmitter, MockTransmitter } from './transmitter.ts';

const env = process.env;

let instance: Promise<Controller> | null = null;

export function controller(): Promise<Controller> {
	instance ??= (async () => {
		const transmitter = env.ESPHOME_URL ? new EsphomeHttpTransmitter(env.ESPHOME_URL) : new MockTransmitter();
		if (transmitter.mock) console.warn('ESPHOME_URL is not set: using the mock transmitter (no IR is sent).');
		const c = new Controller({ transmitter, statePath: join(env.DATA_DIR || 'data', 'state.json') });
		await c.load();
		return c;
	})();
	return instance;
}
