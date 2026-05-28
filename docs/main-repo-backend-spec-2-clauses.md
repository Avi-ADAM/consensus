# מפרט צד-שרת — תוספת (2.0): יישוב מחלוקות ברמת סעיפים

מסמך זה הוא **תוספת** ל-`main-repo-backend-spec.md` (1.0). הוא מכסה **רק את
השינויים החדשים** הנדרשים למעבר ליישוב מחלוקות ברמת **סעיפים** (clauses)
ו**היבטים** (issues). כל מה שתואר ב-1.0 — הקשחת `/api/send`, ה-content-types
`Negotiation`/`Position`/`Argument`, ו-qids 39–42 + הנקודות הציבוריות — **כבר
בוצע ברובו, ואין לבצע אותו מחדש**. המסמך הזה נכתב בנפרד כדי שלא יהיה בלבול.

הנחות היסוד מ-1.0 **נשארות בתוקף ולא משתנות**:

- הקונצנזוס פונה לבקנד רק דרך הפרוקסי `/api/send` (qids + GraphQL מול Strapi).
- הפרוקסי מחשב `isSer` מחדש לפי סוג המשתמש, שולח `x-consensus-secret`, ומזריק
  `arg.__identity` כמקור האמת לזהות המחבר.
- הטוקן המוגבל `consensus-public` משמש לבקשות service; הרשאותיו חייבות לכסות גם
  את ה-content-types וה-qids החדשים שכאן (ראו סעיף 5).

---

## 0. רקע על השינוי המודלי

ב-1.0 דעה (`Position`) היא נקודה אחת על ציר 0..100 ששתי דעות-עוגן מגדירות את
קצותיו. בשלב הזה דעה הופכת ל**אוסף סעיפים**, כשכל סעיף עונה על **היבט** משותף של
הנושא. ההשלכות שרלוונטיות לבקנד:

- **קצוות דינמיים.** הקצוות נגזרים מהדעות שעלו בפועל, לא מוגדרים מראש. עם זאת
  **שומרים את מנגנון העוגנים הקיים** (`Position.isAnchor`/`pole` מ-1.0) כ-fallback
  למקרה שה-AI לא הפיק פירוק שימושי. אין שינוי סכמה עבור זה — השדות כבר קיימים.
- **מיקום נגזר.** `Position.location` כבר לא נקבע ידנית אלא **מחושב בצד הקונצנזוס**
  כממוצע משוקלל של ה-`stanceValue` של הסעיפים, ונכתב חזרה דרך `42UpdatePosition`
  הקיים. **הבקנד לא מחשב כלום** — הוא רק מאחסן את הערך שהקונצנזוס שולח.
- **מיקום-עצמי כסיגנל.** בנוסף, המחבר ממקם את עצמו ידנית; ערך זה נשמר בנפרד
  (`Position.selfPlacement`) ונשלח ל-AI כאינדיקציה. הוא **אינו** המיקום המוצג.

---

## 1. content-type חדש: `Issue` (היבט)

היבט הוא ציר-משנה משותף של הנושא, שאליו נתלים סעיפים מכל הדעות. ההיבטים נוצרים
בהדרגה: הדעה הראשונה מייצרת את המאגר הראשוני, וכל דעה חדשה מותאמת מולו.

| שדה           | טיפוס                              | ברירת מחדל | הערה                                  |
| ------------- | ---------------------------------- | ---------- | ------------------------------------- |
| `negotiation` | relation manyToOne → `Negotiation` | —          | ההיבט שייך לדיון                       |
| `title`       | string                             | —          | כותרת ההיבט (למשל "תקציב", "מי מחליט") |
| `order`       | integer                            | `0`        | סדר תצוגה                             |
| `origin`      | enum `ai` / `human`                | `ai`       | האם ה-AI זיהה אותו או משתמש הוסיף ידנית |

צד הקשר ב-`Negotiation`: `issues` (oneToMany). צד הקשר ב-`Issue`: `clauses`
(oneToMany, ראו למטה).

---

## 2. content-type חדש: `Clause` (סעיף)

סעיף הוא מרכיב תוכן של דעה אחת, השייך להיבט אחד. **הבחנה חשובה:** סעיף ≠ `Argument`.
`Argument` (בעד/נגד מ-1.0) שופט אם דעה טובה; `Clause` הוא חלק מהדעה עצמה. שני
המנגנונים חיים זה לצד זה.

| שדה                 | טיפוס                                   | ברירת מחדל | הערה                                            |
| ------------------- | --------------------------------------- | ---------- | ----------------------------------------------- |
| `body`              | text                                    | —          | ניסוח הסעיף                                     |
| `stanceValue`       | integer                                 | `50`       | מיקום הסעיף על ציר ההיבט 0..100 (יחסי, מתחדד)   |
| `origin`            | enum `ai` / `human`                     | `ai`       | פירוק אוטומטי vs הוספה ידנית                    |
| `confirmedByAuthor` | boolean                                 | `false`    | המחבר אישר שהפירוק/הניסוח נכון                  |
| `position`          | relation manyToOne → `Position`         | —          | הסעיף שייך לדעה זו                              |
| `issue`             | relation manyToOne → `Issue`            | —          | ההיבט שהסעיף עונה עליו (**nullable** עד שמסווג) |
| `negotiation`       | relation manyToOne → `Negotiation`      | —          | לשיוך/סינון מהיר (כמו ב-`Argument`)             |
| `authorExternalId`  | string                                  | —          | מתוך `__identity`                              |
| `authorType`        | enum `registered` / `charter` / `guest` | —          | מתוך `__identity`                              |

צד הקשר ב-`Position`: `clauses` (oneToMany).

---

## 3. הרחבת `Position` (שדה אחד חדש)

| שדה             | טיפוס   | ברירת מחדל | הערה                                                                       |
| --------------- | ------- | ---------- | -------------------------------------------------------------------------- |
| `selfPlacement` | integer | —          | המיקום שהמחבר נתן לעצמו על הציר 0..100 — אינדיקציה ל-AI, נפרד מ-`location` |

> `location` (קיים מ-1.0) הופך ל**מיקום נגזר**: הקונצנזוס מחשב אותו מהסעיפים וכותב
> אותו דרך `42UpdatePosition`. אין שינוי סכמה ל-`location` ואין חישוב בבקנד.

---

## 4. qids חדשים

מספור: שמות מפורשים בסגנון ה-qids הבעלי-שם מ-1.0 (`ListArguments` וכו'). החוזה
(`arg`) חייב להתאים למה שהקונצנזוס שולח. בכל כתיבה — author מ-`__identity` בלבד.

### 4.1 `ListIssues`

`arg: { negotiationId }` →
`filters: { negotiation: { id: { eq: negotiationId } } }`, ממוין `order:asc`.
מחזיר לכל היבט: `id, title, order, origin`.

### 4.2 `ListClauses`

`arg: { negotiationId }` (אופציונלי גם `positionId` לסינון לדעה אחת) →
`filters: { negotiation: { id: { eq } } }`. מחזיר לכל סעיף:
`id, body, stanceValue, origin, confirmedByAuthor`,
`position { data { id } }`, `issue { data { id attributes { title } } }`.

### 4.3 `CreateIssue`

`arg: { negotiationId, title, order, origin }` → `{ id }`.
`origin` ∈ `ai|human` (`human` כשמשתמש מוסיף היבט ידנית). חברו ל-`negotiation`.

### 4.4 `CreateClause`

`arg: { negotiationId, positionId, issueId?, body, stanceValue, origin, __identity }`
→ `{ id }`.
את `authorExternalId`/`authorType` **קחו מ-`__identity`** (לא מהלקוח). חברו
`position`, `negotiation`, ו-`issue` (אם `issueId` סופק; אחרת הסעיף נשאר לא-מסווג).

### 4.5 `UpdateClause`

`arg: { id, body?, stanceValue?, issueId?, confirmedByAuthor?, __identity }`.
עריכת `body`/`issueId` מותרת רק כאשר `__identity.type === 'registered'` והמשתמש
הוא הבעלים (כמו כלל העריכה ב-`42UpdatePosition`). עדכון `stanceValue` ו-
`confirmedByAuthor` מותר למחבר. אל תסמכו על author שמגיע מהלקוח.

### 4.6 אופציונלי: הרחבת `39GetNegotiation`

אם תעדיפו טעינה אחת במקום קריאות נפרדות, אפשר להוסיף לתשובת `39GetNegotiation`
את `issues { data { id attributes { title order origin } } }` ועל positions את
`clauses { data { id attributes { body stanceValue origin confirmedByAuthor
issue { data { id } } } } }` ו-`selfPlacement`. לא חובה — `ListIssues`/`ListClauses`
מספיקים.

---

## 5. הרשאות לטוקן המוגבל (`consensus-public`)

הוסיפו לטוקן המוגבל מ-1.0 הרשאות **בדיוק** ל-qids/פעולות החדשים:

- `Issue`: `find`, `create`
- `Clause`: `find`, `create`, `update`
- `Position`: `update` כבר קיים מ-1.0 (לכתיבת `location`/`selfPlacement`) — ודאו
  ש-`selfPlacement` נכלל בשדות הניתנים לעדכון.

כל שאר כללי האבטחה מ-1.0 (secret משותף, `__identity` כמקור אמת, `isSer` מחושב-
מחדש) חלים גם כאן ללא שינוי.

---

## 6. צ'קליסט

- [ ] content-type חדש `Issue` (+ relation `Negotiation.issues`)
- [ ] content-type חדש `Clause` (+ relations `Position.clauses`, `Issue.clauses`, `Clause.negotiation`)
- [ ] הרחבת `Position`: שדה `selfPlacement`
- [ ] qids חדשים: `ListIssues`, `ListClauses`, `CreateIssue`, `CreateClause`, `UpdateClause`
- [ ] (אופציונלי) הרחבת `39GetNegotiation` לקנן issues+clauses+selfPlacement
- [ ] הרשאות הטוקן המוגבל מכסות את ה-content-types וה-qids החדשים בלבד
- [ ] כתיבות clause/issue משתמשות ב-`__identity` כמקור אמת לזהות
