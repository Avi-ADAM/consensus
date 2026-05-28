<script lang="ts">
	import { dominantClause, missingIssues, type Clause, type Issue } from './scale';

	interface Props {
		title: string;
		/** This opinion's clauses. */
		clauses: Clause[];
		/** All issues raised in the discussion. */
		issues: Issue[];
		selfPlacement?: number;
		derivedLocation: number;
		canAdd?: boolean;
		loading?: boolean;
		fillingIssueId?: string | null;
		onfill?: (issue: Issue) => void;
		onclose?: () => void;
	}

	let {
		title,
		clauses,
		issues,
		selfPlacement,
		derivedLocation,
		canAdd = false,
		loading = false,
		fillingIssueId = null,
		onfill = () => {},
		onclose = () => {}
	}: Props = $props();

	let sortedIssues = $derived([...issues].sort((a, b) => a.order - b.order));
	let clausesByIssue = $derived(
		new Map(sortedIssues.map((i) => [i.id, clauses.filter((c) => c.issueId === i.id)]))
	);
	let unclassified = $derived(clauses.filter((c) => c.issueId === null));
	let gaps = $derived(missingIssues(clauses, issues));
	let pulling = $derived(
		typeof selfPlacement === 'number' ? dominantClause(clauses, selfPlacement) : null
	);
	let drift = $derived(
		typeof selfPlacement === 'number' ? Math.round(derivedLocation) - Math.round(selfPlacement) : 0
	);
</script>

<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" dir="rtl">
	<div
		class="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl border border-white/15 bg-[#15152a] p-6 text-white shadow-2xl"
	>
		<div class="flex items-start justify-between gap-4">
			<div>
				<p class="text-xs text-white/40">סעיפי הדעה</p>
				<h2 class="text-lg font-bold">{title}</h2>
			</div>
			<button
				type="button"
				onclick={onclose}
				class="rounded-lg px-2 py-1 text-sm text-white/60 hover:text-white"
				aria-label="סגירה">✕</button
			>
		</div>

		{#if loading}
			<p class="mt-6 text-sm text-white/50">טוען…</p>
		{:else}
			{#if clauses.length > 0 && typeof selfPlacement === 'number'}
				<div
					class="mt-4 rounded-xl border border-violet-400/25 bg-violet-500/10 p-3 text-sm text-violet-50"
				>
					לפי הסעיפים שלך המיקום הנגזר הוא <strong>{Math.round(derivedLocation)}</strong>, וסימנת את
					עצמך ב-<strong>{Math.round(selfPlacement)}</strong>.
					{#if Math.abs(drift) >= 5 && pulling}
						מה שהכי מושך אותך לכיוון הוא הסעיף: "{pulling.body}".
					{/if}
				</div>
			{/if}

			<div class="mt-4 flex-1 space-y-4 overflow-y-auto">
				{#each sortedIssues as issue (issue.id)}
					{@const issueClauses = clausesByIssue.get(issue.id) ?? []}
					{#if issueClauses.length > 0}
						<section>
							<h3 class="mb-2 text-sm font-semibold text-white/80">{issue.title}</h3>
							<ul class="space-y-2">
								{#each issueClauses as clause (clause.id)}
									<li class="rounded-lg border border-white/10 bg-white/5 p-3 text-sm">
										<p class="text-white/90">{clause.body}</p>
										<div class="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
											<div
												class="h-full rounded-full bg-violet-400/70"
												style="width: {clause.stanceValue}%"
											></div>
										</div>
									</li>
								{/each}
							</ul>
						</section>
					{/if}
				{/each}

				{#if unclassified.length > 0}
					<section>
						<h3 class="mb-2 text-sm font-semibold text-white/50">ללא שיוך להיבט</h3>
						<ul class="space-y-2">
							{#each unclassified as clause (clause.id)}
								<li class="rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-white/90">
									{clause.body}
								</li>
							{/each}
						</ul>
					</section>
				{/if}

				{#if gaps.length > 0}
					<section class="rounded-xl border border-amber-400/30 bg-amber-500/5 p-3">
						<h3 class="mb-1 text-sm font-semibold text-amber-200">
							סעיפים חסרים — היבטים שדעות אחרות התייחסו אליהם
						</h3>
						<p class="mb-3 text-xs text-amber-100/70">הדעה הזו עדיין לא מתייחסת אליהם.</p>
						<ul class="space-y-2">
							{#each gaps as issue (issue.id)}
								<li class="flex items-center justify-between gap-3 text-sm">
									<span class="text-white/90">{issue.title}</span>
									{#if canAdd}
										<button
											type="button"
											onclick={() => onfill(issue)}
											disabled={fillingIssueId === issue.id}
											class="shrink-0 rounded-full border border-amber-400/40 px-3 py-1 text-xs text-amber-100 hover:bg-amber-500/20 disabled:opacity-50"
										>
											{fillingIssueId === issue.id ? 'משלים…' : 'השלם עם AI'}
										</button>
									{/if}
								</li>
							{/each}
						</ul>
					</section>
				{/if}

				{#if clauses.length === 0 && gaps.length === 0}
					<p class="text-sm text-white/40">אין עדיין סעיפים לדעה זו.</p>
				{/if}
			</div>
		{/if}
	</div>
</div>
