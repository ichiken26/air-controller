import { afterEach, describe, expect, it } from 'vitest';
import { toHex, type IrMessage } from '@air-controller/protocol';
import { Controller } from './controller.ts';
import { EsphomeHttpTransmitter, MockTransmitter, TransmitError, type FrameTransmitter } from './transmitter.ts';

class FailingTransmitter implements FrameTransmitter {
	readonly mock = true;
	async send(_: IrMessage): Promise<void> {
		throw new TransmitError('offline');
	}
	async ping() {
		return false;
	}
}

let now = new Date(2026, 10, 7, 4, 0, 0);
const controllers: Controller[] = [];
function make(transmitter: FrameTransmitter = new MockTransmitter()) {
	let n = 0;
	const c = new Controller({ transmitter, statePath: null, now: () => now, newId: () => `t${++n}` });
	controllers.push(c);
	return c;
}
afterEach(() => {
	controllers.splice(0).forEach((c) => c.dispose());
	now = new Date(2026, 10, 7, 4, 0, 0);
});

describe('Controller', () => {
	it('sends the encoded frames and records what was sent', async () => {
		const tx = new MockTransmitter();
		const c = make(tx);
		await c.command({ action: 'run', settings: { mode: 'cool', temperature: 24.5, fan: 'auto' } });
		expect(tx.sent[0].frames.map(toHex)).toEqual(['C23DBF4040BF', 'C23DBF4040BF', 'D5662000005B']);
		const s = await c.state();
		expect(s.power).toBe('on');
		expect(s.settings).toEqual({ mode: 'cool', temperature: 24.5, fan: 'auto' });
		await c.command({ action: 'off' });
		expect((await c.state()).power).toBe('off');
	});

	it('keeps the previous state when sending fails', async () => {
		const c = make(new FailingTransmitter());
		await expect(c.command({ action: 'run', settings: { mode: 'heat', temperature: 22, fan: 'auto' } })).rejects.toThrow(TransmitError);
		const s = await c.state();
		expect(s.power).toBe('off');
		expect(s.lastError).toBe('offline');
	});

	it('timers: snapshot settings, fire when due, cancel', async () => {
		const tx = new MockTransmitter();
		const c = make(tx);
		const on = await c.addTimer({ kind: 'on', time: '05:26', settings: { mode: 'heat', temperature: 22.5, fan: 'medium' } });
		await c.addTimer({ kind: 'off', time: '07:00' });
		expect(on.at).toBe(new Date(2026, 10, 7, 5, 26).toISOString());
		expect((await c.state()).timers.map((t) => t.time)).toEqual(['05:26', '07:00']);

		now = new Date(2026, 10, 7, 5, 26, 1);
		expect(await c.runDueTimers()).toBe(1);
		expect(tx.sent).toHaveLength(1);
		const s = await c.state();
		expect(s.settings).toEqual({ mode: 'heat', temperature: 22.5, fan: 'medium' });
		expect(s.timers.map((t) => t.time)).toEqual(['07:00']);

		expect(await c.cancelTimers()).toBe(1);
		expect((await c.state()).timers).toEqual([]);
	});

	it('rejects a timer whose settings cannot be encoded', async () => {
		const c = make();
		await expect(c.addTimer({ kind: 'on', time: '05:00', settings: { mode: 'cool', temperature: 40, fan: 'auto' } })).resolves.toMatchObject({
			settings: { temperature: 30 }
		});
	});
});

describe('EsphomeHttpTransmitter', () => {
	it('POSTs the frames to the ir_frames text entity', async () => {
		const calls: Array<{ url: string; method?: string }> = [];
		const fetch = (async (url: string, init?: RequestInit) => {
			calls.push({ url, method: init?.method });
			return new Response(null, { status: 200 });
		}) as typeof globalThis.fetch;
		const tx = new EsphomeHttpTransmitter('http://aircontroller.local/', { fetch, seqStart: 41 });
		await tx.send({ frames: [[0xc2, 0x3d, 0x7b, 0x84, 0xe0, 0x1f]] });
		expect(calls).toEqual([{ url: 'http://aircontroller.local/text/ir_frames/set?value=42%3AC23D7B84E01F', method: 'POST' }]);
	});

	it('turns HTTP and network failures into TransmitError', async () => {
		const notFound = (async () => new Response(null, { status: 404 })) as unknown as typeof globalThis.fetch;
		await expect(new EsphomeHttpTransmitter('http://x', { fetch: notFound }).send({ frames: [[0, 0, 0, 0, 0, 0]] })).rejects.toThrow(TransmitError);
		const down = (async () => {
			throw new TypeError('fetch failed');
		}) as unknown as typeof globalThis.fetch;
		await expect(new EsphomeHttpTransmitter('http://x', { fetch: down }).send({ frames: [[0, 0, 0, 0, 0, 0]] })).rejects.toThrow(TransmitError);
		expect(await new EsphomeHttpTransmitter('http://x', { fetch: down }).ping()).toBe(false);
	});
});
