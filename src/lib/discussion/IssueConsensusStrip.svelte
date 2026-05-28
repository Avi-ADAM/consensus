<script lang="ts">
	import { issueConsensus, type Clause, type Issue } from './scale';

	interface Props {
		issues: Issue[];
		/** All clauses in the discussion. */
		clauses: Clause[];
	}

	let { issues, clauses }: Props = $props();

	let rows = $derived(issueConsensus(clauses, issues).filter((r) => r.clauseCount > 0));

	function tone(score: number): string {
		if (score >= 70) return 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200';
		if (score >= 40) return 'border-amber-400/40 bg-amber-500/10 text-amber-200';
		return 'border-rose-400/40 bg-rose-500/10 text-rose-200';
	}
</script>

{#if rows.length > 0}
	<div class="rounded-xl border border-white/10 bg-white/5 p-3">
		<p class="mb-2 text-xs text-white/50">קונצנזוס לפי היבט</p>
		<div class="flex flex-wrap gap-2">
			{#each rows as row (row.issueId)}
				<span
					class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs {tone(
						row.score
					)}"
				>
					<span>{row.title}</span>
					<span class="font-semibold">{row.score}%</span>
				</span>
			{/each}
		</div>
	</div>
{/if}
