import { describe, it, expect } from 'vitest';
import { authorizeSend } from './sendPolicy';
import type { AppUser } from '$lib/auth/permissions';

const registered: AppUser = {
	type: 'registered',
	id: '1',
	name: 'A',
	email: 'a@x.com',
	authenticated: true
};
const charter: AppUser = {
	type: 'charter',
	id: 'f1',
	name: 'B',
	email: 'b@x.com',
	authenticated: false
};
const guest: AppUser = { type: 'guest', id: null, name: null, email: null, authenticated: false };

describe('authorizeSend', () => {
	it('lets registered users run any operation with their own jwt', () => {
		expect(authorizeSend(registered, '40CreateNegotiation')).toEqual({
			allowed: true,
			useService: false
		});
		expect(authorizeSend(registered, 'some-future-op')).toEqual({
			allowed: true,
			useService: false
		});
	});

	it('lets charter users propose and vote via the service token, but not create discussions', () => {
		expect(authorizeSend(charter, '41CreatePosition')).toEqual({ allowed: true, useService: true });
		expect(authorizeSend(charter, '42UpdatePosition')).toEqual({ allowed: true, useService: true });
		expect(authorizeSend(charter, '39GetNegotiation')).toEqual({ allowed: true, useService: true });
		expect(authorizeSend(charter, '40CreateNegotiation')).toEqual({
			allowed: false,
			useService: true
		});
	});

	it('restricts guests to read-only operations', () => {
		expect(authorizeSend(guest, '39GetNegotiation')).toEqual({ allowed: true, useService: true });
		expect(authorizeSend(guest, 'ListLocalNegotiations')).toEqual({
			allowed: true,
			useService: true
		});
		expect(authorizeSend(guest, '41CreatePosition')).toEqual({ allowed: false, useService: true });
		expect(authorizeSend(guest, '40CreateNegotiation')).toEqual({
			allowed: false,
			useService: true
		});
	});
});
