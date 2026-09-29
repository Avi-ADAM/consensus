import { error, type RequestHandler } from '@sveltejs/kit';
import { MAIN_APP_URL, PROXY_SHARED_SECRET } from '$env/static/private';
import { authorizeSend } from '$lib/server/sendPolicy';

/** Creates that record who wrote them. */
const AUTHORED_QIDS: ReadonlySet<string> = new Set([
	'41CreatePosition',
	'CreateArgument',
	'CreateClause'
]);
const AUTHOR_FIELDS = ['authorExternalId', 'authorType', 'authorEmail', 'authorName'] as const;

interface SendBody {
	data?: { queId?: string; arg?: Record<string, unknown> };
}

/**
 * Thin proxy to the main 1lev1 app's `/api/send` GraphQL gateway.
 *
 * We deliberately do NOT re-implement the query map (qids) or talk to Strapi
 * directly here. The main repo owns that logic, and its API host
 * (api.1lev1.com) sits next to Strapi. We forward the body and the SSO cookies
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
	const target = MAIN_APP_URL;
	if (!target) {
		throw error(500, 'env.MAIN_APP_URL is not configured');
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
	// Author fields are never taken from the client.
	for (const key of AUTHOR_FIELDS) delete arg[key];
	if (!decision.useService && AUTHORED_QIDS.has(queId) && locals.user.id) {
		// The main server fills author fields from `__identity` only on the
		// service path; on the JWT path it stores none, so a registered user's
		// opinion had no owner and its clauses could never be edited. Stamp the
		// identity we resolved from the SSO cookies instead.
		arg.authorExternalId = locals.user.id;
		arg.authorType = locals.user.type;
		if (locals.user.email) arg.authorEmail = locals.user.email;
		if (locals.user.name) arg.authorName = locals.user.name;
	}
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
	if (PROXY_SHARED_SECRET) {
		headers['x-consensus-secret'] = PROXY_SHARED_SECRET;
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
