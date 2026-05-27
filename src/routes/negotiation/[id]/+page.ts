import type { PageLoad } from './$types';
import { loadDiscussion, loadDiscussionByToken } from '$lib/discussion/api';

export const load: PageLoad = async ({ params, url, fetch }) => {
	const token = url.searchParams.get('token');
	try {
		const loaded = token
			? await loadDiscussionByToken(token, fetch)
			: await loadDiscussion(params.id, fetch);
		return { id: params.id, loaded };
	} catch {
		return { id: params.id, loaded: null };
	}
};
