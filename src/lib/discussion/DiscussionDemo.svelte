<script lang="ts">
	import { _ } from 'svelte-i18n';
	import ConsensusField from './ConsensusField.svelte';
	import ClausesPanel from './ClausesPanel.svelte';
	import IssueHealth from './IssueHealth.svelte';
	import IssueMatrix from './IssueMatrix.svelte';
	import SynthesisPreview from './SynthesisPreview.svelte';
	import { colorFor, locationFromClauses, type Clause, type Issue, type Opinion } from './scale';
	import type { SynthesisDraft } from './decompose';

	function uid(): string {
		return typeof crypto !== 'undefined' && crypto.randomUUID
			? crypto.randomUUID()
			: Math.random().toString(36).slice(2);
	}

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

	interface SeedOpinion {
		id: string;
		heading: string;
		description: string;
		votes: number;
		selfPlacement: number;
	}

	interface Scenario {
		id: string;
		label: string;
		topic: string;
		issues: Issue[];
		seedClauses: Clause[];
		seedOpinions: SeedOpinion[];
		fill: Record<string, { body: string; stanceValue: number }>;
		synthesis: SynthesisDraft;
	}

	const SCENARIOS: Scenario[] = [
		{
			id: 'ai',
			label: 'רגולציה של AI',
			topic: 'כיצד ראוי להסדיר בינה מלאכותית?',
			issues: [
				{ id: 'a1', title: 'היקף הרגולציה', order: 0, origin: 'ai' },
				{ id: 'a2', title: 'פרטיות ונתונים', order: 1, origin: 'ai' },
				{ id: 'a3', title: 'אחריות ונזיקין', order: 2, origin: 'ai' },
				{ id: 'a4', title: 'השפעה על תעסוקה', order: 3, origin: 'ai' }
			],
			seedClauses: [
				// o1 — רגולציה מחמירה (חסר: תעסוקה)
				clause('ac1', 'o1', 'a1', 'לחייב רישוי ממשלתי לכל מודל גדול לפני שחרור', 90, true),
				clause('ac2', 'o1', 'a2', 'לאסור אימון על נתונים אישיים ללא הסכמה מפורשת', 85),
				clause('ac3', 'o1', 'a3', 'להטיל אחריות מלאה על המפתחים לכל נזק', 80),
				// o2 — להניח לשוק (חסר: אחריות)
				clause('ac4', 'o2', 'a1', 'לא להטיל רישוי; להסתמך על תקינה וולונטרית', 10, true),
				clause('ac5', 'o2', 'a2', 'להסתמך על חוקי הפרטיות הקיימים בלבד', 20),
				clause('ac6', 'o2', 'a4', 'לא להתערב בשוק העבודה; הוא יסתגל מעצמו', 15),
				// o3 — מבוססת-סיכון
				clause('ac7', 'o3', 'a1', 'רגולציה מדורגת לפי רמת הסיכון של היישום', 50),
				clause('ac8', 'o3', 'a2', 'שקיפות וזכות הסבר, בלי איסור גורף', 55),
				clause('ac9', 'o3', 'a3', 'אחריות משותפת בין המפתח למשתמש', 50),
				clause('ac10', 'o3', 'a4', 'השקעה בהסבה מקצועית במקום עצירת פיתוח', 45)
			],
			seedOpinions: [
				{
					id: 'o1',
					heading: 'רגולציה מחמירה ומיידית',
					description: 'רישוי חובה, איסורים ברורים ואחריות מלאה של המפתחים.',
					votes: 6,
					selfPlacement: 80
				},
				{
					id: 'o2',
					heading: 'להניח לשוק',
					description: 'רגולציה תחנוק חדשנות; עדיף תקינה וולונטרית.',
					votes: 4,
					selfPlacement: 10
				},
				{
					id: 'o3',
					heading: 'רגולציה מבוססת-סיכון',
					description: 'דרישות מדורגות לפי סיכון, עם שקיפות והסבה מקצועית.',
					votes: 9,
					selfPlacement: 50
				}
			],
			fill: {
				'o1:a4': { body: 'תוכניות הסבה מקצועית במימון חברות ה-AI', stanceValue: 75 },
				'o2:a3': { body: 'אחריות מוגבלת בכפוף לעמידה בתקינה וולונטרית', stanceValue: 20 }
			},
			synthesis: {
				heading: 'מסגרת מבוססת-סיכון עם ערבויות',
				description: 'רגולציה מדורגת לפי סיכון, שקיפות נתונים, אחריות משותפת והשקעה בהסבה.',
				rationale:
					'כל צד מקבל את העיקר שלו: מי שחושש מנזק מקבל בקרה על יישומי הסיכון הגבוה, ומי שחושש לחדשנות מקבל מסלול מהיר ליישומים קלי-סיכון ובלי איסורים גורפים.',
				clauses: [
					{
						issueId: 'a1',
						issueTitle: 'היקף הרגולציה',
						body: 'רישוי רק ליישומי סיכון גבוה; קלי-סיכון בנוהל מקוצר',
						stanceValue: 55
					},
					{
						issueId: 'a2',
						issueTitle: 'פרטיות ונתונים',
						body: 'חובת שקיפות וזכות הסבר, עם הסכמה לנתונים רגישים',
						stanceValue: 55
					},
					{
						issueId: 'a3',
						issueTitle: 'אחריות ונזיקין',
						body: 'אחריות מדורגת בין המפתח למפעיל לפי השליטה בסיכון',
						stanceValue: 50
					},
					{
						issueId: 'a4',
						issueTitle: 'השפעה על תעסוקה',
						body: 'קרן הסבה מקצועית במימון משותף של התעשייה והמדינה',
						stanceValue: 50
					}
				]
			}
		},
		{
			id: 'street',
			label: 'מדרחוב עירוני',
			topic: 'האם להפוך את רחוב המרכז למדרחוב?',
			issues: [
				{ id: 'i1', title: 'תנועת רכב', order: 0, origin: 'ai' },
				{ id: 'i2', title: 'חניה', order: 1, origin: 'ai' },
				{ id: 'i3', title: 'תקציב', order: 2, origin: 'ai' },
				{ id: 'i4', title: 'לוח זמנים', order: 3, origin: 'ai' }
			],
			seedClauses: [
				clause('c1', 'o1', 'i1', 'לחסום לחלוטין כניסת רכבים לרחוב', 90, true),
				clause('c2', 'o1', 'i3', 'להשקיע תקציב משמעותי בריצוף ועיצוב', 80),
				clause('c3', 'o1', 'i4', 'להתחיל את הביצוע כבר העונה', 85),
				clause('c4', 'o2', 'i1', 'לא לשנות את הסדרי התנועה הקיימים', 10, true),
				clause('c5', 'o2', 'i2', 'לשמר את כל מקומות החניה ברחוב', 15),
				clause('c6', 'o2', 'i3', 'לא להוציא תקציב ייעודי לפרויקט', 10),
				clause('c7', 'o3', 'i1', 'לסגור לתנועה בסופי שבוע בלבד', 50),
				clause('c8', 'o3', 'i2', 'להסדיר חניון תחליפי סמוך', 55),
				clause('c9', 'o3', 'i3', 'תקציב מדורג לפי שלבים', 45),
				clause('c10', 'o3', 'i4', 'פיילוט של חצי שנה ואז החלטה', 50)
			],
			seedOpinions: [
				{
					id: 'o1',
					heading: 'מדרחוב מלא ומיידי',
					description: 'לחסום את הרחוב לרכבים ולהפוך אותו למרחב הולכי רגל.',
					votes: 3,
					selfPlacement: 80
				},
				{
					id: 'o2',
					heading: 'להשאיר כמו שהוא',
					description: 'הרחוב מתפקד; שינוי יפגע בעסקים ובחניה.',
					votes: 5,
					selfPlacement: 5
				},
				{
					id: 'o3',
					heading: 'מדרחוב חלקי בסופי שבוע',
					description: 'סגירה חלקית בסופי שבוע עם פתרון חניה תחליפי.',
					votes: 8,
					selfPlacement: 50
				}
			],
			fill: {
				'o1:i2': { body: 'להמיר את חניות הרחוב לחניון משותף בקצה הרחוב', stanceValue: 70 },
				'o2:i4': { body: 'לא לקדם שינוי בטווח הנראה לעין', stanceValue: 10 }
			},
			synthesis: {
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
			}
		}
	];

	function buildOpinions(scn: Scenario): Opinion[] {
		return scn.seedOpinions.map((o, idx) => {
			const own = scn.seedClauses.filter((c) => c.positionId === o.id);
			const location = locationFromClauses(own) ?? o.selfPlacement;
			return {
				id: o.id,
				heading: o.heading,
				description: o.description,
				location,
				votes: o.votes,
				color: colorFor(idx),
				isAnchor: false,
				pole: 'none',
				kind: 'opinion',
				selfPlacement: o.selfPlacement,
				authorExternalId: 'demo-user'
			};
		});
	}

	let scenarioId = $state(SCENARIOS[0].id);
	let active = $derived(SCENARIOS.find((s) => s.id === scenarioId) ?? SCENARIOS[0]);

	let issues = $state<Issue[]>(SCENARIOS[0].issues.map((i) => ({ ...i })));
	let clauses = $state<Clause[]>(SCENARIOS[0].seedClauses.map((c) => ({ ...c })));
	let opinions = $state<Opinion[]>(buildOpinions(SCENARIOS[0]));

	let view = $state<'spectrum' | 'matrix'>('spectrum');
	let clausesOpenId = $state<string | null>(null);
	let synthDraft = $state<SynthesisDraft | null>(null);

	let clausesOpinion = $derived(opinions.find((o) => o.id === clausesOpenId) ?? null);
	let openClauses = $derived(clauses.filter((c) => c.positionId === clausesOpenId));

	function selectScenario(id: string) {
		if (id === scenarioId) return;
		const scn = SCENARIOS.find((s) => s.id === id) ?? SCENARIOS[0];
		scenarioId = id;
		issues = scn.issues.map((i) => ({ ...i }));
		clauses = scn.seedClauses.map((c) => ({ ...c }));
		opinions = buildOpinions(scn);
		view = 'spectrum';
		clausesOpenId = null;
		synthDraft = null;
	}

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
		const canned = active.fill[`${clausesOpinion.id}:${issue.id}`] ?? {
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
		synthDraft = active.synthesis;
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

<div class="rounded-3xl border border-white/10 bg-[#0d0d18] p-4 sm:p-6">
	<div class="flex flex-wrap items-center gap-2">
		<span class="rounded-full bg-violet-500/15 px-2.5 py-0.5 text-xs font-medium text-violet-200"
			>{$_('demoInteractive.badge')}</span
		>
		<div class="ms-auto inline-flex rounded-full border border-white/10 bg-white/5 p-1 text-xs">
			{#each SCENARIOS as scn (scn.id)}
				<button
					type="button"
					onclick={() => selectScenario(scn.id)}
					class="rounded-full px-3 py-1.5 font-medium transition {scenarioId === scn.id
						? 'bg-white/15 text-white shadow-sm'
						: 'text-white/55 hover:text-white/85'}"
				>
					{scn.label}
				</button>
			{/each}
		</div>
	</div>

	<h3 class="mt-3 text-lg font-bold text-white">{active.topic}</h3>
	<p class="mt-1 text-sm text-white/50">{$_('demoInteractive.instruction')}</p>

	<div class="mt-4 space-y-3">
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
			<button
				type="button"
				onclick={proposeSynthesis}
				class="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-100 transition hover:bg-emerald-500/20"
			>
				{$_('discussion.synthesize')}
			</button>
		</div>
	</div>

	{#if view === 'matrix'}
		<div class="mt-4">
			<IssueMatrix {issues} {clauses} {opinions} />
		</div>
	{:else}
		<div class="mt-2">
			<ConsensusField
				{opinions}
				{clauses}
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
		color={clausesOpinion.color}
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
