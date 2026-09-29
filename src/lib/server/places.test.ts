import { describe, expect, it, vi } from 'vitest';
import { listPlaces, placesFromResponse } from './places';

const response = {
	data: {
		cuntries: {
			data: [
				{ id: 1, attributes: { name: 'Israel' } },
				{ id: '2', attributes: { name: 'Jordan' } }
			]
		}
	}
};

describe('placesFromResponse', () => {
	it('maps countries to places', () => {
		expect(placesFromResponse(response)).toEqual([
			{ id: '1', name: 'Israel' },
			{ id: '2', name: 'Jordan' }
		]);
	});

	it('tolerates an error response', () => {
		expect(placesFromResponse({ errors: [{ message: 'nope' }] })).toEqual([]);
	});
});

describe('listPlaces', () => {
	it('asks the main app for ListPlaces on the service path', async () => {
		const fetch = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => Response.json(response));
		const places = await listPlaces({ mainAppUrl: 'https://api.1lev1.com/', secret: 's3', fetch });

		expect(places).toHaveLength(2);
		expect(fetch).toHaveBeenCalledWith('https://api.1lev1.com/api/send', expect.anything());
		const init = fetch.mock.calls[0][1]!;
		expect((init.headers as Record<string, string>)['x-consensus-secret']).toBe('s3');
		expect(JSON.parse(init.body as string)).toEqual({
			isSer: true,
			data: { queId: 'ListPlaces', arg: {} }
		});
	});

	it('returns an empty list when the main app fails', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const fetch = vi.fn(async () => new Response('Unauthorized', { status: 401 }));
		expect(await listPlaces({ mainAppUrl: 'https://api.1lev1.com', secret: 's3', fetch })).toEqual([]);
	});

	it('does not call anything without a main app URL', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const fetch = vi.fn();
		expect(await listPlaces({ mainAppUrl: undefined, secret: 's3', fetch })).toEqual([]);
		expect(fetch).not.toHaveBeenCalled();
	});
});
