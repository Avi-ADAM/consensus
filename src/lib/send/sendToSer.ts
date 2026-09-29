import { loginHref } from '$lib/links';

type FetchLike = typeof globalThis.fetch;

/**
 * Send a named GraphQL operation (queId, e.g. "39GetNegotiation") to the backend
 * through our local `/api/send` proxy, which forwards to the main 1lev1 server.
 *
 * Mirrors the signature used in the 1.0 repo so adopted code keeps working.
 */
export async function sendToSer<T = unknown>(
	arg: Record<string, unknown> = {},
	queId = '',
	_me = 0,
	_project = 0,
	isSer = false,
	fetch: FetchLike = globalThis.fetch
): Promise<T> {
	const payload = { isSer, data: { arg, queId } };

	const res = await fetch('/api/send', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload)
	});

	if (res.status === 401) {
		// Sessions live on the main site; this app has no /login of its own.
		if (typeof window !== 'undefined') {
			window.location.href = loginHref(window.location.href);
		}
		throw new Error('Unauthorized');
	}

	return (await res.json()) as T;
}
