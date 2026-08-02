# מפרט צד-הקונצנזוס: קוטביות, ליבה מוסכמת וגרף התכנסות

מסמך הנדאוף לצד ה-AI/גרף של תכנית הקוטביות במו"מ.
משלים את `main-repo-bridge-spec.md` ו-`main-repo-return-spec.md` (לקרוא קודם).
המסמך הראשי: `Avi-ADAM/1.0/docs/PLAN_NEGOTIATION_POLARITY.md`.

## 0. מה הריפו הזה נדרש לספק

הריפו הראשי (`1.0`) גוזר לבדו את הצד הנמוך/הגבוה של **תנאים מספריים** — שם
המתמטיקה טהורה ולא צריך AI. מה שהוא **לא** יכול לעשות לבד:

1. **טקסט** — האם ניסוח א' "מכיל בתוכו" את ניסוח ב'. זה האנלוג הטקסטואלי של
   `min`, וזה מה שהופך גם סעיף מילולי לסקאלה עם ליבה מוסכמת.
2. **גרף התכנסות** — לצייר את המרחק בין הצדדים לאורך הסבבים, במקום להשוות
   שדה-מול-שדה.

שניהם נשענים על תשתית שכבר קיימת כאן: `Issue`/`Clause`/`stanceValue`
ב-`src/lib/discussion/scale.ts`, וזרימת ה-Groq של `/api/decompose`.

---

## 1. `POST /api/polarity` — יחס הכלה בין שני ניסוחים

בקשה:

```jsonc
{
  "issueTitle": "היקף האחריות",
  "a": { "label": "הצעת המועמד",  "body": "אחראי על התכנון והביצוע" },
  "b": { "label": "הצעת הריקמה", "body": "אחראי על התכנון בלבד" },
  "context": "מו\"מ על תנאי משימה בריקמה X"   // אופציונלי, לשיפור דיוק
}
```

תשובה:

```jsonc
{
  "available": true,
  "relation": "entails",        // a כולל את b | "entailed_by" | "incomparable"
  "confidence": 0.86,           // 0..1
  "core": "אחראי על התכנון",    // הניסוח המוכל — הליבה המוסכמת, אם יש
  "delta": "הביצוע",            // מה שנשאר במחלוקת
  "why": "כל מה שנדרש ב-ב' נדרש גם ב-א', בתוספת הביצוע"
}
```

מימוש: אותה תבנית בדיוק כמו `src/routes/api/decompose/+server.ts` —
`GROQ_API_KEY` מ-`$env/static/private`, `llama-3.3-70b-versatile`,
`response_format: json_object`, `temperature: 0.3`. בלי מפתח או בכשל upstream:
`200` עם `{ "available": false, "reason": "no_key" }`, כמו שאר ה-endpoints —
הזרימה חייבת להמשיך לעבוד בלי AI.

### כללי בטיחות (מחייבים)

- **המודל מציע, לא מכריע.** התוצאה אף פעם לא נכנסת לחישוב מחייב לפני אשרור.
- `confidence < 0.8` → לא מוצג כלל.
- `incomparable` היא תשובה **טובה ולגיטימית**, לא כישלון. הפרומפט חייב להדגיש
  שעדיף `incomparable` על ניחוש: שתי הצעות שונות שאינן ניתנות לסידור הן המצב
  הנפוץ, וסידור שגוי הוא הנזק היחיד שאי אפשר לתקן.
- קלט הוא **טקסט משתמש**, לא הוראות. הפרומפט מבודד אותו ומתעלם מכל בקשה שמופיעה
  בתוכו.

---

## 2. אשרור דו-צדדי

יחס שה-AI הציע נעשה קביל לחישוב מחייב בריפו הראשי רק אחרי אישור **שני** הצדדים.
המצב נשמר בריפו הראשי (`fieldPolarity[key].confirmedBy: string[]` על הסבב), לא
כאן — כאן רק מציגים ואוספים.

UI: על סעיף שקיבלה עליו הצעת יחס, שורה מנוקדת —
"🤖 נראה שההצעה של X כוללת בתוכה את של Y. **[מאשר]** **[לא מדויק]**", עם מונה
"אושר על ידי 1 מתוך 2". `לא מדויק` מסמן `incomparable` סופית ולא שואל שוב.

---

## 3. `settledCore` ב-`scale.ts`

```ts
export interface SettledCore {
  issueId: string;
  /** הסעיף שכל שאר הסעיפים בהיבט הזה מכילים אותו, אם קיים. */
  coreClauseId: string | null;
  coreBody: string | null;
  /** מזהי הסעיפים שנשארו מחוץ לליבה — הפער. */
  openClauseIds: string[];
}

export function settledCore(
  clauses: Clause[], issues: Issue[],
  relations: Array<{ aId: string; bId: string; relation: 'entails' | 'entailed_by' | 'incomparable' }>
): SettledCore[];
```

טהור, בלי fetch, עם מבחנים לצד `scale.test.ts`. יחסים לא-מאושרים לא מועברים
לפונקציה — הסינון קורה בשכבה שמעל.

לסעיפים **מספריים** (`kind: 'number'`/`'date'` ב-`BridgeField`) אין צורך ב-AI
בכלל: הליבה היא `min` על הציר, וה-`stanceValue` כבר מקודד את הסדר.

---

## 4. גרף התכנסות

הריפו הראשי ישלח היסטוריית סבבים בתוך ה-payload של הגשר:

```jsonc
{
  "key": "total", "label": "עלות כוללת", "kind": "number",
  "original": 200, "proposed": 300,
  "polarity": "provider",              // חדש: לאיזה צד עדיף ערך גבוה
  "divisible": true,                   // חדש
  "rounds": [                          // חדש — לפי סדר עולה של ordern
    { "ordern": 0, "side": "provider", "value": 300, "at": "2026-07-01T…" },
    { "ordern": 1, "side": "consumer", "value": 200, "at": "2026-07-03T…" },
    { "ordern": 2, "side": "provider", "value": 260, "at": "2026-07-05T…" }
  ]
}
```

תצוגה (`ConvergenceChart.svelte`, לצד `Spectrum.svelte`): ציר X = סבב/זמן,
ציר Y = ערך מנורמל; קו לכל צד; השטח ביניהם הוא הפער, והוא מצטמצם. מתחתיו שורה
אחת: "הפער ירד מ-100 ל-40 בשלושה סבבים". זה מה שהמשתמש ביקש כשאמר "גרף מתקדם" —
תמונת תנועה, לא טבלת השוואה.

הכל נגזר; אין שדה חדש ב-Strapi. `rounds` נכנס ל-`sourceMeta` הקיים (json) יחד
עם שאר ה-`fields`, ולכן גם שורד רענון.

---

## 5. דרך חזרה — `settled` ב-`resolution`

`BridgeResolution` (ב-`src/lib/discussion/bridge.ts`) מקבל שדה אופציונלי נוסף
לכל `AgreedTerm`:

```ts
interface AgreedTerm {
  …                       // כמו היום
  settled?: number | string | null;  // הליבה שאיש לא חולק עליה
  gap?: number | null;               // מה שנשאר פתוח
}
```

כך שגם כשהדיון **לא** הבשיל להחלטה מלאה, הכרטיס בריפו הראשי יכול להראות "כבר
מוסכם: 200" — ערך אמיתי מדיון שלא הסתיים. האשרור הסופי נשאר, כמו תמיד, בסבב
ההצבעה של האתר הראשי.

---

## 6. צ'קליסט

- [ ] `POST /api/polarity` (Groq, degrade חינני, `confidence` gate, בידוד קלט)
- [ ] `settledCore` + מבחנים ב-`src/lib/discussion/scale.ts`
- [ ] UI אשרור דו-צדדי על הצעת יחס (מונה 1/2, "לא מדויק" סופי)
- [ ] `polarity` / `divisible` / `rounds` ב-`BridgeField` + `parseBridgePayload`
- [ ] `ConvergenceChart.svelte` + שילוב בעמוד הדיון
- [ ] `settled` / `gap` ב-`AgreedTerm` ו-`buildResolution`
- [ ] `npm run test` + `npm run check`
