import { page } from 'vitest/browser';
import { beforeAll, describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { setupI18n, waitLocale } from '$lib/i18n';
import Page from './+page.svelte';

describe('/+page.svelte', () => {
	// The page calls $_ at render time. In the app +layout.ts does the setup;
	// rendering the page on its own has to do it here, or svelte-i18n throws
	// "Cannot format a message without first setting the initial locale".
	beforeAll(async () => {
		setupI18n('he');
		await waitLocale();
	});

	it('should render h1', async () => {
		render(Page);

		const heading = page.getByRole('heading', { level: 1 });
		await expect.element(heading).toBeInTheDocument();
	});
});
