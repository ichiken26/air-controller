// Sends encoded frames to the ESP32 (firmware/aircontroller.yaml, text entity "ir_frames").

import type { IrMessage } from '@air-controller/protocol';
import { toEsphomeFramesValue } from '@air-controller/protocol/esphome';

export interface FrameTransmitter {
	readonly mock: boolean;
	send(message: IrMessage): Promise<void>;
	/** Whether the device answers at all (not whether the AC is on). */
	ping(): Promise<boolean>;
}

export class TransmitError extends Error {
	override name = 'TransmitError';
}

type Fetch = typeof globalThis.fetch;

/** ESPHome web_server v3 REST: POST /text/ir_frames/set?value=<seq>:<frames> */
export class EsphomeHttpTransmitter implements FrameTransmitter {
	readonly mock = false;
	readonly #baseUrl: string;
	readonly #fetch: Fetch;
	readonly #timeoutMs: number;
	#seq: number;

	constructor(baseUrl: string, options: { fetch?: Fetch; timeoutMs?: number; seqStart?: number } = {}) {
		this.#baseUrl = baseUrl.replace(/\/+$/, '');
		this.#fetch = options.fetch ?? globalThis.fetch;
		this.#timeoutMs = options.timeoutMs ?? 5000;
		// Starts from the clock so a server restart does not reuse a value the device still holds.
		this.#seq = options.seqStart ?? Date.now() % 1_000_000_000;
	}

	async send(message: IrMessage): Promise<void> {
		this.#seq = (this.#seq + 1) % 1_000_000_000;
		const value = toEsphomeFramesValue(message, this.#seq);
		const url = `${this.#baseUrl}/text/ir_frames/set?value=${encodeURIComponent(value)}`;
		let res: Response;
		try {
			res = await this.#fetch(url, { method: 'POST', signal: AbortSignal.timeout(this.#timeoutMs) });
		} catch (e) {
			throw new TransmitError(`マイコン (${this.#baseUrl}) に接続できません: ${e instanceof Error ? e.message : String(e)}`);
		}
		if (!res.ok) throw new TransmitError(`マイコンが送信を拒否しました: HTTP ${res.status}`);
	}

	async ping(): Promise<boolean> {
		try {
			const res = await this.#fetch(`${this.#baseUrl}/text/ir_frames`, { signal: AbortSignal.timeout(2000) });
			return res.ok;
		} catch {
			return false;
		}
	}
}

/** Used when ESPHOME_URL is not set (development without the device). Logs instead of sending. */
export class MockTransmitter implements FrameTransmitter {
	readonly mock = true;
	readonly sent: IrMessage[] = [];

	async send(message: IrMessage): Promise<void> {
		this.sent.push(message);
		console.info('[mock transmitter]', toEsphomeFramesValue(message, this.sent.length));
	}

	async ping(): Promise<boolean> {
		return true;
	}
}
