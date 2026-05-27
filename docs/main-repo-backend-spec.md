# מפרט צד-שרת לריפו הראשי (1.0) — תמיכה בתת-דומיין `consensus.1lev1.com`

מסמך הנדאוף לסוכן הקוד שעובד על הריפו הראשי (`Avi-ADAM/1.0`) ועל Strapi.
אפליקציית הקונצנזוס היא SvelteKit נפרד שרץ על `consensus.1lev1.com`, משתפת את
עוגיות ה-SSO של `.1lev1.com`, ופונה לבקנד **דרך `/api/send` הקיים** (אותו מנגנון
`qids` + GraphQL מול Strapi). היא **לא** ניגשת ל-Strapi ישירות ולא משכפלת את ה-qids.

המשימות כאן: (1) להרחיב/להוסיף content-types ב-Strapi, (2) להוסיף/להרחיב qids,
(3) להקשיח את מסלול ה-service-token עבור משתמשים בלי `jwt`.

---

## 0. רקע על סוגי המשתמשים (נקבע בצד הקונצנזוס)

| סוג          | זיהוי מהעוגיות                         | הרשאות                                                   |
| ------------ | -------------------------------------- | -------------------------------------------------------- |
| `registered` | יש `jwt` (+`id`,`un`,`email`)          | יצירת דיון, הגבה, הצעה, הצבעה, עריכה                     |
| `charter`    | יש `fpval`+`email`/`un`, **אין `jwt`** | הגבה, הצעה, הצבעה — **בלי** יצירת דיון, בלי עריכה מתמשכת |
| `guest`      | כלום (גישה דרך לינק שיתוף)             | קריאה בלבד                                               |

הפרוקסי בצד הקונצנזוס (`/api/send` המקומי) שולח לשרת הראשי כך:

- **registered** → מעביר את ה-`jwt` כרגיל (`isSer:false`). Strapi אוכף הרשאות.
- **charter / guest** → אין `jwt`, ולכן הפרוקסי שולח **`isSer:true`** עבור פעולות
  מאושרות בלבד (allow-list קשיח: guest=קריאה, charter=קריאה+`CreatePosition`+`UpdatePosition`).
- הפרוקסי **תמיד** מחשב את `isSer` מחדש לפי סוג המשתמש — לא סומכים על מה שמגיע מהלקוח.

---

## 1. הקשחת אבטחה ב-`/api/send` (קריטי)

כיום `/api/send` משתמש בטוקן האדמין כשמגיע `isSer:true`:
`let jw = isSer ? VITE_ADMINMONTHER : cookies.get('jwt')`.
המשמעות: **כל** בקשה עם `isSer:true` מקבלת הרשאות אדמין מלאות. כשפותחים את זה
למשתמשי אמנה/אורח דרך הפרוקסי, חובה לתחום:

1. **טוקן ייעודי בהרשאות מינימום** — צרו Strapi API Token חדש (למשל
   `consensus-public`) עם הרשאות **רק** ל:
   - `Negotiation`: `find`, `findOne`
   - `Position`: `create`, `update`
   - `Argument`: `find`, `create`, `update`
   - `Cuntry`: `find`
     הוסיפו אותו כ-env (למשל `CONSENSUS_PUBLIC_TOKEN`) והשתמשו בו במקום
     `VITE_ADMINMONTHER` כאשר הבקשה מגיעה מהקונצנזוס (ראו סעיף הבא).

2. **Secret משותף** — הפרוקסי שולח header `x-consensus-secret` (כשמוגדר
   `PROXY_SHARED_SECRET` בצד הקונצנזוס). ב-`/api/send`: אם `isSer:true` והבקשה
   מיועדת ל-qid של קונצנזוס, אמתו שה-header תואם ל-`CONSENSUS_PROXY_SECRET`
   שלכם; אחרת `401`. כך לקוח אקראי לא יכול להפעיל את מסלול ה-service.

3. **מקור זהות נאמן** — לבקשות service, הפרוקסי מזריק ל-`arg` שדה `__identity`:
   ```json
   { "externalId": "…", "name": "…", "email": "…", "type": "charter|guest|registered" }
   ```
   ה-handlers של ה-qids **חייבים להשתמש ב-`__identity` כמקור האמת** לזהות
   המחבר/מצביע (author/voter), ולהתעלם משדות author שמגיעים מהלקוח. כך משתמש
   אמנה/אורח לא יכול להתחזות.

---

## 2. שינויים ב-content-types (Strapi v4)

### 2.1 הרחבת `Negotiation`

| שדה               | טיפוס                                 | ברירת מחדל | הערה                                      |
| ----------------- | ------------------------------------- | ---------- | ----------------------------------------- |
| `visibility`      | enum `private` / `unlisted` / `local` | `private`  | `unlisted`=נגיש בלינק; `local`=דיון מקומי |
| `shareToken`      | uid (unique)                          | —          | ללינק שיתוף                               |
| `ownerExternalId` | string                                | —          | ה-`id` של יוצר רשום                       |
| `isLocal`         | boolean                               | `false`    |                                           |
| `places`          | relation manyToMany → `Cuntry`        | —          | "מקום" סמנטי — **כרגע מדינה בלבד**        |
| `scaleMin`        | integer                               | `0`        | להרחבת הסקאלה כשמוסיפים דעה קיצונית       |
| `scaleMax`        | integer                               | `100`      |                                           |

> "מקום" מודל סמנטית כ-relation ל-`Cuntry` הקיים (אותו collection שעמוד `love`
> טוען כ-`cuntries`). בעתיד אפשר להחליף/להוסיף רמות עדינות יותר בלי לשנות את ה-API.

### 2.2 הרחבת `Position`

| שדה                 | טיפוס                                   | ברירת מחדל | הערה                                                                      |
| ------------------- | --------------------------------------- | ---------- | ------------------------------------------------------------------------- |
| `isAnchor`          | boolean                                 | `false`    | שתי דעות-העוגן שמגדירות את הקצוות                                         |
| `pole`              | enum `top` / `bottom` / `none`          | `none`     | קצה עליון/תחתון                                                           |
| `kind`              | enum `opinion` / `proposed_solution`    | `opinion`  |                                                                           |
| `relativePlacement` | json                                    | —          | `{ "mode": "between\|beyond_top\|beyond_bottom", "refOrder": <number?> }` |
| `authorExternalId`  | string                                  | —          | מתוך `__identity`                                                         |
| `authorType`        | enum `registered` / `charter` / `guest` | —          | מתוך `__identity`                                                         |

(נשמרים כבר: `heading`, `description`, `author`, `authorEmail`, `votes`,
`voters`(json), `location`, `intensity`, `tags`(json), `order`, `aiMeta`(json).)

### 2.3 content-type חדש: `Argument` (דיון מובנה — יתרונות/חסרונות)

במקום תגובות חופשיות: לכל דעה (`Position`) מצרפים טיעונים בעד/נגד, כל אחד עם
תמיכה משלו. כך עולות הדעות עם האיזון הטוב בין יתרונות לחסרונות.

| שדה                | טיפוס                                            | הערה                     |
| ------------------ | ------------------------------------------------ | ------------------------ |
| `body`             | text                                             | תוכן הטיעון              |
| `stance`           | enum `pro` / `con`                               | יתרון / חיסרון           |
| `votes`            | integer (default `0`)                            | תמיכה בטיעון             |
| `voters`           | json (default `[]`)                              | מזהי המצביעים            |
| `authorName`       | string                                           | מתוך `__identity`        |
| `authorEmail`      | string                                           | מתוך `__identity`        |
| `authorExternalId` | string                                           | מתוך `__identity`        |
| `authorType`       | enum `registered`/`charter`/`guest`              |                          |
| `position`         | relation manyToOne → `Position`                  | הטיעון נוגע לדעה זו      |
| `negotiation`      | relation manyToOne → `Negotiation`               | לשיוך/סינון              |
| `parent`           | relation manyToOne → `Argument` (self, nullable) | טיעון-נגד (לשרשור עתידי) |

---

## 3. qids — חדשים ומורחבים

מספור: השתמשו במספרים הפנויים הבאים אחרי הקיימים. החוזה (`arg`) חייב להתאים למה
שהקונצנזוס שולח.

### 3.1 הרחבת `39GetNegotiation` (קיים)

`arg: { id }`. הוסיפו לתשובה את השדות החדשים:
`visibility`, `shareToken`, `isLocal`, `scaleMin`, `scaleMax`,
`places { data { id attributes { name } } }`, ועל positions:
`isAnchor`, `pole`, `kind`, `relativePlacement`, `authorType`.

### 3.2 הרחבת `40CreateNegotiation` (קיים, **registered בלבד**)

`arg: { topic, description, maxRounds, createdBy, createdByEmail, ownerExternalId,
visibility, shareToken, isLocal, placeIds: number[] }`.
מחזיר `{ id, shareToken }`. חברו `places` עם `placeIds`.

### 3.3 הרחבת `41CreatePosition` (קיים)

`arg: { negotiationId, heading, description, location, order, intensity, tags,
kind, pole, isAnchor, relativePlacement, __identity }`.
את `author`/`authorEmail`/`authorExternalId`/`authorType` **קחו מ-`__identity`**
(לא מהלקוח).

### 3.4 הרחבת `42UpdatePosition` (קיים) — הצבעה/תמיכה ועריכה

`arg: { id, support?, heading?, description?, location?, __identity }`.
כשמגיע `support: true` — זו **הצבעה**: הוסיפו את `__identity.externalId` ל-`voters`
בצד השרת (idempotent) ועדכנו `votes` בהתאם (אל תסמכו על votes/voters מהלקוח).
אחרת זו **עריכה**: אפשרו `heading/description/location` רק אם
`__identity.type==='registered'` והוא הבעלים.

### 3.5 חדש: `GetNegotiationByToken`

`arg: { token }` → `filters: { shareToken: { eq: token } }`. אותה תשובה כמו 3.1.
לשימוש בגישה דרך לינק שיתוף (גם ל-guest).

### 3.6 חדש: `ListLocalNegotiations`

`arg: { placeId }` → דיונים שבהם `places` מכיל `placeId` ו-`visibility` ∈
`{ local }` (ו/או `unlisted` לפי שיקולכם). מחזיר רשימה מקוצרת
(`id, topic, description, currentRound, maxRounds, positions count`).

### 3.7 חדש: טיעונים (יתרונות/חסרונות)

- **`ListArguments`** — `arg: { positionId }` → טיעונים של הדעה
  (`id, body, stance, votes`), ממוינים למשל לפי `votes` יורד.
- **`CreateArgument`** — `arg: { negotiationId, positionId, stance, body, __identity }`.
  שדות ה-author מ-`__identity`; `stance` ∈ `pro|con`.
- **`UpdateArgument`** — `arg: { id, support?, __identity }`. כמו 3.4: `support:true`
  מוסיף את `__identity.externalId` ל-`voters` (idempotent) ומעדכן `votes`.

### 3.8 חדש (אופציונלי): `ListPlaces`

`arg: {}` → `cuntries { data { id attributes { name } } }`. אם תעדיפו, הקונצנזוס
יכול לצרוך את שאילתת ה-`cuntries` הציבורית הקיימת ישירות — אך qid דרך `/api/send`
שומר על אחידות.

---

## 4. צ'קליסט

- [ ] content-types: הרחבת `Negotiation` + `Position`, יצירת `Argument`
- [ ] relation `Negotiation.places` → `Cuntry`
- [ ] Strapi API Token `consensus-public` בהרשאות מינימום + env
- [ ] `/api/send`: מסלול service מאומת ב-secret + שימוש בטוקן המוגבל לבקשות קונצנזוס
- [ ] `/api/send`: שימוש ב-`__identity` כמקור אמת לזהות בכתיבות service
- [ ] qids: הרחבת 39/40/41/42 + חדשים `GetNegotiationByToken`, `ListLocalNegotiations`, `ListArguments`, `CreateArgument`, `UpdateArgument` (+`ListPlaces` אופציונלי)
- [ ] הרשאות Strapi לטוקן המוגבל מכסות בדיוק את ה-qids האלו

> בצד הקונצנזוס: הפרוקסי (`src/routes/api/send/+server.ts`) כבר שולח `isSer`
> מחושב-מחדש, header `x-consensus-secret` (כשמוגדר), ו-`arg.__identity`.
> ה-qids ושמות השדות חייבים להתאים לחוזה למעלה.
