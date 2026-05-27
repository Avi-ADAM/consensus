import type { PageLoad } from './$types';
import { loadDiscussion } from '$lib/discussion/api';

export const load: PageLoad = async ({ params, fetch }) => {
	try {
		const loaded = await loadDiscussion(params.id, fetch);
		return { id: params.id, loaded };
	} catch {
		return { id: params.id, loaded: null };
	}
};
