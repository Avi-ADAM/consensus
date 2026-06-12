<script lang="ts">
	import type { Clause, Issue, Opinion } from './scale';
	import type { SourceMeta } from './bridge';
	import {
		agreementFromPosition,
		buildReturnUrl,
		defaultAgreementPosition,
		formatFieldValue
	} from './bridge';
	import { t } from '$lib/i18n';

	let {
		sourceMeta,
		sourceId,
		issues,
		clauses,
		opinions
	}: {
		sourceMeta: SourceMeta;
		sourceId: string;
		issues: Issue[];
		clauses: Clause[];
		opinions: Opinion[];
	} = $props();

	let open = $state(false);
	let selectedId = $state<string | null>(null);

	let solution = $derived(defaultAgreementPosition(opinions));
	let chosen = $derived(opinions.find((o) => o.id === selectedId) ?? solution ?? null);
	let terms = $derived(chosen ? agreementFromPosition(sourceMeta, issues, clauses, chosen.id) : []);
	let backUrl = $derived(chosen ? buildReturnUrl(sourceMeta, sourceId, terms) : null);

	function fieldFor(key: string) {
		return sourceMeta.fields.find((f) => f.key === key) ?? null;
	}
</script>

<div class="mt-3 rounded-xl border border-emerald-400/25 bg-emerald-500/5 p-3 text-sm">
	<div class="flex flex-wrap items-center justify-between gap-2">
		<p class="font-medium text-emerald-100">
			🤝 {t('bridge.bar.title', { title: sourceMeta.title })}
		</p>
		<button
			type="button"
			onclick={() => (open = !open)}
			class="rounded-lg border border-emerald-400/30 px-3 py-1.5 text-xs text-emerald-100 hover:bg-emerald-500/15"
		>
			{open ? t('bridge.bar.hide') : t('bridge.bar.show')}
		</button>
	</div>

	{#if open}
		<p class="mt-2 text-xs text-white/55">{t('bridge.bar.hint')}</p>

		{#if !chosen}
			<p class="mt-3 rounded-lg border border-white/10 bg-white/5 p-3 text-xs text-white/60">
				{t('bridge.bar.noSolution')}
			</p>
		{:else}
			<label class="mt-3 block text-xs text-white/60">
				{t('bridge.bar.choose')}
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
						<th class="pb-1 font-normal">{t('bridge.bar.term')}</th>
						<th class="pb-1 font-normal">{t('bridge.bar.value')}</th>
					</tr>
				</thead>
				<tbody>
					{#each terms as term (term.key)}
						{@const field = fieldFor(term.key)}
						<tr class="border-t border-white/5">
							<td class="py-1.5 pe-2 text-white/70">{term.label}</td>
							<td class="max-w-52 truncate py-1.5 text-emerald-100">
								{#if term.value === null}
									<span class="text-white/40">{t('bridge.bar.keep')}</span>
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

			{#if backUrl}
				<!-- eslint-disable svelte/no-navigation-without-resolve -- external link back to the main app, validated as https by parseBridgePayload -->
				<a
					href={backUrl}
					class="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-900/30 transition hover:bg-emerald-500"
				>
					{t('bridge.bar.back')}
				</a>
				<!-- eslint-enable svelte/no-navigation-without-resolve -->
			{/if}
		{/if}
	{/if}
</div>
