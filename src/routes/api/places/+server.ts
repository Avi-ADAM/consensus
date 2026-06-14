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

	const targetUrl = `${STRAPI_URL.replace(/\/$/, '')}/graphql`;
	console.log('[places] fetching:', targetUrl);
	console.log('[places] runtime:', typeof window === 'undefined' ? 'server (Node)' : 'browser');

	const start = Date.now();
	try {
		const res = await fetch(targetUrl, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				query: `query { cuntries { data { id attributes { name } } } }`
			}),
			signal: AbortSignal.timeout(10_000)
		});
		console.log('[places] response status:', res.status, 'in', Date.now() - start, 'ms');
		const data = await res.json();
		console.log('[places] raw data keys:', Object.keys(data ?? {}));
		if (data?.error) console.error('[places] graphql error:', JSON.stringify(data.error, null, 2));
		if (data?.errors) console.error('[places] graphql errors:', JSON.stringify(data.errors, null, 2));
		const places: Place[] = (data?.data?.cuntries?.data ?? []).map(
			(c: { id: string | number; attributes?: { name?: string } }) => ({
				id: String(c.id),
				name: c.attributes?.name ?? ''
			})
		);
		return json({ places });
	} catch (e) {
		const elapsed = Date.now() - start;
		console.error(`[places] fetch error after ${elapsed}ms:`, e);
		// @ts-expect-error cause exists on TypeError
		if (e?.cause) console.error('[places] cause:', e.cause);
		return json({ places: [] as Place[], _error: String(e) } as unknown as { places: Place[] });
	}
};
