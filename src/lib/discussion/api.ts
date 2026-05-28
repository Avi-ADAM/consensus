import { sendToSer } from '$lib/send/sendToSer';
import {
	colorFor,
	type Clause,
	type Issue,
	type Opinion,
	type Origin,
	type Pole,
	type OpinionKind
} from './scale';

type FetchLike = typeof globalThis.fetch;

export interface DiscussionMeta {
	id: string;
	topic: string;
	description: string;
	visibility: string;
	shareToken: string;
	isLocal: boolean;
	maxRounds: number;
	currentRound: number;
	places: { id: string; name: string }[];
}

export interface LoadedDiscussion {
	meta: DiscussionMeta;
	opinions: Opinion[];
}

export interface OpinionInput {
	heading: string;
	description: string;
	/** 0..100 where the author places themselves — a hint, not the shown location. */
	selfPlacement?: number;
}

export interface CreateDiscussionInput {
	topic: string;
	description: string;
	visibility: 'private' | 'unlisted' | 'local';
	isLocal: boolean;
	placeIds: string[];
	maxRounds: number;
	/** The creator's own opinion — the only required one. */
	ownOpinion: OpinionInput;
	/** Opinions of others the creator optionally seeds (kept non-prominent in UI). */
	otherOpinions?: OpinionInput[];
}

export interface ProposeInput {
	negotiationId: string;
	heading: string;
	description: string;
	location: number;
	order: number;
	kind: OpinionKind;
	relativePlacement: Record<string, unknown>;
	selfPlacement?: number;
}

export interface DiscussionSummary {
	id: string;
	topic: string;
	description: string;
	currentRound: number;
	maxRounds: number;
	positionsCount: number;
}

export type Stance = 'pro' | 'con';

export interface Argument {
	id: string;
	body: string;
	stance: Stance;
	votes: number;
}

export interface CreateArgumentInput {
	negotiationId: string;
	positionId: string;
	stance: Stance;
	body: string;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function attr(node: any) {
	return node?.attributes ?? {};
}

function parseJson<T>(value: unknown, fallback: T): T {
	if (typeof value !== 'string') return (value as T) ?? fallback;
	try {
		return JSON.parse(value) as T;
	} catch {
		return fallback;
	}
}

function toOpinion(node: any, index: number): Opinion {
	const a = attr(node);
	return {
		id: String(node?.id ?? crypto.randomUUID()),
		heading: a.heading ?? '',
		description: a.description ?? '',
		location: typeof a.location === 'number' ? a.location : 50,
		votes: a.votes ?? parseJson<string[]>(a.voters, []).length ?? 0,
		color: colorFor(index),
		isAnchor: Boolean(a.isAnchor),
		pole: (a.pole as Pole) ?? 'none',
		kind: (a.kind as OpinionKind) ?? 'opinion',
		selfPlacement: typeof a.selfPlacement === 'number' ? a.selfPlacement : undefined
	};
}

function mapNegotiation(node: any): LoadedDiscussion {
	const a = attr(node);
	return {
		meta: {
			id: String(node.id),
			topic: a.topic ?? '',
			description: a.description ?? '',
			visibility: a.visibility ?? 'private',
			shareToken: a.shareToken ?? '',
			isLocal: Boolean(a.isLocal),
			maxRounds: a.maxRounds ?? 3,
			currentRound: a.currentRound ?? 1,
			places: (a.places?.data ?? []).map((p: any) => ({
				id: String(p.id),
				name: attr(p).name ?? ''
			}))
		},
		opinions: (a.positions?.data ?? []).map(toOpinion)
	};
}

export async function loadDiscussion(
	id: string,
	fetch: FetchLike = globalThis.fetch
): Promise<LoadedDiscussion | null> {
	const res = await sendToSer<any>({ id }, '39GetNegotiation', 0, 0, false, fetch);
	const node = res?.data?.negotiation?.data;
	return node ? mapNegotiation(node) : null;
}

export async function loadDiscussionByToken(
	token: string,
	fetch: FetchLike = globalThis.fetch
): Promise<LoadedDiscussion | null> {
	const res = await sendToSer<any>({ token }, 'GetNegotiationByToken', 0, 0, false, fetch);
	const node = res?.data?.negotiations?.data?.[0] ?? res?.data?.negotiation?.data;
	return node ? mapNegotiation(node) : null;
}

function extractPositionId(created: any): string | null {
	const id = created?.data?.createPosition?.data?.id ?? created?.id;
	return id ? String(id) : null;
}

/**
 * Evenly spread initial locations across the axis for the seed opinions. These
 * are placeholders: once clauses exist, the location is re-derived from them.
 */
function seedLocation(own: OpinionInput, index: number, total: number): number {
	if (typeof own.selfPlacement === 'number') return own.selfPlacement;
	if (total <= 1) return 50;
	return Math.round((100 * index) / (total - 1));
}

export async function createDiscussion(
	input: CreateDiscussionInput,
	fetch: FetchLike = globalThis.fetch
): Promise<{ id: string; shareToken: string; positionIds: string[] } | null> {
	const shareToken =
		typeof crypto !== 'undefined' && crypto.randomUUID
			? crypto.randomUUID()
			: Math.random().toString(36).slice(2);

	const created = await sendToSer<any>(
		{
			topic: input.topic,
			description: input.description,
			maxRounds: input.maxRounds,
			visibility: input.visibility,
			shareToken,
			isLocal: input.isLocal,
			placeIds: input.placeIds.map((p) => Number(p))
		},
		'40CreateNegotiation',
		0,
		0,
		false,
		fetch
	);

	const id = created?.data?.createNegotiation?.data?.id ?? created?.id;
	if (!id) return null;

	const seeds = [input.ownOpinion, ...(input.otherOpinions ?? [])];
	const positionIds: string[] = [];
	for (let i = 0; i < seeds.length; i++) {
		const seed = seeds[i];
		const posId = await createPosition(
			{
				negotiationId: String(id),
				heading: seed.heading,
				description: seed.description,
				location: seedLocation(seed, i, seeds.length),
				order: i + 1,
				kind: 'opinion',
				relativePlacement: {},
				selfPlacement: seed.selfPlacement
			},
			fetch
		);
		if (posId) positionIds.push(posId);
	}

	return { id: String(id), shareToken, positionIds };
}

export async function createPosition(
	input: ProposeInput,
	fetch: FetchLike = globalThis.fetch
): Promise<string | null> {
	const created = await sendToSer<any>(
		{ ...input, isAnchor: false, pole: 'none' },
		'41CreatePosition',
		0,
		0,
		false,
		fetch
	);
	return extractPositionId(created);
}

export async function supportPosition(
	id: string,
	fetch: FetchLike = globalThis.fetch
): Promise<void> {
	await sendToSer({ id, support: true }, '42UpdatePosition', 0, 0, false, fetch);
}

/** Write back the location derived from an opinion's clauses. */
export async function updatePositionLocation(
	id: string,
	location: number,
	fetch: FetchLike = globalThis.fetch
): Promise<void> {
	await sendToSer({ id, location }, '42UpdatePosition', 0, 0, false, fetch);
}

export async function listLocalDiscussions(
	placeId: string,
	fetch: FetchLike = globalThis.fetch
): Promise<DiscussionSummary[]> {
	const res = await sendToSer<any>(
		{ placeId: Number(placeId) },
		'ListLocalNegotiations',
		0,
		0,
		false,
		fetch
	);
	const list = res?.data?.negotiations?.data ?? [];
	return list.map((n: any) => {
		const a = attr(n);
		return {
			id: String(n.id),
			topic: a.topic ?? '',
			description: a.description ?? '',
			currentRound: a.currentRound ?? 1,
			maxRounds: a.maxRounds ?? 3,
			positionsCount: a.positions?.data?.length ?? a.positionsCount ?? 0
		};
	});
}

export async function listArguments(
	positionId: string,
	fetch: FetchLike = globalThis.fetch
): Promise<Argument[]> {
	const res = await sendToSer<any>({ positionId }, 'ListArguments', 0, 0, false, fetch);
	const list = res?.data?.arguments?.data ?? [];
	return list.map((n: any) => {
		const a = attr(n);
		return {
			id: String(n.id),
			body: a.body ?? '',
			stance: a.stance === 'con' ? 'con' : 'pro',
			votes: a.votes ?? 0
		};
	});
}

export async function createArgument(
	input: CreateArgumentInput,
	fetch: FetchLike = globalThis.fetch
): Promise<void> {
	await sendToSer({ ...input }, 'CreateArgument', 0, 0, false, fetch);
}

export async function supportArgument(
	id: string,
	fetch: FetchLike = globalThis.fetch
): Promise<void> {
	await sendToSer({ id, support: true }, 'UpdateArgument', 0, 0, false, fetch);
}

/* ── Issues & clauses ──────────────────────────────────────────────────── */

function toIssue(node: any): Issue {
	const a = attr(node);
	return {
		id: String(node?.id ?? crypto.randomUUID()),
		title: a.title ?? '',
		order: typeof a.order === 'number' ? a.order : 0,
		origin: a.origin === 'human' ? 'human' : 'ai'
	};
}

function toClause(node: any): Clause {
	const a = attr(node);
	const issueNode = a.issue?.data;
	const positionNode = a.position?.data;
	return {
		id: String(node?.id ?? crypto.randomUUID()),
		positionId: positionNode ? String(positionNode.id) : '',
		issueId: issueNode ? String(issueNode.id) : null,
		body: a.body ?? '',
		stanceValue: typeof a.stanceValue === 'number' ? a.stanceValue : 50,
		origin: a.origin === 'human' ? 'human' : 'ai',
		confirmedByAuthor: Boolean(a.confirmedByAuthor)
	};
}

export async function listIssues(
	negotiationId: string,
	fetch: FetchLike = globalThis.fetch
): Promise<Issue[]> {
	const res = await sendToSer<any>({ negotiationId }, 'ListIssues', 0, 0, false, fetch);
	return (res?.data?.issues?.data ?? []).map(toIssue);
}

export async function listClauses(
	negotiationId: string,
	positionId: string | null = null,
	fetch: FetchLike = globalThis.fetch
): Promise<Clause[]> {
	const arg: Record<string, unknown> = { negotiationId };
	if (positionId) arg.positionId = positionId;
	const res = await sendToSer<any>(arg, 'ListClauses', 0, 0, false, fetch);
	return (res?.data?.clauses?.data ?? []).map(toClause);
}

export async function createIssue(
	input: { negotiationId: string; title: string; order: number; origin: Origin },
	fetch: FetchLike = globalThis.fetch
): Promise<string | null> {
	const res = await sendToSer<any>({ ...input }, 'CreateIssue', 0, 0, false, fetch);
	const id = res?.data?.createIssue?.data?.id ?? res?.id;
	return id ? String(id) : null;
}

export async function createClause(
	input: {
		negotiationId: string;
		positionId: string;
		issueId?: string | null;
		body: string;
		stanceValue: number;
		origin: Origin;
	},
	fetch: FetchLike = globalThis.fetch
): Promise<string | null> {
	const res = await sendToSer<any>({ ...input }, 'CreateClause', 0, 0, false, fetch);
	const id = res?.data?.createClause?.data?.id ?? res?.id;
	return id ? String(id) : null;
}

export async function updateClause(
	input: {
		id: string;
		body?: string;
		stanceValue?: number;
		issueId?: string | null;
		confirmedByAuthor?: boolean;
	},
	fetch: FetchLike = globalThis.fetch
): Promise<void> {
	await sendToSer({ ...input }, 'UpdateClause', 0, 0, false, fetch);
}
/* eslint-enable @typescript-eslint/no-explicit-any */
