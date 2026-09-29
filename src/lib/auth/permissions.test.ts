import { describe, expect, it } from 'vitest';
import { isAuthor, type AppUser } from './permissions';

const registered: AppUser = {
	type: 'registered',
	id: '42',
	name: 'Dana',
	email: 'Dana@Example.com',
	authenticated: true
};
const charter: AppUser = {
	type: 'charter',
	id: '7',
	name: 'Omar',
	email: 'omar@example.com',
	authenticated: false
};
const guest: AppUser = { type: 'guest', id: null, name: null, email: null, authenticated: false };

describe('isAuthor', () => {
	it('matches the stamped external id', () => {
		expect(isAuthor({ authorExternalId: '42' }, registered)).toBe(true);
		expect(isAuthor({ authorExternalId: '7' }, charter)).toBe(true);
	});

	it('matches an author relation set by hand in Strapi', () => {
		expect(isAuthor({ authorUserId: '42' }, registered)).toBe(true);
	});

	it('falls back to the relation email, case-insensitively', () => {
		expect(isAuthor({ authorUserEmail: 'dana@example.com ' }, registered)).toBe(true);
	});

	it('does not trust the relation for charter signatories', () => {
		// A signature id and a user id are different number spaces.
		expect(isAuthor({ authorUserId: '7' }, charter)).toBe(false);
		expect(isAuthor({ authorUserEmail: 'omar@example.com' }, charter)).toBe(false);
	});

	it('rejects other authors and guests', () => {
		expect(isAuthor({ authorExternalId: '43', authorUserId: '43' }, registered)).toBe(false);
		expect(isAuthor({ authorExternalId: '42' }, guest)).toBe(false);
		expect(isAuthor(null, registered)).toBe(false);
	});
});
