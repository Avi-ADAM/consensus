<script lang="ts">
	import Spectrum from '$lib/discussion/Spectrum.svelte';
	import {
		colorFor,
		insertLocation,
		locationFromClauses,
		sortByLocation,
		type Clause,
		type InsertMode,
		type Issue,
		type Opinion
	} from '$lib/discussion/scale';
	import {
		createArgument,
		createClause,
		createPosition,
		listArguments,
		listClauses,
		listIssues,
		loadDiscussion,
		supportArgument,
		supportPosition,
		updateClause,
		updatePositionLocation,
		type Argument,
		type Stance
	} from '$lib/discussion/api';
	import {
		decomposeAndPersist,
		fillGap,
		persistSynthesis,
		requestSynthesis,
		type SynthesisDraft
	} from '$lib/discussion/decompose';
	import ArgumentsPanel from '$lib/discussion/ArgumentsPanel.svelte';
	import ClausesPanel from '$lib/discussion/ClausesPanel.svelte';
	import IssueConsensusStrip from '$lib/discussion/IssueConsensusStrip.svelte';
	import IssueMatrix from '$lib/discussion/IssueMatrix.svelte';
	import SynthesisPreview from '$lib/discussion/SynthesisPreview.svelte';
	import { permissionsFor } from '$lib/auth/permissions';
	import { SvelteSet } from 'svelte/reactivity';
	import { page } from '$app/state';
	import { ShareButtons } from '@1lev1/svelte-share';

	let { data } = $props();

	let perms = $derived(permissionsFor(data.user.type));
	let live = $derived(data.loaded !== null);

	// Fallback demo content when the backend is not connected yet.
	const SEED_TOPIC = 'האם להרחיב את שעות הפעילות של הספרייה הציבורית?';
	const SEED_OPINIONS: Opinion[] = [
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
	];

	// Server data is the source; local edits overlay it and reset on navigation.
	let base = $derived(data.loaded ?? { meta: { topic: SEED_TOPIC }, opinions: SEED_OPINIONS });
	let localOpinions = $state<Opinion[] | null>(null);
	let opinions = $derived(localOpinions ?? base.opinions);
	let topic = $derived(base.meta.topic);
	let meta = $derived(data.loaded?.meta ?? null);
	let shareable = $derived(!!meta?.shareToken && meta.visibility !== 'private');
	let showShare = $state(false);
	let voted = new SvelteSet<string>();

	// Structured arguments (pros & cons) per opinion
	let openId = $state<string | null>(null);
	let args = $state<Argument[]>([]);
	let argsLoading = $state(false);
	let argVoted = new SvelteSet<string>();
	let demoArgs = $state<Record<string, Argument[]>>({});
	let openOpinion = $derived(opinions.find((o) => o.id === openId) ?? null);

	// Clauses & issues (clause-level decomposition)
	let issues = $state<Issue[]>([]);
	let clauses = $state<Clause[]>([]);
	let clausesOpenId = $state<string | null>(null);
	let clausesLoading = $state(false);
	let fillingIssueId = $state<string | null>(null);
	let clausesOpinion = $derived(opinions.find((o) => o.id === clausesOpenId) ?? null);
	let openClauses = $derived(clauses.filter((c) => c.positionId === clausesOpenId));
	let savingClauseId = $state<string | null>(null);
	let canEditClauses = $derived(
		live &&
			perms.editOwn &&
			!!clausesOpinion?.authorExternalId &&
			clausesOpinion.authorExternalId === data.user.id
	);

	// Overview: spectrum (default) vs issue matrix
	let view = $state<'spectrum' | 'matrix'>('spectrum');

	// Middle-ground synthesis
	let synthDraft = $state<SynthesisDraft | null>(null);
	let synthBusy = $state(false);
	let synthSaving = $state(false);
	let synthError = $state<string | null>(null);
	let canSynthesize = $derived(live && perms.propose && issues.length > 0 && opinions.length >= 2);

	async function loadClauseData() {
		if (!live) return;
		try {
			const [nextIssues, nextClauses] = await Promise.all([
				listIssues(data.id),
				listClauses(data.id)
			]);
			issues = nextIssues;
			clauses = nextClauses;
		} catch {
			issues = [];
			clauses = [];
		}
	}

	$effect(() => {
		const _id = data.id; // track navigation to reset the local overlay
		localOpinions = null;
		voted.clear();
		openId = null;
		clausesOpenId = null;
		issues = [];
		clauses = [];
		synthDraft = null;
		synthError = null;
		loadClauseData();
	});

	// Add-opinion flow
	let pending = $state<InsertMode | null>(null);
	let heading = $state('');
	let description = $state('');
	let fraction = $state(50);
	let aiNote = $state<string | null>(null);
	let aiBusy = $state(false);
	let submitError = $state<string | null>(null);

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
		submitError = null;
	}

	function closeForm() {
		pending = null;
	}

	async function refresh() {
		const fresh = await loadDiscussion(data.id);
		if (fresh) localOpinions = fresh.opinions;
		await loadClauseData();
	}

	function openClausesPanel(id: string) {
		clausesOpenId = id;
		if (live && clauses.length === 0 && issues.length === 0) {
			clausesLoading = true;
			loadClauseData().finally(() => (clausesLoading = false));
		}
	}

	function closeClausesPanel() {
		clausesOpenId = null;
	}

	async function fillGapClause(issue: Issue) {
		if (!live || !clausesOpinion || fillingIssueId) return;
		fillingIssueId = issue.id;
		try {
			await fillGap({
				negotiationId: data.id,
				positionId: clausesOpinion.id,
				topic,
				opinion: { heading: clausesOpinion.heading, description: clausesOpinion.description },
				issue,
				existingClauses: openClauses
			});
			await refresh();
		} catch {
			/* leave the panel open; the gap simply stays */
		} finally {
			fillingIssueId = null;
		}
	}

	async function proposeSynthesis() {
		if (!canSynthesize || synthBusy) return;
		synthBusy = true;
		synthError = null;
		try {
			const draft = await requestSynthesis({ topic, issues, clauses });
			if (draft) {
				synthDraft = draft;
			} else {
				synthError = 'עוזר ה-AI אינו זמין כעת.';
			}
		} catch {
			synthError = 'שגיאה בהפקת נוסחת האמצע.';
		} finally {
			synthBusy = false;
		}
	}

	async function confirmSynthesis() {
		if (!synthDraft || synthSaving) return;
		synthSaving = true;
		try {
			await persistSynthesis({
				negotiationId: data.id,
				order: opinions.length + 1,
				draft: synthDraft,
				existingIssues: issues
			});
			synthDraft = null;
			await refresh();
		} catch {
			synthError = 'שמירת נוסחת האמצע נכשלה.';
		} finally {
			synthSaving = false;
		}
	}

	async function rederivePosition(positionId: string) {
		const own = clauses.filter((c) => c.positionId === positionId);
		const loc = locationFromClauses(own);
		if (loc !== null) await updatePositionLocation(positionId, Math.round(loc)).catch(() => {});
	}

	async function updateClauseHandler(
		clauseId: string,
		draft: { body: string; stanceValue: number }
	) {
		if (savingClauseId) return;
		savingClauseId = clauseId;
		const positionId = clauses.find((c) => c.id === clauseId)?.positionId ?? null;
		try {
			await updateClause({ id: clauseId, body: draft.body, stanceValue: draft.stanceValue });
			await loadClauseData();
			if (positionId) await rederivePosition(positionId);
			await refresh();
		} catch {
			/* keep the panel open */
		} finally {
			savingClauseId = null;
		}
	}

	async function confirmClauseHandler(clauseId: string) {
		if (savingClauseId) return;
		savingClauseId = clauseId;
		try {
			await updateClause({ id: clauseId, confirmedByAuthor: true });
			await loadClauseData();
		} catch {
			/* keep the panel open */
		} finally {
			savingClauseId = null;
		}
	}

	async function addManualClause(issue: Issue, draft: { body: string; stanceValue: number }) {
		if (!clausesOpinion) return;
		const positionId = clausesOpinion.id;
		try {
			await createClause({
				negotiationId: data.id,
				positionId,
				issueId: issue.id,
				body: draft.body,
				stanceValue: draft.stanceValue,
				origin: 'human'
			});
			await loadClauseData();
			await rederivePosition(positionId);
			await refresh();
		} catch {
			/* keep the panel open */
		}
	}

	async function submit() {
		if (!resolvedInsert || !heading.trim()) return;
		const location = insertLocation(opinions, resolvedInsert);
		const relativePlacement =
			resolvedInsert.mode === 'between'
				? { mode: 'between', fraction: resolvedInsert.fraction ?? 0.5 }
				: { mode: resolvedInsert.mode };

		if (live) {
			try {
				const posId = await createPosition({
					negotiationId: data.id,
					heading: heading.trim(),
					description: description.trim(),
					location,
					order: opinions.length + 1,
					kind: 'proposed_solution',
					relativePlacement,
					selfPlacement: Math.round(location)
				});
				await refresh();
				closeForm();
				if (posId) {
					decomposeAndPersist({
						negotiationId: data.id,
						positionId: posId,
						topic,
						opinion: {
							heading: heading.trim(),
							description: description.trim(),
							selfPlacement: Math.round(location)
						}
					})
						.then(refresh)
						.catch(() => {});
				}
			} catch {
				submitError = 'שמירת הדעה נכשלה. נסו שוב.';
			}
		} else {
			localOpinions = [
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
	}

	function support(id: string) {
		if (voted.has(id)) return;
		voted.add(id);
		localOpinions = opinions.map((o) => (o.id === id ? { ...o, votes: o.votes + 1 } : o));
		if (live) {
			supportPosition(id)
				.then(refresh)
				.catch(() => {});
		}
	}

	async function openPanel(id: string) {
		openId = id;
		if (live) {
			argsLoading = true;
			try {
				args = await listArguments(id);
			} catch {
				args = [];
			} finally {
				argsLoading = false;
			}
		} else {
			args = demoArgs[id] ?? [];
		}
	}

	function closePanel() {
		openId = null;
	}

	async function createArg(stance: Stance, body: string) {
		if (!openId) return;
		if (live) {
			try {
				await createArgument({ negotiationId: data.id, positionId: openId, stance, body });
				args = await listArguments(openId);
			} catch {
				/* keep panel open */
			}
		} else {
			const next = [
				...(demoArgs[openId] ?? []),
				{ id: crypto.randomUUID(), body, stance, votes: 0 }
			];
			demoArgs = { ...demoArgs, [openId]: next };
			args = next;
		}
	}

	function supportArg(id: string) {
		if (argVoted.has(id)) return;
		argVoted.add(id);
		args = args.map((a) => (a.id === id ? { ...a, votes: a.votes + 1 } : a));
		if (live) {
			supportArgument(id)
				.then(async () => {
					if (openId) args = await listArguments(openId);
				})
				.catch(() => {});
		} else if (openId) {
			demoArgs = { ...demoArgs, [openId]: args };
		}
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
		<p class="text-sm text-white/40">דיון #{data.id}</p>
		<h1 class="mt-1 text-2xl font-bold text-white">{topic}</h1>
		<p class="mt-2 text-sm text-white/60">
			שתי דעות-העוגן מגדירות את הקצוות. הוסיפו דעה ביניהן או קיצונית מעבר לקצה — לא חייב באמצע, אפשר
			קרוב מאוד לדעה קיימת.
		</p>

		{#if shareable && meta}
			<div class="mt-3">
				<button
					type="button"
					onclick={() => (showShare = !showShare)}
					class="rounded-lg border border-white/20 px-3 py-1.5 text-sm text-white/80 hover:bg-white/10"
				>
					🔗 שיתוף הדיון
				</button>
				{#if showShare}
					<div class="mt-3">
						<ShareButtons
							siteTitle="Consensus"
							siteUrl={page.url.origin}
							slug={`negotiation/${data.id}?token=${meta.shareToken}`}
							title={topic}
							desc={meta.description || topic}
							lang="he"
						/>
					</div>
				{/if}
			</div>
		{/if}

		{#if !live}
			<div class="mt-3 rounded-lg border border-white/15 bg-white/5 p-3 text-sm text-white/50">
				מצב הדגמה — השרת אינו מחובר, השינויים אינם נשמרים.
			</div>
		{/if}

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

	{#if issues.length > 0}
		<div class="mx-auto mt-6 max-w-3xl space-y-3">
			<IssueConsensusStrip {issues} {clauses} />
			<div class="flex flex-wrap items-center justify-between gap-3">
				<div class="inline-flex rounded-full border border-white/15 p-0.5 text-sm">
					<button
						type="button"
						onclick={() => (view = 'spectrum')}
						class="rounded-full px-3 py-1 {view === 'spectrum'
							? 'bg-white/15 text-white'
							: 'text-white/60'}"
					>
						ספקטרום
					</button>
					<button
						type="button"
						onclick={() => (view = 'matrix')}
						class="rounded-full px-3 py-1 {view === 'matrix'
							? 'bg-white/15 text-white'
							: 'text-white/60'}"
					>
						מטריצת היבטים
					</button>
				</div>
				{#if canSynthesize}
					<div class="flex items-center gap-3">
						<button
							type="button"
							onclick={proposeSynthesis}
							disabled={synthBusy}
							class="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-4 py-1.5 text-sm text-emerald-100 hover:bg-emerald-500/20 disabled:opacity-50"
						>
							{synthBusy ? 'מפיק נוסחת אמצע…' : '✨ הצע נוסחת אמצע'}
						</button>
						{#if synthError}
							<span class="text-xs text-rose-300">{synthError}</span>
						{/if}
					</div>
				{/if}
			</div>
		</div>
	{/if}

	{#if view === 'matrix' && issues.length > 0}
		<div class="mx-auto mt-6 max-w-3xl">
			<IssueMatrix {issues} {clauses} {opinions} />
		</div>
	{:else}
		<div class="mt-10">
			<Spectrum
				{opinions}
				canPropose={perms.propose}
				canVote={perms.vote}
				oninsert={openForm}
				onsupport={support}
				onopen={openPanel}
				onclauses={openClausesPanel}
			/>
		</div>
	{/if}
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

			{#if submitError}
				<p class="mt-3 rounded-lg border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-100">
					{submitError}
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

{#if openId && openOpinion}
	<ArgumentsPanel
		title={openOpinion.heading}
		{args}
		loading={argsLoading}
		canAdd={perms.comment}
		canVote={perms.vote}
		oncreate={createArg}
		onsupport={supportArg}
		onclose={closePanel}
	/>
{/if}

{#if clausesOpenId && clausesOpinion}
	<ClausesPanel
		title={clausesOpinion.heading}
		clauses={openClauses}
		{issues}
		selfPlacement={clausesOpinion.selfPlacement}
		derivedLocation={clausesOpinion.location}
		canEdit={canEditClauses}
		loading={clausesLoading}
		{fillingIssueId}
		{savingClauseId}
		onfill={fillGapClause}
		onaddmanual={addManualClause}
		onupdate={updateClauseHandler}
		onconfirm={confirmClauseHandler}
		onclose={closeClausesPanel}
	/>
{/if}

{#if synthDraft}
	<SynthesisPreview
		draft={synthDraft}
		saving={synthSaving}
		onconfirm={confirmSynthesis}
		onclose={() => (synthDraft = null)}
	/>
{/if}
