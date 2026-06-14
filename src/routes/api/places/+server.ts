import { json, type RequestHandler } from '@sveltejs/kit';
import { STRAPI_URL } from '$env/static/private';

interface Place {
	id: string;
	name: string;
}

/**
 * List places (currently countries). The `cuntries` collection is a public,
 * unauthenticated GraphQL query in the shared Strapi — the same one the main
 * app's `love` page reads — so we query it directly. Degrades to an empty list
 * when env.STRAPI_URL is unset or the query fails, keeping the create form usable.
 */
export const GET: RequestHandler = async ({ fetch }) => {
	console.log('STRAPI_URL value:', STRAPI_URL)
	if (!STRAPI_URL) return json({ places: [], _debug: 'STRAPI_URL is empty' } as unknown as { places: Place[] });

	try {
		const res = await fetch(`${STRAPI_URL.replace(/\/$/, '')}/graphql`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				query: `query { cuntries { data { id attributes { name } } } }`
			})
		});
		const data = await res.json();
		const places: Place[] = (data?.data?.cuntries?.data ?? []).map(
			(c: { id: string | number; attributes?: { name?: string } }) => ({
				id: String(c.id),
				name: c.attributes?.name ?? ''
			})
		);
		return json({ places });
	} catch (e) {
		console.error('places fetch error:', e);
		return json({ places: [] as Place[], _error: String(e) } as unknown as { places: Place[] });
	}
};
