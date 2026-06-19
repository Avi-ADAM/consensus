<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import {
		createDiscussion,
		createIssue,
		createClause,
		updatePositionLocation
	} from '$lib/discussion/api';
	import { buildBridgeSeed, fieldChanged, formatFieldValue } from '$lib/discussion/bridge';
	import { t } from '$lib/i18n';
	import { _ } from 'svelte-i18n';

	let { data } = $props();

	let payload = $derived(data.payload);
	let canCreate = $derived(data.user.type === 'registered');

	let busy = $state(false);
	let error = $state<string | null>(null);

	async function open() {
		if (!payload || busy) return;
		busy = true;
		error = null;

		const seed = buildBridgeSeed(payload);
		try {
			const result = await createDiscussion({
				topic: seed.topic,
				description: seed.description,
				visibility: 'private',
				isLocal: false,
				placeIds: [],
				maxRounds: 3,
				ownOpinion: seed.originalOpinion,
				otherOpinions: [seed.proposedOpinion],
				sourceType: payload.sourceType,
				sourceId: payload.sourceId,
				sourceMeta: seed.sourceMeta
			});

			if (!result || result.positionIds.length < 2) {
				error = t('bridge.errorCreate');
				return;
			}

			// Seed issues and clauses deterministically — the terms are known, so
			// no AI pass is needed; the assistant tools take over inside the
			// discussion. Best-effort per item: a failed clause leaves a gap the
			// panel can fill later.
			const issueIdByTitle: Record<string, string> = {};
			for (let i = 0; i < seed.issueTitles.length; i++) {
				const title = seed.issueTitles[i];
				const id = await createIssue({
					negotiationId: result.id,
					title,
					order: i,
					origin: 'human'
				}).catch(() => null);
				if (id) issueIdByTitle[title] = id;
			}

			const [originalId, proposedId] = result.positionIds;
			const sums = { original: { sum: 0, n: 0 }, proposed: { sum: 0, n: 0 } };
			for (const clause of seed.clauses) {
				const positionId = clause.side === 'original' ? originalId : proposedId;
				const saved = await createClause({
					negotiationId: result.id,
					positionId,
					issueId: issueIdByTitle[clause.issueTitle] ?? null,
					body: clause.body,
					stanceValue: clause.stanceValue,
					origin: 'human'
				}).catch(() => null);
				if (saved) {
					sums[clause.side].sum += clause.stanceValue;
					sums[clause.side].n += 1;
				}
			}

			if (sums.original.n > 0) {
				await updatePositionLocation(
					originalId,
					Math.round(sums.original.sum / sums.original.n)
				).catch(() => {});
			}
			if (sums.proposed.n > 0) {
				await updatePositionLocation(
					proposedId,
					Math.round(sums.proposed.sum / sums.proposed.n)
				).catch(() => {});
			}

			await goto(resolve('/negotiation/[id]', { id: result.id }));
		} catch {
			error = t('bridge.errorCreate');
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head><title>{$_('bridge.title')}</title></svelte:head>

<main
	class="flex min-h-screen flex-col items-center bg-linear-to-br from-[#09090f] via-[#120b2e] to-[#0d0d1a] px-4 py-10 text-white sm:py-16"
>
	<div class="w-full max-w-xl">
		<header class="text-center">
			<span
				class="inline-flex items-center gap-1.5 rounded-full border border-violet-400/30 bg-violet-500/10 px-3 py-1 text-xs font-medium text-violet-200"
			>
				🤝 {$_('bridge.title')}
			</span>
			{#if payload}
				<h1 class="mt-3 text-3xl font-bold tracking-tight">{payload.title}</h1>
				{#if payload.projectName}
					<p class="mt-1 text-sm text-white/50">
						{$_('bridge.sourceProject', { values: { name: payload.projectName } })}
					</p>
				{/if}
			{/if}
		</header>

		{#if !payload}
			<div
				class="mt-6 rounded-2xl border border-amber-400/30 bg-amber-500/10 p-5 text-center text-sm text-amber-100"
			>
				{$_('bridge.invalid')}
			</div>
		{:else if !canCreate}
			<div
				class="mt-6 rounded-2xl border border-amber-400/30 bg-amber-500/10 p-5 text-center text-sm text-amber-100"
			>
				{$_('bridge.locked')}
				<a class="underline" href="https://www.1lev1.com/login">{$_('bridge.lockedCta')}</a>
			</div>
		{:else}
			<p class="mx-auto mt-3 max-w-md text-center text-sm text-white/60">{$_('bridge.intro')}</p>

			<div
				class="mt-7 rounded-3xl border border-white/10 bg-[#0d0d18] p-5 shadow-2xl shadow-black/40 sm:p-7"
			>
				<h2 class="text-base font-semibold text-violet-100">{$_('bridge.fieldsTitle')}</h2>
				<table class="mt-3 w-full text-sm">
					<thead>
						<tr class="text-right text-xs text-white/40">
							<th class="pb-2 font-normal"></th>
							<th class="pb-2 font-normal">{$_('bridge.original')}</th>
							<th class="pb-2 font-normal">{$_('bridge.proposed')}</th>
						</tr>
					</thead>
					<tbody>
						{#each payload.fields as field (field.key)}
							{@const changed = fieldChanged(field)}
							<tr class="border-t border-white/5">
								<td class="py-2 pe-2 text-white/70">
									{field.label}
									{#if !changed}
										<span
											class="ms-1 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-200"
										>
											{$_('bridge.agreedBadge')}
										</span>
									{/if}
								</td>
								<td class="max-w-40 truncate py-2 pe-2 {changed ? 'text-white' : 'text-white/50'}">
									{formatFieldValue(field, field.original)}
								</td>
								<td class="max-w-40 truncate py-2 {changed ? 'text-violet-200' : 'text-white/50'}">
									{formatFieldValue(field, field.proposed)}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>

				{#if error}
					<p
						class="mt-4 rounded-lg border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-100"
					>
						{error}
					</p>
				{/if}

				<button
					type="button"
					onclick={open}
					disabled={busy}
					class="mt-6 w-full rounded-xl bg-violet-600 px-5 py-3 font-semibold text-white shadow-lg shadow-violet-900/30 transition hover:bg-violet-500 disabled:opacity-40"
				>
					{busy ? t('bridge.creating') : t('bridge.create')}
				</button>
			</div>
		{/if}
	</div>
</main>
