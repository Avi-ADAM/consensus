import { json, type RequestHandler } from '@sveltejs/kit';
import { STRAPI_URL } from '$env/static/private';

interface Place {
	id: string;
	name: string;
}

const empty = () => json({ places: [] as Place[] });

/**
 * List places (currently countries). The `cuntries` collection is a public,
 * unauthenticated GraphQL query in the shared Strapi — the same one the main
 * app's `love` page reads — so we query it directly. Degrades to an empty list
 * when env.STRAPI_URL is unset or the query fails, keeping the create form usable.
 *
 * Failures are logged server-side only: the response never carries the backend
 * URL, status text or error string, since that is internal infrastructure detail.
 */
export const GET: RequestHandler = async ({ fetch }) => {
	if (!STRAPI_URL) {
		console.error('[places] STRAPI_URL is not configured');
		return empty();
	}

	const targetUrl = `${STRAPI_URL.replace(/\/$/, '')}/graphql`;

	try {
		const res = await fetch(targetUrl, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				query: `query { cuntries(pagination: { limit: -1 }) { data { id attributes { name } } } }`
			}),
			signal: AbortSignal.timeout(10_000)
		});

		if (!res.ok) {
			console.error(`[places] non-ok response (${res.status}):`, (await res.text()).slice(0, 300));
			return empty();
		}

		const data = await res.json();
		if (data?.errors) console.error('[places] graphql errors:', JSON.stringify(data.errors));

		const places: Place[] = (data?.data?.cuntries?.data ?? []).map(
			(c: { id: string | number; attributes?: { name?: string } }) => ({
				id: String(c.id),
				name: c.attributes?.name ?? ''
			})
		);
		return json({ places });
	} catch (e) {
		console.error('[places] fetch failed:', e);
		return empty();
	}
};
