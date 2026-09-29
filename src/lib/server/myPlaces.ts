import type { AppUser } from '$lib/auth/permissions';

type FetchLike = typeof globalThis.fetch;

/**
 * Country ids from a comma-separated cookie value.
 *
 * The agreement flow leaves the signer's countries behind as `country`
 * (www.1lev1.com /api/chezin, shared on .1lev1.com) and, on the older
 * referral path, as `contriesi`.
 */
export function placeIdsFromCookie(value: string | undefined | null): string[] {
	if (!value) return [];
	return value
		.split(',')
		.map((v) => v.trim())
		.filter((v) => /^\d+$/.test(v));
}

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Pull the country ids out of a `ConsensusMyPlaces` response: the countries
 * on the account itself and the ones picked when signing the agreement (the
 * account's chezin).
 */
export function placeIdsFromAccount(body: any): string[] {
	const user = body?.data?.usersPermissionsUser?.data?.attributes;
	if (!user) return [];
	const own = user.cuntries?.data ?? [];
	const signed = user.chezin?.data?.attributes?.countries?.data ?? [];
	return [...own, ...signed].map((c: any) => String(c?.id ?? '')).filter(Boolean);
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * The places a visitor belongs to, most authoritative first, without
 * duplicates. Never throws: an unreachable main server just means the
 * cookie-derived ids.
 */
export async function resolveMyPlaceIds(opts: {
	user: AppUser;
	cookieHeader: string;
	cookieIds: string[];
	mainAppUrl: string | undefined;
	fetch: FetchLike;
}): Promise<string[]> {
	const { user, cookieHeader, cookieIds, mainAppUrl, fetch } = opts;
	const ids: string[] = [];

	// A registered visitor's own account says where they are. The query runs
	// on their session (the main server pins `uid` to the caller), so it needs
	// neither the service token nor any trust in the id sent here.
	if (user.type === 'registered' && user.id && mainAppUrl) {
		try {
			const res = await fetch(`${mainAppUrl.replace(/\/$/, '')}/api/send`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', cookie: cookieHeader },
				body: JSON.stringify({ data: { queId: 'ConsensusMyPlaces', arg: { uid: user.id } } }),
				signal: AbortSignal.timeout(8_000)
			});
			if (res.ok) ids.push(...placeIdsFromAccount(await res.json()));
		} catch (e) {
			console.error('[my-places] account lookup failed:', e);
		}
	}

	ids.push(...cookieIds);
	return [...new Set(ids)];
}
