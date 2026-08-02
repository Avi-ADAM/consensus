<script lang="ts">
	import { page } from '$app/state';
	import { _ } from 'svelte-i18n';

	let isNotFound = $derived(page.status === 404);
</script>

<svelte:head>
	<title>{page.status} · Consensus</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<main class="error-page">
	<p class="code">{page.status}</p>
	<h1>{isNotFound ? $_('error.notFoundTitle') : $_('error.genericTitle')}</h1>
	<p class="body">{isNotFound ? $_('error.notFoundBody') : $_('error.genericBody')}</p>
	<div class="actions">
		<a class="primary" href="/">{$_('error.home')}</a>
		<a class="ghost" href="/negotiation/local">{$_('footer.map')}</a>
	</div>
</main>

<style>
	.error-page {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.6rem;
		padding: 4rem 1.5rem;
		text-align: center;
		background: #09090f;
		font-family: 'Sora', sans-serif;
	}

	.code {
		font-size: 3.5rem;
		font-weight: 800;
		line-height: 1;
		color: #7c3aed;
		margin: 0;
	}

	h1 {
		font-size: 1.5rem;
		font-weight: 700;
		color: #f0f0f8;
		margin: 0;
	}

	.body {
		font-size: 0.95rem;
		color: #7070a0;
		max-width: 46ch;
		margin: 0 0 1rem;
		line-height: 1.6;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		justify-content: center;
	}

	.actions a {
		padding: 0.7rem 1.5rem;
		border-radius: 100px;
		font-size: 0.9rem;
		font-weight: 600;
		text-decoration: none;
	}

	.primary {
		background: #7c3aed;
		color: #fff;
	}

	.primary:hover {
		background: #8b5cf6;
	}

	.ghost {
		border: 1px solid #3a3a5a;
		color: #a0a0c8;
	}

	.ghost:hover {
		border-color: #7c3aed;
		color: #c4b5fd;
	}
</style>
