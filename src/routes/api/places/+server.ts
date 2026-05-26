import { json, type RequestHandler } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

interface Place {
	id: string;
	name: string;
}

/**
 * List places (currently countries). The `cuntries` collection is a public,
 * unauthenticated GraphQL query in the shared Strapi — the same one the main
 * app's `love` page reads — so we query it directly. Degrades to an empty list
 * when STRAPI_URL is unset or the query fails, keeping the create form usable.
 */
export const GET: RequestHandler = async ({ fetch }) => {
	const base = env.STRAPI_URL;
	if (!base) return json({ places: [] as Place[] });

	try {
		const res = await fetch(`${base.replace(/\/$/, '')}/graphql`, {
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
	} catch {
		return json({ places: [] as Place[] });
	}
};
