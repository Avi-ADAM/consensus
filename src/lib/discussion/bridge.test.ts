import { describe, it, expect } from 'vitest';
import {
	agreementFromPosition,
	buildBridgeSeed,
	buildReturnUrl,
	defaultAgreementPosition,
	encodeBridgePayload,
	fieldChanged,
	parseBridgePayload,
	stanceToValue,
	ORIGINAL_STANCE,
	PROPOSED_STANCE,
	type BridgeField,
	type BridgePayload,
	type SourceMeta
} from './bridge';
import { colorFor, type Clause, type Issue, type Opinion } from './scale';

const priceField: BridgeField = {
	key: 'price',
	label: 'שווי',
	kind: 'number',
	original: 100,
	proposed: 60
};

const dateField: BridgeField = {
	key: 'sqadualed',
	label: 'תאריך התחלה',
	kind: 'date',
	original: '2026-01-01',
	proposed: '2026-01-31'
};

const textField: BridgeField = {
	key: 'descrip',
	label: 'תיאור',
	kind: 'text',
	original: 'ניסוח ישן',
	proposed: 'ניסוח חדש'
};

const agreedField: BridgeField = {
	key: 'hm',
	label: 'כמות',
	kind: 'number',
	original: 5,
	proposed: 5
};

function payload(fields: BridgeField[] = [priceField, textField]): BridgePayload {
	return {
		v: 1,
		sourceType: 'pmash',
		sourceId: '42',
		title: 'מקרן להשאלה',
		projectName: 'הקואופ',
		returnUrl: 'https://www.1lev1.com/pmash/42',
		fields
	};
}

describe('bridge payload encode/parse', () => {
	it('round-trips through base64url', () => {
		const parsed = parseBridgePayload(encodeBridgePayload(payload()));
		expect(parsed).not.toBeNull();
		expect(parsed?.sourceType).toBe('pmash');
		expect(parsed?.sourceId).toBe('42');
		expect(parsed?.title).toBe('מקרן להשאלה');
		expect(parsed?.returnUrl).toBe('https://www.1lev1.com/pmash/42');
		expect(parsed?.fields).toHaveLength(2);
		expect(parsed?.fields[0]).toMatchObject({ key: 'price', kind: 'number', original: 100 });
	});

	it('rejects garbage, wrong versions and empty field lists', () => {
		expect(parseBridgePayload('not-base64!!!')).toBeNull();
		expect(parseBridgePayload(encodeBridgePayload({ ...payload(), v: 2 } as never))).toBeNull();
		expect(parseBridgePayload(encodeBridgePayload({ ...payload(), fields: [] }))).toBeNull();
		expect(parseBridgePayload(encodeBridgePayload({ ...payload(), title: '' }))).toBeNull();
	});

	it('drops malformed fields and non-https return URLs', () => {
		const dirty = {
			...payload(),
			returnUrl: 'javascript:alert(1)',
			fields: [priceField, { key: '', label: 'x', kind: 'number' }, { nonsense: true }]
		};
		const parsed = parseBridgePayload(encodeBridgePayload(dirty as never));
		expect(parsed?.fields).toHaveLength(1);
		expect(parsed?.returnUrl).toBeUndefined();
	});

	it('truncates oversized text values', () => {
		const long = { ...textField, proposed: 'א'.repeat(5000) };
		const parsed = parseBridgePayload(encodeBridgePayload(payload([long])));
		expect(String(parsed?.fields[0].proposed).length).toBe(1200);
	});
});

describe('buildBridgeSeed', () => {
	it('seeds one issue per term and a clause per side at the poles', () => {
		const seed = buildBridgeSeed(payload([priceField, textField]));
		expect(seed.issueTitles).toEqual(['שווי', 'תיאור']);
		expect(seed.clauses).toHaveLength(4);
		const price = seed.clauses.filter((c) => c.issueTitle === 'שווי');
		expect(price.find((c) => c.side === 'original')?.stanceValue).toBe(ORIGINAL_STANCE);
		expect(price.find((c) => c.side === 'proposed')?.stanceValue).toBe(PROPOSED_STANCE);
	});

	it('centers clauses for terms both sides already agree on', () => {
		expect(fieldChanged(agreedField)).toBe(false);
		const seed = buildBridgeSeed(payload([agreedField]));
		expect(seed.clauses.map((c) => c.stanceValue)).toEqual([50, 50]);
	});

	it('keeps the source snapshot in sourceMeta for the way back', () => {
		const seed = buildBridgeSeed(payload());
		expect(seed.sourceMeta.returnUrl).toBe('https://www.1lev1.com/pmash/42');
		expect(seed.sourceMeta.fields).toHaveLength(2);
	});
});

describe('stanceToValue', () => {
	it('interpolates numbers between original (0) and proposed (100)', () => {
		expect(stanceToValue(priceField, 0)).toBe(100);
		expect(stanceToValue(priceField, 100)).toBe(60);
		expect(stanceToValue(priceField, 50)).toBe(80);
	});

	it('interpolates dates by timestamp', () => {
		expect(stanceToValue(dateField, 50)).toBe('2026-01-16');
		expect(stanceToValue(dateField, 0)).toBe('2026-01-01');
	});

	it('falls back to the closer wording for text', () => {
		expect(stanceToValue(textField, 30)).toBe('ניסוח ישן');
		expect(stanceToValue(textField, 70)).toBe('ניסוח חדש');
	});
});

describe('agreementFromPosition + return URL', () => {
	const meta: SourceMeta = {
		v: 1,
		title: 'מקרן להשאלה',
		returnUrl: 'https://www.1lev1.com/pmash/42',
		fields: [priceField, textField]
	};
	const issues: Issue[] = [
		{ id: 'i1', title: 'שווי', order: 0, origin: 'human' },
		{ id: 'i2', title: 'תיאור', order: 1, origin: 'human' }
	];
	const clauses: Clause[] = [
		{
			id: 'c1',
			positionId: 'synth',
			issueId: 'i1',
			body: 'שווי: 75',
			stanceValue: 62.5,
			origin: 'ai',
			confirmedByAuthor: false
		},
		{
			id: 'c2',
			positionId: 'synth',
			issueId: 'i2',
			body: 'ניסוח מאוזן שמשלב את שתי הגרסאות',
			stanceValue: 50,
			origin: 'ai',
			confirmedByAuthor: false
		}
	];

	it('maps stances to concrete values per term', () => {
		const terms = agreementFromPosition(meta, issues, clauses, 'synth');
		expect(terms[0]).toMatchObject({ key: 'price', value: 75 });
		expect(terms[1]).toMatchObject({ key: 'descrip', value: 'ניסוח מאוזן שמשלב את שתי הגרסאות' });
	});

	it('returns null values for terms the position never addressed', () => {
		const terms = agreementFromPosition(meta, issues, [clauses[0]], 'synth');
		expect(terms[1].value).toBeNull();
	});

	it('packs agreed values into the negoBridge return param', () => {
		const terms = agreementFromPosition(meta, issues, clauses, 'synth');
		const url = buildReturnUrl(meta, '42', terms);
		expect(url).not.toBeNull();
		const param = new URL(url as string).searchParams.get('negoBridge');
		expect(param).toBeTruthy();
		const decoded = JSON.parse(
			Buffer.from((param as string).replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString(
				'utf8'
			)
		);
		expect(decoded).toMatchObject({ v: 1, sourceId: '42', values: { price: 75 } });
	});
});

describe('defaultAgreementPosition', () => {
	it('prefers the latest proposed solution', () => {
		const mk = (id: string, kind: Opinion['kind']): Opinion => ({
			id,
			heading: id,
			description: '',
			location: 50,
			votes: 0,
			color: colorFor(0),
			isAnchor: false,
			pole: 'none',
			kind
		});
		const opinions = [
			mk('a', 'opinion'),
			mk('s1', 'proposed_solution'),
			mk('s2', 'proposed_solution')
		];
		expect(defaultAgreementPosition(opinions)?.id).toBe('s2');
		expect(defaultAgreementPosition([mk('a', 'opinion')])).toBeNull();
	});
});
