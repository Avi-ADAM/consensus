import { browser } from '$app/environment';
import { setupI18n, waitLocale } from '$lib/i18n';
import type { LayoutLoad } from './$types';

let initialized = false;

export const load: LayoutLoad = async ({ data }) => {
	const locale = (data as { locale?: string }).locale ?? 'he';
	if (!initialized || browser) {
		setupI18n(locale);
		initialized = true;
	}
	await waitLocale();
	// Re-expose the server layout data (user, locale): when both +layout.server.ts
	// and +layout.ts exist, only what this universal load returns reaches the pages.
	return { ...data };
};
