<script lang="ts">
	import { page } from '$app/state';
	import Spectrum from '$lib/discussion/Spectrum.svelte';
	import {
		colorFor,
		insertLocation,
		sortByLocation,
		type InsertMode,
		type Opinion
	} from '$lib/discussion/scale';
	import { permissionsFor } from '$lib/auth/permissions';
	import { SvelteSet } from 'svelte/reactivity';

	let { data } = $props();

	let perms = $derived(permissionsFor(data.user.type));

	// Local demo state until the backend qids exist. Two anchors define the poles.
	let topic = $state('האם להרחיב את שעות הפעילות של הספרייה הציבורית?');
	let opinions = $state<Opinion[]>([
		{
			id: 'anchor-top',
			heading: 'להשאיר כמו שהוא',
			description: 'אין צורך בשינוי; המשאבים מוגבלים.',
			location: 0,
			votes: 2,
			color: colorFor(0),
			isAnchor: true,
			pole: 'top',
			kind: 'opinion'
		},
		{
			id: 'anchor-bottom',
			heading: 'פתיחה 24/7',
			description: 'נגישות מרבית לכולם בכל שעה.',
			location: 100,
			votes: 1,
			color: colorFor(1),
			isAnchor: true,
			pole: 'bottom',
			kind: 'opinion'
		}
	]);

	let voted = new SvelteSet<string>();

	// Add-opinion flow
	let pending = $state<InsertMode | null>(null);
	let heading = $state('');
	let description = $state('');
	let fraction = $state(50);
	let aiNote = $state<string | null>(null);
	let aiBusy = $state(false);

	let resolvedInsert = $derived<InsertMode | null>(
		pending && pending.mode === 'between' ? { ...pending, fraction: fraction / 100 } : pending
	);

	let previewLocation = $derived(resolvedInsert ? insertLocation(opinions, resolvedInsert) : null);

	function openForm(mode: InsertMode) {
		pending = mode;
		heading = '';
		description = '';
		fraction = 50;
		aiNote = null;
	}

	function closeForm() {
		pending = null;
	}

	function submit() {
		if (!resolvedInsert || !heading.trim()) return;
		const location = insertLocation(opinions, resolvedInsert);
		opinions = [
			...opinions,
			{
				id: crypto.randomUUID(),
				heading: heading.trim(),
				description: description.trim(),
				location,
				votes: 0,
				color: colorFor(opinions.length),
				isAnchor: false,
				pole: 'none',
				kind: 'proposed_solution'
			}
		];
		closeForm();
	}

	function support(id: string) {
		if (voted.has(id)) return;
		voted.add(id);
		opinions = opinions.map((o) => (o.id === id ? { ...o, votes: o.votes + 1 } : o));
	}

	async function askAi() {
		if (!resolvedInsert || !heading.trim()) return;
		aiBusy = true;
		aiNote = null;
		try {
			const res = await fetch('/api/analyze', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					topic,
					heading,
					description,
					chosenLocation: previewLocation,
					neighbors: sortByLocation(opinions).map((o) => ({
						heading: o.heading,
						location: o.location
					}))
				})
			});
			const out = await res.json();
			aiNote = out.available
				? (out.data?.comment ?? out.data?.rationale ?? 'אין הערה.')
				: 'עוזר ה-AI אינו זמין כעת.';
		} catch {
			aiNote = 'שגיאה בפנייה לעוזר ה-AI.';
		} finally {
			aiBusy = false;
		}
	}
</script>

<svelte:head><title>דיון: {topic}</title></svelte:head>

<main dir="rtl" class="min-h-screen bg-[#09090f] px-4 py-8 text-white">
	<div class="mx-auto max-w-3xl">
		<p class="text-sm text-white/40">דיון #{page.params.id}</p>
		<h1 class="mt-1 text-2xl font-bold text-white">{topic}</h1>
		<p class="mt-2 text-sm text-white/60">
			שתי דעות-העוגן מגדירות את הקצוות. הוסיפו דעה ביניהן או קיצונית מעבר לקצה — לא חייב באמצע, אפשר
			קרוב מאוד לדעה קיימת.
		</p>

		{#if data.user.type === 'charter'}
			<div
				class="mt-3 rounded-lg border border-amber-400/30 bg-amber-500/10 p-3 text-sm text-amber-100"
			>
				אתם משתתפים כחותמי אמנה. כדי לערוך בעתיד או מדפדפן אחר —
				<a class="underline" href="https://www.1lev1.com/signup">צרו חשבון</a>.
			</div>
		{:else if data.user.type === 'guest'}
			<div class="mt-3 rounded-lg border border-white/15 bg-white/5 p-3 text-sm text-white/60">
				צפייה בלבד. כדי להשתתף, התחברו או הסכימו לאמנה.
			</div>
		{/if}
	</div>

	<div class="mt-10">
		<Spectrum
			{opinions}
			canPropose={perms.propose}
			canVote={perms.vote}
			oninsert={openForm}
			onsupport={support}
		/>
	</div>
</main>

{#if pending}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" dir="rtl">
		<div
			class="w-full max-w-md rounded-2xl border border-white/15 bg-[#15152a] p-6 text-white shadow-2xl"
		>
			<h2 class="text-lg font-bold">
				{pending.mode === 'beyond_top'
					? 'דעה קיצונית למעלה'
					: pending.mode === 'beyond_bottom'
						? 'דעה קיצונית למטה'
						: 'דעה ביניהן'}
			</h2>

			<label class="mt-4 block text-sm text-white/70">
				כותרת
				<input
					bind:value={heading}
					class="mt-1 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-white"
					placeholder="נסחו את הדעה במשפט"
				/>
			</label>

			<label class="mt-3 block text-sm text-white/70">
				הסבר (לא חובה)
				<textarea
					bind:value={description}
					rows="2"
					class="mt-1 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-white"
				></textarea>
			</label>

			{#if pending.mode === 'between'}
				<label class="mt-3 block text-sm text-white/70">
					מיקום בין שתי הדעות — {fraction}%
					<input type="range" min="5" max="95" bind:value={fraction} class="mt-1 w-full" />
				</label>
			{/if}

			{#if aiNote}
				<p
					class="mt-3 rounded-lg border border-violet-400/30 bg-violet-500/10 p-3 text-sm text-violet-100"
				>
					🤖 {aiNote}
				</p>
			{/if}

			<div class="mt-5 flex items-center justify-between gap-2">
				<button
					type="button"
					onclick={askAi}
					disabled={aiBusy || !heading.trim()}
					class="rounded-lg border border-violet-400/40 px-3 py-2 text-sm text-violet-100 hover:bg-violet-500/20 disabled:opacity-40"
				>
					{aiBusy ? 'בודק…' : 'שאלו את ה-AI'}
				</button>
				<div class="flex gap-2">
					<button
						type="button"
						onclick={closeForm}
						class="rounded-lg px-3 py-2 text-sm text-white/60"
					>
						ביטול
					</button>
					<button
						type="button"
						onclick={submit}
						disabled={!heading.trim()}
						class="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-40"
					>
						הוספה
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}
