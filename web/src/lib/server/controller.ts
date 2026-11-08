// Owns the app state: what was last sent, the timer queue, and the single send path.

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { encode, type Command } from '@air-controller/protocol';
import type { AppState, CommandRequest, Power, TimerEntry, TimerRequest } from '../api.ts';
import { DEFAULT_SETTINGS, normalizeSettings, toRunCommand, type AcSettings } from '../remote.ts';
import { delayUntil, nextOccurrence } from './schedule.ts';
import type { FrameTransmitter } from './transmitter.ts';

interface Persisted {
	settings: AcSettings;
	power: Power;
	lastSentAt: string | null;
	timers: TimerEntry[];
}

export interface ControllerOptions {
	readonly transmitter: FrameTransmitter;
	/** JSON file for state and timers; null keeps everything in memory (tests). */
	readonly statePath: string | null;
	readonly now?: () => Date;
	readonly newId?: () => string;
}

export class Controller {
	readonly #transmitter: FrameTransmitter;
	readonly #statePath: string | null;
	readonly #now: () => Date;
	readonly #newId: () => string;
	#data: Persisted = { settings: DEFAULT_SETTINGS, power: 'off', lastSentAt: null, timers: [] };
	#lastError: string | null = null;
	/** Sends run one at a time, in order. */
	#queue: Promise<unknown> = Promise.resolve();
	#timer: ReturnType<typeof setTimeout> | null = null;

	constructor(options: ControllerOptions) {
		this.#transmitter = options.transmitter;
		this.#statePath = options.statePath;
		this.#now = options.now ?? (() => new Date());
		this.#newId = options.newId ?? (() => crypto.randomUUID());
	}

	async load(): Promise<void> {
		if (this.#statePath) {
			try {
				const saved = JSON.parse(await readFile(this.#statePath, 'utf8')) as Partial<Persisted>;
				this.#data = {
					settings: saved.settings ? normalizeSettings(saved.settings) : DEFAULT_SETTINGS,
					power: saved.power === 'on' ? 'on' : 'off',
					lastSentAt: saved.lastSentAt ?? null,
					timers: Array.isArray(saved.timers) ? saved.timers : []
				};
			} catch (e) {
				if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
			}
		}
		this.#reschedule();
	}

	async state(): Promise<AppState> {
		return {
			settings: this.#data.settings,
			power: this.#data.power,
			lastSentAt: this.#data.lastSentAt,
			lastError: this.#lastError,
			timers: [...this.#data.timers].sort((a, b) => a.at.localeCompare(b.at)),
			device: { online: await this.#transmitter.ping(), mock: this.#transmitter.mock }
		};
	}

	/** Throws (TransmitError, UnsupportedCommandError) when nothing was sent; state is unchanged then. */
	async command(request: CommandRequest): Promise<void> {
		switch (request.action) {
			case 'run': {
				const settings = normalizeSettings(request.settings);
				await this.#send(toRunCommand(settings), { settings, power: 'on' });
				return;
			}
			case 'off':
				await this.#send({ kind: 'off' }, { power: 'off' });
				return;
			case 'swing':
				await this.#send({ kind: 'swingToggle' }, {});
				return;
			case 'direction':
				await this.#send({ kind: 'airflowDirection' }, {});
				return;
		}
	}

	async addTimer(request: TimerRequest): Promise<TimerEntry> {
		const settings = request.kind === 'on' && request.settings ? normalizeSettings(request.settings) : undefined;
		// Encode now so an unsendable timer is rejected when it is added, not when it fires.
		if (settings) encode(toRunCommand(settings));
		const entry: TimerEntry = {
			id: this.#newId(),
			kind: request.kind,
			time: request.time,
			at: nextOccurrence(request.time, this.#now()).toISOString(),
			...(settings ? { settings } : {})
		};
		this.#data.timers = [...this.#data.timers, entry];
		await this.#save();
		this.#reschedule();
		return entry;
	}

	/** id omitted: cancel every timer (the remote's とりけし). */
	async cancelTimers(id?: string): Promise<number> {
		const before = this.#data.timers.length;
		this.#data.timers = id ? this.#data.timers.filter((t) => t.id !== id) : [];
		await this.#save();
		this.#reschedule();
		return before - this.#data.timers.length;
	}

	/** Runs every timer that is due; returns how many ran. Called by the internal setTimeout. */
	async runDueTimers(): Promise<number> {
		const now = this.#now().getTime();
		const due = this.#data.timers.filter((t) => Date.parse(t.at) <= now);
		if (due.length === 0) return 0;
		this.#data.timers = this.#data.timers.filter((t) => !due.includes(t));
		await this.#save();
		for (const t of due.sort((a, b) => a.at.localeCompare(b.at))) {
			try {
				if (t.kind === 'on' && t.settings) await this.command({ action: 'run', settings: t.settings });
				else await this.command({ action: 'off' });
			} catch (e) {
				this.#lastError = `${t.time} の${t.kind === 'on' ? '入' : '切'}タイマーを送信できませんでした: ${e instanceof Error ? e.message : String(e)}`;
			}
		}
		this.#reschedule();
		return due.length;
	}

	dispose(): void {
		if (this.#timer) clearTimeout(this.#timer);
		this.#timer = null;
	}

	#send(command: Command, update: Partial<Pick<Persisted, 'settings' | 'power'>>): Promise<void> {
		const run = async () => {
			const message = encode(command);
			try {
				await this.#transmitter.send(message);
			} catch (e) {
				this.#lastError = e instanceof Error ? e.message : String(e);
				throw e;
			}
			this.#lastError = null;
			this.#data = { ...this.#data, ...update, lastSentAt: this.#now().toISOString() };
			await this.#save();
		};
		const result = this.#queue.then(run, run);
		this.#queue = result.catch(() => undefined);
		return result;
	}

	#reschedule(): void {
		this.dispose();
		const next = this.#data.timers.map((t) => Date.parse(t.at)).sort((a, b) => a - b)[0];
		if (next === undefined) return;
		this.#timer = setTimeout(() => void this.runDueTimers(), delayUntil(new Date(next), this.#now()));
		this.#timer.unref?.();
	}

	async #save(): Promise<void> {
		if (!this.#statePath) return;
		await mkdir(dirname(this.#statePath), { recursive: true });
		const tmp = `${this.#statePath}.tmp`;
		await writeFile(tmp, JSON.stringify(this.#data, null, 2));
		await rename(tmp, this.#statePath);
	}
}
