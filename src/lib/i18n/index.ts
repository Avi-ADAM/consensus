import { he, type MessageKey } from './locales/he';

export type { MessageKey };

const locales = { he } as const;
export type Locale = keyof typeof locales;

export const DEFAULT_LOCALE: Locale = 'he';

type Params = Record<string, string | number>;

function interpolate(template: string, params?: Params): string {
	if (!params) return template;
	return template.replace(/\{(\w+)\}/g, (match, key) =>
		key in params ? String(params[key]) : match
	);
}

/**
 * Translate a message key for the given locale, with `{token}` interpolation.
 * Falls back to the default locale, then to the key itself, so a missing
 * translation degrades visibly rather than throwing.
 */
export function t(key: MessageKey, params?: Params, locale: Locale = DEFAULT_LOCALE): string {
	const catalog = locales[locale] ?? locales[DEFAULT_LOCALE];
	const template = catalog[key] ?? locales[DEFAULT_LOCALE][key] ?? key;
	return interpolate(template, params);
}
