<script lang="ts">
	import type { Argument, Stance } from './api';

	interface Props {
		title: string;
		args: Argument[];
		loading?: boolean;
		canAdd?: boolean;
		canVote?: boolean;
		oncreate?: (stance: Stance, body: string) => void;
		onsupport?: (id: string) => void;
		onclose?: () => void;
	}

	let {
		title,
		args,
		loading = false,
		canAdd = false,
		canVote = false,
		oncreate = () => {},
		onsupport = () => {},
		onclose = () => {}
	}: Props = $props();

	let draft = $state('');

	let pros = $derived(args.filter((a) => a.stance === 'pro').sort((a, b) => b.votes - a.votes));
	let cons = $derived(args.filter((a) => a.stance === 'con').sort((a, b) => b.votes - a.votes));

	function add(stance: Stance) {
		const body = draft.trim();
		if (!body) return;
		oncreate(stance, body);
		draft = '';
	}
</script>

<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" dir="rtl">
	<div
		class="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl border border-white/15 bg-[#15152a] p-6 text-white shadow-2xl"
	>
		<div class="flex items-start justify-between gap-4">
			<h2 class="text-lg font-bold">{title}</h2>
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
			<div class="mt-4 grid flex-1 gap-4 overflow-y-auto sm:grid-cols-2">
				<section>
					<h3 class="mb-2 text-sm font-semibold text-emerald-300">יתרונות</h3>
					<ul class="space-y-2">
						{#each pros as a (a.id)}
							<li class="rounded-lg border border-emerald-400/20 bg-emerald-500/5 p-3 text-sm">
								<p class="text-white/90">{a.body}</p>
								<div class="mt-2 flex items-center gap-2">
									<span class="text-xs text-white/40">{a.votes} תומכים</span>
									{#if canVote}
										<button
											type="button"
											onclick={() => onsupport(a.id)}
											class="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-200 hover:bg-emerald-500/40"
											>תמיכה</button
										>
									{/if}
								</div>
							</li>
						{/each}
						{#if pros.length === 0}
							<li class="text-xs text-white/40">אין עדיין יתרונות.</li>
						{/if}
					</ul>
				</section>

				<section>
					<h3 class="mb-2 text-sm font-semibold text-rose-300">חסרונות</h3>
					<ul class="space-y-2">
						{#each cons as a (a.id)}
							<li class="rounded-lg border border-rose-400/20 bg-rose-500/5 p-3 text-sm">
								<p class="text-white/90">{a.body}</p>
								<div class="mt-2 flex items-center gap-2">
									<span class="text-xs text-white/40">{a.votes} תומכים</span>
									{#if canVote}
										<button
											type="button"
											onclick={() => onsupport(a.id)}
											class="rounded-full bg-rose-500/20 px-2 py-0.5 text-xs text-rose-200 hover:bg-rose-500/40"
											>תמיכה</button
										>
									{/if}
								</div>
							</li>
						{/each}
						{#if cons.length === 0}
							<li class="text-xs text-white/40">אין עדיין חסרונות.</li>
						{/if}
					</ul>
				</section>
			</div>

			{#if canAdd}
				<div class="mt-4 border-t border-white/10 pt-4">
					<textarea
						bind:value={draft}
						rows="2"
						placeholder="כתבו טיעון…"
						class="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white"
					></textarea>
					<div class="mt-2 flex gap-2">
						<button
							type="button"
							onclick={() => add('pro')}
							disabled={!draft.trim()}
							class="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-40"
							>הוסיפו יתרון</button
						>
						<button
							type="button"
							onclick={() => add('con')}
							disabled={!draft.trim()}
							class="rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-rose-500 disabled:opacity-40"
							>הוסיפו חיסרון</button
						>
					</div>
				</div>
			{/if}
		{/if}
	</div>
</div>
