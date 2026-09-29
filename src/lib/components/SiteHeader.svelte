<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { _ } from 'svelte-i18n';
	import { isRTL, locale } from '$lib/i18n';
	import type { AppUser } from '$lib/auth/permissions';
	import UserMenu from './UserMenu.svelte';

	/**
	 * Header for every inner page: a way back, where you are, and who you are.
	 * The home page has its own hero nav (with the same UserMenu).
	 */
	let { user }: { user: AppUser } = $props();

	interface Crumb {
		label: string;
		href?: string;
	}

	let crumbs = $derived.by<Crumb[]>(() => {
		const home: Crumb = { label: $_('header.home'), href: resolve('/') };
		const map: Crumb = { label: $_('nav.map'), href: resolve('/negotiation/local') };
		switch (page.route.id) {
			case '/negotiation/local':
				return [home, { label: $_('nav.map') }];
			case '/negotiation/new':
				return [home, map, { label: $_('new.title') }];
			case '/negotiation/bridge':
				return [home, { label: $_('bridge.title') }];
			case '/negotiation/[id]': {
				const topic = page.data?.loaded?.meta?.topic as string | undefined;
				const label =
					topic || $_('discussion.discussionId', { values: { id: page.params.id ?? '' } });
				return [home, map, { label }];
			}
			default:
				return [home];
		}
	});

	/** The crumb above this page: where "back" goes when there is no history to return to. */
	let parent = $derived([...crumbs].reverse().find((c) => c.href) ?? crumbs[0]);

	let rtl = $derived(isRTL($locale ?? undefined));

	function back(event: MouseEvent) {
		// Came here from another page of this site: behave like the browser's
		// back button, so a filtered map or a scrolled list is where you left it.
		// Arrived from outside (a shared link, the agreement site): go up instead.
		if (document.referrer.startsWith(location.origin) && history.length > 1) {
			event.preventDefault();
			history.back();
		}
	}
</script>

<header
	class="sticky top-0 z-40 border-b border-white/10 bg-[#09090f]/85 text-white backdrop-blur-md"
>
	<div class="mx-auto flex max-w-5xl items-center gap-3 px-4 py-2.5">
		{#if crumbs.length > 1}
			<a
				href={parent.href}
				onclick={back}
				class="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/15 text-white/80 transition hover:border-violet-400 hover:text-white"
				aria-label={$_('header.back')}
				title={$_('header.back')}
			>
				<svg
					width="18"
					height="18"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2.2"
					stroke-linecap="round"
					stroke-linejoin="round"
					aria-hidden="true"
					style:transform={rtl ? 'scaleX(-1)' : undefined}
				>
					<path d="M19 12H5M12 19l-7-7 7-7" />
				</svg>
			</a>
		{/if}

		<a href={resolve('/')} class="flex shrink-0 items-center gap-2" aria-label="Consensus">
			<img src="/logo-96.png" alt="" width="28" height="28" class="h-7 w-7" />
			<span
				class="hidden bg-gradient-to-br from-violet-300 to-indigo-400 bg-clip-text font-extrabold text-transparent sm:inline"
				>Consensus</span
			>
		</a>

		<nav aria-label={$_('header.breadcrumb')} class="min-w-0 flex-1">
			<ol class="flex min-w-0 items-center gap-1.5 text-sm text-white/55">
				{#each crumbs.slice(1) as crumb, i (i)}
					<li class="shrink-0 text-white/25" aria-hidden="true">/</li>
					<li class="min-w-0 {crumb.href ? 'shrink-0' : 'truncate'}">
						{#if crumb.href}
							<a href={crumb.href} class="transition hover:text-white">{crumb.label}</a>
						{:else}
							<span class="font-medium text-white/90" aria-current="page">{crumb.label}</span>
						{/if}
					</li>
				{/each}
			</ol>
		</nav>

		<div class="shrink-0">
			<UserMenu {user} />
		</div>
	</div>
</header>
