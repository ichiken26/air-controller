import { error, json } from '@sveltejs/kit';
import { controller } from '#lib/server/instance.ts';
import type { RequestHandler } from './$types';

export const DELETE: RequestHandler = async ({ params }) => {
	const c = await controller();
	if ((await c.cancelTimers(params.id)) === 0) error(404, 'timer not found');
	return json(await c.state());
};
