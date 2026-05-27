<script lang="ts">
	interface Props {
		word: string;
		color?: string;
		big?: boolean;
		muted?: boolean;
	}

	let { word, color = 'violet', big = false, muted = false }: Props = $props();

	// Literal class strings so Tailwind can detect them at build time.
	const styles: Record<string, string> = {
		violet: 'bg-violet-500/15 text-violet-100 border-violet-400/40',
		sky: 'bg-sky-500/15 text-sky-100 border-sky-400/40',
		emerald: 'bg-emerald-500/15 text-emerald-100 border-emerald-400/40',
		amber: 'bg-amber-500/15 text-amber-100 border-amber-400/40',
		rose: 'bg-rose-500/15 text-rose-100 border-rose-400/40',
		indigo: 'bg-indigo-500/15 text-indigo-100 border-indigo-400/40',
		teal: 'bg-teal-500/15 text-teal-100 border-teal-400/40',
		fuchsia: 'bg-fuchsia-500/15 text-fuchsia-100 border-fuchsia-400/40',
		lime: 'bg-lime-500/15 text-lime-100 border-lime-400/40'
	};

	let palette = $derived(styles[color] ?? styles.violet);
</script>

<span
	class="inline-flex items-center rounded-full border font-semibold shadow-md backdrop-blur-md transition-all duration-300 select-none {palette}"
	class:px-5={big}
	class:py-2={big}
	class:text-base={big}
	class:px-3={!big}
	class:py-1={!big}
	class:text-xs={!big}
	class:opacity-60={muted}
>
	{word}
</span>
