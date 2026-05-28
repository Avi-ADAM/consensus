import {
	createClause,
	createIssue,
	listIssues,
	updatePositionLocation,
	type OpinionInput
} from './api';
import { locationFromClauses, type Clause, type Issue } from './scale';

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

	// Resolve each clause onto an issue id, creating issues as needed and
	// deduping by title within this pass.
	const byTitle = new Map<string, string>();
	for (const issue of existingIssues) byTitle.set(issue.title.trim(), issue.id);
	let order = existingIssues.length;

	const saved: Clause[] = [];
	for (const c of result.clauses) {
		let issueId = c.issueId && byTitle.size ? c.issueId : null;
		if (!issueId && c.issueTitle) {
			issueId = byTitle.get(c.issueTitle) ?? null;
			if (!issueId) {
				issueId = await createIssue(
					{
						negotiationId: input.negotiationId,
						title: c.issueTitle,
						order: order++,
						origin: 'ai'
					},
					fetch
				).catch(() => null);
				if (issueId) byTitle.set(c.issueTitle, issueId);
			}
		}

		const clauseId = await createClause(
			{
				negotiationId: input.negotiationId,
				positionId: input.positionId,
				issueId,
				body: c.body,
				stanceValue: c.stanceValue,
				origin: 'ai'
			},
			fetch
		).catch(() => null);

		if (clauseId) {
			saved.push({
				id: clauseId,
				positionId: input.positionId,
				issueId,
				body: c.body,
				stanceValue: c.stanceValue,
				origin: 'ai',
				confirmedByAuthor: false
			});
		}
	}

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
