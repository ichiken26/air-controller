import { json } from '@sveltejs/kit';
import { controller } from '#lib/server/instance.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => json(await (await controller()).state());
