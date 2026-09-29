/**
 * The three sites of the 1💗1 network and the hand-offs between them.
 *
 * - agreement.1lev1.com — signing the agreement (consent, no coercion). That
 *   signature is the minimum this site asks of a participant.
 * - www.1lev1.com — full accounts (login / signup / logout). The same app
 *   also runs as api.1lev1.com, next to Strapi: the API gateway every site's
 *   server talks to (MAIN_APP_URL).
 * - consensus.1lev1.com — this site.
 *
 * Each hand-off carries the page to come back to, so a visitor who leaves to
 * sign or log in lands on the discussion they left, not on another site's home.
 */
export const MAIN_SITE = 'https://www.1lev1.com';
export const AGREEMENT_SITE = 'https://agreement.1lev1.com';
export const CONSENSUS_SITE = 'https://consensus.1lev1.com';

/** Log in at the main site, then come back to `returnTo`. */
export function loginHref(returnTo: string): string {
	return `${MAIN_SITE}/login?from=${encodeURIComponent(returnTo)}`;
}

/** Sign the agreement, then come back to `returnTo`. */
export function agreementHref(returnTo: string, locale?: string | null): string {
	const params = new URLSearchParams({ return: returnTo });
	if (locale) params.set('lang', locale);
	return `${AGREEMENT_SITE}/hascama?${params}`;
}

/**
 * Turn an agreement signature into a full account. /signup reads the
 * signature (`fpval`, shared on .1lev1.com) and sends a visitor without one
 * back to the agreement first.
 */
export function upgradeHref(): string {
	return `${MAIN_SITE}/signup`;
}

/** Sign out on the main site (the session cookies live there), then come back. */
export function logoutHref(returnTo: string): string {
	return `${MAIN_SITE}/logout?to=${encodeURIComponent(returnTo)}`;
}
