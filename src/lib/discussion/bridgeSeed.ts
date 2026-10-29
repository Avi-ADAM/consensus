import {
	createClause,
	createIssue,
	listClauses,
	listIssues,
	updatePositionLocation,
	type LoadedDiscussion,
	type OpinionInput
} from './api';
import { ORIGINAL_STANCE, PROPOSED_STANCE, type BridgePayload, type BridgeSeed } from './bridge';
import { locationFromClauses } from './scale';

type FetchLike = typeof globalThis.fetch;

export interface SeedPositions {
	original: string;
	proposed: string;
}

/**
 * Write a bridge seed's issues and clauses onto a discussion, creating only
 * what is missing — so it both seeds a fresh discussion and completes one
 * whose first seeding failed part-way. Returns how many writes failed; the
 * caller surfaces that instead of landing on a discussion without terms.
 */
export async function seedBridgeTerms(
	negotiationId: string,
	positions: SeedPositions,
	seed: BridgeSeed,
	fetch: FetchLike = globalThis.fetch
): Promise<{ failed: number }> {
	let failed = 0;

	const existingIssues = await listIssues(negotiationId, fetch);
	const issueIdByTitle: Record<string, string> = {};
	for (const issue of existingIssues) issueIdByTitle[issue.title] = issue.id;

	for (let i = 0; i < seed.issueTitles.length; i++) {
		const title = seed.issueTitles[i];
		if (issueIdByTitle[title]) continue;
		const id = await createIssue({ negotiationId, title, order: i, origin: 'human' }, fetch).catch(
			() => null
		);
		if (id) issueIdByTitle[title] = id;
		else failed++;
	}

	const existingClauses = await listClauses(negotiationId, null, fetch);
	const has = (positionId: string, issueId: string | undefined) =>
		existingClauses.some((c) => c.positionId === positionId && c.issueId === (issueId ?? null));

	for (const clause of seed.clauses) {
		const positionId = positions[clause.side];
		const issueId = issueIdByTitle[clause.issueTitle];
		if (has(positionId, issueId)) continue;
		const saved = await createClause(
			{
				negotiationId,
				positionId,
				issueId: issueId ?? null,
				body: clause.body,
				stanceValue: clause.stanceValue,
				origin: 'human'
			},
			fetch
		).catch(() => null);
		if (!saved) failed++;
	}

	// Re-derive each side's location from all of its clauses, old and new.
	const clauses = await listClauses(negotiationId, null, fetch);
	for (const positionId of [positions.original, positions.proposed]) {
		const location = locationFromClauses(clauses.filter((c) => c.positionId === positionId));
		if (location !== null) {
			await updatePositionLocation(positionId, Math.round(location), fetch).catch(() => {});
		}
	}

	return { failed };
}

/**
 * The two seed positions of a bridged discussion, told apart by the heading
 * the seed gave them — the backend does not keep their selfPlacement, so the
 * stance is only a fallback (see buildBridgeSeed).
 */
export function seedPositionsOf(
	discussion: LoadedDiscussion,
	seed: BridgeSeed
): SeedPositions | null {
	const find = (opinion: OpinionInput, stance: number) =>
		(
			discussion.opinions.find((o) => o.heading === opinion.heading) ??
			discussion.opinions.find((o) => o.selfPlacement === stance)
		)?.id ?? null;
	const original = find(seed.originalOpinion, ORIGINAL_STANCE);
	const proposed = find(seed.proposedOpinion, PROPOSED_STANCE);
	return original && proposed && original !== proposed ? { original, proposed } : null;
}

/**
 * The payload a bridged discussion was opened with, rebuilt from its stored
 * sourceMeta — so completing it reuses the original terms, not whatever the
 * card shows now.
 */
export function payloadFromDiscussion(
	discussion: LoadedDiscussion,
	fallback: BridgePayload
): BridgePayload {
	const meta = discussion.meta.sourceMeta;
	if (!meta?.fields?.length) return fallback;
	return {
		v: 1,
		sourceType: discussion.meta.sourceType ?? fallback.sourceType,
		sourceId: discussion.meta.sourceId ?? fallback.sourceId,
		title: meta.title || fallback.title,
		projectName: meta.projectName ?? fallback.projectName,
		returnUrl: meta.returnUrl ?? fallback.returnUrl,
		fields: meta.fields
	};
}
