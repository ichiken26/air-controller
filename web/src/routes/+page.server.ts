import { controller } from '#lib/server/instance.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => ({ state: await (await controller()).state() });
