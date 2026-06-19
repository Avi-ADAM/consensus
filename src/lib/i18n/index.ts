import { browser } from '$app/environment';
import { init, register, _, locale, waitLocale } from 'svelte-i18n';
import { get } from 'svelte/store';

export type Locale = 'he' | 'en' | 'ar';
export const RTL_LOCALES: Locale[] = ['he', 'ar'];
export const SUPPORTED_LOCALES: Locale[] = ['he', 'en', 'ar'];
export const DEFAULT_LOCALE: Locale = 'he';

register('he', () => import('./locales/he.json'));
register('en', () => import('./locales/en.json'));
register('ar', () => import('./locales/ar.json'));

export function setupI18n(initialLocale: string = DEFAULT_LOCALE) {
	const safeLocale = SUPPORTED_LOCALES.includes(initialLocale as Locale)
		? initialLocale
		: DEFAULT_LOCALE;

	init({
		fallbackLocale: DEFAULT_LOCALE,
		initialLocale: browser
			? (localStorage.getItem('locale') ?? safeLocale)
			: safeLocale
	});
}

export function setLocale(newLocale: Locale) {
	locale.set(newLocale);
	if (browser) localStorage.setItem('locale', newLocale);
	// Persist to cookie for SSR on next request
	if (browser) document.cookie = `locale=${newLocale};path=/;max-age=31536000`;
}

export function isRTL(loc?: string): boolean {
	const l = (loc ?? get(locale)) as Locale;
	return RTL_LOCALES.includes(l);
}

/** Synchronous translate — for use in event handlers & non-reactive script code. */
export function t(key: string, values?: Record<string, string | number>): string {
	return get(_)(key, { values });
}

export { locale, waitLocale, _ };
