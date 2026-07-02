<script lang="ts">
	import type { Clause, Issue, Opinion } from './scale';
	import type { BridgeResolution, SourceMeta } from './bridge';
	import {
		agreementFromPosition,
		buildResolution,
		buildReturnUrl,
		defaultAgreementPosition,
		formatFieldValue
	} from './bridge';
	import { loadResolutionBySource, saveResolution } from './api';
	import { _ } from 'svelte-i18n';

	let {
		negotiationId,
		sourceMeta,
		sourceType,
		sourceId,
		issues,
		clauses,
		opinions,
		canFinalize = false
	}: {
		negotiationId: string;
		sourceMeta: SourceMeta;
		sourceType: string;
		sourceId: string;
		issues: Issue[];
		clauses: Clause[];
		opinions: Opinion[];
		canFinalize?: boolean;
	} = $props();

	let open = $state(false);
	let selectedId = $state<string | null>(null);

	// The persisted decision, if one was already signed and sent back.
	let resolution = $state<BridgeResolution | null>(null);
	let saving = $state(false);
	let saveError = $state(false);

	// Async server read keyed on the source — re-runs when navigating between
	// bridged discussions; the cleanup guards against out-of-order responses.
	$effect(() => {
		const type = sourceType;
		const id = sourceId;
		let cancelled = false;
		resolution = null;
		loadResolutionBySource(type, id)
			.then((r) => {
				if (!cancelled) resolution = r;
			})
			.catch(() => {});
		return () => {
			cancelled = true;
		};
	});

	let solution = $derived(defaultAgreementPosition(opinions));
	let chosen = $derived(opinions.find((o) => o.id === selectedId) ?? solution ?? null);
	let terms = $derived(chosen ? agreementFromPosition(sourceMeta, issues, clauses, chosen.id) : []);
	let backUrl = $derived(chosen ? buildReturnUrl(sourceMeta, sourceId, terms) : null);
	// After a decision is signed, the link back carries the SIGNED terms, so the
	// prefill matches what every other member reads from the server.
	let resolvedBackUrl = $derived(
		resolution ? buildReturnUrl(sourceMeta, sourceId, resolution.terms) : null
	);

	function fieldFor(key: string) {
		return sourceMeta.fields.find((f) => f.key === key) ?? null;
	}

	async function finalize() {
		if (!chosen || saving) return;
		saving = true;
		saveError = false;
		const next = buildResolution(sourceType, sourceId, chosen, terms);
		try {
			const ok = await saveResolution(negotiationId, next);
			if (ok) {
				resolution = next;
			} else {
				saveError = true;
			}
		} catch {
			saveError = true;
		} finally {
			saving = false;
		}
	}
</script>

<div class="mt-3 rounded-xl border border-emerald-400/25 bg-emerald-500/5 p-3 text-sm">
	<div class="flex flex-wrap items-center justify-between gap-2">
		<p class="font-medium text-emerald-100">
			🤝 {$_('bridge.bar.title', { values: { title: sourceMeta.title } })}
		</p>
		<button
			type="button"
			onclick={() => (open = !open)}
			class="rounded-lg border border-emerald-400/30 px-3 py-1.5 text-xs text-emerald-100 hover:bg-emerald-500/15"
		>
			{open ? $_('bridge.bar.hide') : $_('bridge.bar.show')}
		</button>
	</div>

	{#if resolution}
		<div class="mt-2 rounded-lg border border-emerald-400/40 bg-emerald-500/15 p-3">
			<p class="text-xs font-semibold text-emerald-100">
				✅ {$_('bridge.bar.resolved', {
					values: { heading: resolution.heading }
				})}
			</p>
			<p class="mt-1 text-[11px] text-emerald-100/70">
				{$_('bridge.bar.resolvedAt', {
					values: { date: new Date(resolution.decidedAt).toLocaleDateString('he-IL') }
				})}
			</p>
			{#if resolvedBackUrl}
				<!-- eslint-disable svelte/no-navigation-without-resolve -- external link back to the main app, validated as https by parseBridgePayload -->
				<a
					href={resolvedBackUrl}
					class="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500"
				>
					{$_('bridge.bar.back')}
				</a>
				<!-- eslint-enable svelte/no-navigation-without-resolve -->
			{/if}
		</div>
	{/if}

	{#if open}
		<p class="mt-2 text-xs text-white/55">{$_('bridge.bar.hint')}</p>

		{#if !chosen}
			<p class="mt-3 rounded-lg border border-white/10 bg-white/5 p-3 text-xs text-white/60">
				{$_('bridge.bar.noSolution')}
			</p>
		{:else}
			<label class="mt-3 block text-xs text-white/60">
				{$_('bridge.bar.choose')}
				<select
					value={chosen.id}
					onchange={(e) => (selectedId = e.currentTarget.value)}
					class="mt-1 w-full rounded-lg border border-white/15 bg-[#10101c] px-3 py-2 text-sm text-white focus:border-emerald-400/60 focus:outline-none"
				>
					{#each opinions as opinion (opinion.id)}
						<option value={opinion.id}>
							{opinion.kind === 'proposed_solution' ? '✨ ' : ''}{opinion.heading}
						</option>
					{/each}
				</select>
			</label>

			<table class="mt-3 w-full text-xs">
				<thead>
					<tr class="text-right text-white/40">
						<th class="pb-1 font-normal">{$_('bridge.bar.term')}</th>
						<th class="pb-1 font-normal">{$_('bridge.bar.value')}</th>
					</tr>
				</thead>
				<tbody>
					{#each terms as term (term.key)}
						{@const field = fieldFor(term.key)}
						<tr class="border-t border-white/5">
							<td class="py-1.5 pe-2 text-white/70">{term.label}</td>
							<td class="max-w-52 truncate py-1.5 text-emerald-100">
								{#if term.value === null}
									<span class="text-white/40">{$_('bridge.bar.keep')}</span>
								{:else if term.kind === 'text'}
									{String(term.value)}
								{:else if field}
									{formatFieldValue(field, term.value)}
								{:else}
									{String(term.value)}
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>

			<div class="mt-3 flex flex-wrap items-center gap-2">
				{#if canFinalize}
					<button
						type="button"
						onclick={finalize}
						disabled={saving}
						class="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-900/30 transition hover:bg-emerald-500 disabled:opacity-50"
					>
						{saving
							? $_('bridge.bar.finalizing')
							: resolution
								? $_('bridge.bar.refinalize')
								: $_('bridge.bar.finalize')}
					</button>
				{/if}
				{#if backUrl}
					<!-- eslint-disable svelte/no-navigation-without-resolve -- external link back to the main app, validated as https by parseBridgePayload -->
					<a
						href={backUrl}
						class="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/40 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/15"
					>
						{$_('bridge.bar.back')}
					</a>
					<!-- eslint-enable svelte/no-navigation-without-resolve -->
				{/if}
			</div>
			{#if canFinalize}
				<p class="mt-2 text-[11px] text-white/45">{$_('bridge.bar.finalizeHint')}</p>
			{/if}
			{#if saveError}
				<p class="mt-2 rounded-lg border border-red-400/30 bg-red-500/10 p-2 text-xs text-red-100">
					{$_('bridge.bar.finalizeError')}
				</p>
			{/if}
		{/if}
	{/if}
</div>
