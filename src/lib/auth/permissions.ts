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

/** The authorship fields of an opinion (see `Opinion` in discussion/scale.ts). */
export interface Authored {
	authorExternalId?: string;
	authorUserId?: string;
	authorUserEmail?: string;
}

/**
 * Is `user` the author of this opinion?
 *
 * Three ways to be recognized, strongest first:
 * - `authorExternalId` — what the server stamps on every create (the 1lev1
 *   user id for registered authors, the agreement signature id for charter);
 * - the `author` user relation — set on registered creates too, and the one
 *   an admin fills in when attaching an opinion to its author by hand;
 * - that relation's email — for a response that carries no relation id.
 *   Registered users only: their `email` cookie is written by the login.
 *
 * This only decides what the page offers. The main server checks every
 * clause edit against the clause's own author.
 */
export function isAuthor(opinion: Authored | null | undefined, user: AppUser): boolean {
	if (!opinion || !user.id) return false;
	if (opinion.authorExternalId && opinion.authorExternalId === user.id) return true;
	if (user.type !== 'registered') return false;
	if (opinion.authorUserId && opinion.authorUserId === user.id) return true;
	return (
		!!opinion.authorUserEmail &&
		!!user.email &&
		opinion.authorUserEmail.trim().toLowerCase() === user.email.trim().toLowerCase()
	);
}
