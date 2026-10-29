import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import { buildBridgeSeed, parseBridgePayload } from '$lib/discussion/bridge';
import { listIssues, loadDiscussionBySource, type LoadedDiscussion } from '$lib/discussion/api';
import {
	payloadFromDiscussion,
	seedPositionsOf,
	type SeedPositions
} from '$lib/discussion/bridgeSeed';

/**
 * Entry point for the main-app bridge: `?d=` carries the negotiation snapshot
 * (see BridgePayload). If a discussion was already opened for this source
 * object, jump straight to it — unless its terms never got seeded, in which
 * case the page completes them first. Otherwise hand the payload to the page
 * so the user can open one.
 */
export const load: PageLoad = async ({ url, fetch }) => {
	const raw = url.searchParams.get('d');
	const payload = raw ? parseBridgePayload(raw) : null;
	if (!payload) return { payload: null, repair: null };

	let existing: LoadedDiscussion | null = null;
	try {
		existing = await loadDiscussionBySource(payload.sourceType, payload.sourceId, fetch);
	} catch {
		// Backend without the lookup qid yet — fall through to the create flow.
		existing = null;
	}
	if (!existing) return { payload, repair: null };

	const id = existing.meta.id;
	const repairPayload = payloadFromDiscussion(existing, payload);
	const positions = seedPositionsOf(existing, buildBridgeSeed(repairPayload));
	const issues = positions ? await listIssues(id, fetch).catch(() => []) : [];
	if (!positions || issues.length > 0) redirect(303, `/negotiation/${id}`);

	const repair: { id: string; positions: SeedPositions } = { id, positions };
	return { payload: repairPayload, repair };
};
