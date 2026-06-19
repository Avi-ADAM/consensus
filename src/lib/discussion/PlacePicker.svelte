<script lang="ts">
	import { _ } from 'svelte-i18n';

	interface Place {
		id: string;
		name: string;
	}

	interface Props {
		places: Place[];
		selected?: string[];
	}

	let { places, selected = $bindable([]) }: Props = $props();
	let query = $state('');

	let filtered = $derived(
		query.trim()
			? places.filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase()))
			: places
	);

	function toggle(id: string) {
		selected = selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id];
	}
</script>

{#if places.length === 0}
	<p class="text-sm text-white/50">{$_('place.noPlaces')}</p>
{:else}
	<input
		bind:value={query}
		placeholder={$_('place.searchPlaceholder')}
		class="mb-2 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white"
	/>
	<div class="flex max-h-44 flex-wrap gap-2 overflow-y-auto">
		{#each filtered as place (place.id)}
			<button
				type="button"
				onclick={() => toggle(place.id)}
				class="rounded-full border px-3 py-1 text-sm transition-colors {selected.includes(place.id)
					? 'border-violet-400 bg-violet-500 text-white'
					: 'border-white/30 text-white/70 hover:border-white/60'}"
			>
				{place.name}
			</button>
		{/each}
	</div>
{/if}
