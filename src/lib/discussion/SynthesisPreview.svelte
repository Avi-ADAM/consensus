<script lang="ts">
	import type { SynthesisDraft } from './decompose';

	interface Props {
		draft: SynthesisDraft;
		saving?: boolean;
		onconfirm?: () => void;
		onclose?: () => void;
	}

	let { draft, saving = false, onconfirm = () => {}, onclose = () => {} }: Props = $props();
</script>

<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" dir="rtl">
	<div
		class="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl border border-emerald-400/25 bg-[#15152a] p-6 text-white shadow-2xl"
	>
		<div class="flex items-start justify-between gap-4">
			<div>
				<p class="text-xs text-emerald-300/70">נוסחת אמצע מוצעת</p>
				<h2 class="text-lg font-bold">{draft.heading}</h2>
			</div>
			<button
				type="button"
				onclick={onclose}
				class="rounded-lg px-2 py-1 text-sm text-white/60 hover:text-white"
				aria-label="סגירה">✕</button
			>
		</div>

		{#if draft.description}
			<p class="mt-2 text-sm text-white/70">{draft.description}</p>
		{/if}

		{#if draft.rationale}
			<div
				class="mt-3 rounded-xl border border-emerald-400/25 bg-emerald-500/10 p-3 text-sm text-emerald-50"
			>
				למה זה עובד לשני הצדדים: {draft.rationale}
			</div>
		{/if}

		<div class="mt-4 flex-1 space-y-2 overflow-y-auto">
			<p class="text-xs text-white/50">סעיפי הנוסחה לפי היבט</p>
			{#each draft.clauses as clause, i (i)}
				<div class="rounded-lg border border-white/10 bg-white/5 p-3 text-sm">
					{#if clause.issueTitle}
						<p class="mb-1 text-xs font-semibold text-white/60">{clause.issueTitle}</p>
					{/if}
					<p class="text-white/90">{clause.body}</p>
					<div class="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
						<div
							class="h-full rounded-full bg-emerald-400/70"
							style="width: {clause.stanceValue}%"
						></div>
					</div>
				</div>
			{/each}
			{#if draft.clauses.length === 0}
				<p class="text-sm text-white/40">לא הופקו סעיפים.</p>
			{/if}
		</div>

		<div class="mt-5 flex justify-end gap-2 border-t border-white/10 pt-4">
			<button type="button" onclick={onclose} class="rounded-lg px-3 py-2 text-sm text-white/60">
				ביטול
			</button>
			<button
				type="button"
				onclick={onconfirm}
				disabled={saving || draft.clauses.length === 0}
				class="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-40"
			>
				{saving ? 'מוסיף…' : 'הוספה לדיון כדעה'}
			</button>
		</div>
	</div>
</div>
