import { error, type RequestHandler } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

/**
 * Thin proxy to the main 1lev1 app's `/api/send` GraphQL gateway.
 *
 * We deliberately do NOT re-implement the query map (qids) or talk to Strapi
 * directly here. The main repo owns that logic and will eventually share a host
 * with Strapi (internal traffic). We only forward the body and the SSO cookies
 * (`jwt`, `id`, ...) so the main server authenticates the user as it does today.
 */
export const POST: RequestHandler = async ({ request, fetch }) => {
	const target = env.MAIN_APP_URL;
	if (!target) {
		throw error(500, 'MAIN_APP_URL is not configured');
	}

	const body = await request.text();

	const upstream = await fetch(`${target.replace(/\/$/, '')}/api/send`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			cookie: request.headers.get('cookie') ?? ''
		},
		body
	});

	const text = await upstream.text();
	return new Response(text, {
		status: upstream.status,
		headers: {
			'Content-Type': upstream.headers.get('content-type') ?? 'application/json'
		}
	});
};
