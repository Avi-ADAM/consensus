# מפרט גשר מו"מ — חיבור `negoPend` (ריפו 1.0) לדיוני הקונצנזוס

מסמך הנדאוף לסוכן/מפתח שעובד על הריפו הראשי (`Avi-ADAM/1.0`) ועל Strapi.
משלים את `main-repo-backend-spec.md` (חובה לקרוא אותו קודם — ההקשחות שם תקפות גם כאן).

## הרעיון

קומפוננטות המו"מ בריפו הראשי (`src/lib/components/prPr/negoPend.svelte` ומקבילתה
למשאבים) מנהלות מו"מ "ערך מול ערך": שם, תיאור, מחיר, כמות, תאריכים, מיקום —
מקורי מול מוצע, ואישור ב"כן / כן-אבל". הגשר מאפשר לפתוח מהכרטיס הזה **דיון
גישור** באפליקציית הקונצנזוס (`consensus.1lev1.com`), שבו:

- כל תנאי במו"מ הופך ל-**Issue** (היבט).
- ערכי שני הצדדים הופכים ל-**Clauses** של שתי עמדות-קצה: "התנאים הקיימים"
  (stance 0) מול "ההצעה החדשה" (stance 100). תנאי שלא השתנה מקבל סעיף מוסכם
  במרכז (stance 50) — כך כל התמונה על השולחן והמוסכם מסומן ככזה.
- כלי הקונצנזוס (טיעונים, מטריצת היבטים, נוסחת אמצע ב-AI) פועלים על הסכסוך האמיתי.
- כשמתגבשת הסכמה, הערכים המוסכמים מחושבים באינטרפולציה בין שני הקצוות וחוזרים
  לעמוד המו"מ בלינק עם פרמטר `negoBridge`. **האשרור הסופי נשאר במנגנון ההצבעה
  הקיים** — הדיון מגבש את ההצעה, לא עוקף את הקונצנזוס.

הזרימה: כפתור ב-`negoPend` → `consensus.1lev1.com/negotiation/bridge?d=<payload>`
→ find-or-create של דיון לפי `(sourceType, sourceId)` → דיון → לינק חזרה עם
`negoBridge=<values>` → מילוי מוקדם של שדות הכרטיס.

צד הקונצנזוס כבר ממומש (ראוט `negotiation/bridge`, `src/lib/discussion/bridge.ts`,
רכיב `BridgeBar` בעמוד הדיון). המשימות בריפו הראשי:

---

## 1. Strapi — הרחבת `Negotiation`

| שדה          | טיפוס  | הערה                                                           |
| ------------ | ------ | -------------------------------------------------------------- |
| `sourceType` | string | סוג האובייקט באפליקציה הראשית, למשל `pmash` / `mission`        |
| `sourceId`   | string | מזהה האובייקט. יחד עם `sourceType` — מפתח חיפוש (להוסיף index) |
| `sourceMeta` | json   | תמונת התנאים + `returnUrl`, נכתב על-ידי הקונצנזוס ביצירה       |

מבנה `sourceMeta` (נכתב ונקרא רק על-ידי צד הקונצנזוס — לשרת זה blob):

```json
{
	"v": 1,
	"title": "מקרן להשאלה",
	"projectName": "הקואופ",
	"returnUrl": "https://www.1lev1.com/…",
	"fields": [
		{ "key": "price", "label": "שווי", "kind": "number", "original": 100, "proposed": 60 },
		{ "key": "descrip", "label": "תיאור", "kind": "text", "original": "…", "proposed": "…" }
	]
}
```

## 2. qids

### 2.1 הרחבת `40CreateNegotiation`

ה-arg מקבל אופציונלית: `sourceType` (string), `sourceId` (string),
`sourceMeta` (json). שמרו אותם על הרשומה כפי שהם. שאר החוזה ללא שינוי.

### 2.2 הרחבת `39GetNegotiation` (וגם `GetNegotiationByToken`)

הוסיפו לתשובה את `sourceType`, `sourceId`, `sourceMeta`.

### 2.3 חדש: `GetNegotiationBySource`

`arg: { sourceType, sourceId }` →
`filters: { sourceType: { eq }, sourceId: { eq } }`, אותה צורת תשובה כמו 39
(העדכני ביותר אם יש כמה: `sort: createdAt:desc`, `pagination: { limit: 1 }`).

**הרשאות:** ה-qid הזה רץ רק עם `jwt` של משתמש רשום (צד הקונצנזוס לא הוסיף אותו
ל-allow-lists של guest/charter, כך שאין מסלול service-token אליו). מומלץ לאמת
בצד השרת שהמשתמש חבר בפרויקט של האובייקט (`sourceId`) או לפחות שהדיון אינו
מוחזר למי שאינו רשום — דיוני גשר נוצרים כ-`visibility: 'private'`.

> כנ"ל ל-`39GetNegotiation`: ודאו שדיון `private` מוחזר רק למשתמשים רשומים
> (רצוי: חברי הפרויקט של המקור).

## 3. הכפתור ב-`negoPend.svelte` (ובמקבילה למשאבים)

מוסיפים כפתור "🤝 דיון מעמיק" שבונה payload מהערכים שעל המסך ופותח את הגשר.
ה-payload כולל **את כל** התנאים הניתנים למו"מ (גם אם לא שונו — הם יסומנו
כמוסכמים), כשה"מוצע" הוא הערכים העריכים הנוכחיים (המשתנים עם סיומת `2`).

```js
function b64url(obj) {
	const bytes = new TextEncoder().encode(JSON.stringify(obj));
	let bin = '';
	for (const b of bytes) bin += String.fromCharCode(b);
	return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function openBridge() {
	const returnUrl = new URL(window.location.href);
	returnUrl.searchParams.delete('negoBridge');
	const payload = {
		v: 1,
		sourceType: 'pmash',
		sourceId: String(pendId),
		title: name1,
		projectName,
		returnUrl: returnUrl.toString(),
		fields: [
			{ key: 'name', label: 'שם', kind: 'text', original: name1 ?? null, proposed: name2 ?? null },
			{
				key: 'descrip',
				label: 'תיאור',
				kind: 'text',
				original: descrip ?? null,
				proposed: descrip2 ?? null
			},
			{
				key: 'price',
				label: 'שווי',
				kind: 'number',
				original: Number(price) || 0,
				proposed: Number(price2) || 0
			},
			{
				key: 'easy',
				label: 'שווי לב',
				kind: 'number',
				original: Number(easy) || 0,
				proposed: Number(easy2) || 0
			},
			{
				key: 'hm',
				label: 'כמות',
				kind: 'number',
				original: Number(hm) || 0,
				proposed: Number(hm2) || 0
			},
			{
				key: 'sqadualed',
				label: 'תאריך התחלה',
				kind: 'date',
				original: toIsoDateString(sqadualed) ?? null,
				proposed: toIsoDateString(sqadualed2) ?? null
			},
			{
				key: 'sqadualedf',
				label: 'תאריך סיום',
				kind: 'date',
				original: toIsoDateString(sqadualedf) ?? null,
				proposed: toIsoDateString(sqadualedf2) ?? null
			}
		]
	};
	window.open(
		`https://consensus.1lev1.com/negotiation/bridge?d=${b64url(payload)}`,
		'_blank',
		'noopener'
	);
}
```

הערות:

- `label` הופך לכותרת ה-Issue בדיון ולמפתח ההתאמה בחזרה — שמרו אותו יציב
  (אל תחליפו שפה באמצע מו"מ). ההתאמה של ערכים בחזרה נעשית לפי `key`.
- `kind`: `number` ו-`date` עוברים אינטרפולציה (stance 50 ⇒ אמצע בין הערכים);
  `text` חוזר כניסוח של סעיף ההסכמה עצמו.
- טקסט ארוך נחתך ל-1200 תווים בצד הקונצנזוס (ה-payload נוסע ב-URL) — לתיאורי
  rich-text מומלץ לשלוח גרסת טקסט נקי.
- אם המשתמש כבר פתח דיון לאותו `pendId`, הראוט מזהה זאת (`GetNegotiationBySource`)
  ומדלג ישר לדיון הקיים.

## 4. קליטת ההסכמה בחזרה (`negoBridge`)

ה-BridgeBar בדיון מחזיר את המשתמש ל-`returnUrl` עם פרמטר `negoBridge`
(base64url של JSON):

```json
{ "v": 1, "sourceId": "42", "values": { "price": 75, "descrip": "ניסוח מאוזן…" } }
```

בעמוד שמארח את `negoPend` (או בקומפוננטה עצמה), בעת טעינה:

```js
const raw = new URLSearchParams(window.location.search).get('negoBridge');
if (raw) {
	try {
		const b64 = raw.replace(/-/g, '+').replace(/_/g, '/');
		const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
		const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
		const agreed = JSON.parse(new TextDecoder().decode(bytes));
		if (agreed?.v === 1 && String(agreed.sourceId) === String(pendId)) {
			// מילוי מוקדם של שדות העריכה — המשתמש עדיין שולח ומאשר כרגיל
			if (agreed.values.price != null) price2 = Number(agreed.values.price);
			if (agreed.values.easy != null) easy2 = Number(agreed.values.easy);
			if (agreed.values.hm != null) hm2 = Number(agreed.values.hm);
			if (agreed.values.name != null) name2 = String(agreed.values.name);
			if (agreed.values.descrip != null) descrip2 = String(agreed.values.descrip);
			if (agreed.values.sqadualed != null) sqadualed2 = agreed.values.sqadualed;
			if (agreed.values.sqadualedf != null) sqadualedf2 = agreed.values.sqadualedf;
		}
	} catch {
		/* פרמטר פגום — מתעלמים */
	}
}
```

המשתמש רואה את ערכי הפשרה ממולאים מראש, ושולח אותם דרך `increment()` הקיים —
כלומר ההסכמה עוברת את אותו סבב הצבעות ("כן / כן-אבל") כמו כל הצעה אחרת.

## 5. צ'קליסט

- [ ] Strapi: `sourceType` + `sourceId` + `sourceMeta` על `Negotiation` (+index)
- [ ] qid `40CreateNegotiation`: קבלת שלושת השדות
- [ ] qid `39GetNegotiation` + `GetNegotiationByToken`: החזרתם בתשובה
- [ ] qid חדש `GetNegotiationBySource` (registered בלבד; אכיפת חברות בפרויקט)
- [ ] אכיפת `visibility: private` בקריאות (לא להחזיר דיוני גשר לאורחים)
- [ ] כפתור `openBridge` ב-`negoPend.svelte` ובמקבילת המשאבים
- [ ] קליטת `negoBridge` ומילוי מוקדם של שדות העריכה
