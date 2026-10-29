import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { LoadedDiscussion } from './api';
import { buildBridgeSeed, type BridgePayload } from './bridge';
import { colorFor, type Clause, type Issue, type Opinion } from './scale';

const api = vi.hoisted(() => ({
	listIssues: vi.fn(),
	listClauses: vi.fn(),
	createIssue: vi.fn(),
	createClause: vi.fn(),
	updatePositionLocation: vi.fn()
}));
vi.mock('./api', () => api);

const { seedBridgeTerms, seedPositionsOf, payloadFromDiscussion } = await import('./bridgeSeed');

const payload: BridgePayload = {
	v: 1,
	sourceType: 'pmash',
	sourceId: '100',
	title: 'מקרן',
	fields: [
		{ key: 'price', label: 'שווי', kind: 'number', original: 2000, proposed: 1500 },
		{ key: 'hm', label: 'כמות', kind: 'number', original: 1, proposed: 1 }
	]
};
const positions = { original: 'p1', proposed: 'p2' };

function opinion(id: string, selfPlacement?: number): Opinion {
	return {
		id,
		heading: id,
		description: '',
		location: 50,
		votes: 0,
		color: colorFor(0),
		isAnchor: false,
		pole: 'none',
		kind: 'opinion',
		selfPlacement
	};
}

function discussion(opinions: Opinion[], meta: Partial<LoadedDiscussion['meta']> = {}) {
	return {
		meta: {
			id: '5',
			topic: '',
			description: '',
			visibility: 'private',
			shareToken: '',
			isLocal: false,
			maxRounds: 3,
			currentRound: 1,
			places: [],
			...meta
		},
		opinions
	} as LoadedDiscussion;
}

function clause(positionId: string, issueId: string, stanceValue: number): Clause {
	return {
		id: `${positionId}-${issueId}`,
		positionId,
		issueId,
		body: '',
		stanceValue,
		origin: 'human',
		confirmedByAuthor: false
	};
}

describe('seedBridgeTerms', () => {
	beforeEach(() => {
		vi.resetAllMocks();
		let next = 0;
		api.createIssue.mockImplementation(async () => `i${++next}`);
		api.createClause.mockImplementation(async () => 'c');
		api.updatePositionLocation.mockResolvedValue(undefined);
	});

	it('seeds every issue and clause on an empty discussion', async () => {
		api.listIssues.mockResolvedValue([]);
		api.listClauses.mockResolvedValue([]);

		const { failed } = await seedBridgeTerms('5', positions, buildBridgeSeed(payload));

		expect(failed).toBe(0);
		expect(api.createIssue).toHaveBeenCalledTimes(2);
		expect(api.createClause).toHaveBeenCalledTimes(4);
	});

	it('creates only what is missing', async () => {
		const issues: Issue[] = [{ id: 'i9', title: 'שווי', order: 0, origin: 'human' }];
		api.listIssues.mockResolvedValue(issues);
		api.listClauses.mockResolvedValue([clause('p1', 'i9', 0)]);

		await seedBridgeTerms('5', positions, buildBridgeSeed(payload));

		expect(api.createIssue).toHaveBeenCalledTimes(1);
		expect(api.createIssue.mock.calls[0][0].title).toBe('כמות');
		// p2/שווי, p1/כמות, p2/כמות — the existing p1/שווי clause is skipped.
		expect(api.createClause).toHaveBeenCalledTimes(3);
		expect(api.createClause.mock.calls.map((c) => c[0].issueId)).toEqual(['i9', 'i1', 'i1']);
	});

	it('counts failed writes instead of swallowing them', async () => {
		api.listIssues.mockResolvedValue([]);
		api.listClauses.mockResolvedValue([]);
		api.createIssue.mockResolvedValue(null);
		api.createClause.mockRejectedValue(new Error('Forbidden'));

		const { failed } = await seedBridgeTerms('5', positions, buildBridgeSeed(payload));

		expect(failed).toBe(6);
	});

	it('re-derives each side’s location from its clauses', async () => {
		api.listIssues.mockResolvedValue([]);
		api.listClauses
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([
				clause('p1', 'i1', 0),
				clause('p1', 'i2', 50),
				clause('p2', 'i1', 100)
			]);

		await seedBridgeTerms('5', positions, buildBridgeSeed(payload));

		expect(api.updatePositionLocation.mock.calls.map((c) => [c[0], c[1]])).toEqual([
			['p1', 25],
			['p2', 100]
		]);
	});
});

describe('seedPositionsOf', () => {
	it('tells the seed positions apart by their stance', () => {
		const d = discussion([opinion('b', 100), opinion('x'), opinion('a', 0)]);
		expect(seedPositionsOf(d)).toEqual({ original: 'a', proposed: 'b' });
	});

	it('is null when a side is missing', () => {
		expect(seedPositionsOf(discussion([opinion('a', 0)]))).toBeNull();
	});
});

describe('payloadFromDiscussion', () => {
	it('prefers the terms stored on the discussion', () => {
		const stored = [{ ...payload.fields[0], proposed: 1800 }];
		const d = discussion([], {
			sourceType: 'pmash',
			sourceId: '100',
			sourceMeta: { v: 1, title: 'מקרן', fields: stored }
		});
		expect(payloadFromDiscussion(d, payload).fields).toEqual(stored);
	});

	it('falls back to the link payload without stored terms', () => {
		expect(payloadFromDiscussion(discussion([]), payload)).toBe(payload);
	});
});
