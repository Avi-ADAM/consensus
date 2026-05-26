// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { AppUser } from '$lib/auth/permissions';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			user: AppUser;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
