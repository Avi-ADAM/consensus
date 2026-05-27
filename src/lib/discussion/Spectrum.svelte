<script lang="ts">
	import Tile from './Tile.svelte';
	import {
		consensusScore,
		sortByLocation,
		toDisplay,
		weightedCenter,
		type InsertMode,
		type Opinion
	} from './scale';

	interface Props {
		opinions: Opinion[];
		canPropose?: boolean;
		canVote?: boolean;
		oninsert?: (mode: InsertMode) => void;
		onsupport?: (id: string) => void;
		onopen?: (id: string) => void;
	}

	let {
		opinions,
		canPropose = false,
		canVote = false,
		oninsert = () => {},
		onsupport = () => {},
		onopen = () => {}
	}: Props = $props();

	let sorted = $derived(sortByLocation(opinions));
	let displayById = $derived(new Map(toDisplay(opinions).map((d) => [d.id, d.display])));
	let center = $derived(weightedCenter(opinions));
	let score = $derived(consensusScore(opinions));
	let hoveredId = $state<string | null>(null);

	function diameter(votes: number): number {
		return 24 + Math.min(votes, 12) * 4;
	}
</script>

<div class="relative mx-auto h-[70vh] min-h-[480px] w-full max-w-3xl">
	<!-- vertical axis -->
	<div
		class="absolute top-0 bottom-0 left-1/2 w-0.5 -translate-x-1/2 rounded-full bg-gradient-to-b from-violet-500/60 via-indigo-400/30 to-violet-500/60"
	></div>

	<!-- consensus center marker -->
	<div
		class="absolute right-2 left-2 flex items-center gap-2 transition-all duration-500"
		style="top: {center}%"
	>
		<div class="h-px flex-1 bg-emerald-400/50 [border-top:1px_dashed_rgb(52_211_153/0.6)]"></div>
		<span class="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-200"
			>מרכז הסכמה · {score}%</span
		>
		<div class="h-px flex-1 bg-emerald-400/50 [border-top:1px_dashed_rgb(52_211_153/0.6)]"></div>
	</div>

	<!-- add beyond top -->
	{#if canPropose && sorted.length > 0}
		<button
			type="button"
			class="absolute left-1/2 -translate-x-1/2 -translate-y-full rounded-full border border-violet-400/40 bg-violet-500/20 px-3 py-1 text-sm text-violet-100 hover:bg-violet-500/40"
			style="top: 0"
			onclick={() => oninsert({ mode: 'beyond_top' })}
		>
			➕ דעה קיצונית למעלה
		</button>
	{/if}

	{#each sorted as opinion, i (opinion.id)}
		{@const display = displayById.get(opinion.id) ?? 50}
		{@const big = hoveredId === opinion.id}
		{@const side = i % 2 === 0 ? 'right' : 'left'}
		<!-- node -->
		<div
			class="absolute z-10 -translate-x-1/2 -translate-y-1/2 transition-all duration-500"
			style="top: {display}%; left: 50%"
		>
			<div
				role="button"
				tabindex="0"
				class="rounded-full border border-white/30 bg-white/10 shadow-lg backdrop-blur-md transition-all duration-300"
				style="width: {diameter(opinion.votes)}px; height: {diameter(opinion.votes)}px"
				onmouseenter={() => (hoveredId = opinion.id)}
				onmouseleave={() => (hoveredId = null)}
				onfocus={() => (hoveredId = opinion.id)}
				onblur={() => (hoveredId = null)}
			></div>
		</div>

		<!-- card -->
		<div
			class="absolute z-20 w-56 transition-all duration-500"
			class:text-right={side === 'right'}
			style="top: {display}%; {side === 'right'
				? 'left: calc(50% + 28px)'
				: 'right: calc(50% + 28px)'}; transform: translateY(-50%)"
		>
			<div
				role="group"
				onmouseenter={() => (hoveredId = opinion.id)}
				onmouseleave={() => (hoveredId = null)}
			>
				<Tile
					word={opinion.heading}
					color={opinion.color}
					{big}
					muted={!big && opinion.votes === 0}
				/>
				{#if opinion.isAnchor}
					<span class="mr-1 text-[10px] text-white/40"
						>{opinion.pole === 'top' ? 'עוגן עליון' : 'עוגן תחתון'}</span
					>
				{/if}
				{#if big && opinion.description}
					<p class="mt-1 text-xs leading-relaxed text-white/70">{opinion.description}</p>
				{/if}
				<div class="mt-1 flex items-center gap-2" class:justify-end={side === 'right'}>
					<span class="text-xs text-white/50">{opinion.votes} תומכים</span>
					{#if canVote}
						<button
							type="button"
							class="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-200 hover:bg-emerald-500/40"
							onclick={() => onsupport(opinion.id)}
						>
							תמיכה
						</button>
					{/if}
					<button
						type="button"
						class="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/70 hover:bg-white/20"
						onclick={() => onopen(opinion.id)}
					>
						יתרונות/חסרונות
					</button>
				</div>
			</div>
		</div>

		<!-- add between this node and the next -->
		{#if canPropose && i < sorted.length - 1}
			{@const nextDisplay = displayById.get(sorted[i + 1].id) ?? display}
			<button
				type="button"
				class="absolute left-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-full border border-violet-400/40 bg-violet-500/20 px-2 py-0.5 text-xs text-violet-100 transition-all duration-500 hover:bg-violet-500/40"
				style="top: {(display + nextDisplay) / 2}%"
				onclick={() =>
					oninsert({ mode: 'between', afterId: opinion.id, beforeId: sorted[i + 1].id })}
			>
				➕ ביניהן
			</button>
		{/if}
	{/each}

	<!-- add beyond bottom -->
	{#if canPropose && sorted.length > 0}
		<button
			type="button"
			class="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full rounded-full border border-violet-400/40 bg-violet-500/20 px-3 py-1 text-sm text-violet-100 hover:bg-violet-500/40"
			onclick={() => oninsert({ mode: 'beyond_bottom' })}
		>
			➕ דעה קיצונית למטה
		</button>
	{/if}
</div>
