import { json } from '@sveltejs/kit';
import { parseCommandRequest } from '#lib/api.ts';
import { controller } from '#lib/server/instance.ts';
import { errorResponse, readJson } from '#lib/server/respond.ts';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	const c = await controller();
	try {
		await c.command(parseCommandRequest(await readJson(request)));
	} catch (e) {
		return errorResponse(e);
	}
	return json(await c.state());
};
