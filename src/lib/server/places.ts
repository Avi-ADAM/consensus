type FetchLike = typeof globalThis.fetch;

export interface Place {
	id: string;
	name: string;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
/** Pull the places out of a `ListPlaces` response. */
export function placesFromResponse(body: any): Place[] {
	return (body?.data?.cuntries?.data ?? []).map((c: any) => ({
		id: String(c?.id ?? ''),
		name: c?.attributes?.name ?? ''
	}));
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * Every place (currently countries), through the main app's `/api/send`
 * (`ListPlaces`). The list is public, but a visitor may have no `jwt`, so it
 * rides the consensus service token: `isSer` plus the shared secret, which the
 * main server requires before it honours `isSer` for a consensus qid.
 *
 * Never throws: an unreachable or misconfigured main server just means an
 * empty list, keeping the create form usable. Failures are logged server-side
 * only, since they carry internal infrastructure detail.
 */
export async function listPlaces(opts: {
	mainAppUrl: string | undefined;
	secret: string | undefined;
	fetch: FetchLike;
}): Promise<Place[]> {
	const { mainAppUrl, secret, fetch } = opts;
	if (!mainAppUrl) {
		console.error('[places] MAIN_APP_URL is not configured');
		return [];
	}
	if (!secret) console.error('[places] PROXY_SHARED_SECRET is not configured — the service call will 401');

	try {
		const res = await fetch(`${mainAppUrl.replace(/\/$/, '')}/api/send`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				...(secret ? { 'x-consensus-secret': secret } : {})
			},
			body: JSON.stringify({ isSer: true, data: { queId: 'ListPlaces', arg: {} } }),
			signal: AbortSignal.timeout(10_000)
		});

		if (!res.ok) {
			console.error(`[places] non-ok response (${res.status}):`, (await res.text()).slice(0, 300));
			return [];
		}

		const body = await res.json();
		if (body?.errors) console.error('[places] graphql errors:', JSON.stringify(body.errors));
		return placesFromResponse(body);
	} catch (e) {
		console.error('[places] fetch failed:', e);
		return [];
	}
}
