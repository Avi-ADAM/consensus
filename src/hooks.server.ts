import type { Handle } from '@sveltejs/kit';
import { resolveUser } from '$lib/server/auth';

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.user = resolveUser(event.cookies);
	return resolve(event);
};
