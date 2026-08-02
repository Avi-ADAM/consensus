import type { Handle } from '@sveltejs/kit';
import { resolveUser } from '$lib/server/auth';

const RTL_LOCALES = new Set(['he', 'ar']);
const SUPPORTED_LOCALES = new Set(['he', 'en', 'ar']);
const DEFAULT_LOCALE = 'he';

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.user = resolveUser(event.cookies);

	const cookieLocale = event.cookies.get('locale');
	const locale =
		cookieLocale && SUPPORTED_LOCALES.has(cookieLocale) ? cookieLocale : DEFAULT_LOCALE;

	// The document is Hebrew-first and mostly RTL. Stamping lang/dir on the
	// server keeps the first paint in the right direction and tells crawlers and
	// screen readers which language the page is in.
	return resolve(event, {
		transformPageChunk: ({ html }) =>
			html
				.replace('%consensus.lang%', locale)
				.replace('%consensus.dir%', RTL_LOCALES.has(locale) ? 'rtl' : 'ltr')
	});
};
