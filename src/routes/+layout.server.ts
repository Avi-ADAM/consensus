import type { LayoutServerLoad } from './$types';

const SUPPORTED = ['he', 'en', 'ar', 'ru'];

export const load: LayoutServerLoad = ({ locals, cookies, url }) => {
	// hooks.server.ts stores ?lang= in the cookie; reading the URL as well makes
	// this load rerun, and pick the new language, when a ?lang= link is followed.
	const pick = (l: string | null | undefined) => (l && SUPPORTED.includes(l) ? l : undefined);
	const locale = pick(url.searchParams.get('lang')) ?? pick(cookies.get('locale')) ?? 'he';
	return { user: locals.user, locale };
};
