import { describe, it, expect } from 'vitest';
import {
	colorFor,
	consensusScore,
	insertLocation,
	sortByLocation,
	toDisplay,
	weightedCenter,
	type Opinion
} from './scale';

function op(id: string, location: number, votes = 0): Opinion {
	return {
		id,
		heading: id,
		description: '',
		location,
		votes,
		color: 'violet',
		isAnchor: false,
		pole: 'none',
		kind: 'opinion'
	};
}

describe('colorFor', () => {
	it('cycles the palette and handles negatives', () => {
		expect(colorFor(0)).toBe('violet');
		expect(colorFor(9)).toBe('violet');
		expect(colorFor(-1)).toBe('lime');
	});
});

describe('insertLocation', () => {
	const anchors = [op('top', 0), op('bottom', 100)];

	it('places beyond the extremes', () => {
		expect(insertLocation(anchors, { mode: 'beyond_top' })).toBe(-10);
		expect(insertLocation(anchors, { mode: 'beyond_bottom' })).toBe(110);
	});

	it('places between two opinions at an arbitrary fraction, not only the midpoint', () => {
		expect(insertLocation(anchors, { mode: 'between', afterId: 'top', beforeId: 'bottom' })).toBe(
			50
		);
		expect(
			insertLocation(anchors, {
				mode: 'between',
				afterId: 'top',
				beforeId: 'bottom',
				fraction: 0.2
			})
		).toBe(20);
	});

	it('clamps the fraction so it never lands exactly on a neighbor', () => {
		expect(
			insertLocation(anchors, { mode: 'between', afterId: 'top', beforeId: 'bottom', fraction: 0 })
		).toBe(5);
		expect(
			insertLocation(anchors, { mode: 'between', afterId: 'top', beforeId: 'bottom', fraction: 1 })
		).toBe(95);
	});
});

describe('toDisplay', () => {
	it('centers a single opinion', () => {
		expect(toDisplay([op('a', 42)])).toEqual([{ id: 'a', display: 50 }]);
	});

	it('maps extremes to the padded ends and keeps order', () => {
		const points = toDisplay([op('b', 100), op('a', 0)], 8);
		expect(points).toEqual([
			{ id: 'a', display: 8 },
			{ id: 'b', display: 92 }
		]);
	});
});

describe('weightedCenter', () => {
	it('pulls toward the more supported side', () => {
		const center = weightedCenter([op('a', 0, 0), op('b', 100, 9)]);
		expect(center).toBeGreaterThan(50);
	});
});

describe('consensusScore', () => {
	it('is higher when opinions cluster', () => {
		const spread = consensusScore([op('a', 0), op('b', 100)]);
		const tight = consensusScore([op('a', 45), op('b', 55)]);
		expect(tight).toBeGreaterThan(spread);
	});

	it('returns 0 for fewer than two opinions', () => {
		expect(consensusScore([op('a', 50)])).toBe(0);
	});
});

describe('sortByLocation', () => {
	it('does not mutate the input', () => {
		const input = [op('b', 100), op('a', 0)];
		const sorted = sortByLocation(input);
		expect(sorted[0].id).toBe('a');
		expect(input[0].id).toBe('b');
	});
});
