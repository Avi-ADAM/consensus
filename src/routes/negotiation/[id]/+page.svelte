<script lang="ts">
	import ConsensusField from '$lib/discussion/ConsensusField.svelte';
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
		attachClauses,
		decomposeAndPersist,
		fillGap,
		persistSynthesis,
		requestSynthesis,
		type SynthesisDraft
	} from '$lib/discussion/decompose';
	import ArgumentsPanel from '$lib/discussion/ArgumentsPanel.svelte';
	import BridgeBar from '$lib/discussion/BridgeBar.svelte';
	import ClausesPanel from '$lib/discussion/ClausesPanel.svelte';
	import OpinionForm, { type OpinionSubmit } from '$lib/discussion/OpinionForm.svelte';
	import IssueHealth from '$lib/discussion/IssueHealth.svelte';
	import IssueMatrix from '$lib/discussion/IssueMatrix.svelte';
	import SynthesisPreview from '$lib/discussion/SynthesisPreview.svelte';
	import { isAuthor, permissionsFor } from '$lib/auth/permissions';
	import { SvelteSet } from 'svelte/reactivity';
	import { page } from '$app/state';
	import { agreementHref, loginHref, upgradeHref } from '$lib/links';
	import { ShareButtons } from '@1lev1/svelte-share';
	import { _ } from 'svelte-i18n';
	import { locale, t } from '$lib/i18n';

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
	let canEditClauses = $derived(live && perms.editOwn && isAuthor(clausesOpinion, data.user));

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
	let fraction = $state(50);
	let aiNote = $state<string | null>(null);
	let aiBusy = $state(false);
	let submitting = $state(false);
	let submitError = $state<string | null>(null);
	let submitNotice = $state<string | null>(null);

	let resolvedInsert = $derived<InsertMode | null>(
		pending && pending.mode === 'between' ? { ...pending, fraction: fraction / 100 } : pending
	);
	let previewLocation = $derived(resolvedInsert ? insertLocation(opinions, resolvedInsert) : null);

	function openForm(mode: InsertMode) {
		pending = mode;
		fraction = 50;
		aiNote = null;
		submitError = null;
	}

	function closeForm() {
		if (submitting) return;
		pending = null;
	}

	async function refresh(): Promise<Opinion[] | null> {
		const fresh = await loadDiscussion(data.id);
		if (fresh) localOpinions = fresh.opinions;
		await loadClauseData();
		return fresh?.opinions ?? null;
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
				synthError = t('discussion.synthErrorAI');
			}
		} catch {
			synthError = t('discussion.synthError');
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
			synthError = t('discussion.synthSaveError');
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

	async function addClauseHandler(draft: {
		issueTitle: string;
		body: string;
		stanceValue: number;
	}): Promise<boolean> {
		if (!clausesOpinion) return false;
		const positionId = clausesOpinion.id;
		try {
			const existingIssues = await listIssues(data.id).catch(() => issues);
			const saved = await attachClauses({
				negotiationId: data.id,
				positionId,
				drafts: [{ ...draft, issueId: null, origin: 'human' }],
				existingIssues,
				confirm: true
			});
			if (saved.length === 0) return false;
			await loadClauseData();
			await rederivePosition(positionId);
			await refresh();
			return true;
		} catch {
			return false;
		}
	}

	async function submit(input: OpinionSubmit) {
		if (!resolvedInsert || submitting) return;
		const location = insertLocation(opinions, resolvedInsert);
		const relativePlacement =
			resolvedInsert.mode === 'between'
				? { mode: 'between', fraction: resolvedInsert.fraction ?? 0.5 }
				: { mode: resolvedInsert.mode };

		if (!live) {
			submitDemo(input, location);
			return;
		}

		submitting = true;
		submitError = null;
		try {
			const posId = await createPosition({
				negotiationId: data.id,
				heading: input.heading,
				description: input.description,
				location,
				order: opinions.length + 1,
				kind: 'proposed_solution',
				relativePlacement,
				selfPlacement: Math.round(location)
			});
			if (!posId) {
				submitError = t('discussion.submitError');
				return;
			}

			let failedClauses = 0;
			if (input.clauses.length > 0) {
				// Fresh issue list, so a title another participant just added is reused.
				const existingIssues = await listIssues(data.id).catch(() => issues);
				const saved = await attachClauses({
					negotiationId: data.id,
					positionId: posId,
					drafts: input.clauses,
					existingIssues,
					confirm: true
				});
				failedClauses = input.clauses.length - saved.length;
				const derived = locationFromClauses(saved);
				if (derived !== null) {
					await updatePositionLocation(posId, Math.round(derived)).catch(() => {});
				}
			}

			const fresh = await refresh();
			if (!fresh?.some((o) => o.id === posId)) {
				submitError = t('opinionForm.notVisible');
				return;
			}

			submitting = false;
			closeForm();
			if (failedClauses > 0) {
				submitNotice = t('opinionForm.clausesPartial', { n: failedClauses });
			}
			if (input.clauses.length === 0) {
				// Nothing written by hand — let the AI break it down in the background.
				decomposeAndPersist({
					negotiationId: data.id,
					positionId: posId,
					topic,
					opinion: {
						heading: input.heading,
						description: input.description,
						selfPlacement: Math.round(location)
					}
				})
					.then(() => refresh())
					.catch(() => {});
			}
		} catch {
			submitError = t('discussion.submitError');
		} finally {
			submitting = false;
		}
	}

	/** Demo mode (no backend): keep the opinion and its clauses in memory. */
	function submitDemo(input: OpinionSubmit, location: number) {
		const id = crypto.randomUUID();
		const nextIssues = [...issues];
		const newClauses: Clause[] = [];
		for (const draft of input.clauses) {
			const title = draft.issueTitle.trim();
			let issue = title
				? nextIssues.find((i) => i.title.trim().toLowerCase() === title.toLowerCase())
				: undefined;
			if (!issue && title) {
				issue = { id: crypto.randomUUID(), title, order: nextIssues.length, origin: draft.origin };
				nextIssues.push(issue);
			}
			newClauses.push({
				id: crypto.randomUUID(),
				positionId: id,
				issueId: issue?.id ?? null,
				body: draft.body,
				stanceValue: draft.stanceValue,
				origin: draft.origin,
				confirmedByAuthor: true
			});
		}
		issues = nextIssues;
		clauses = [...clauses, ...newClauses];
		localOpinions = [
			...opinions,
			{
				id,
				heading: input.heading,
				description: input.description,
				location: locationFromClauses(newClauses) ?? location,
				votes: 0,
				color: colorFor(opinions.length),
				isAnchor: false,
				pole: 'none',
				kind: 'proposed_solution',
				selfPlacement: Math.round(location)
			}
		];
		closeForm();
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

	async function askAi({ heading, description }: { heading: string; description: string }) {
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
				? (out.data?.comment ?? out.data?.rationale ?? t('discussion.aiNoComment'))
				: t('discussion.synthErrorAI');
		} catch {
			aiNote = t('discussion.aiError');
		} finally {
			aiBusy = false;
		}
	}
</script>

<svelte:head><title>{$_('discussion.pageTitle', { values: { topic } })}</title></svelte:head>

<main class="min-h-screen bg-[#09090f] px-4 py-8 text-white">
	<div class="mx-auto max-w-3xl">
		<p class="text-sm text-white/40">{$_('discussion.discussionId', { values: { id: data.id } })}</p>
		<h1 class="mt-1 text-2xl font-bold text-white">{topic}</h1>
		<p class="mt-2 text-sm text-white/60">{$_('discussion.introText')}</p>

		{#if shareable && meta}
			<div class="mt-3">
				<button
					type="button"
					onclick={() => (showShare = !showShare)}
					class="rounded-lg border border-white/20 px-3 py-1.5 text-sm text-white/80 hover:bg-white/10"
				>
					{$_('discussion.shareDiscussion')}
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

		{#if submitNotice}
			<div
				class="mt-3 flex items-start justify-between gap-3 rounded-lg border border-amber-400/30 bg-amber-500/10 p-3 text-sm text-amber-100"
			>
				<span>{submitNotice}</span>
				<button type="button" class="text-amber-200/70" onclick={() => (submitNotice = null)}>✕</button>
			</div>
		{/if}

		{#if !live}
			<div class="mt-3 rounded-lg border border-white/15 bg-white/5 p-3 text-sm text-white/50">
				{$_('discussion.demoMode')}
			</div>
		{/if}

		{#if meta?.sourceMeta && meta.sourceId}
			<BridgeBar
				negotiationId={data.id}
				sourceMeta={meta.sourceMeta}
				sourceType={meta.sourceType ?? ''}
				sourceId={meta.sourceId}
				{issues}
				{clauses}
				{opinions}
				canFinalize={live && data.user.type === 'registered'}
			/>
		{/if}

		{#if data.user.type === 'charter'}
			<div
				class="mt-3 rounded-lg border border-amber-400/30 bg-amber-500/10 p-3 text-sm text-amber-100"
			>
				{$_('discussion.charterNote')}
				<a class="underline" href={upgradeHref()}>{$_('discussion.createAccount')}</a>.
			</div>
		{:else if data.user.type === 'guest'}
			<div class="mt-3 rounded-lg border border-white/15 bg-white/5 p-3 text-sm text-white/60">
				{$_('discussion.viewOnly')}
				<div class="mt-2 flex flex-wrap gap-3">
					<a
						class="font-semibold text-violet-200 underline"
						href={agreementHref(page.url.href, $locale)}>{$_('auth.joinAgreement')}</a
					>
					<a class="underline" href={loginHref(page.url.href)}>{$_('auth.login')}</a>
				</div>
			</div>
		{/if}
	</div>

	{#if issues.length > 0}
		<div class="mx-auto mt-6 max-w-3xl space-y-3">
			<IssueHealth {issues} {clauses} />
			<div class="flex flex-wrap items-center justify-between gap-3">
				<div class="inline-flex rounded-full border border-white/10 bg-white/5 p-1 text-sm">
					<button
						type="button"
						onclick={() => (view = 'spectrum')}
						class="rounded-full px-4 py-1.5 font-medium transition {view === 'spectrum'
							? 'bg-white/15 text-white shadow-sm'
							: 'text-white/55 hover:text-white/85'}"
					>
						{$_('discussion.spectrum')}
					</button>
					<button
						type="button"
						onclick={() => (view = 'matrix')}
						class="rounded-full px-4 py-1.5 font-medium transition {view === 'matrix'
							? 'bg-white/15 text-white shadow-sm'
							: 'text-white/55 hover:text-white/85'}"
					>
						{$_('discussion.matrix')}
					</button>
				</div>
				{#if canSynthesize}
					<div class="flex items-center gap-3">
						<button
							type="button"
							onclick={proposeSynthesis}
							disabled={synthBusy}
							class="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-100 transition hover:bg-emerald-500/20 disabled:opacity-50"
						>
							{synthBusy ? $_('discussion.synthesizing') : $_('discussion.synthesize')}
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
			<ConsensusField
				{opinions}
				{clauses}
				canPropose={perms.propose || !live}
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
	<OpinionForm
		title={pending.mode === 'beyond_top'
			? $_('discussion.opinionMode.beyond_top')
			: pending.mode === 'beyond_bottom'
				? $_('discussion.opinionMode.beyond_bottom')
				: $_('discussion.opinionMode.between')}
		{topic}
		{issues}
		bind:fraction
		showPlacement={pending.mode === 'between'}
		busy={submitting}
		error={submitError}
		placementNote={aiNote}
		placementBusy={aiBusy}
		onaskplacement={askAi}
		onsubmit={submit}
		oncancel={closeForm}
	/>
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
		color={clausesOpinion.color}
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
		onaddclause={addClauseHandler}
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
