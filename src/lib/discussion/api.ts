import { sendToSer } from '$lib/send/sendToSer';
import { colorFor, type Opinion, type Pole, type OpinionKind } from './scale';

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

export interface CreateDiscussionInput {
	topic: string;
	description: string;
	visibility: 'private' | 'unlisted' | 'local';
	isLocal: boolean;
	placeIds: string[];
	maxRounds: number;
	anchorTop: { heading: string; description: string };
	anchorBottom: { heading: string; description: string };
}

export interface ProposeInput {
	negotiationId: string;
	heading: string;
	description: string;
	location: number;
	order: number;
	kind: OpinionKind;
	relativePlacement: Record<string, unknown>;
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
		kind: (a.kind as OpinionKind) ?? 'opinion'
	};
}

export async function loadDiscussion(
	id: string,
	fetch: FetchLike = globalThis.fetch
): Promise<LoadedDiscussion | null> {
	const res = await sendToSer<any>({ id }, '39GetNegotiation', 0, 0, false, fetch);
	const node = res?.data?.negotiation?.data;
	if (!node) return null;
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

export async function createDiscussion(
	input: CreateDiscussionInput,
	fetch: FetchLike = globalThis.fetch
): Promise<{ id: string; shareToken: string } | null> {
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

	await sendToSer(
		{
			negotiationId: id,
			heading: input.anchorTop.heading,
			description: input.anchorTop.description,
			location: 0,
			order: 1,
			kind: 'opinion',
			isAnchor: true,
			pole: 'top'
		},
		'41CreatePosition',
		0,
		0,
		false,
		fetch
	);
	await sendToSer(
		{
			negotiationId: id,
			heading: input.anchorBottom.heading,
			description: input.anchorBottom.description,
			location: 100,
			order: 2,
			kind: 'opinion',
			isAnchor: true,
			pole: 'bottom'
		},
		'41CreatePosition',
		0,
		0,
		false,
		fetch
	);

	return { id: String(id), shareToken };
}

export async function createPosition(
	input: ProposeInput,
	fetch: FetchLike = globalThis.fetch
): Promise<void> {
	await sendToSer(
		{ ...input, isAnchor: false, pole: 'none' },
		'41CreatePosition',
		0,
		0,
		false,
		fetch
	);
}

export async function supportPosition(
	id: string,
	votes: number,
	voters: string[],
	fetch: FetchLike = globalThis.fetch
): Promise<void> {
	await sendToSer({ id, votes, voters }, '42UpdatePosition', 0, 0, false, fetch);
}
/* eslint-enable @typescript-eslint/no-explicit-any */
