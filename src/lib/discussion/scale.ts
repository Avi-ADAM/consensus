export type Pole = 'top' | 'bottom' | 'none';
export type OpinionKind = 'opinion' | 'proposed_solution';

export interface Opinion {
	id: string;
	heading: string;
	description: string;
	/** Continuous position on the scale. Anchors sit at the extremes; others fall between or beyond. */
	location: number;
	votes: number;
	color: string;
	isAnchor: boolean;
	pole: Pole;
	kind: OpinionKind;
	/** Where the author placed themselves — an input signal, distinct from the derived `location`. */
	selfPlacement?: number;
	/** External id of the author, for ownership checks (clause editing). */
	authorExternalId?: string;
}

export type InsertMode =
	| { mode: 'beyond_top' }
	| { mode: 'beyond_bottom' }
	/** Place between two adjacent opinions. `fraction` (0..1) lets it sit anywhere between — not only the midpoint. */
	| { mode: 'between'; afterId: string; beforeId: string; fraction?: number };

export const PALETTE = [
	'violet',
	'sky',
	'emerald',
	'amber',
	'rose',
	'indigo',
	'teal',
	'fuchsia',
	'lime'
] as const;

export function colorFor(index: number): string {
	return PALETTE[((index % PALETTE.length) + PALETTE.length) % PALETTE.length];
}

/** How far beyond the current extreme a new "more extreme" opinion lands. */
const BEYOND_GAP = 10;

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

export function sortByLocation(opinions: Opinion[]): Opinion[] {
	return [...opinions].sort((a, b) => a.location - b.location);
}

/**
 * Resolve the raw `location` for a newly inserted opinion. The result may fall
 * outside [0,100] when placed beyond an extreme; display normalization handles that.
 */
export function insertLocation(opinions: Opinion[], insert: InsertMode): number {
	const sorted = sortByLocation(opinions);
	if (sorted.length === 0) return 50;

	if (insert.mode === 'beyond_top') {
		return sorted[0].location - BEYOND_GAP;
	}
	if (insert.mode === 'beyond_bottom') {
		return sorted[sorted.length - 1].location + BEYOND_GAP;
	}

	const a = sorted.find((o) => o.id === insert.afterId);
	const b = sorted.find((o) => o.id === insert.beforeId);
	if (!a || !b) {
		throw new Error('between insert requires two existing opinions');
	}
	const fraction = clamp(insert.fraction ?? 0.5, 0.05, 0.95);
	return a.location + (b.location - a.location) * fraction;
}

export interface DisplayPoint {
	id: string;
	/** 0 (top) .. 100 (bottom) position along the visual axis. */
	display: number;
}

/**
 * Map raw locations onto the visible axis, keeping relative spacing but padding
 * the ends so the extreme cards stay on screen.
 */
export function toDisplay(opinions: Opinion[], pad = 8): DisplayPoint[] {
	const sorted = sortByLocation(opinions);
	const n = sorted.length;
	if (n === 0) return [];
	if (n === 1) return [{ id: sorted[0].id, display: 50 }];

	const span = 100 - 2 * pad;
	const min = sorted[0].location;
	const max = sorted[n - 1].location;

	if (max === min) {
		return sorted.map((o, i) => ({ id: o.id, display: pad + (span * i) / (n - 1) }));
	}
	return sorted.map((o) => ({
		id: o.id,
		display: pad + (span * (o.location - min)) / (max - min)
	}));
}

/** Center of mass on the display axis, weighted by support (votes + 1). */
export function weightedCenter(opinions: Opinion[], pad = 8): number {
	const points = toDisplay(opinions, pad);
	if (points.length === 0) return 50;
	const byId = new Map(opinions.map((o) => [o.id, o]));
	let weighted = 0;
	let total = 0;
	for (const p of points) {
		const w = (byId.get(p.id)?.votes ?? 0) + 1;
		weighted += p.display * w;
		total += w;
	}
	return total === 0 ? 50 : weighted / total;
}

/**
 * 0..100; higher means opinions cluster tightly on the underlying scale (closer
 * to consensus). Uses raw locations, not display positions, so genuine clustering
 * is not erased by normalization.
 */
export function consensusScore(opinions: Opinion[]): number {
	if (opinions.length < 2) return 0;
	return spreadToScore(opinions.map((o) => o.location));
}

/** Shared variance→score mapping used by both the global and per-issue scores. */
function spreadToScore(values: number[]): number {
	if (values.length < 2) return 0;
	const mean = values.reduce((s, v) => s + v, 0) / values.length;
	const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
	return Math.round(clamp(100 - Math.sqrt(variance), 0, 100));
}

/* ── Clause-level model ─────────────────────────────────────────────────────
 * An opinion decomposes into clauses, each answering one shared issue (axis).
 * The opinion's location on the global scale is *derived* from its clauses
 * rather than placed by hand. */

export type Origin = 'ai' | 'human';

export interface Issue {
	id: string;
	title: string;
	order: number;
	origin: Origin;
}

export interface Clause {
	id: string;
	positionId: string;
	/** Null until the clause is classified onto an issue. */
	issueId: string | null;
	body: string;
	/** 0..100 stance on this clause's issue axis. */
	stanceValue: number;
	origin: Origin;
	confirmedByAuthor: boolean;
}

/**
 * Derive an opinion's global location from its clauses (mean stance). Returns
 * null when there are no clauses, so callers can fall back to a manual/anchor
 * location. The mean keeps the opinion centered among the positions it actually
 * takes rather than at a hand-picked spot.
 */
export function locationFromClauses(clauses: Clause[]): number | null {
	if (clauses.length === 0) return null;
	const sum = clauses.reduce((s, c) => s + c.stanceValue, 0);
	return clamp(sum / clauses.length, 0, 100);
}

export interface IssueConsensus {
	issueId: string;
	title: string;
	/** 0..100; higher means the clauses on this issue agree. */
	score: number;
	clauseCount: number;
}

/**
 * Consensus per issue: how tightly the clauses answering each issue agree.
 * Lets the UI point energy at the contested issues and mark the settled ones.
 */
export function issueConsensus(clauses: Clause[], issues: Issue[]): IssueConsensus[] {
	return [...issues]
		.sort((a, b) => a.order - b.order)
		.map((issue) => {
			const values = clauses.filter((c) => c.issueId === issue.id).map((c) => c.stanceValue);
			return {
				issueId: issue.id,
				title: issue.title,
				score: spreadToScore(values),
				clauseCount: values.length
			};
		});
}

/**
 * Issues that other opinions addressed but this opinion skipped — the gaps to
 * fill. `positionClauses` are the clauses of one opinion; `coveredIssueIds`
 * are issues touched by any opinion in the discussion.
 */
export function missingIssues(positionClauses: Clause[], issues: Issue[]): Issue[] {
	const covered = new Set(positionClauses.map((c) => c.issueId));
	return issues.filter((i) => !covered.has(i.id));
}

/**
 * The clause that pulls the derived location furthest from where the author
 * placed themselves — powers the "because of clause X you sit at Y" hint.
 */
export function dominantClause(clauses: Clause[], selfPlacement: number): Clause | null {
	let best: Clause | null = null;
	let bestGap = -1;
	for (const c of clauses) {
		const gap = Math.abs(c.stanceValue - selfPlacement);
		if (gap > bestGap) {
			bestGap = gap;
			best = c;
		}
	}
	return best;
}
