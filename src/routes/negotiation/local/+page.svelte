<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { listLocalDiscussions, type DiscussionSummary } from '$lib/discussion/api';

	let { data } = $props();

	let canCreate = $derived(data.user.type === 'registered');

	let places = $state<{ id: string; name: string }[]>([]);
	let query = $state('');
	let selectedPlaceId = $state<string | null>(null);
	let discussions = $state<DiscussionSummary[]>([]);
	let loading = $state(false);

	let filteredPlaces = $derived(
		query.trim()
			? places.filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase()))
			: places
	);
	let selectedPlace = $derived(places.find((p) => p.id === selectedPlaceId) ?? null);

	onMount(async () => {
		try {
			const res = await fetch('/api/places');
			const out = await res.json();
			places = out.places ?? [];
		} catch {
			places = [];
		}
	});

	async function selectPlace(id: string) {
		selectedPlaceId = id;
		loading = true;
		try {
			discussions = await listLocalDiscussions(id);
		} catch {
			discussions = [];
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head><title>דיונים מקומיים</title></svelte:head>

<main dir="rtl" class="min-h-screen bg-[#09090f] px-4 py-8 text-white">
	<div class="mx-auto max-w-3xl">
		<div class="flex items-center justify-between gap-3">
			<h1 class="text-2xl font-bold">דיונים מקומיים</h1>
			{#if canCreate}
				<a
					href={resolve('/negotiation/new')}
					class="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500"
				>
					דיון חדש
				</a>
			{/if}
		</div>
		<p class="mt-2 text-sm text-white/60">בחרו מקום כדי לראות דיונים שנוגעים לאנשים שבו.</p>

		{#if places.length === 0}
			<p class="mt-6 text-sm text-white/50">לא נטענו מקומות (יש להגדיר STRAPI_URL).</p>
		{:else}
			<input
				bind:value={query}
				placeholder="חיפוש מקום…"
				class="mt-6 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white"
			/>
			<div class="mt-3 flex max-h-32 flex-wrap gap-2 overflow-y-auto">
				{#each filteredPlaces as place (place.id)}
					<button
						type="button"
						onclick={() => selectPlace(place.id)}
						class="rounded-full border px-3 py-1 text-sm transition-colors {selectedPlaceId ===
						place.id
							? 'border-violet-400 bg-violet-500 text-white'
							: 'border-white/30 text-white/70 hover:border-white/60'}"
					>
						{place.name}
					</button>
				{/each}
			</div>
		{/if}

		{#if selectedPlace}
			<h2 class="mt-8 text-lg font-semibold text-violet-200">דיונים ב{selectedPlace.name}</h2>

			{#if loading}
				<p class="mt-4 text-sm text-white/50">טוען…</p>
			{:else if discussions.length === 0}
				<p class="mt-4 text-sm text-white/50">
					אין עדיין דיונים מקומיים כאן.
					{#if canCreate}פתחו את הראשון!{/if}
				</p>
			{:else}
				<ul class="mt-4 space-y-3">
					{#each discussions as d (d.id)}
						<li>
							<a
								href={resolve('/negotiation/[id]', { id: d.id })}
								class="block rounded-xl border border-white/10 bg-white/5 p-4 transition-colors hover:border-violet-400/40 hover:bg-white/10"
							>
								<h3 class="font-semibold text-white">{d.topic}</h3>
								{#if d.description}
									<p class="mt-1 line-clamp-2 text-sm text-white/60">{d.description}</p>
								{/if}
								<div class="mt-2 flex gap-3 text-xs text-white/40">
									<span>סבב {d.currentRound}/{d.maxRounds}</span>
									<span>{d.positionsCount} דעות</span>
								</div>
							</a>
						</li>
					{/each}
				</ul>
			{/if}
		{/if}
	</div>
</main>
