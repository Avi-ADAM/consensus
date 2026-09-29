import { json, type RequestHandler } from '@sveltejs/kit';
import { MAIN_APP_URL } from '$env/static/private';
import { placeIdsFromCookie, resolveMyPlaceIds } from '$lib/server/myPlaces';

/**
 * The visitor's own places (countries) — from their 1💗1 account and the
 * agreement they signed — so the local map can open on them instead of on an
 * alphabetical list of every country in the world.
 */
export const GET: RequestHandler = async ({ locals, cookies, request, fetch }) => {
	if (locals.user.type === 'guest') return json({ placeIds: [] });

	const placeIds = await resolveMyPlaceIds({
		user: locals.user,
		cookieHeader: request.headers.get('cookie') ?? '',
		cookieIds: [
			...placeIdsFromCookie(cookies.get('country')),
			...placeIdsFromCookie(cookies.get('contriesi'))
		],
		mainAppUrl: MAIN_APP_URL,
		fetch
	});

	return json({ placeIds }, { headers: { 'cache-control': 'private, no-store' } });
};
