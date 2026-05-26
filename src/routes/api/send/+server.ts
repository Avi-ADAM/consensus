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
 * For charter/guest users (no `jwt`) we set `isSer: true` so the main server
 * uses its service token — strictly bounded by the allow-list in sendPolicy.
 * The client-supplied `isSer` is never trusted; we always recompute it.
 *
 * For service-token requests we also inject `arg.__identity`, the verified
 * identity from the SSO cookies. The main server must treat this as the source
 * of truth for author/voter identity and ignore client-supplied author fields,
 * so charter/guest users cannot impersonate anyone.
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

	const arg: Record<string, unknown> = { ...(body.data?.arg ?? {}) };
	if (decision.useService) {
		arg.__identity = {
			externalId: locals.user.id,
			name: locals.user.name,
			email: locals.user.email,
			type: locals.user.type
		};
	}

	const headers: Record<string, string> = {
		'Content-Type': 'application/json',
		cookie: request.headers.get('cookie') ?? ''
	};
	if (env.PROXY_SHARED_SECRET) {
		headers['x-consensus-secret'] = env.PROXY_SHARED_SECRET;
	}

	const upstream = await fetch(`${target.replace(/\/$/, '')}/api/send`, {
		method: 'POST',
		headers,
		body: JSON.stringify({ ...body, isSer: decision.useService, data: { queId, arg } })
	});

	const text = await upstream.text();
	return new Response(text, {
		status: upstream.status,
		headers: {
			'Content-Type': upstream.headers.get('content-type') ?? 'application/json'
		}
	});
};
