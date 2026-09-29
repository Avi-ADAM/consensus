<script lang="ts" module>
	import type { ClauseDraft } from './decompose';

	export interface OpinionSubmit {
		heading: string;
		description: string;
		clauses: ClauseDraft[];
	}
</script>

<script lang="ts">
	import { decomposeOpinion, type Gap } from './decompose';
	import type { Issue, Origin } from './scale';
	import { _ } from 'svelte-i18n';

	interface Row {
		key: number;
		issueTitle: string;
		body: string;
		stanceValue: number;
		origin: Origin;
	}

	interface Props {
		title: string;
		topic: string;
		/** Issues already raised in the discussion — offered when choosing a clause's issue. */
		issues: Issue[];
		/** Placement between the neighbouring opinions, 5..95 (only for "between"). */
		fraction?: number;
		showPlacement?: boolean;
		busy?: boolean;
		error?: string | null;
		placementNote?: string | null;
		placementBusy?: boolean;
		onaskplacement?: (text: { heading: string; description: string }) => void;
		onsubmit: (input: OpinionSubmit) => void;
		oncancel: () => void;
	}

	let {
		title,
		topic,
		issues,
		fraction = $bindable(50),
		showPlacement = false,
		busy = false,
		error = null,
		placementNote = null,
		placementBusy = false,
		onaskplacement,
		onsubmit,
		oncancel
	}: Props = $props();

	let heading = $state('');
	let description = $state('');
	let rows = $state<Row[]>([]);
	let gaps = $state<Gap[]>([]);
	let aiBusy = $state(false);
	let aiMessage = $state<string | null>(null);
	let nextKey = 0;

	const knownTitles = $derived(new Set(issues.map((i) => i.title.trim().toLowerCase())));
	const filledRows = $derived(rows.filter((r) => r.body.trim()));
	const openGaps = $derived(
		gaps.filter(
			(g) =>
				g.issueTitle &&
				!rows.some((r) => r.issueTitle.trim().toLowerCase() === g.issueTitle.trim().toLowerCase())
		)
	);

	function row(partial: Partial<Row> = {}): Row {
		return {
			key: nextKey++,
			issueTitle: '',
			body: '',
			stanceValue: 50,
			origin: 'human',
			...partial
		};
	}

	function addRow() {
		rows.push(row());
	}

	function removeRow(key: number) {
		rows = rows.filter((r) => r.key !== key);
	}

	function isNewIssue(r: Row): boolean {
		const t = r.issueTitle.trim().toLowerCase();
		return t !== '' && !knownTitles.has(t);
	}

	function addGap(g: Gap) {
		rows.push(row({ issueTitle: g.issueTitle, body: g.suggestedClause, origin: 'ai' }));
	}

	async function decompose() {
		if (!heading.trim() || aiBusy) return;
		aiBusy = true;
		aiMessage = null;
		try {
			const result = await decomposeOpinion({
				topic,
				opinion: { heading: heading.trim(), description: description.trim() },
				existingIssues: issues
			});
			if (!result) {
				aiMessage = $_('opinionForm.aiUnavailable');
				return;
			}
			if (result.clauses.length === 0) {
				aiMessage = $_('opinionForm.aiEmpty');
			}
			// Keep what the author wrote by hand; replace the previous AI pass.
			const own = rows.filter((r) => r.origin === 'human' && r.body.trim());
			rows = [
				...own,
				...result.clauses.map((c) =>
					row({
						issueTitle: c.issueTitle,
						body: c.body,
						stanceValue: c.stanceValue,
						origin: 'ai'
					})
				)
			];
			gaps = result.gaps;
		} catch {
			aiMessage = $_('opinionForm.aiUnavailable');
		} finally {
			aiBusy = false;
		}
	}

	function submit() {
		if (!heading.trim() || busy) return;
		onsubmit({
			heading: heading.trim(),
			description: description.trim(),
			clauses: filledRows.map((r) => ({
				body: r.body.trim(),
				issueId: null,
				issueTitle: r.issueTitle.trim(),
				stanceValue: r.stanceValue,
				origin: r.origin
			}))
		});
	}

	function onkeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && !busy) oncancel();
	}
</script>

<svelte:window {onkeydown} />

<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4">
	<div
		role="dialog"
		aria-modal="true"
		aria-labelledby="opinion-form-title"
		class="flex max-h-[92vh] w-full max-w-2xl flex-col rounded-2xl border border-white/15 bg-[#15152a] text-white shadow-2xl"
	>
		<header class="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
			<h2 id="opinion-form-title" class="text-lg font-bold">{title}</h2>
			<button
				type="button"
				onclick={oncancel}
				disabled={busy}
				aria-label={$_('opinionForm.close')}
				class="rounded-lg px-2 py-1 text-white/50 hover:bg-white/10 hover:text-white">✕</button
			>
		</header>

		<div class="flex-1 overflow-y-auto px-5 py-4">
			<!-- 1. The opinion -->
			<section>
				<h3 class="text-xs font-semibold tracking-wider text-white/45">
					{$_('opinionForm.stepOpinion')}
				</h3>
				<label class="mt-2 block text-sm text-white/70">
					{$_('opinionForm.titleLabel')}
					<input
						bind:value={heading}
						class="mt-1 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-white"
						placeholder={$_('opinionForm.titlePlaceholder')}
					/>
				</label>
				<label class="mt-3 block text-sm text-white/70">
					{$_('opinionForm.descLabel')}
					<textarea
						bind:value={description}
						rows="3"
						class="mt-1 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-white"
						placeholder={$_('opinionForm.descPlaceholder')}
					></textarea>
				</label>

				{#if showPlacement}
					<label class="mt-3 block text-sm text-white/70">
						{$_('discussion.form.placement', { values: { fraction } })}
						<input type="range" min="5" max="95" bind:value={fraction} class="mt-1 w-full" />
					</label>
				{/if}

				{#if onaskplacement}
					<button
						type="button"
						onclick={() => onaskplacement({ heading, description })}
						disabled={placementBusy || !heading.trim()}
						class="mt-2 text-xs text-violet-300 underline-offset-2 hover:underline disabled:opacity-40"
					>
						{placementBusy ? $_('discussion.form.aiCheck') : $_('opinionForm.placementCheck')}
					</button>
				{/if}
				{#if placementNote}
					<p
						class="mt-2 rounded-lg border border-violet-400/30 bg-violet-500/10 p-3 text-sm text-violet-100"
					>
						{$_('discussion.form.aiNote')}
						{placementNote}
					</p>
				{/if}
			</section>

			<!-- 2. Its clauses -->
			<section class="mt-6">
				<div class="flex flex-wrap items-end justify-between gap-2">
					<div>
						<h3 class="text-xs font-semibold tracking-wider text-white/45">
							{$_('opinionForm.stepClauses')}
						</h3>
						<p class="mt-1 text-sm text-white/60">{$_('opinionForm.clausesSub')}</p>
					</div>
				</div>

				<div class="mt-3 flex flex-wrap gap-2">
					<button
						type="button"
						onclick={addRow}
						class="rounded-lg border border-white/20 px-3 py-2 text-sm text-white/85 hover:bg-white/10"
					>
						{$_('opinionForm.addClause')}
					</button>
					<button
						type="button"
						onclick={decompose}
						disabled={aiBusy || !heading.trim()}
						title={heading.trim() ? '' : $_('opinionForm.aiNeedsText')}
						class="rounded-lg border border-violet-400/40 bg-violet-500/10 px-3 py-2 text-sm text-violet-100 hover:bg-violet-500/20 disabled:opacity-40"
					>
						{aiBusy
							? $_('opinionForm.aiDecomposing')
							: rows.some((r) => r.origin === 'ai')
								? $_('opinionForm.aiRedo')
								: $_('opinionForm.aiDecompose')}
					</button>
				</div>

				{#if aiMessage}
					<p class="mt-2 text-sm text-amber-200">{aiMessage}</p>
				{/if}

				{#if issues.length > 0}
					<datalist id="opinion-form-issues">
						{#each issues as issue (issue.id)}
							<option value={issue.title}></option>
						{/each}
					</datalist>
				{/if}

				<ol class="mt-3 space-y-3">
					{#each rows as r, i (r.key)}
						<li class="rounded-xl border border-white/10 bg-white/[0.04] p-3">
							<div class="flex items-center justify-between gap-2">
								<span class="text-xs font-semibold text-white/55">
									{$_('opinionForm.clauseN', { values: { n: i + 1 } })}
									{#if r.origin === 'ai'}
										<span
											class="ms-1 rounded-full bg-violet-500/20 px-2 py-0.5 text-[0.68rem] text-violet-200"
											>{$_('opinionForm.originAI')}</span
										>
									{/if}
								</span>
								<button
									type="button"
									onclick={() => removeRow(r.key)}
									class="text-xs text-white/45 hover:text-rose-300"
								>
									{$_('opinionForm.remove')}
								</button>
							</div>

							<label class="mt-2 block text-xs text-white/60">
								{$_('opinionForm.issueLabel')}
								{#if isNewIssue(r)}
									<span class="ms-1 text-amber-200/80">· {$_('opinionForm.newIssue')}</span>
								{/if}
								<input
									bind:value={r.issueTitle}
									list={issues.length > 0 ? 'opinion-form-issues' : undefined}
									placeholder={$_('opinionForm.issuePlaceholder')}
									class="mt-1 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-sm text-white"
								/>
							</label>

							<label class="mt-2 block text-xs text-white/60">
								{$_('opinionForm.bodyLabel')}
								<textarea
									bind:value={r.body}
									rows="2"
									placeholder={$_('opinionForm.bodyPlaceholder')}
									class="mt-1 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white"
								></textarea>
							</label>

							<label class="mt-2 block text-xs text-white/60">
								{$_('opinionForm.stance', { values: { value: r.stanceValue } })}
								<input
									type="range"
									min="0"
									max="100"
									bind:value={r.stanceValue}
									class="mt-1 w-full"
								/>
							</label>
						</li>
					{:else}
						<li
							class="rounded-xl border border-dashed border-white/15 p-4 text-center text-sm text-white/50"
						>
							{$_('opinionForm.noClauses')}
						</li>
					{/each}
				</ol>

				{#if openGaps.length > 0}
					<div class="mt-4 rounded-xl border border-amber-400/30 bg-amber-500/5 p-3">
						<p class="text-sm text-amber-100">{$_('opinionForm.gapsTitle')}</p>
						<div class="mt-2 flex flex-wrap gap-2">
							{#each openGaps as g (g.issueTitle)}
								<button
									type="button"
									onclick={() => addGap(g)}
									class="rounded-full border border-amber-400/40 px-3 py-1 text-xs text-amber-100 hover:bg-amber-500/15"
								>
									+ {g.issueTitle}
								</button>
							{/each}
						</div>
					</div>
				{/if}
			</section>

			{#if error}
				<p class="mt-4 rounded-lg border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-100">
					{error}
				</p>
			{/if}
		</div>

		<footer
			class="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 px-5 py-3"
		>
			<span class="text-xs text-white/45">
				{filledRows.length > 0
					? $_('opinionForm.clauseCount', { values: { n: filledRows.length } })
					: $_('opinionForm.autoHint')}
			</span>
			<div class="flex gap-2">
				<button
					type="button"
					onclick={oncancel}
					disabled={busy}
					class="rounded-lg px-3 py-2 text-sm text-white/60 hover:text-white"
				>
					{$_('discussion.form.cancel')}
				</button>
				<button
					type="button"
					onclick={submit}
					disabled={!heading.trim() || busy}
					class="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-40"
				>
					{busy ? $_('opinionForm.saving') : $_('opinionForm.submit')}
				</button>
			</div>
		</footer>
	</div>
</div>
