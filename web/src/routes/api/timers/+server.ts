import { json } from '@sveltejs/kit';
import { parseTimerRequest } from '#lib/api.ts';
import { controller } from '#lib/server/instance.ts';
import { errorResponse, readJson } from '#lib/server/respond.ts';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	const c = await controller();
	try {
		await c.addTimer(parseTimerRequest(await readJson(request)));
	} catch (e) {
		return errorResponse(e);
	}
	return json(await c.state(), { status: 201 });
};

/** とりけし: removes every queued timer. */
export const DELETE: RequestHandler = async () => {
	const c = await controller();
	await c.cancelTimers();
	return json(await c.state());
};
