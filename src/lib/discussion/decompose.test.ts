import { describe, it, expect } from 'vitest';
import {
	decomposeOpinion,
	decomposeAndPersist,
	fillGap,
	requestSynthesis,
	persistSynthesis,
	type SynthesisDraft
} from './decompose';
import type { Clause, Issue } from './scale';

type Json = Record<string, unknown>;

interface SendCall {
	queId: string;
	arg: Json;
}

interface Routes {
	decompose?: (body: Json) => Json;
	synthesize?: (body: Json) => Json;
	suggest?: (body: Json) => Json;
	send?: (queId: string, arg: Json) => Json;
}

/**
 * A fake fetch that routes by URL and, for /api/send, by queId — letting us
 * exercise the orchestration without a backend. Records every /api/send call.
 */
function makeFetch(routes: Routes) {
	const sendCalls: SendCall[] = [];
	const fetchLike = (async (url: string, opts?: { body?: string }) => {
		const body: Json = opts?.body ? JSON.parse(opts.body) : {};
		let payload: Json = {};
		if (url === '/api/decompose') {
			payload = routes.decompose?.(body) ?? { available: false };
		} else if (url === '/api/synthesize') {
			payload = routes.synthesize?.(body) ?? { available: false };
		} else if (url === '/api/suggest-clause') {
			payload = routes.suggest?.(body) ?? { available: false };
		} else if (url === '/api/send') {
			const data = (body.data ?? {}) as Json;
			const queId = String(data.queId ?? '');
			const arg = (data.arg ?? {}) as Json;
			sendCalls.push({ queId, arg });
			payload = routes.send?.(queId, arg) ?? {};
		}
		return { status: 200, json: async () => payload };
	}) as unknown as typeof globalThis.fetch;
	return { fetch: fetchLike, sendCalls };
}

function issuesResponse(issues: Issue[]) {
	return {
		data: {
			issues: {
				data: issues.map((i) => ({
					id: i.id,
					attributes: { title: i.title, order: i.order, origin: i.origin }
				}))
			}
		}
	};
}

/** Default /api/send handler that hands back incrementing ids for creates. */
function defaultSend(existingIssues: Issue[] = []) {
	let issueSeq = 0;
	let clauseSeq = 0;
	let positionSeq = 0;
	return (queId: string, _arg: Json): Json => {
		switch (queId) {
			case 'ListIssues':
				return issuesResponse(existingIssues);
			case 'CreateIssue':
				return { data: { createIssue: { data: { id: `new-issue-${++issueSeq}` } } } };
			case 'CreateClause':
				return { data: { createClause: { data: { id: `clause-${++clauseSeq}` } } } };
			case '41CreatePosition':
				return { data: { createPosition: { data: { id: `pos-${++positionSeq}` } } } };
			case '42UpdatePosition':
				return {};
			default:
				return {};
		}
	};
}

describe('decomposeOpinion', () => {
	it('returns null when the assistant is unavailable', async () => {
		const { fetch } = makeFetch({ decompose: () => ({ available: false }) });
		const result = await decomposeOpinion(
			{ topic: 't', opinion: { heading: 'h', description: 'd' }, existingIssues: [] },
			fetch
		);
		expect(result).toBeNull();
	});

	it('parses clauses, clamps stance, and drops empty-body clauses', async () => {
		const { fetch } = makeFetch({
			decompose: () => ({
				available: true,
				data: {
					clauses: [
						{ body: 'keep me', issueId: null, issueTitle: 'Budget', stanceValue: 140 },
						{ body: '   ', issueTitle: 'Empty', stanceValue: 50 }
					],
					gaps: [{ issueId: 'i9', issueTitle: 'Timeline', suggestedClause: 'do later' }]
				}
			})
		});
		const result = await decomposeOpinion(
			{ topic: 't', opinion: { heading: 'h', description: 'd' }, existingIssues: [] },
			fetch
		);
		expect(result?.clauses).toEqual([
			{ body: 'keep me', issueId: null, issueTitle: 'Budget', stanceValue: 100 }
		]);
		expect(result?.gaps).toEqual([
			{ issueId: 'i9', issueTitle: 'Timeline', suggestedClause: 'do later' }
		]);
	});
});

describe('decomposeAndPersist', () => {
	it('creates an issue per new title and dedupes repeats within the pass', async () => {
		const send = defaultSend([]);
		const { fetch, sendCalls } = makeFetch({
			decompose: () => ({
				available: true,
				data: {
					clauses: [
						{ body: 'a', issueTitle: 'Budget', stanceValue: 20 },
						{ body: 'b', issueTitle: 'Budget', stanceValue: 40 },
						{ body: 'c', issueTitle: 'Timeline', stanceValue: 60 }
					],
					gaps: []
				}
			}),
			send
		});

		await decomposeAndPersist(
			{
				negotiationId: 'n1',
				positionId: 'p1',
				topic: 't',
				opinion: { heading: 'h', description: 'd' }
			},
			fetch
		);

		// Two distinct titles → exactly two CreateIssue calls.
		expect(sendCalls.filter((c) => c.queId === 'CreateIssue')).toHaveLength(2);
		// Three clauses persisted.
		expect(sendCalls.filter((c) => c.queId === 'CreateClause')).toHaveLength(3);
	});

	it('reuses an existing issue by title instead of creating a new one', async () => {
		const existing: Issue[] = [{ id: 'iX', title: 'Budget', order: 0, origin: 'ai' }];
		const send = defaultSend(existing);
		const { fetch, sendCalls } = makeFetch({
			decompose: () => ({
				available: true,
				data: { clauses: [{ body: 'a', issueTitle: 'Budget', stanceValue: 30 }], gaps: [] }
			}),
			send
		});

		await decomposeAndPersist(
			{
				negotiationId: 'n1',
				positionId: 'p1',
				topic: 't',
				opinion: { heading: 'h', description: 'd' }
			},
			fetch
		);

		expect(sendCalls.filter((c) => c.queId === 'CreateIssue')).toHaveLength(0);
		const clauseCall = sendCalls.find((c) => c.queId === 'CreateClause');
		expect(clauseCall?.arg.issueId).toBe('iX');
	});

	it('writes back the derived location as the mean clause stance', async () => {
		const send = defaultSend([]);
		const { fetch, sendCalls } = makeFetch({
			decompose: () => ({
				available: true,
				data: {
					clauses: [
						{ body: 'a', issueTitle: 'I1', stanceValue: 20 },
						{ body: 'b', issueTitle: 'I2', stanceValue: 80 }
					],
					gaps: []
				}
			}),
			send
		});

		await decomposeAndPersist(
			{
				negotiationId: 'n1',
				positionId: 'p1',
				topic: 't',
				opinion: { heading: 'h', description: 'd' }
			},
			fetch
		);

		const update = sendCalls.find((c) => c.queId === '42UpdatePosition');
		expect(update?.arg).toMatchObject({ id: 'p1', location: 50 });
	});

	it('returns the result without persisting when there are no clauses', async () => {
		const send = defaultSend([]);
		const { fetch, sendCalls } = makeFetch({
			decompose: () => ({ available: true, data: { clauses: [], gaps: [] } }),
			send
		});

		const result = await decomposeAndPersist(
			{
				negotiationId: 'n1',
				positionId: 'p1',
				topic: 't',
				opinion: { heading: 'h', description: 'd' }
			},
			fetch
		);

		expect(result).toEqual({ clauses: [], gaps: [] });
		expect(sendCalls.some((c) => c.queId === 'CreateClause')).toBe(false);
		expect(sendCalls.some((c) => c.queId === '42UpdatePosition')).toBe(false);
	});
});

describe('fillGap', () => {
	const issue: Issue = { id: 'iT', title: 'Timeline', order: 3, origin: 'ai' };

	it('returns null when the assistant is unavailable', async () => {
		const { fetch } = makeFetch({ suggest: () => ({ available: false }), send: defaultSend() });
		const created = await fillGap(
			{
				negotiationId: 'n1',
				positionId: 'p1',
				topic: 't',
				opinion: { heading: 'h', description: 'd' },
				issue,
				existingClauses: []
			},
			fetch
		);
		expect(created).toBeNull();
	});

	it('persists the drafted clause and re-derives location over the full set', async () => {
		const send = defaultSend();
		const { fetch, sendCalls } = makeFetch({
			suggest: () => ({ available: true, data: { body: 'phase it', stanceValue: 70 } }),
			send
		});
		const existingClauses: Clause[] = [
			{
				id: 'c1',
				positionId: 'p1',
				issueId: 'iA',
				body: 'x',
				stanceValue: 30,
				origin: 'ai',
				confirmedByAuthor: false
			}
		];

		const created = await fillGap(
			{
				negotiationId: 'n1',
				positionId: 'p1',
				topic: 't',
				opinion: { heading: 'h', description: 'd' },
				issue,
				existingClauses
			},
			fetch
		);

		expect(created).toMatchObject({ issueId: 'iT', body: 'phase it', stanceValue: 70 });
		// mean of 30 (existing) and 70 (new) = 50
		const update = sendCalls.find((c) => c.queId === '42UpdatePosition');
		expect(update?.arg).toMatchObject({ id: 'p1', location: 50 });
	});
});

describe('requestSynthesis', () => {
	const issues: Issue[] = [{ id: 'i1', title: 'Budget', order: 0, origin: 'ai' }];
	const clauses: Clause[] = [
		{
			id: 'c1',
			positionId: 'p1',
			issueId: 'i1',
			body: 'spend more',
			stanceValue: 80,
			origin: 'ai',
			confirmedByAuthor: false
		}
	];

	it('returns null when unavailable', async () => {
		const { fetch } = makeFetch({ synthesize: () => ({ available: false }) });
		expect(await requestSynthesis({ topic: 't', issues, clauses }, fetch)).toBeNull();
	});

	it('returns null when the draft has no heading', async () => {
		const { fetch } = makeFetch({
			synthesize: () => ({ available: true, data: { heading: '', clauses: [] } })
		});
		expect(await requestSynthesis({ topic: 't', issues, clauses }, fetch)).toBeNull();
	});

	it('parses a draft and clamps clause stances', async () => {
		const { fetch } = makeFetch({
			synthesize: () => ({
				available: true,
				data: {
					heading: 'Compromise',
					description: 'desc',
					rationale: 'why',
					clauses: [{ issueId: 'i1', issueTitle: 'Budget', body: 'balance', stanceValue: -5 }]
				}
			})
		});
		const draft = await requestSynthesis({ topic: 't', issues, clauses }, fetch);
		expect(draft?.heading).toBe('Compromise');
		expect(draft?.clauses).toEqual([
			{ issueId: 'i1', issueTitle: 'Budget', body: 'balance', stanceValue: 0 }
		]);
	});
});

describe('persistSynthesis', () => {
	const draft: SynthesisDraft = {
		heading: 'Compromise',
		description: 'desc',
		rationale: 'why',
		clauses: [
			{ issueId: 'i1', issueTitle: 'Budget', body: 'balance', stanceValue: 40 },
			{ issueId: null, issueTitle: 'NewTopic', body: 'fresh', stanceValue: 60 }
		]
	};

	it('creates a position, attaches clauses, and derives its location', async () => {
		const existing: Issue[] = [{ id: 'i1', title: 'Budget', order: 0, origin: 'ai' }];
		const send = defaultSend(existing);
		const { fetch, sendCalls } = makeFetch({ send });

		const positionId = await persistSynthesis(
			{ negotiationId: 'n1', order: 4, draft, existingIssues: existing },
			fetch
		);

		expect(positionId).toBe('pos-1');
		// Existing issue reused, one new issue created for "NewTopic".
		expect(sendCalls.filter((c) => c.queId === 'CreateIssue')).toHaveLength(1);
		expect(sendCalls.filter((c) => c.queId === 'CreateClause')).toHaveLength(2);
		// mean of 40 and 60 = 50
		const update = sendCalls.find((c) => c.queId === '42UpdatePosition');
		expect(update?.arg).toMatchObject({ id: 'pos-1', location: 50 });
	});

	it('returns null when the position cannot be created', async () => {
		const { fetch } = makeFetch({
			send: (queId) => (queId === '41CreatePosition' ? {} : {})
		});
		const positionId = await persistSynthesis(
			{ negotiationId: 'n1', order: 4, draft, existingIssues: [] },
			fetch
		);
		expect(positionId).toBeNull();
	});
});
