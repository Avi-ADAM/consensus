<script lang="ts">
	import { page } from '$app/state';
	import { _ } from 'svelte-i18n';
	import { locale } from '$lib/i18n';
	import type { AppUser } from '$lib/auth/permissions';
	import { MAIN_SITE, agreementHref, loginHref, logoutHref, upgradeHref } from '$lib/links';

	/**
	 * Who is here, and the next step for them.
	 *
	 * - guest      → sign the agreement (the minimum to take part) or log in;
	 * - charter    → signed the agreement; may upgrade to a full account;
	 * - registered → logged in at 1💗1; account and sign-out.
	 *
	 * Every hand-off returns to the page the visitor is on.
	 */
	let { user }: { user: AppUser } = $props();

	let here = $derived(page.url.href);
	let initial = $derived((user.name ?? user.email ?? '?').trim().charAt(0).toUpperCase());
	let displayName = $derived(user.name ?? user.email ?? '');
</script>

{#if user.type === 'guest'}
	<div class="flex items-center gap-2">
		<a
			href={loginHref(here)}
			class="rounded-lg border border-white/20 px-3 py-1.5 text-sm text-white/80 transition hover:border-violet-400 hover:text-white"
		>
			{$_('auth.login')}
		</a>
		<a
			href={agreementHref(here, $locale)}
			title={$_('auth.joinAgreementHint')}
			class="rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 px-3 py-1.5 text-sm font-semibold text-white shadow-lg shadow-violet-900/40 transition hover:-translate-y-px"
		>
			{$_('auth.joinAgreement')}
		</a>
	</div>
{:else}
	<details class="user-menu relative">
		<summary
			class="flex cursor-pointer list-none items-center gap-2 rounded-full border border-white/15 bg-white/5 py-1 ps-1 pe-3 text-sm text-white/90 transition hover:border-violet-400/60"
			aria-label={$_('auth.menu')}
		>
			<span
				class="grid h-7 w-7 place-items-center rounded-full text-xs font-bold text-white {user.type ===
				'registered'
					? 'bg-violet-600'
					: 'bg-amber-600'}"
				aria-hidden="true">{initial}</span
			>
			<span class="max-w-[9rem] truncate">{displayName}</span>
			{#if user.type === 'charter'}
				<span
					class="hidden rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] text-amber-200 sm:inline"
				>
					✓ {$_('auth.signedAgreement')}
				</span>
			{/if}
		</summary>

		<div
			class="absolute end-0 z-50 mt-2 w-72 rounded-xl border border-white/10 bg-[#11111c] p-4 text-sm text-white/80 shadow-2xl shadow-black/60"
		>
			{#if user.type === 'registered'}
				<p class="text-white">{$_('auth.loggedInAs', { values: { name: displayName } })}</p>
				{#if user.email && user.email !== displayName}
					<p class="mt-0.5 truncate text-xs text-white/50" dir="ltr">{user.email}</p>
				{/if}
				<div class="mt-3 flex flex-col gap-1.5">
					<a class="menu-link" href="{MAIN_SITE}/lev" target="_blank" rel="noopener noreferrer">
						{$_('auth.account')}
					</a>
					<a class="menu-link" href={logoutHref(here)}>{$_('auth.logout')}</a>
				</div>
			{:else}
				<p class="text-white">✓ {$_('auth.signedAgreement')}</p>
				<p class="mt-1 text-xs leading-relaxed text-white/60">{$_('auth.charterHint')}</p>
				<div class="mt-3 flex flex-col gap-1.5">
					<a class="menu-link font-semibold text-violet-200" href={upgradeHref()}>
						{$_('auth.upgrade')}
					</a>
					<p class="text-xs text-white/45">{$_('auth.upgradeHint')}</p>
					<a class="menu-link" href={loginHref(here)}>{$_('auth.haveAccount')}</a>
				</div>
			{/if}
		</div>
	</details>
{/if}

<style>
	.user-menu summary::-webkit-details-marker {
		display: none;
	}

	.menu-link {
		display: block;
		border-radius: 0.5rem;
		padding: 0.4rem 0.6rem;
		color: inherit;
		text-decoration: none;
		transition: background 0.15s;
	}

	.menu-link:hover {
		background: rgba(255, 255, 255, 0.07);
		color: #fff;
	}
</style>
