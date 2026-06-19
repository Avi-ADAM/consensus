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
	return {};
};
