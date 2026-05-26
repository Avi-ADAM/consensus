import { error, type RequestHandler } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { authorizeSend } from '$lib/server/sendPolicy';

interface SendBody {
	data?: { queId?: string; arg?: Record<string, unknown> };
}

/**
 * Thin proxy to the main 1lev1 app's `/api/send` GraphQL gateway.
 *
 * We deliberately do NOT re-implement the query map (qids) or talk to Strapi
 * directly here. The main repo owns that logic and will eventually share a host
 * with Strapi (internal traffic). We forward the body and the SSO cookies
 * (`jwt`, `id`, ...) so the main server authenticates registered users as today.
 *
 * For charter/guest users (no `jwt`) we instead set `isSer: true` so the main
 * server uses its service token — strictly bounded by the allow-list in
 * sendPolicy. The client-supplied `isSer` is never trusted; we always recompute
 * it from the resolved user.
 */
export const POST: RequestHandler = async ({ request, fetch, locals }) => {
	const target = env.MAIN_APP_URL;
	if (!target) {
		throw error(500, 'MAIN_APP_URL is not configured');
	}

	let body: SendBody;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON body');
	}

	const queId = body.data?.queId;
	if (!queId) {
		throw error(400, 'Missing queId');
	}

	const decision = authorizeSend(locals.user, queId);
	if (!decision.allowed) {
		throw error(403, 'Operation not permitted for this user');
	}

	const forwarded = JSON.stringify({ ...body, isSer: decision.useService });

	const upstream = await fetch(`${target.replace(/\/$/, '')}/api/send`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			cookie: request.headers.get('cookie') ?? ''
		},
		body: forwarded
	});

	const text = await upstream.text();
	return new Response(text, {
		status: upstream.status,
		headers: {
			'Content-Type': upstream.headers.get('content-type') ?? 'application/json'
		}
	});
};
