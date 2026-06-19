<script lang="ts">
	import './layout.css';
	import { locale, setLocale, isRTL, type Locale, SUPPORTED_LOCALES } from '$lib/i18n';
	import { _ } from 'svelte-i18n';

	let { children } = $props();

	const langLabels: Record<Locale, string> = { he: 'עברית', ar: 'العربية', en: 'English' };

	let dir = $derived<'rtl' | 'ltr'>(isRTL($locale ?? undefined) ? 'rtl' : 'ltr');
	// isRTL accepts string | undefined, $locale can be null so we coerce
	let lang = $derived($locale ?? 'he');
</script>

<svelte:head>
	<link rel="icon" type="image/png" href="/logo.png" />
	<link rel="shortcut icon" href="/logo.png" />
	<link rel="apple-touch-icon" href="/logo.png" />
</svelte:head>

<div {lang} {dir} style="min-height:100vh">
	{@render children()}
</div>

<!-- Floating language switcher -->
<div class="lang-switcher" dir="ltr">
	{#each SUPPORTED_LOCALES as loc}
		<button
			class="lang-btn"
			class:active={$locale === loc}
			onclick={() => setLocale(loc)}
			aria-label={langLabels[loc]}
		>
			{langLabels[loc]}
		</button>
	{/each}
</div>

<style>
	.lang-switcher {
		position: fixed;
		bottom: 1.2rem;
		left: 1.2rem;
		z-index: 9999;
		display: flex;
		gap: 0.4rem;
		background: rgba(15, 15, 30, 0.9);
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 100px;
		padding: 0.3rem 0.5rem;
		backdrop-filter: blur(12px);
		box-shadow: 0 4px 24px rgba(0, 0, 0, 0.5);
	}

	.lang-btn {
		font-size: 0.78rem;
		font-family: 'Sora', sans-serif;
		color: rgba(160, 160, 200, 0.8);
		background: transparent;
		border: none;
		cursor: pointer;
		padding: 0.25rem 0.6rem;
		border-radius: 100px;
		transition: background 0.2s, color 0.2s;
		white-space: nowrap;
	}

	.lang-btn:hover {
		color: #f0f0f8;
		background: rgba(255, 255, 255, 0.08);
	}

	.lang-btn.active {
		background: #7c3aed;
		color: #fff;
		font-weight: 600;
	}
</style>
