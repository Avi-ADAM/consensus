/* ============================================================================
   scale.ts — TypeScript type definitions and math for the Consensus spectrum.
   Mirrors Avi-ADAM/consensus  src/lib/discussion/scale.ts.
   Components import types from here; the full runtime version lives in the app.
   ============================================================================ */

// ── Types ────────────────────────────────────────────────────────────────────

export type OpinionKind = 'opinion' | 'proposed_solution' | 'anchor';
export type OpinionPole = 'top' | 'bottom' | 'none';

export interface Opinion {
  id: string;
  heading: string;
  description?: string;
  /** Derived location on the 0–100 axis, computed from clauses. */
  location: number;
  /** Where the author placed themselves on the axis. */
  selfPlacement?: number;
  votes: number;
  color: string;
  isAnchor: boolean;
  pole: OpinionPole;
  kind: OpinionKind;
  authorExternalId?: string;
}

export interface Issue {
  id: string;
  title: string;
  order: number;
  origin?: string;
}

export interface Clause {
  id: string;
  positionId: string;
  issueId: string | null;
  body: string;
  stanceValue: number;
  origin?: 'ai' | 'human';
  confirmedByAuthor?: boolean;
}

export type InsertMode =
  | { mode: 'beyond_top' }
  | { mode: 'beyond_bottom' }
  | { mode: 'between'; afterId: string; beforeId: string; fraction?: number };

// ── Palette ──────────────────────────────────────────────────────────────────

export const PALETTE = [
  'violet', 'sky', 'emerald', 'amber', 'rose', 'indigo', 'teal', 'fuchsia', 'lime',
] as const;

export type PaletteColor = typeof PALETTE[number];

export function colorFor(index: number): string {
  return PALETTE[((index % PALETTE.length) + PALETTE.length) % PALETTE.length];
}

// ── Axis math ────────────────────────────────────────────────────────────────

const BEYOND_GAP = 10;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function sortByLocation(opinions: Opinion[]): Opinion[] {
  return [...opinions].sort((a, b) => a.location - b.location);
}

export function insertLocation(
  opinions: Opinion[],
  insert: InsertMode,
): number {
  const sorted = sortByLocation(opinions);
  if (sorted.length === 0) return 50;
  if (insert.mode === 'beyond_top') return sorted[0].location - BEYOND_GAP;
  if (insert.mode === 'beyond_bottom')
    return sorted[sorted.length - 1].location + BEYOND_GAP;
  const a = sorted.find((o) => o.id === insert.afterId);
  const b = sorted.find((o) => o.id === insert.beforeId);
  if (!a || !b) throw new Error('between insert requires two existing opinions');
  const fraction = clamp(insert.fraction ?? 0.5, 0.05, 0.95);
  return a.location + (b.location - a.location) * fraction;
}

/** Map raw locations onto a visible 0..100 axis, padding the ends. */
export function toDisplay(
  opinions: Opinion[],
  pad = 8,
): { id: string; display: number }[] {
  const sorted = sortByLocation(opinions);
  const n = sorted.length;
  if (n === 0) return [];
  if (n === 1) return [{ id: sorted[0].id, display: 50 }];
  const span = 100 - 2 * pad;
  const min = sorted[0].location;
  const max = sorted[n - 1].location;
  if (max === min) {
    return sorted.map((o, i) => ({
      id: o.id,
      display: pad + (span * i) / (n - 1),
    }));
  }
  return sorted.map((o) => ({
    id: o.id,
    display: pad + (span * (o.location - min)) / (max - min),
  }));
}

/** Center of mass on the display axis, weighted by support (votes + 1). */
export function weightedCenter(opinions: Opinion[], pad = 8): number {
  const points = toDisplay(opinions, pad);
  if (points.length === 0) return 50;
  const byId = new Map(opinions.map((o) => [o.id, o]));
  let weighted = 0, total = 0;
  for (const p of points) {
    const w = ((byId.get(p.id)?.votes) ?? 0) + 1;
    weighted += p.display * w;
    total += w;
  }
  return total === 0 ? 50 : weighted / total;
}

function spreadToScore(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return Math.round(clamp(100 - Math.sqrt(variance), 0, 100));
}

/** 0..100; higher = opinions cluster tightly on the underlying scale. */
export function consensusScore(opinions: Opinion[]): number {
  if (opinions.length < 2) return 0;
  return spreadToScore(opinions.map((o) => o.location));
}

/** Derive an opinion's global location from its clauses (mean stance). */
export function locationFromClauses(clauses: Clause[]): number | null {
  if (clauses.length === 0) return null;
  const sum = clauses.reduce((s, c) => s + c.stanceValue, 0);
  return clamp(sum / clauses.length, 0, 100);
}

/** Consensus per issue: how tightly the clauses answering each issue agree. */
export function issueConsensus(
  clauses: Clause[],
  issues: Issue[],
): { issueId: string; title: string; score: number; clauseCount: number }[] {
  return [...issues]
    .sort((a, b) => a.order - b.order)
    .map((issue) => {
      const values = clauses
        .filter((c) => c.issueId === issue.id)
        .map((c) => c.stanceValue);
      return {
        issueId: issue.id,
        title: issue.title,
        score: spreadToScore(values),
        clauseCount: values.length,
      };
    });
}

/** Issues other opinions addressed but this opinion skipped — the gaps. */
export function missingIssues(positionClauses: Clause[], issues: Issue[]): Issue[] {
  const covered = new Set(positionClauses.map((c) => c.issueId));
  return issues.filter((i) => !covered.has(i.id));
}

/** The clause that pulls the derived location furthest from self-placement. */
export function dominantClause(clauses: Clause[], selfPlacement: number): Clause | null {
  let best: Clause | null = null;
  let bestGap = -1;
  for (const c of clauses) {
    const gap = Math.abs(c.stanceValue - selfPlacement);
    if (gap > bestGap) { bestGap = gap; best = c; }
  }
  return best;
}
