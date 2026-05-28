<script lang="ts">
	import { sortByLocation, type Clause, type Issue, type Opinion } from './scale';

	interface Props {
		issues: Issue[];
		clauses: Clause[];
		opinions: Opinion[];
	}

	let { issues, clauses, opinions }: Props = $props();

	let sortedIssues = $derived([...issues].sort((a, b) => a.order - b.order));
	let cols = $derived(sortByLocation(opinions));
	let cellMap = $derived(new Map(clauses.map((c) => [`${c.positionId}:${c.issueId}`, c] as const)));

	function cell(positionId: string, issueId: string): Clause | undefined {
		return cellMap.get(`${positionId}:${issueId}`);
	}
</script>

{#if sortedIssues.length > 0 && cols.length > 0}
	<div class="overflow-x-auto rounded-xl border border-white/10 bg-white/5">
		<table class="w-full border-collapse text-sm" dir="rtl">
			<thead>
				<tr>
					<th
						class="sticky right-0 z-10 min-w-28 bg-[#15152a] p-2 text-right text-xs font-semibold text-white/50"
					>
						היבט
					</th>
					{#each cols as opinion (opinion.id)}
						<th class="min-w-40 p-2 text-right text-xs font-semibold text-white/80">
							<span class="line-clamp-2">{opinion.heading}</span>
						</th>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#each sortedIssues as issue (issue.id)}
					<tr class="border-t border-white/10">
						<th
							class="sticky right-0 z-10 min-w-28 bg-[#15152a] p-2 text-right align-top text-xs font-medium text-white/70"
						>
							{issue.title}
						</th>
						{#each cols as opinion (opinion.id)}
							{@const c = cell(opinion.id, issue.id)}
							<td class="min-w-40 p-2 align-top">
								{#if c}
									<p class="text-xs leading-snug text-white/85">{c.body}</p>
									<div class="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-white/10">
										<div
											class="h-full rounded-full bg-violet-400/70"
											style="width: {c.stanceValue}%"
										></div>
									</div>
								{:else}
									<span
										class="inline-block rounded border border-amber-400/30 bg-amber-500/5 px-1.5 py-0.5 text-[10px] text-amber-200/80"
									>
										חסר
									</span>
								{/if}
							</td>
						{/each}
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{:else}
	<p class="text-sm text-white/40">אין עדיין סעיפים להשוואה.</p>
{/if}
