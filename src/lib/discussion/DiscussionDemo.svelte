<script lang="ts">
	import Spectrum from './Spectrum.svelte';
	import ClausesPanel from './ClausesPanel.svelte';
	import IssueConsensusStrip from './IssueConsensusStrip.svelte';
	import IssueMatrix from './IssueMatrix.svelte';
	import SynthesisPreview from './SynthesisPreview.svelte';
	import { colorFor, locationFromClauses, type Clause, type Issue, type Opinion } from './scale';
	import type { SynthesisDraft } from './decompose';

	const TOPIC = 'האם להפוך את רחוב המרכז למדרחוב?';

	function uid(): string {
		return typeof crypto !== 'undefined' && crypto.randomUUID
			? crypto.randomUUID()
			: Math.random().toString(36).slice(2);
	}

	let issues = $state<Issue[]>([
		{ id: 'i1', title: 'תנועת רכב', order: 0, origin: 'ai' },
		{ id: 'i2', title: 'חניה', order: 1, origin: 'ai' },
		{ id: 'i3', title: 'תקציב', order: 2, origin: 'ai' },
		{ id: 'i4', title: 'לוח זמנים', order: 3, origin: 'ai' }
	]);

	function clause(
		id: string,
		positionId: string,
		issueId: string | null,
		body: string,
		stanceValue: number,
		confirmedByAuthor = false
	): Clause {
		return { id, positionId, issueId, body, stanceValue, origin: 'ai', confirmedByAuthor };
	}

	let clauses = $state<Clause[]>([
		// o1 — מדרחוב מלא ומיידי (חסר: חניה)
		clause('c1', 'o1', 'i1', 'לחסום לחלוטין כניסת רכבים לרחוב', 90, true),
		clause('c2', 'o1', 'i3', 'להשקיע תקציב משמעותי בריצוף ועיצוב', 80),
		clause('c3', 'o1', 'i4', 'להתחיל את הביצוע כבר העונה', 85),
		// o2 — להשאיר כמו שהוא (חסר: לוח זמנים)
		clause('c4', 'o2', 'i1', 'לא לשנות את הסדרי התנועה הקיימים', 10, true),
		clause('c5', 'o2', 'i2', 'לשמר את כל מקומות החניה ברחוב', 15),
		clause('c6', 'o2', 'i3', 'לא להוציא תקציב ייעודי לפרויקט', 10),
		// o3 — מדרחוב חלקי בסופי שבוע
		clause('c7', 'o3', 'i1', 'לסגור לתנועה בסופי שבוע בלבד', 50),
		clause('c8', 'o3', 'i2', 'להסדיר חניון תחליפי סמוך', 55),
		clause('c9', 'o3', 'i3', 'תקציב מדורג לפי שלבים', 45),
		clause('c10', 'o3', 'i4', 'פיילוט של חצי שנה ואז החלטה', 50)
	]);

	function makeOpinion(
		id: string,
		heading: string,
		description: string,
		votes: number,
		selfPlacement: number,
		index: number
	): Opinion {
		const own = clauses.filter((c) => c.positionId === id);
		const location = locationFromClauses(own) ?? selfPlacement;
		return {
			id,
			heading,
			description,
			location,
			votes,
			color: colorFor(index),
			isAnchor: false,
			pole: 'none',
			kind: 'opinion',
			selfPlacement,
			authorExternalId: 'demo-user'
		};
	}

	let opinions = $state<Opinion[]>([
		makeOpinion(
			'o1',
			'מדרחוב מלא ומיידי',
			'לחסום את הרחוב לרכבים ולהפוך אותו למרחב הולכי רגל.',
			3,
			80,
			0
		),
		makeOpinion('o2', 'להשאיר כמו שהוא', 'הרחוב מתפקד; שינוי יפגע בעסקים ובחניה.', 5, 5, 1),
		makeOpinion(
			'o3',
			'מדרחוב חלקי בסופי שבוע',
			'סגירה חלקית בסופי שבוע עם פתרון חניה תחליפי.',
			8,
			50,
			2
		)
	]);

	let view = $state<'spectrum' | 'matrix'>('spectrum');
	let clausesOpenId = $state<string | null>(null);
	let synthDraft = $state<SynthesisDraft | null>(null);

	let clausesOpinion = $derived(opinions.find((o) => o.id === clausesOpenId) ?? null);
	let openClauses = $derived(clauses.filter((c) => c.positionId === clausesOpenId));

	// Canned "AI" gap fills so the demo behaves like the live assistant.
	const FILL: Record<string, { body: string; stanceValue: number }> = {
		'o1:i2': { body: 'להמיר את חניות הרחוב לחניון משותף בקצה הרחוב', stanceValue: 70 },
		'o2:i4': { body: 'לא לקדם שינוי בטווח הנראה לעין', stanceValue: 10 }
	};

	function rederive(positionId: string) {
		const own = clauses.filter((c) => c.positionId === positionId);
		const loc = locationFromClauses(own);
		if (loc === null) return;
		opinions = opinions.map((o) => (o.id === positionId ? { ...o, location: Math.round(loc) } : o));
	}

	function support(id: string) {
		opinions = opinions.map((o) => (o.id === id ? { ...o, votes: o.votes + 1 } : o));
	}

	function fillGap(issue: Issue) {
		if (!clausesOpinion) return;
		const canned = FILL[`${clausesOpinion.id}:${issue.id}`] ?? {
			body: `הצעה להיבט "${issue.title}" בהתאם לעמדה`,
			stanceValue: Math.round(clausesOpinion.location)
		};
		clauses = [
			...clauses,
			clause(uid(), clausesOpinion.id, issue.id, canned.body, canned.stanceValue)
		];
		rederive(clausesOpinion.id);
	}

	function addManual(issue: Issue, draft: { body: string; stanceValue: number }) {
		if (!clausesOpinion) return;
		const c = clause(uid(), clausesOpinion.id, issue.id, draft.body, draft.stanceValue);
		clauses = [...clauses, { ...c, origin: 'human' }];
		rederive(clausesOpinion.id);
	}

	function updateClause(clauseId: string, draft: { body: string; stanceValue: number }) {
		let positionId: string | null = null;
		clauses = clauses.map((c) => {
			if (c.id !== clauseId) return c;
			positionId = c.positionId;
			return { ...c, body: draft.body, stanceValue: draft.stanceValue };
		});
		if (positionId) rederive(positionId);
	}

	function confirmClause(clauseId: string) {
		clauses = clauses.map((c) => (c.id === clauseId ? { ...c, confirmedByAuthor: true } : c));
	}

	function proposeSynthesis() {
		synthDraft = {
			heading: 'מדרחוב מדורג עם פתרון חניה',
			description: 'סגירה בסופי שבוע, חניון תחליפי, ותקציב מדורג לפי הצלחת פיילוט.',
			rationale:
				'כל צד מקבל את העיקר שלו: תומכי המדרחוב מקבלים מרחב הולכי רגל בסופי שבוע, והמתנגדים מקבלים שמירה על חניה ותקציב זהיר עם יציאה מדורגת.',
			clauses: [
				{
					issueId: 'i1',
					issueTitle: 'תנועת רכב',
					body: 'סגירה לתנועה בסופי שבוע ובחגים, עם בחינת הרחבה',
					stanceValue: 55
				},
				{
					issueId: 'i2',
					issueTitle: 'חניה',
					body: 'הקמת חניון תחליפי במרחק הליכה לפני הסגירה',
					stanceValue: 60
				},
				{
					issueId: 'i3',
					issueTitle: 'תקציב',
					body: 'פיילוט זול ואז השקעה מלאה לפי הצלחה',
					stanceValue: 50
				},
				{
					issueId: 'i4',
					issueTitle: 'לוח זמנים',
					body: 'פיילוט של חצי שנה עם מדדי הצלחה ברורים',
					stanceValue: 50
				}
			]
		};
	}

	function confirmSynthesis() {
		if (!synthDraft) return;
		const id = uid();
		const newClauses = synthDraft.clauses.map((c) =>
			clause(uid(), id, c.issueId, c.body, c.stanceValue)
		);
		clauses = [...clauses, ...newClauses];
		const location = locationFromClauses(newClauses) ?? 50;
		opinions = [
			...opinions,
			{
				id,
				heading: synthDraft.heading,
				description: synthDraft.description,
				location,
				votes: 0,
				color: colorFor(opinions.length),
				isAnchor: false,
				pole: 'none',
				kind: 'proposed_solution',
				authorExternalId: 'demo-user'
			}
		];
		synthDraft = null;
	}
</script>

<div class="rounded-3xl border border-white/10 bg-[#0d0d18] p-4 sm:p-6" dir="rtl">
	<div class="flex flex-wrap items-start justify-between gap-3">
		<div>
			<span class="rounded-full bg-violet-500/15 px-2.5 py-0.5 text-xs font-medium text-violet-200"
				>דמו אינטראקטיבי · נתוני דוגמה</span
			>
			<h3 class="mt-2 text-lg font-bold text-white">{TOPIC}</h3>
			<p class="mt-1 text-sm text-white/50">
				לחצו "סעיפים" על דעה כדי לראות את הפירוק להיבטים, השלימו סעיף חסר, או הציעו נוסחת אמצע.
			</p>
		</div>
	</div>

	<div class="mt-4 space-y-3">
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
			<button
				type="button"
				onclick={proposeSynthesis}
				class="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-4 py-1.5 text-sm text-emerald-100 hover:bg-emerald-500/20"
			>
				✨ הצע נוסחת אמצע
			</button>
		</div>
	</div>

	{#if view === 'matrix'}
		<div class="mt-4">
			<IssueMatrix {issues} {clauses} {opinions} />
		</div>
	{:else}
		<div class="mt-2">
			<Spectrum
				{opinions}
				canPropose={false}
				canVote={true}
				onsupport={support}
				onclauses={(id) => (clausesOpenId = id)}
			/>
		</div>
	{/if}
</div>

{#if clausesOpenId && clausesOpinion}
	<ClausesPanel
		title={clausesOpinion.heading}
		clauses={openClauses}
		{issues}
		selfPlacement={clausesOpinion.selfPlacement}
		derivedLocation={clausesOpinion.location}
		canEdit={true}
		onfill={fillGap}
		onaddmanual={addManual}
		onupdate={updateClause}
		onconfirm={confirmClause}
		onclose={() => (clausesOpenId = null)}
	/>
{/if}

{#if synthDraft}
	<SynthesisPreview
		draft={synthDraft}
		onconfirm={confirmSynthesis}
		onclose={() => (synthDraft = null)}
	/>
{/if}
