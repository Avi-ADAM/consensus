import { describe, expect, it, vi } from 'vitest';
import { placeIdsFromAccount, placeIdsFromCookie, resolveMyPlaceIds } from './myPlaces';
import type { AppUser } from '$lib/auth/permissions';

const registered: AppUser = {
	type: 'registered',
	id: '42',
	name: 'Dana',
	email: 'dana@example.com',
	authenticated: true
};

describe('placeIdsFromCookie', () => {
	it('keeps numeric ids only', () => {
		expect(placeIdsFromCookie('3, 12,,abc,7')).toEqual(['3', '12', '7']);
		expect(placeIdsFromCookie(undefined)).toEqual([]);
	});
});

describe('placeIdsFromAccount', () => {
	it('reads the account countries and the signed chezin countries', () => {
		const body = {
			data: {
				usersPermissionsUser: {
					data: {
						attributes: {
							cuntries: { data: [{ id: 1 }] },
							chezin: { data: { attributes: { countries: { data: [{ id: 2 }, { id: 1 }] } } } }
						}
					}
				}
			}
		};
		expect(placeIdsFromAccount(body)).toEqual(['1', '2', '1']);
	});

	it('tolerates an error response', () => {
		expect(placeIdsFromAccount({ errors: [{ message: 'nope' }] })).toEqual([]);
	});
});

describe('resolveMyPlaceIds', () => {
	it('puts account places first and dedupes cookie ids', async () => {
		const fetch = vi.fn(async () =>
			Response.json({
				data: {
					usersPermissionsUser: { data: { attributes: { cuntries: { data: [{ id: 5 }] } } } }
				}
			})
		);
		const ids = await resolveMyPlaceIds({
			user: registered,
			cookieHeader: 'jwt=x',
			cookieIds: ['9', '5'],
			mainAppUrl: 'https://api.1lev1.com/',
			fetch
		});
		expect(ids).toEqual(['5', '9']);
		expect(fetch).toHaveBeenCalledWith('https://api.1lev1.com/api/send', expect.anything());
	});

	it('falls back to the cookie when the main server fails', async () => {
		const fetch = vi.fn(async () => new Response('Unknown queId', { status: 400 }));
		const ids = await resolveMyPlaceIds({
			user: registered,
			cookieHeader: '',
			cookieIds: ['4'],
			mainAppUrl: 'https://api.1lev1.com',
			fetch
		});
		expect(ids).toEqual(['4']);
	});

	it('does not call the main server for a charter signatory', async () => {
		const fetch = vi.fn();
		const ids = await resolveMyPlaceIds({
			user: { ...registered, type: 'charter', authenticated: false },
			cookieHeader: '',
			cookieIds: ['8'],
			mainAppUrl: 'https://api.1lev1.com',
			fetch
		});
		expect(ids).toEqual(['8']);
		expect(fetch).not.toHaveBeenCalled();
	});
});
