/**
 * Hebrew catalog — the default (and currently only) locale. Keys are the stable
 * contract used through `t()`; add a sibling locale file with the same keys to
 * translate. `{name}` tokens are interpolated by `t(key, { name })`.
 */
export const he = {
	'common.cancel': 'ביטול',
	'common.add': 'הוספה',
	'common.save': 'שמירה',
	'common.close': 'סגירה',
	'common.loading': 'טוען…',
	'common.optional': 'לא חובה',

	'new.title': 'דיון חדש',
	'new.locked': 'יצירת דיון פתוחה למשתמשים רשומים בלבד.',
	'new.lockedCta': 'התחברו',
	'new.intro':
		'הגדירו את הנושא ואת דעתכם. משתתפים יוסיפו דעות נוספות, וה-AI יפרק כל דעה לסעיפים לפי היבטים משותפים.',
	'new.topicLabel': 'נושא הדיון',
	'new.topicPlaceholder': 'במשפט אחד וברור',
	'new.descriptionLabel': 'תיאור',
	'new.ownOpinionTitle': 'דעתכם',
	'new.ownOpinionHint': 'נסחו את עמדתכם. אין צורך לחלק לסעיפים — ה-AI יעשה זאת.',
	'new.opinionHeadingPlaceholder': 'כותרת — העמדה במשפט',
	'new.opinionDescriptionPlaceholder': 'הסבר קצר (לא חובה)',
	'new.selfPlacementLabel': 'איפה אתם ממקמים את עצמכם?',
	'new.selfPlacementHint': 'סימון עזר ל-AI. המיקום הסופי ייגזר מהסעיפים שלכם.',
	'new.selfPlacementStart': 'קצה אחד',
	'new.selfPlacementEnd': 'קצה שני',
	'new.othersToggle': 'הוספת דעות של אחרים',
	'new.othersHint': 'אם אתם מכניסים עמדות קיימות של אנשים אחרים, הוסיפו אותן כאן.',
	'new.addAnotherOpinion': 'הוספת דעה נוספת',
	'new.removeOpinion': 'הסרה',
	'new.visibilityLegend': 'נראות',
	'new.visibilityPrivate': 'פרטי (בהזמנה)',
	'new.visibilityUnlisted': 'משותף בלינק',
	'new.visibilityLocal': 'מקומי',
	'new.placesLabel': 'בחרו מקום אחד או יותר',
	'new.maxRoundsLabel': 'מספר סבבים',
	'new.submit': 'צור דיון',
	'new.submitting': 'יוצר…',
	'new.errorCreate': 'יצירת הדיון נכשלה. ודאו שהשרת מחובר ונסו שוב.',
	'new.errorGeneric': 'שגיאה ביצירת הדיון. ודאו שהשרת מחובר ונסו שוב.'
} as const;

export type MessageKey = keyof typeof he;
