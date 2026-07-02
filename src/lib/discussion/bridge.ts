import type { Clause, Issue, Opinion } from './scale';
import type { OpinionInput } from './api';

/* ── Bridge: negotiation imported from the main app (1.0) ───────────────────
 * A pmash/mission negotiation in the main app is a set of terms (price, hours,
 * dates, wording…) with an "original" and a "proposed" side. The bridge turns
 * each term into an Issue and each side's value into a Clause, so the
 * consensus tools (matrix, arguments, synthesis) operate on the real dispute.
 * Stances are fixed at ORIGINAL_STANCE/PROPOSED_STANCE and concrete values are
 * re-derived by interpolating between the two sides on the way back. */

export type BridgeFieldKind = 'number' | 'date' | 'text';

export interface BridgeField {
	/** Field name in the source object, e.g. 'price', 'hm', 'sqadualed'. */
	key: string;
	/** Human title — doubles as the Issue title, so it must stay stable. */
	label: string;
	kind: BridgeFieldKind;
	original: string | number | null;
	proposed: string | number | null;
	unit?: string;
}

export interface BridgePayload {
	v: 1;
	/** Source object type in the main app, e.g. 'pmash' | 'mission'. */
	sourceType: string;
	sourceId: string;
	/** Display name of the resource/mission under negotiation. */
	title: string;
	projectName?: string;
	/** Absolute URL back to the negotiation card in the main app. */
	returnUrl?: string;
	fields: BridgeField[];
}

/** Persisted on the Negotiation (json) so the way back survives reloads. */
export interface SourceMeta {
	v: 1;
	title: string;
	projectName?: string;
	returnUrl?: string;
	fields: BridgeField[];
}

export const ORIGINAL_STANCE = 0;
export const PROPOSED_STANCE = 100;
/** Stance for terms both sides already agree on — sits at the center. */
const AGREED_STANCE = 50;

/** Long rich-text values are truncated: the payload travels in a URL. */
const MAX_TEXT = 1200;
const MAX_FIELDS = 24;

function b64urlEncode(text: string): string {
	const bytes = new TextEncoder().encode(text);
	let bin = '';
	for (const b of bytes) bin += String.fromCharCode(b);
	return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(value: string): string {
	const b64 = value.replace(/-/g, '+').replace(/_/g, '/');
	const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
	const bin = atob(padded);
	const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
	return new TextDecoder().decode(bytes);
}

export function encodeBridgePayload(payload: BridgePayload): string {
	return b64urlEncode(JSON.stringify(payload));
}

function truncate(value: string | number | null): string | number | null {
	if (typeof value === 'string' && value.length > MAX_TEXT) return value.slice(0, MAX_TEXT);
	return value;
}

function asField(raw: unknown): BridgeField | null {
	if (typeof raw !== 'object' || raw === null) return null;
	const f = raw as Record<string, unknown>;
	const key = typeof f.key === 'string' ? f.key.trim() : '';
	const label = typeof f.label === 'string' ? f.label.trim() : '';
	const kind = f.kind === 'number' || f.kind === 'date' || f.kind === 'text' ? f.kind : null;
	if (!key || !label || !kind) return null;
	const value = (v: unknown): string | number | null =>
		typeof v === 'number' || typeof v === 'string' ? truncate(v) : null;
	return {
		key,
		label,
		kind,
		original: value(f.original),
		proposed: value(f.proposed),
		unit: typeof f.unit === 'string' ? f.unit : undefined
	};
}

/** Decode and validate a `?d=` payload. Returns null on any malformed input. */
export function parseBridgePayload(raw: string): BridgePayload | null {
	let parsed: unknown;
	try {
		parsed = JSON.parse(b64urlDecode(raw));
	} catch {
		return null;
	}
	if (typeof parsed !== 'object' || parsed === null) return null;
	const p = parsed as Record<string, unknown>;
	const sourceType = typeof p.sourceType === 'string' ? p.sourceType.trim() : '';
	const sourceId =
		typeof p.sourceId === 'string' || typeof p.sourceId === 'number' ? String(p.sourceId) : '';
	const title = typeof p.title === 'string' ? p.title.trim() : '';
	if (p.v !== 1 || !sourceType || !sourceId || !title) return null;

	const fields = (Array.isArray(p.fields) ? p.fields : [])
		.map(asField)
		.filter((f): f is BridgeField => f !== null)
		.slice(0, MAX_FIELDS);
	if (fields.length === 0) return null;

	return {
		v: 1,
		sourceType,
		sourceId,
		title,
		projectName: typeof p.projectName === 'string' ? p.projectName : undefined,
		returnUrl:
			typeof p.returnUrl === 'string' && /^https:\/\//.test(p.returnUrl) ? p.returnUrl : undefined,
		fields
	};
}

export function fieldChanged(field: BridgeField): boolean {
	const norm = (v: string | number | null) => (v === null || v === '' ? null : String(v));
	return norm(field.original) !== norm(field.proposed);
}

export function formatFieldValue(field: BridgeField, value: string | number | null): string {
	if (value === null || value === '') return '—';
	if (field.kind === 'number') {
		const n = Number(value);
		const text = Number.isFinite(n) ? n.toLocaleString('he-IL') : String(value);
		return field.unit ? `${text} ${field.unit}` : text;
	}
	return String(value);
}

export interface SeedClause {
	/** 'original' | 'proposed' — which seed position the clause belongs to. */
	side: 'original' | 'proposed';
	issueTitle: string;
	body: string;
	stanceValue: number;
}

export interface BridgeSeed {
	topic: string;
	description: string;
	originalOpinion: OpinionInput;
	proposedOpinion: OpinionInput;
	/** One issue per term, in payload order. */
	issueTitles: string[];
	clauses: SeedClause[];
	sourceMeta: SourceMeta;
}

function sideLines(fields: BridgeField[], side: 'original' | 'proposed'): string {
	return fields
		.map((f) => `${f.label}: ${formatFieldValue(f, side === 'original' ? f.original : f.proposed)}`)
		.join('\n');
}

/**
 * Build everything needed to seed a discussion from a bridge payload: two
 * opposing positions, one issue per term, and a clause per side per term.
 * Unchanged terms get a single agreed (centered) clause on each side so the
 * full picture of the terms is on the table, marked as settled.
 */
export function buildBridgeSeed(payload: BridgePayload): BridgeSeed {
	const clauses: SeedClause[] = [];
	for (const f of payload.fields) {
		const changed = fieldChanged(f);
		clauses.push({
			side: 'original',
			issueTitle: f.label,
			body: `${f.label}: ${formatFieldValue(f, f.original)}`,
			stanceValue: changed ? ORIGINAL_STANCE : AGREED_STANCE
		});
		clauses.push({
			side: 'proposed',
			issueTitle: f.label,
			body: `${f.label}: ${formatFieldValue(f, f.proposed)}`,
			stanceValue: changed ? PROPOSED_STANCE : AGREED_STANCE
		});
	}

	const project = payload.projectName ? ` (${payload.projectName})` : '';
	return {
		topic: `מו"מ: ${payload.title}${project}`,
		description: `דיון גישור על תנאי "${payload.title}" שהגיע מהאתר הראשי. כל היבט הוא תנאי במו"מ; הקצוות הם התנאים הקיימים מול ההצעה החדשה.`,
		originalOpinion: {
			heading: 'התנאים הקיימים',
			description: sideLines(payload.fields, 'original'),
			selfPlacement: ORIGINAL_STANCE
		},
		proposedOpinion: {
			heading: 'ההצעה החדשה',
			description: sideLines(payload.fields, 'proposed'),
			selfPlacement: PROPOSED_STANCE
		},
		issueTitles: payload.fields.map((f) => f.label),
		clauses,
		sourceMeta: {
			v: 1,
			title: payload.title,
			projectName: payload.projectName,
			returnUrl: payload.returnUrl,
			fields: payload.fields
		}
	};
}

/* ── Mapping a position back to concrete terms ─────────────────────────── */

function toIsoDate(ms: number): string {
	return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Interpolate a concrete value from a stance on a term's axis: 0 is the
 * original value, 100 the proposed one. Text terms cannot be interpolated —
 * callers use the clause body instead (see `agreementFromPosition`).
 */
export function stanceToValue(field: BridgeField, stance: number): string | number | null {
	const t = Math.min(100, Math.max(0, stance)) / 100;
	if (field.kind === 'number') {
		const a = Number(field.original);
		const b = Number(field.proposed);
		if (!Number.isFinite(a) || !Number.isFinite(b)) return field.proposed ?? field.original;
		return Math.round((a + (b - a) * t) * 100) / 100;
	}
	if (field.kind === 'date') {
		const a = field.original === null ? NaN : Date.parse(String(field.original));
		const b = field.proposed === null ? NaN : Date.parse(String(field.proposed));
		if (Number.isNaN(a) && Number.isNaN(b)) return null;
		if (Number.isNaN(a)) return toIsoDate(b);
		if (Number.isNaN(b)) return toIsoDate(a);
		return toIsoDate(a + (b - a) * t);
	}
	return t >= 0.5 ? field.proposed : field.original;
}

export interface AgreedTerm {
	key: string;
	label: string;
	kind: BridgeFieldKind;
	/** Interpolated value (number/date) or the clause wording (text). */
	value: string | number | null;
	/** The clause text backing this term, when one exists. */
	body: string | null;
	/** Mean stance of the position's clauses on this term, when any exist. */
	stance: number | null;
}

/**
 * Translate one position (typically the accepted synthesis) back into concrete
 * terms for the source object: per term, average the position's clause stances
 * on the matching issue and interpolate. Terms the position never addressed
 * come back with value null so the caller can keep the current value.
 */
export function agreementFromPosition(
	meta: SourceMeta,
	issues: Issue[],
	clauses: Clause[],
	positionId: string
): AgreedTerm[] {
	const issueByTitle = new Map(issues.map((i) => [i.title.trim(), i.id]));
	return meta.fields.map((field) => {
		const issueId = issueByTitle.get(field.label.trim()) ?? null;
		const own = issueId
			? clauses.filter((c) => c.positionId === positionId && c.issueId === issueId)
			: [];
		if (own.length === 0) {
			return {
				key: field.key,
				label: field.label,
				kind: field.kind,
				value: null,
				body: null,
				stance: null
			};
		}
		const stance = own.reduce((s, c) => s + c.stanceValue, 0) / own.length;
		const body = own[0].body || null;
		const value =
			field.kind === 'text' ? (body ?? stanceToValue(field, stance)) : stanceToValue(field, stance);
		return { key: field.key, label: field.label, kind: field.kind, value, body, stance };
	});
}

/** The most recent compromise proposal, the natural default to send back. */
export function defaultAgreementPosition(opinions: Opinion[]): Opinion | null {
	const solutions = opinions.filter((o) => o.kind === 'proposed_solution');
	return solutions.length > 0 ? solutions[solutions.length - 1] : null;
}

/* ── Resolution: the signed decision persisted on the Negotiation ─────────
 * The URL return (`negoBridge` param) only reaches the browser that clicked
 * the link. The resolution is the durable half of the way back: it is written
 * onto the Negotiation record itself, so ANY member opening the source card in
 * the main app (haluka, negoPend, …) sees the agreed outcome and can act on
 * it. The final approval still runs through the main app's own vote round. */

export interface BridgeResolution {
	v: 1;
	sourceType: string;
	sourceId: string;
	/** The position the resolution was derived from. */
	positionId: string;
	heading: string;
	/** Description of the chosen position — human summary of the agreement. */
	summary: string;
	/** key → agreed value, ready to prefill the source card (same as negoBridge). */
	values: Record<string, string | number>;
	terms: AgreedTerm[];
	decidedAt: string;
}

export function buildResolution(
	sourceType: string,
	sourceId: string,
	position: Opinion,
	terms: AgreedTerm[]
): BridgeResolution {
	const values: Record<string, string | number> = {};
	for (const t of terms) {
		if (t.value !== null && t.value !== '') values[t.key] = t.value;
	}
	return {
		v: 1,
		sourceType,
		sourceId,
		positionId: position.id,
		heading: position.heading,
		summary: position.description,
		values,
		terms,
		decidedAt: new Date().toISOString()
	};
}

/** Parse a resolution blob coming back from the server (json or string). */
export function parseResolution(raw: unknown): BridgeResolution | null {
	let parsed: unknown = raw;
	if (typeof raw === 'string') {
		try {
			parsed = JSON.parse(raw);
		} catch {
			return null;
		}
	}
	if (typeof parsed !== 'object' || parsed === null) return null;
	const r = parsed as Record<string, unknown>;
	if (r.v !== 1 || typeof r.values !== 'object' || r.values === null) return null;
	return r as unknown as BridgeResolution;
}

/**
 * Deep link back to the main app with the agreed terms, appended as a
 * `negoBridge` base64url param the source page reads to prefill its fields.
 */
export function buildReturnUrl(
	meta: SourceMeta,
	sourceId: string,
	terms: AgreedTerm[]
): string | null {
	if (!meta.returnUrl) return null;
	const values: Record<string, string | number> = {};
	for (const t of terms) {
		if (t.value !== null && t.value !== '') values[t.key] = t.value;
	}
	const packed = b64urlEncode(JSON.stringify({ v: 1, sourceId, values }));
	const url = new URL(meta.returnUrl);
	url.searchParams.set('negoBridge', packed);
	return url.toString();
}
