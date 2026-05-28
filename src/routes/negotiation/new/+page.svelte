<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import PlacePicker from '$lib/discussion/PlacePicker.svelte';
	import { createDiscussion, type OpinionInput } from '$lib/discussion/api';
	import { decomposeAndPersist } from '$lib/discussion/decompose';
	import { t } from '$lib/i18n';

	let { data } = $props();

	let canCreate = $derived(data.user.type === 'registered');

	let topic = $state('');
	let description = $state('');
	let ownHeading = $state('');
	let ownDescription = $state('');
	let selfPlacement = $state(50);
	let showOthers = $state(false);
	let others = $state<{ heading: string; description: string }[]>([]);
	let maxRounds = $state(3);
	let visibility = $state<'private' | 'unlisted' | 'local'>('private');
	let placeIds = $state<string[]>([]);

	let places = $state<{ id: string; name: string }[]>([]);
	let busy = $state(false);
	let error = $state<string | null>(null);

	let valid = $derived(topic.trim() !== '' && ownHeading.trim() !== '');

	onMount(async () => {
		try {
			const res = await fetch('/api/places');
			const out = await res.json();
			places = out.places ?? [];
		} catch {
			places = [];
		}
	});

	function addOther() {
		others = [...others, { heading: '', description: '' }];
	}

	function removeOther(index: number) {
		others = others.filter((_, i) => i !== index);
	}

	async function submit() {
		if (!valid || busy) return;
		busy = true;
		error = null;

		const ownOpinion: OpinionInput = {
			heading: ownHeading.trim(),
			description: ownDescription.trim(),
			selfPlacement
		};
		const otherOpinions: OpinionInput[] = others
			.filter((o) => o.heading.trim() !== '')
			.map((o) => ({ heading: o.heading.trim(), description: o.description.trim() }));

		try {
			const result = await createDiscussion({
				topic: topic.trim(),
				description: description.trim(),
				visibility,
				isLocal: visibility === 'local',
				placeIds: visibility === 'local' ? placeIds : [],
				maxRounds,
				ownOpinion,
				otherOpinions
			});

			if (!result) {
				error = t('new.errorCreate');
				return;
			}

			// Decompose each seed opinion into clauses, sequentially so the first
			// opinion seeds the issue pool and the rest hang on it. Best-effort:
			// failures leave the discussion intact without clauses.
			const seeds = [ownOpinion, ...otherOpinions];
			for (let i = 0; i < result.positionIds.length; i++) {
				await decomposeAndPersist({
					negotiationId: result.id,
					positionId: result.positionIds[i],
					topic: topic.trim(),
					opinion: seeds[i]
				}).catch(() => null);
			}

			await goto(resolve('/negotiation/[id]', { id: result.id }));
		} catch {
			error = t('new.errorGeneric');
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head><title>{t('new.title')}</title></svelte:head>

<main dir="rtl" class="min-h-screen bg-[#09090f] px-4 py-8 text-white">
	<div class="mx-auto max-w-xl">
		<h1 class="text-2xl font-bold">{t('new.title')}</h1>

		{#if !canCreate}
			<div
				class="mt-4 rounded-lg border border-amber-400/30 bg-amber-500/10 p-4 text-sm text-amber-100"
			>
				{t('new.locked')}
				<a class="underline" href="https://www.1lev1.com/login">{t('new.lockedCta')}</a>
			</div>
		{:else}
			<p class="mt-2 text-sm text-white/60">{t('new.intro')}</p>

			<label class="mt-6 block text-sm text-white/70">
				{t('new.topicLabel')}
				<input
					bind:value={topic}
					class="mt-1 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 text-base text-white focus:border-violet-400/60 focus:outline-none"
					placeholder={t('new.topicPlaceholder')}
				/>
			</label>

			<label class="mt-3 block text-sm text-white/70">
				{t('new.descriptionLabel')} <span class="text-white/40">({t('common.optional')})</span>
				<textarea
					bind:value={description}
					rows="2"
					class="mt-1 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 text-base text-white focus:border-violet-400/60 focus:outline-none"
				></textarea>
			</label>

			<section class="mt-6 rounded-2xl border border-violet-400/25 bg-violet-500/5 p-4 sm:p-5">
				<h2 class="text-base font-semibold text-violet-100">{t('new.ownOpinionTitle')}</h2>
				<p class="mt-1 text-xs text-white/50">{t('new.ownOpinionHint')}</p>

				<input
					bind:value={ownHeading}
					class="mt-3 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 text-base text-white focus:border-violet-400/60 focus:outline-none"
					placeholder={t('new.opinionHeadingPlaceholder')}
				/>
				<textarea
					bind:value={ownDescription}
					rows="2"
					class="mt-2 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 text-base text-white focus:border-violet-400/60 focus:outline-none"
					placeholder={t('new.opinionDescriptionPlaceholder')}
				></textarea>

				<div class="mt-4">
					<label for="self-placement" class="block text-sm text-white/70">
						{t('new.selfPlacementLabel')}
					</label>
					<input
						id="self-placement"
						type="range"
						min="0"
						max="100"
						bind:value={selfPlacement}
						class="mt-2 w-full accent-violet-500"
					/>
					<div class="flex justify-between text-xs text-white/40">
						<span>{t('new.selfPlacementStart')}</span>
						<span>{t('new.selfPlacementEnd')}</span>
					</div>
					<p class="mt-1 text-xs text-white/50">{t('new.selfPlacementHint')}</p>
				</div>
			</section>

			<div class="mt-4">
				<button
					type="button"
					onclick={() => (showOthers = !showOthers)}
					class="flex w-full items-center justify-between rounded-lg px-1 py-2 text-sm text-white/60 hover:text-white/90"
					aria-expanded={showOthers}
				>
					<span>{t('new.othersToggle')}</span>
					<span class="text-white/40">{showOthers ? '▲' : '▼'}</span>
				</button>

				{#if showOthers}
					<div class="rounded-xl border border-white/10 bg-white/5 p-3">
						<p class="text-xs text-white/50">{t('new.othersHint')}</p>
						{#each others as other, i (i)}
							<div class="mt-3 rounded-lg border border-white/10 bg-white/5 p-3">
								<div class="flex items-start gap-2">
									<input
										bind:value={other.heading}
										class="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white focus:border-violet-400/60 focus:outline-none"
										placeholder={t('new.opinionHeadingPlaceholder')}
									/>
									<button
										type="button"
										onclick={() => removeOther(i)}
										class="shrink-0 rounded-lg px-2 py-2 text-xs text-white/50 hover:text-rose-300"
									>
										{t('new.removeOpinion')}
									</button>
								</div>
								<textarea
									bind:value={other.description}
									rows="2"
									class="mt-2 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white focus:border-violet-400/60 focus:outline-none"
									placeholder={t('new.opinionDescriptionPlaceholder')}
								></textarea>
							</div>
						{/each}
						<button
							type="button"
							onclick={addOther}
							class="mt-3 rounded-lg border border-white/15 px-3 py-1.5 text-sm text-white/70 hover:bg-white/10"
						>
							＋ {t('new.addAnotherOpinion')}
						</button>
					</div>
				{/if}
			</div>

			<fieldset class="mt-6">
				<legend class="text-sm text-white/70">{t('new.visibilityLegend')}</legend>
				<div class="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-sm">
					<label class="flex items-center gap-2">
						<input type="radio" bind:group={visibility} value="private" class="accent-violet-500" />
						{t('new.visibilityPrivate')}
					</label>
					<label class="flex items-center gap-2">
						<input
							type="radio"
							bind:group={visibility}
							value="unlisted"
							class="accent-violet-500"
						/>
						{t('new.visibilityUnlisted')}
					</label>
					<label class="flex items-center gap-2">
						<input type="radio" bind:group={visibility} value="local" class="accent-violet-500" />
						{t('new.visibilityLocal')}
					</label>
				</div>
			</fieldset>

			{#if visibility === 'local'}
				<div class="mt-3">
					<p class="mb-2 text-sm text-white/70">{t('new.placesLabel')}</p>
					<PlacePicker {places} bind:selected={placeIds} />
				</div>
			{/if}

			<label class="mt-4 block text-sm text-white/70">
				{t('new.maxRoundsLabel')}
				<input
					type="number"
					min="1"
					max="10"
					bind:value={maxRounds}
					class="mt-1 w-24 rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 text-base text-white focus:border-violet-400/60 focus:outline-none"
				/>
			</label>

			{#if error}
				<p class="mt-4 rounded-lg border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-100">
					{error}
				</p>
			{/if}

			<button
				type="button"
				onclick={submit}
				disabled={!valid || busy}
				class="mt-6 w-full rounded-xl bg-violet-600 px-5 py-3 font-semibold text-white hover:bg-violet-500 disabled:opacity-40 sm:w-auto"
			>
				{busy ? t('new.submitting') : t('new.submit')}
			</button>
		{/if}
	</div>
</main>
