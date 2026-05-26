<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import PlacePicker from '$lib/discussion/PlacePicker.svelte';
	import { createDiscussion } from '$lib/discussion/api';

	let { data } = $props();

	let canCreate = $derived(data.user.type === 'registered');

	let topic = $state('');
	let description = $state('');
	let topHeading = $state('');
	let topDescription = $state('');
	let bottomHeading = $state('');
	let bottomDescription = $state('');
	let maxRounds = $state(3);
	let visibility = $state<'private' | 'unlisted' | 'local'>('private');
	let placeIds = $state<string[]>([]);

	let places = $state<{ id: string; name: string }[]>([]);
	let busy = $state(false);
	let error = $state<string | null>(null);

	let valid = $derived(
		topic.trim() !== '' && topHeading.trim() !== '' && bottomHeading.trim() !== ''
	);

	onMount(async () => {
		try {
			const res = await fetch('/api/places');
			const out = await res.json();
			places = out.places ?? [];
		} catch {
			places = [];
		}
	});

	async function submit() {
		if (!valid || busy) return;
		busy = true;
		error = null;
		try {
			const result = await createDiscussion({
				topic: topic.trim(),
				description: description.trim(),
				visibility,
				isLocal: visibility === 'local',
				placeIds: visibility === 'local' ? placeIds : [],
				maxRounds,
				anchorTop: { heading: topHeading.trim(), description: topDescription.trim() },
				anchorBottom: { heading: bottomHeading.trim(), description: bottomDescription.trim() }
			});
			if (result) {
				await goto(resolve('/negotiation/[id]', { id: result.id }));
			} else {
				error = 'יצירת הדיון נכשלה. ודאו שהשרת מחובר ונסו שוב.';
			}
		} catch {
			error = 'שגיאה ביצירת הדיון. ודאו שהשרת מחובר ונסו שוב.';
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head><title>דיון חדש</title></svelte:head>

<main dir="rtl" class="min-h-screen bg-[#09090f] px-4 py-8 text-white">
	<div class="mx-auto max-w-xl">
		<h1 class="text-2xl font-bold">דיון חדש</h1>

		{#if !canCreate}
			<div
				class="mt-4 rounded-lg border border-amber-400/30 bg-amber-500/10 p-4 text-sm text-amber-100"
			>
				יצירת דיון פתוחה למשתמשים רשומים בלבד.
				<a class="underline" href="https://www.1lev1.com/login">התחברו</a> כדי להתחיל דיון.
			</div>
		{:else}
			<p class="mt-2 text-sm text-white/60">
				הגדירו את הנושא ואת שתי דעות-העוגן שמגדירות את קצוות הסקאלה. משתתפים יוסיפו דעות ביניהן או
				מעבר לקצוות.
			</p>

			<label class="mt-6 block text-sm text-white/70">
				נושא הדיון
				<input
					bind:value={topic}
					class="mt-1 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-white"
					placeholder="במשפט אחד וברור"
				/>
			</label>

			<label class="mt-3 block text-sm text-white/70">
				תיאור (לא חובה)
				<textarea
					bind:value={description}
					rows="2"
					class="mt-1 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-white"
				></textarea>
			</label>

			<div class="mt-6 grid gap-4 sm:grid-cols-2">
				<div class="rounded-xl border border-white/10 bg-white/5 p-4">
					<h2 class="text-sm font-semibold text-violet-200">דעת-עוגן עליונה</h2>
					<input
						bind:value={topHeading}
						class="mt-2 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white"
						placeholder="כותרת"
					/>
					<textarea
						bind:value={topDescription}
						rows="2"
						class="mt-2 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white"
						placeholder="הסבר (לא חובה)"
					></textarea>
				</div>
				<div class="rounded-xl border border-white/10 bg-white/5 p-4">
					<h2 class="text-sm font-semibold text-violet-200">דעת-עוגן תחתונה</h2>
					<input
						bind:value={bottomHeading}
						class="mt-2 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white"
						placeholder="כותרת"
					/>
					<textarea
						bind:value={bottomDescription}
						rows="2"
						class="mt-2 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white"
						placeholder="הסבר (לא חובה)"
					></textarea>
				</div>
			</div>

			<fieldset class="mt-6">
				<legend class="text-sm text-white/70">נראות</legend>
				<div class="mt-2 flex flex-wrap gap-4 text-sm">
					<label class="flex items-center gap-2">
						<input type="radio" bind:group={visibility} value="private" /> פרטי (בהזמנה)
					</label>
					<label class="flex items-center gap-2">
						<input type="radio" bind:group={visibility} value="unlisted" /> משותף בלינק
					</label>
					<label class="flex items-center gap-2">
						<input type="radio" bind:group={visibility} value="local" /> מקומי
					</label>
				</div>
			</fieldset>

			{#if visibility === 'local'}
				<div class="mt-3">
					<p class="mb-2 text-sm text-white/70">בחרו מקום אחד או יותר</p>
					<PlacePicker {places} bind:selected={placeIds} />
				</div>
			{/if}

			<label class="mt-4 block text-sm text-white/70">
				מספר סבבים
				<input
					type="number"
					min="1"
					max="10"
					bind:value={maxRounds}
					class="mt-1 w-24 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-white"
				/>
			</label>

			{#if error}
				<p class="mt-4 rounded-lg border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-100">
					{error}
				</p>
			{/if}

			<button
				type="button"
				onclick={submit}
				disabled={!valid || busy}
				class="mt-6 rounded-lg bg-violet-600 px-5 py-2.5 font-semibold text-white hover:bg-violet-500 disabled:opacity-40"
			>
				{busy ? 'יוצר…' : 'צור דיון'}
			</button>
		{/if}
	</div>
</main>
