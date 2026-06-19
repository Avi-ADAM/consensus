import type { LayoutServerLoad } from './$types';

const SUPPORTED = ['he', 'en', 'ar'];

export const load: LayoutServerLoad = ({ locals, cookies }) => {
	const cookieLocale = cookies.get('locale');
	const locale = cookieLocale && SUPPORTED.includes(cookieLocale) ? cookieLocale : 'he';
	return { user: locals.user, locale };
};
