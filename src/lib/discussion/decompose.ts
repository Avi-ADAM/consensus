import {
	createClause,
	createIssue,
	createPosition,
	listIssues,
	updateClause,
	updatePositionLocation,
	type OpinionInput
} from './api';
import { locationFromClauses, type Clause, type Issue, type Origin } from './scale';

type OpinionText = Pick<OpinionInput, 'heading' | 'description'>;

type FetchLike = typeof globalThis.fetch;

interface DecomposedClause {
	body: string;
	issueId: string | null;
	issueTitle: string;
	stanceValue: number;
}

export interface Gap {
	issueId: string | null;
	issueTitle: string;
	suggestedClause: string;
}

export interface DecomposeResult {
	clauses: DecomposedClause[];
	gaps: Gap[];
}

function clampStance(value: unknown): number {
	const n = typeof value === 'number' ? value : Number(value);
	if (!Number.isFinite(n)) return 50;
	return Math.min(100, Math.max(0, Math.round(n)));
}

/**
 * Ask the AI to split an opinion into clauses against the issues already raised.
 * Returns null when the assistant is unavailable so callers fall back silently.
 */
export async function decomposeOpinion(
	input: {
		topic: string;
		opinion: OpinionInput;
		existingIssues: Issue[];
	},
	fetch: FetchLike = globalThis.fetch
): Promise<DecomposeResult | null> {
	const res = await fetch('/api/decompose', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			topic: input.topic,
			heading: input.opinion.heading,
			description: input.opinion.description,
			selfPlacement: input.opinion.selfPlacement,
			existingIssues: input.existingIssues.map((i) => ({ id: i.id, title: i.title }))
		})
	});
	const out = await res.json();
	if (!out.available) return null;

	const data = out.data ?? {};
	const clauses: DecomposedClause[] = Array.isArray(data.clauses)
		? data.clauses.map((c: Record<string, unknown>) => ({
				body: String(c.body ?? '').trim(),
				issueId: c.issueId ? String(c.issueId) : null,
				issueTitle: String(c.issueTitle ?? '').trim(),
				stanceValue: clampStance(c.stanceValue)
			}))
		: [];
	const gaps: Gap[] = Array.isArray(data.gaps)
		? data.gaps.map((g: Record<string, unknown>) => ({
				issueId: g.issueId ? String(g.issueId) : null,
				issueTitle: String(g.issueTitle ?? '').trim(),
				suggestedClause: String(g.suggestedClause ?? '').trim()
			}))
		: [];
	return { clauses: clauses.filter((c) => c.body), gaps };
}

/** A clause the author (or the AI) drafted, not yet saved. */
export interface ClauseDraft {
	body: string;
	/** An existing issue's id, when the clause hangs on one. */
	issueId: string | null;
	/** The issue's title — used to match or create the issue when there is no id. */
	issueTitle: string;
	stanceValue: number;
	origin: Origin;
}

function titleKey(title: string): string {
	return title.trim().toLowerCase();
}

/**
 * Save clause drafts onto an opinion. Each resolves onto an issue: its id when
 * that is a known issue, else an existing issue with the same title, else a new
 * issue (created once per title within the pass). Drafts without a body are
 * skipped. Returns the clauses that were saved.
 *
 * `confirm` marks them confirmed by the author — for clauses the author wrote or
 * reviewed before submitting, so they do not come back asking for approval.
 */
export async function attachClauses(
	input: {
		negotiationId: string;
		positionId: string;
		drafts: ClauseDraft[];
		existingIssues: Issue[];
		confirm?: boolean;
	},
	fetch: FetchLike = globalThis.fetch
): Promise<Clause[]> {
	const knownIds = new Set(input.existingIssues.map((i) => i.id));
	const byTitle = new Map<string, string>();
	for (const issue of input.existingIssues) byTitle.set(titleKey(issue.title), issue.id);
	let order = input.existingIssues.length;

	const saved: Clause[] = [];
	for (const draft of input.drafts) {
		const body = draft.body.trim();
		if (!body) continue;
		const title = draft.issueTitle.trim();

		let issueId = draft.issueId && knownIds.has(draft.issueId) ? draft.issueId : null;
		if (!issueId && title) {
			issueId = byTitle.get(titleKey(title)) ?? null;
			if (!issueId) {
				issueId = await createIssue(
					{
						negotiationId: input.negotiationId,
						title,
						order: order++,
						origin: draft.origin
					},
					fetch
				).catch(() => null);
				if (issueId) {
					byTitle.set(titleKey(title), issueId);
					knownIds.add(issueId);
				}
			}
		}

		const stanceValue = clampStance(draft.stanceValue);
		const clauseId = await createClause(
			{
				negotiationId: input.negotiationId,
				positionId: input.positionId,
				issueId,
				body,
				stanceValue,
				origin: draft.origin
			},
			fetch
		).catch(() => null);
		if (!clauseId) continue;

		let confirmedByAuthor = false;
		if (input.confirm) {
			confirmedByAuthor = await updateClause({ id: clauseId, confirmedByAuthor: true }, fetch)
				.then(() => true)
				.catch(() => false);
		}

		saved.push({
			id: clauseId,
			positionId: input.positionId,
			issueId,
			body,
			stanceValue,
			origin: draft.origin,
			confirmedByAuthor
		});
	}
	return saved;
}

/**
 * Decompose a freshly created opinion and persist its issues + clauses, then
 * re-derive and store the opinion's location. Resilient: if the assistant or
 * backend is unavailable it returns null and the anchor/manual flow stands.
 *
 * Run sequentially across opinions so issues created for the first are reused
 * by later ones (the first opinion seeds the issue pool; the rest hang on it).
 */
export async function decomposeAndPersist(
	input: {
		negotiationId: string;
		positionId: string;
		topic: string;
		opinion: OpinionInput;
	},
	fetch: FetchLike = globalThis.fetch
): Promise<DecomposeResult | null> {
	let existingIssues: Issue[] = [];
	try {
		existingIssues = await listIssues(input.negotiationId, fetch);
	} catch {
		existingIssues = [];
	}

	const result = await decomposeOpinion(
		{ topic: input.topic, opinion: input.opinion, existingIssues },
		fetch
	).catch(() => null);
	if (!result || result.clauses.length === 0) return result;

	const saved = await attachClauses(
		{
			negotiationId: input.negotiationId,
			positionId: input.positionId,
			drafts: result.clauses.map((c) => ({ ...c, origin: 'ai' as const })),
			existingIssues
		},
		fetch
	);

	const derived = locationFromClauses(saved);
	if (derived !== null) {
		await updatePositionLocation(input.positionId, Math.round(derived), fetch).catch(() => {});
	}

	return result;
}

/**
 * Fill one gap: draft and persist the clause an opinion is missing on a given
 * issue, then re-derive its location from the full clause set. Returns the new
 * clause, or null when the assistant/backend is unavailable.
 */
export async function fillGap(
	input: {
		negotiationId: string;
		positionId: string;
		topic: string;
		opinion: OpinionText;
		issue: Issue;
		/** The opinion's current clauses, so the location can be re-derived. */
		existingClauses: Clause[];
	},
	fetch: FetchLike = globalThis.fetch
): Promise<Clause | null> {
	const res = await fetch('/api/suggest-clause', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			topic: input.topic,
			heading: input.opinion.heading,
			description: input.opinion.description,
			issueTitle: input.issue.title
		})
	}).catch(() => null);
	if (!res) return null;

	const out = await res.json();
	if (!out.available) return null;

	const body = String(out.data?.body ?? '').trim();
	if (!body) return null;
	const stanceValue = clampStance(out.data?.stanceValue);

	const clauseId = await createClause(
		{
			negotiationId: input.negotiationId,
			positionId: input.positionId,
			issueId: input.issue.id,
			body,
			stanceValue,
			origin: 'ai'
		},
		fetch
	).catch(() => null);
	if (!clauseId) return null;

	const created: Clause = {
		id: clauseId,
		positionId: input.positionId,
		issueId: input.issue.id,
		body,
		stanceValue,
		origin: 'ai',
		confirmedByAuthor: false
	};

	const derived = locationFromClauses([...input.existingClauses, created]);
	if (derived !== null) {
		await updatePositionLocation(input.positionId, Math.round(derived), fetch).catch(() => {});
	}

	return created;
}

/* ── Middle-ground synthesis ───────────────────────────────────────────── */

export interface SynthesisClause {
	issueId: string | null;
	issueTitle: string;
	body: string;
	stanceValue: number;
}

export interface SynthesisDraft {
	heading: string;
	description: string;
	rationale: string;
	clauses: SynthesisClause[];
}

/**
 * Ask the AI for a middle-ground formula across the discussion's issues. Returns
 * a draft to preview (not yet persisted), or null when the assistant is
 * unavailable so the caller can surface that.
 */
export async function requestSynthesis(
	input: { topic: string; issues: Issue[]; clauses: Clause[] },
	fetch: FetchLike = globalThis.fetch
): Promise<SynthesisDraft | null> {
	const payloadIssues = input.issues.map((issue) => ({
		id: issue.id,
		title: issue.title,
		clauses: input.clauses
			.filter((c) => c.issueId === issue.id)
			.map((c) => ({ body: c.body, stanceValue: c.stanceValue }))
	}));

	const res = await fetch('/api/synthesize', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ topic: input.topic, issues: payloadIssues })
	}).catch(() => null);
	if (!res) return null;

	const out = await res.json();
	if (!out.available) return null;

	const data = out.data ?? {};
	const heading = String(data.heading ?? '').trim();
	if (!heading) return null;
	const clauses: SynthesisClause[] = Array.isArray(data.clauses)
		? data.clauses
				.map((c: Record<string, unknown>) => ({
					issueId: c.issueId ? String(c.issueId) : null,
					issueTitle: String(c.issueTitle ?? '').trim(),
					body: String(c.body ?? '').trim(),
					stanceValue: clampStance(c.stanceValue)
				}))
				.filter((c: SynthesisClause) => c.body)
		: [];

	return {
		heading,
		description: String(data.description ?? '').trim(),
		rationale: String(data.rationale ?? '').trim(),
		clauses
	};
}

/**
 * Persist a synthesis draft as a new proposed-solution opinion: create the
 * position, attach its clauses across the existing issues, then derive its
 * location. Returns the new position id, or null on failure.
 */
export async function persistSynthesis(
	input: { negotiationId: string; order: number; draft: SynthesisDraft; existingIssues: Issue[] },
	fetch: FetchLike = globalThis.fetch
): Promise<string | null> {
	const positionId = await createPosition(
		{
			negotiationId: input.negotiationId,
			heading: input.draft.heading,
			description: input.draft.description,
			location: 50,
			order: input.order,
			kind: 'proposed_solution',
			relativePlacement: {}
		},
		fetch
	).catch(() => null);
	if (!positionId) return null;

	const saved = await attachClauses(
		{
			negotiationId: input.negotiationId,
			positionId,
			drafts: input.draft.clauses.map((c) => ({ ...c, origin: 'ai' as const })),
			existingIssues: input.existingIssues
		},
		fetch
	);

	const derived = locationFromClauses(saved);
	if (derived !== null) {
		await updatePositionLocation(positionId, Math.round(derived), fetch).catch(() => {});
	}

	return positionId;
}
