import { json } from '@sveltejs/kit';
import { UnsupportedCommandError } from '@air-controller/protocol';
import { ValidationError } from '../api.ts';
import { TransmitError } from './transmitter.ts';

/** Maps known errors to HTTP responses with a Japanese message for the UI. */
export function errorResponse(e: unknown): Response {
	if (e instanceof ValidationError) return json({ error: `不正なリクエスト: ${e.message}` }, { status: 400 });
	if (e instanceof UnsupportedCommandError) return json({ error: `この設定は送信できません: ${e.message}` }, { status: 422 });
	if (e instanceof TransmitError) return json({ error: e.message }, { status: 502 });
	throw e;
}

export async function readJson(request: Request): Promise<unknown> {
	try {
		return await request.json();
	} catch {
		throw new ValidationError('body is not JSON');
	}
}
