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
	const locations = opinions.map((o) => o.location);
	const mean = locations.reduce((s, l) => s + l, 0) / locations.length;
	const variance = locations.reduce((s, l) => s + (l - mean) ** 2, 0) / locations.length;
	return Math.round(clamp(100 - Math.sqrt(variance), 0, 100));
}
