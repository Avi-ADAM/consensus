import { browser } from '$app/environment';
import { setupI18n, waitLocale, SUPPORTED_LOCALES, type Locale } from '$lib/i18n';
import type { LayoutLoad } from './$types';

let initialized = false;

export const load: LayoutLoad = async ({ data, url }) => {
	const locale = (data as { locale?: string }).locale ?? 'he';
	// setupI18n prefers the locale saved in the browser, so a ?lang= link has
	// to overwrite that saved choice or a returning visitor would not see it.
	const urlLocale = url.searchParams.get('lang');
	if (browser && urlLocale && SUPPORTED_LOCALES.includes(urlLocale as Locale)) {
		try {
			localStorage.setItem('locale', urlLocale);
		} catch {
			// Storage can be blocked (private mode); the cookie still carries it.
		}
	}
	if (!initialized || browser) {
		setupI18n(locale);
		initialized = true;
	}
	await waitLocale();
	// Re-expose the server layout data (user, locale): when both +layout.server.ts
	// and +layout.ts exist, only what this universal load returns reaches the pages.
	return { ...data };
};
