import { json, type RequestHandler } from '@sveltejs/kit';
import { MAIN_APP_URL, PROXY_SHARED_SECRET } from '$env/static/private';
import { listPlaces } from '$lib/server/places';

/**
 * List places (currently countries) for the create form and the local map.
 * Goes through the main app's `/api/send` like every other backend call; this
 * site never talks to Strapi directly.
 */
export const GET: RequestHandler = async ({ fetch }) => {
	const places = await listPlaces({
		mainAppUrl: MAIN_APP_URL,
		secret: PROXY_SHARED_SECRET,
		fetch
	});
	return json({ places });
};
