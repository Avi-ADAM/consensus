import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import { parseBridgePayload } from '$lib/discussion/bridge';
import { loadDiscussionBySource } from '$lib/discussion/api';

/**
 * Entry point for the main-app bridge: `?d=` carries the negotiation snapshot
 * (see BridgePayload). If a discussion was already opened for this source
 * object, jump straight to it; otherwise hand the payload to the page so the
 * user can open one.
 */
export const load: PageLoad = async ({ url, fetch }) => {
	const raw = url.searchParams.get('d');
	const payload = raw ? parseBridgePayload(raw) : null;
	if (!payload) return { payload: null };

	let existingId: string | null = null;
	try {
		const existing = await loadDiscussionBySource(payload.sourceType, payload.sourceId, fetch);
		existingId = existing?.meta.id ?? null;
	} catch {
		// Backend without the lookup qid yet — fall through to the create flow.
		existingId = null;
	}
	if (existingId) redirect(303, `/negotiation/${existingId}`);

	return { payload };
};
