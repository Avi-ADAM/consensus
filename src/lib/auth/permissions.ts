export type UserType = 'registered' | 'charter' | 'guest';

export interface AppUser {
	/** 'registered' = logged in at www.1lev1.com, 'charter' = agreed at agreement.1lev1.com, 'guest' = neither */
	type: UserType;
	/** External id: the `id` cookie for registered users, the `fpval` cookie for charter users */
	id: string | null;
	name: string | null;
	email: string | null;
	/** True only when a real `jwt` is present (registered account) */
	authenticated: boolean;
}

export interface Permissions {
	createDiscussion: boolean;
	comment: boolean;
	propose: boolean;
	vote: boolean;
	editOwn: boolean;
	/** Whether the identity survives across browsers / over time (real account) */
	persistentIdentity: boolean;
}

export function permissionsFor(type: UserType): Permissions {
	switch (type) {
		case 'registered':
			return {
				createDiscussion: true,
				comment: true,
				propose: true,
				vote: true,
				editOwn: true,
				persistentIdentity: true
			};
		case 'charter':
			return {
				createDiscussion: false,
				comment: true,
				propose: true,
				vote: true,
				editOwn: false,
				persistentIdentity: false
			};
		default:
			return {
				createDiscussion: false,
				comment: false,
				propose: false,
				vote: false,
				editOwn: false,
				persistentIdentity: false
			};
	}
}
