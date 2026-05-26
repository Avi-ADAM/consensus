import type { Cookies } from '@sveltejs/kit';
import type { AppUser } from '$lib/auth/permissions';

/**
 * Resolve the current visitor from the 1lev1 SSO cookies (scoped to `.1lev1.com`).
 *
 * - Registered (www.1lev1.com login): sets `jwt` (httpOnly) + `id` + `un` + `email`.
 * - Charter (agreement.1lev1.com -> /hascama referral): sets `fpval` (id) + `un` + `email`, no `jwt`.
 */
export function resolveUser(cookies: Cookies): AppUser {
	const jwt = cookies.get('jwt');
	const id = cookies.get('id');
	const fpval = cookies.get('fpval');
	const un = cookies.get('un') ?? null;
	const email = cookies.get('email') ?? null;

	if (jwt && id) {
		return { type: 'registered', id, name: un, email, authenticated: true };
	}

	if (fpval && (email || un)) {
		return { type: 'charter', id: fpval, name: un, email, authenticated: false };
	}

	return { type: 'guest', id: null, name: null, email: null, authenticated: false };
}
