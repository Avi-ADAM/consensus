import type { AppUser } from '$lib/auth/permissions';

export interface SendDecision {
	allowed: boolean;
	/**
	 * When true, the proxy forwards with `isSer: true` so the main server
	 * authenticates with its service token. Required for charter/guest users
	 * who have no `jwt`. MUST stay bounded by the allow-lists below.
	 */
	useService: boolean;
}

/**
 * Operations a guest (share-link visitor, no account, no charter) may trigger.
 * Read-only. Kept deliberately tiny since these run with the service token.
 */
const GUEST_ALLOWED: ReadonlySet<string> = new Set(['39GetNegotiation']);

/**
 * Operations a charter (agreement) user may trigger, on top of guest reads:
 * propose a solution (create position) and support/vote (update position).
 * Notably excludes 40CreateNegotiation — charter users cannot create discussions.
 */
const CHARTER_ALLOWED: ReadonlySet<string> = new Set([
	...GUEST_ALLOWED,
	'41CreatePosition',
	'42UpdatePosition'
]);

/**
 * Decide whether a visitor may run `queId`, and whether the proxy must use the
 * service token to do so.
 *
 * Registered users carry a real `jwt`; we forward it untouched and let Strapi's
 * own permissions decide — so there is no allow-list for them. Charter and guest
 * users have no `jwt`, so any allowed call rides the service token, which is why
 * their operations are strictly enumerated.
 */
export function authorizeSend(user: AppUser, queId: string): SendDecision {
	switch (user.type) {
		case 'registered':
			return { allowed: true, useService: false };
		case 'charter':
			return { allowed: CHARTER_ALLOWED.has(queId), useService: true };
		default:
			return { allowed: GUEST_ALLOWED.has(queId), useService: true };
	}
}
