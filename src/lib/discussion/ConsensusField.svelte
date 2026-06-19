<script lang="ts">
  import { tweened } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';
  import type { Opinion, Clause, InsertMode } from './scale';
  import { hueStyle } from './design';
  import { _ } from 'svelte-i18n';

  // ── Scale math (inlined, mirrors scale.ts) ──────────────────────────────────
  function sortByLocation(ops: Opinion[]) {
    return [...ops].sort((a, b) => a.location - b.location);
  }
  function toDisplay(ops: Opinion[], pad = 8): Map<string, number> {
    const sorted = sortByLocation(ops);
    const n = sorted.length;
    if (n === 0) return new Map();
    if (n === 1) return new Map([[sorted[0].id, 50]]);
    const span = 100 - 2 * pad;
    const min = sorted[0].location;
    const max = sorted[n - 1].location;
    if (max === min) {
      return new Map(sorted.map((o, i) => [o.id, pad + (span * i) / (n - 1)]));
    }
    return new Map(sorted.map((o) => [o.id, pad + (span * (o.location - min)) / (max - min)]));
  }
  function weightedCenter(ops: Opinion[], pad = 8): number {
    const points = toDisplay(ops, pad);
    if (points.size === 0) return 50;
    const byId = new Map(ops.map((o) => [o.id, o]));
    let weighted = 0, total = 0;
    for (const [id, d] of points) {
      const w = ((byId.get(id)?.votes) ?? 0) + 1;
      weighted += d * w; total += w;
    }
    return total === 0 ? 50 : weighted / total;
  }
  function consensusScore(ops: Opinion[]): number {
    if (ops.length < 2) return 0;
    const vals = ops.map((o) => o.location);
    const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
    const variance = vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length;
    return Math.round(Math.min(100, Math.max(0, 100 - Math.sqrt(variance))));
  }

  // ── Radial geometry ─────────────────────────────────────────────────────────
  const ARC = 140;
  function angleOf(d: number) { return 90 - ((d - 50) / 50) * ARC; }
  function pointOf(d: number, R: number) {
    const a = (angleOf(d) * Math.PI) / 180;
    return { x: 50 + R * Math.cos(a), y: 50 - R * Math.sin(a), ox: Math.cos(a), oy: -Math.sin(a) };
  }
  function arcPath(R: number): string {
    const a = pointOf(0, R), b = pointOf(50, R), c = pointOf(100, R);
    return `M ${a.x} ${a.y} A ${R} ${R} 0 0 1 ${b.x} ${b.y} A ${R} ${R} 0 0 1 ${c.x} ${c.y}`;
  }
  function diameter(votes: number, k: number) { return (26 + Math.min(votes, 12) * 4) * k; }
  function pinStyle(p: { x: number; y: number; ox: number; oy: number }, gapPx: number): string {
    return `left:${p.x}%;top:${p.y}%;transform:translate(calc(${-50 + p.ox * 50}% + ${p.ox * gapPx}px),calc(${-50 + p.oy * 50}% + ${p.oy * gapPx}px))`;
  }

  // ── Props ───────────────────────────────────────────────────────────────────
  interface Props {
    opinions: Opinion[];
    canPropose?: boolean;
    canVote?: boolean;
    clauses?: Clause[];
    oninsert?: (mode: InsertMode) => void;
    onsupport?: (id: string) => void;
    onopen?: (id: string) => void;
    onclauses?: (id: string) => void;
    motionOn?: boolean;
    glow?: number;
  }

  let {
    opinions,
    canPropose = false,
    canVote = true,
    clauses = [],
    oninsert,
    onsupport,
    onopen,
    onclauses,
    motionOn = true,
    glow = 1,
  }: Props = $props();

  // ── Internal state ───────────────────────────────────────────────────────────
  let selectedId: string | null = $state(null);
  let containerEl: HTMLDivElement | null = $state(null);
  let containerWidth: number = $state(480);

  // ── ResizeObserver ───────────────────────────────────────────────────────────
  $effect(() => {
    if (!containerEl) return;
    const ro = new ResizeObserver((entries) => {
      containerWidth = entries[0].contentRect.width;
    });
    ro.observe(containerEl);
    return () => ro.disconnect();
  });

  // ── Derived scale values ─────────────────────────────────────────────────────
  const sorted = $derived(sortByLocation(opinions));
  const displayMap = $derived(toDisplay(opinions));
  const score = $derived(consensusScore(opinions));
  const center = $derived(weightedCenter(opinions));
  const k = $derived(Math.max(0.66, Math.min(1.15, containerWidth / 480)));
  const R = 33;

  // ── Tweened values ───────────────────────────────────────────────────────────
  const scoreT = tweened(0, { duration: 650, easing: cubicOut });
  const centerT = tweened(50, { duration: 650, easing: cubicOut });

  $effect(() => {
    const opts = motionOn ? {} : { duration: 0 };
    scoreT.set(score, opts);
  });
  $effect(() => {
    const opts = motionOn ? {} : { duration: 0 };
    centerT.set(center, opts);
  });

  // ── Derived geometry ─────────────────────────────────────────────────────────
  const needle = $derived(pointOf($centerT, R - 4));
  const tickPoint = $derived(pointOf($centerT, R));
  const coreGlow = $derived(18 + ($scoreT / 100) * 34 * glow);
  const coreShadowAlpha = $derived(0.25 + 0.35 * ($scoreT / 100));

  // ── Selected opinion ─────────────────────────────────────────────────────────
  const selectedOpinion = $derived(opinions.find((o) => o.id === selectedId) ?? null);
  const selectedHue = $derived(selectedOpinion ? hueStyle(selectedOpinion.color) : null);
  const clauseCountFor = $derived((id: string) => clauses.filter((c) => c.positionId === id).length);
  const totalSupporters = $derived(opinions.reduce((s, o) => s + (o.votes ?? 0), 0));
  const selectedLoc = $derived(selectedOpinion ? Math.round(selectedOpinion.location) : 0);

  function handleSelect(id: string) {
    selectedId = selectedId === id ? null : id;
  }
</script>

<div class="cf-wrap">
  <div class="cf-grid">
    <!-- ── Field ── -->
    <div class="cf-field" bind:this={containerEl}>
      <svg class="cf-svg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        <defs>
          <radialGradient id="cf-core-grad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="rgba(124,58,237,0.55)" />
            <stop offset="55%" stop-color="rgba(79,70,229,0.18)" />
            <stop offset="100%" stop-color="rgba(79,70,229,0)" />
          </radialGradient>
          <linearGradient id="cf-arc-grad" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stop-color="rgba(139,92,246,0.55)" />
            <stop offset="50%" stop-color="rgba(74,222,128,0.6)" />
            <stop offset="100%" stop-color="rgba(139,92,246,0.55)" />
          </linearGradient>
        </defs>

        <!-- Guide rings -->
        <circle cx="50" cy="50" r={R} fill="none" stroke="rgba(255,255,255,0.07)" stroke-width="0.4" vector-effect="non-scaling-stroke" />
        <circle cx="50" cy="50" r={R - 11} fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="0.4" vector-effect="non-scaling-stroke" />

        <!-- Fan arc -->
        <path d={arcPath(R)} fill="none" stroke="url(#cf-arc-grad)" stroke-width="0.7" stroke-linecap="round" vector-effect="non-scaling-stroke" opacity="0.8" />

        <!-- Field ribs -->
        {#each sorted as o (o.id)}
          {@const p = pointOf(displayMap.get(o.id) ?? 50, R)}
          <line
            x1="50" y1="50" x2={p.x} y2={p.y}
            stroke={selectedId === o.id ? hueStyle(o.color).glow : 'rgba(255,255,255,0.06)'}
            stroke-width={selectedId === o.id ? 0.8 : 0.4}
            vector-effect="non-scaling-stroke"
            class="cf-rib"
          />
        {/each}

        <!-- Core glow -->
        <circle cx="50" cy="50" r="20" fill="url(#cf-core-grad)" />

        <!-- Needle + tick -->
        <line
          x1="50" y1="50"
          x2={needle.x} y2={needle.y}
          stroke="rgba(74,222,128,0.9)"
          stroke-width="0.9"
          stroke-linecap="round"
          vector-effect="non-scaling-stroke"
          class="cf-needle"
        />
        <circle cx={tickPoint.x} cy={tickPoint.y} r="1.5" fill="#4ade80" class="cf-tick" />
      </svg>

      <!-- Core readout -->
      <div
        class="cf-core"
        style="box-shadow: 0 0 {coreGlow}px rgba(124,58,237,{coreShadowAlpha.toFixed(2)})"
      >
        <div class="cf-core-num">{Math.round($scoreT)}<span>%</span></div>
        <div class="cf-core-label">{$_('consensusField.consensus')}</div>
      </div>

      <!-- Center pill -->
      <div class="cf-centerpill" style={pinStyle(tickPoint, 0)}>
        <span class="cf-livedot"></span>{$_('consensusField.consensusCenter')}
      </div>

      <!-- Opinion nodes -->
      {#each sorted as o (o.id)}
        {@const d = displayMap.get(o.id) ?? 50}
        {@const p = pointOf(d, R)}
        {@const hue = hueStyle(o.color)}
        {@const sel = selectedId === o.id}
        {@const dia = diameter(o.votes ?? 0, k)}
        {@const proposed = o.kind === 'proposed_solution'}
        <button
          type="button"
          class="cf-node {sel ? 'is-sel' : ''} {proposed ? 'is-prop' : ''}"
          style="left:{p.x}%;top:{p.y}%;width:{dia}px;height:{dia}px;background:{hue.bg};border-color:{sel ? hue.base : hue.border};box-shadow:{sel ? `0 0 0 3px ${hue.bg}, 0 8px 26px ${hue.glow}` : '0 4px 16px rgba(0,0,0,0.4)'}"
          aria-label={o.heading}
          onclick={() => handleSelect(o.id)}
        >
          {#if proposed}
            <span class="cf-prop-mark">✦</span>
          {:else}
            <span class="cf-node-v">{o.votes ?? 0}</span>
          {/if}
        </button>
        <button
          type="button"
          class="cf-label {sel ? 'is-sel' : ''}"
          style="{pinStyle(p, dia / 2 + 10)};color:{sel ? hue.text : 'rgba(255,255,255,0.82)'}"
          onclick={() => handleSelect(o.id)}
        >
          <span
            class="cf-label-text"
            style={sel ? `border-color:${hue.border};background:${hue.bg}` : ''}
          >{o.heading}</span>
        </button>
      {/each}

      <!-- Pole labels -->
      <div class="cf-pole cf-pole-r">{$_('consensusField.poleRight')}</div>
      <div class="cf-pole cf-pole-l">{$_('consensusField.poleLeft')}</div>
    </div>

    <!-- ── Inspector ── -->
    <aside class="cf-insp {selectedOpinion ? '' : 'cf-insp-empty'}">
      {#if selectedOpinion && selectedHue}
        <div class="cf-insp-eyebrow">
          {selectedOpinion.kind === 'proposed_solution' ? $_('consensusField.proposedSolution') : $_('consensusField.selectedOpinion')}
        </div>
        <div class="cf-insp-head">
          <span
            class="cf-insp-dot"
            style="background:{selectedHue.base};box-shadow:0 0 14px {selectedHue.glow}"
          ></span>
          <h4 class="cf-insp-title">{selectedOpinion.heading}</h4>
        </div>
        {#if selectedOpinion.description}
          <p class="cf-insp-desc">{selectedOpinion.description}</p>
        {/if}

        <div class="cf-insp-loc">
          <div class="cf-insp-loc-top">
            <span>{$_('consensusField.derivedLocation')}</span>
            <strong>{selectedLoc}</strong>
          </div>
          <div class="cf-insp-track">
            <div
              class="cf-insp-track-fill"
              style="width:{selectedLoc}%;background:{selectedHue.base}"
            ></div>
            <div
              class="cf-insp-track-self"
              style="inset-inline-start:{(selectedOpinion.selfPlacement ?? selectedLoc)}%"
              title={$_('consensusField.selfPlacementTitle')}
            ></div>
          </div>
        </div>

        <div class="cf-insp-votes">
          <div>
            <strong>{selectedOpinion.votes ?? 0}</strong>
            <span>{$_('consensusField.supporters')}</span>
          </div>
          {#if canVote && onsupport}
            <button
              type="button"
              class="btn-support"
              style="border-color:{selectedHue.border}"
              onclick={() => onsupport!(selectedOpinion!.id)}
            >
              {$_('consensusField.supportBtn')}
            </button>
          {/if}
        </div>

        <div class="cf-insp-actions">
          {#if onclauses}
            <button
              type="button"
              class="btn-soft btn-soft-wide"
              onclick={() => onclauses!(selectedOpinion!.id)}
            >
              {$_('consensusField.openClauses')}
              <em>{clauseCountFor(selectedOpinion.id)}</em>
            </button>
          {/if}
          {#if onopen}
            <button
              type="button"
              class="btn-soft"
              onclick={() => onopen!(selectedOpinion!.id)}
            >
              {$_('consensusField.openArguments')}
            </button>
          {/if}
        </div>
      {:else}
        <div class="cf-insp-eyebrow">{$_('consensusField.controlCenter')}</div>
        <h4 class="cf-insp-guidetitle">{$_('consensusField.guideTitle')}</h4>
        <ol class="cf-insp-steps">
          <li>
            <b>1</b>
            <span>{$_('consensusField.step1')}</span>
          </li>
          <li>
            <b>2</b>
            <!-- eslint-disable svelte/no-at-html-tags -->
            <span>{@html $_('consensusField.step2')}</span>
          </li>
          <li>
            <b>3</b>
            <span>{@html $_('consensusField.step3')}</span>
            <!-- eslint-enable svelte/no-at-html-tags -->
          </li>
        </ol>
        <div class="cf-insp-summary">
          <div>
            <strong>{Math.round($scoreT)}%</strong>
            <span>{$_('consensusField.overallConsensus')}</span>
          </div>
          <div>
            <strong>{opinions.length}</strong>
            <span>{$_('consensusField.opinionsCount')}</span>
          </div>
          <div>
            <strong>{totalSupporters}</strong>
            <span>{$_('consensusField.supporters')}</span>
          </div>
        </div>
      {/if}
    </aside>
  </div>
</div>

<style>
  /* ── Wrap & grid ── */
  .cf-wrap {
    container-type: inline-size;
    width: 100%;
  }
  .cf-grid {
    display: grid;
    grid-template-columns: minmax(0, 1.5fr) minmax(280px, 1fr);
    gap: 1.4rem;
    align-items: stretch;
  }
  @container (max-width: 640px) {
    .cf-grid { grid-template-columns: 1fr; }
  }

  /* ── Field ── */
  .cf-field {
    position: relative;
    width: 100%;
    max-width: 520px;
    margin-inline: auto;
    aspect-ratio: 1;
    align-self: center;
  }
  .cf-svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    overflow: visible;
  }
  :global(.cf-rib),
  :global(.cf-needle),
  :global(.cf-tick) {
    transition: all 0.5s cubic-bezier(0.2, 0.8, 0.2, 1);
  }

  /* ── Core readout ── */
  .cf-core {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: 23%;
    height: 23%;
    border-radius: 50%;
    background: radial-gradient(circle at 50% 38%, #1b1640, #0c0a1c);
    border: 1px solid rgba(196, 181, 253, 0.30);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    transition: box-shadow 0.6s ease;
  }
  @media (prefers-reduced-motion: no-preference) {
    .cf-core {
      animation: coreBreath 4s ease-in-out infinite;
    }
  }
  @keyframes coreBreath {
    0%, 100% { transform: translate(-50%, -50%) scale(1); }
    50%       { transform: translate(-50%, -50%) scale(1.03); }
  }
  .cf-core-num {
    font-family: var(--font-sans, 'Sora', sans-serif);
    font-weight: 800;
    font-size: clamp(1.3rem, 4.2vw, 2rem);
    line-height: 1;
    background: linear-gradient(135deg, #c4b5fd, #818cf8);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    font-variant-numeric: tabular-nums;
  }
  .cf-core-num span {
    font-size: 0.55em;
    -webkit-text-fill-color: #9090b8;
    margin-inline-start: 1px;
  }
  .cf-core-label {
    font-size: 0.62rem;
    letter-spacing: 0.18em;
    color: var(--fg-3, #7070a0);
    text-transform: uppercase;
    margin-top: 0.2rem;
  }

  /* ── Center pill ── */
  .cf-centerpill {
    position: absolute;
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    white-space: nowrap;
    font-size: 0.66rem;
    font-weight: 600;
    color: #bbf7d0;
    background: rgba(16, 185, 129, 0.18);
    border: 1px solid rgba(52, 211, 153, 0.45);
    padding: 0.18rem 0.55rem;
    border-radius: 100px;
    z-index: 6;
    pointer-events: none;
  }
  .cf-livedot {
    display: inline-block;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #4ade80;
    box-shadow: 0 0 8px rgba(74, 222, 128, 0.6);
    flex-shrink: 0;
  }
  @media (prefers-reduced-motion: no-preference) {
    .cf-livedot {
      animation: pulse 2s ease-in-out infinite;
    }
  }
  @keyframes pulse {
    0%, 100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.35); opacity: 0.65; }
  }

  /* ── Opinion nodes ── */
  .cf-node {
    position: absolute;
    border-radius: 50%;
    border: 1.5px solid;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    backdrop-filter: blur(8px);
    transition:
      left 0.6s cubic-bezier(0.2, 0.8, 0.2, 1),
      top 0.6s cubic-bezier(0.2, 0.8, 0.2, 1),
      width 0.35s ease,
      height 0.35s ease,
      box-shadow 0.35s ease,
      border-color 0.25s;
    transform: translate(-50%, -50%);
    z-index: 8;
    padding: 0;
  }
  .cf-node:hover { filter: brightness(1.15); }
  .cf-node-v {
    font-family: var(--font-sans, 'Sora', sans-serif);
    font-size: 0.72rem;
    font-weight: 700;
    color: #fff;
    opacity: 0.92;
    font-variant-numeric: tabular-nums;
  }
  .cf-prop-mark { color: #6ee7b7; font-size: 0.95rem; }
  .cf-node.is-prop { border-style: dashed; }
  .cf-node.is-sel { z-index: 9; }

  /* ── Labels ── */
  .cf-label {
    position: absolute;
    z-index: 8;
    max-width: 138px;
    background: none;
    border: none;
    cursor: pointer;
    text-align: center;
    line-height: 1.2;
    transition: transform 0.6s cubic-bezier(0.2, 0.8, 0.2, 1), color 0.2s;
    padding: 0;
  }
  .cf-label-text {
    display: inline-block;
    font-family: var(--font-sans, 'Sora', sans-serif);
    font-size: 0.74rem;
    font-weight: 600;
    padding: 0.16rem 0.5rem;
    border-radius: 9px;
    border: 1px solid transparent;
    transition: background 0.2s, border-color 0.2s;
    text-wrap: balance;
  }
  .cf-label.is-sel .cf-label-text { box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35); }

  /* ── Pole captions ── */
  .cf-pole {
    position: absolute;
    bottom: 1%;
    font-size: 0.66rem;
    color: var(--fg-4, #60608a);
    letter-spacing: 0.02em;
    pointer-events: none;
  }
  .cf-pole-r { inset-inline-end: 0; text-align: end; }
  .cf-pole-l { inset-inline-start: 0; text-align: start; }

  /* ── Inspector ── */
  .cf-insp {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.10);
    border-radius: 18px;
    padding: 1.4rem;
    display: flex;
    flex-direction: column;
    min-height: 100%;
  }
  .cf-insp-eyebrow {
    font-size: 0.7rem;
    font-weight: 600;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--fg-3, #7070a0);
    margin-bottom: 0.7rem;
  }
  .cf-insp-head {
    display: flex;
    align-items: flex-start;
    gap: 0.6rem;
  }
  .cf-insp-dot {
    width: 11px;
    height: 11px;
    border-radius: 50%;
    margin-top: 0.45rem;
    flex-shrink: 0;
    display: inline-block;
  }
  .cf-insp-title {
    font-family: var(--font-display, 'Frank Ruhl Libre', serif);
    font-weight: 700;
    font-size: 1.35rem;
    color: #f6f5ff;
    line-height: 1.25;
  }
  .cf-insp-desc {
    color: var(--fg-2, #9090b8);
    font-size: 0.95rem;
    font-weight: 300;
    margin-top: 0.6rem;
    text-wrap: pretty;
    line-height: 1.6;
  }

  /* Location track */
  .cf-insp-loc {
    margin-top: 1.2rem;
    background: rgba(0, 0, 0, 0.2);
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 12px;
    padding: 0.75rem 0.85rem;
  }
  .cf-insp-loc-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 0.78rem;
    color: var(--fg-3, #7070a0);
  }
  .cf-insp-loc-top strong {
    color: #e6e6f4;
    font-size: 1rem;
    font-variant-numeric: tabular-nums;
  }
  .cf-insp-track {
    position: relative;
    height: 7px;
    border-radius: 100px;
    background: rgba(255, 255, 255, 0.10);
    margin-top: 0.55rem;
    overflow: visible;
  }
  .cf-insp-track-fill {
    height: 100%;
    border-radius: 100px;
    transition: width 0.6s cubic-bezier(0.2, 0.8, 0.2, 1);
  }
  .cf-insp-track-self {
    position: absolute;
    top: 50%;
    width: 2px;
    height: 14px;
    background: #fff;
    opacity: 0.55;
    transform: translate(-50%, -50%);
    border-radius: 2px;
  }

  /* Votes row */
  .cf-insp-votes {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 1.2rem;
  }
  .cf-insp-votes > div {
    display: flex;
    flex-direction: column;
  }
  .cf-insp-votes strong {
    font-family: var(--font-sans, 'Sora', sans-serif);
    font-size: 1.7rem;
    font-weight: 700;
    color: #c4b5fd;
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }
  .cf-insp-votes span {
    font-size: 0.74rem;
    color: var(--fg-3, #7070a0);
    margin-top: 0.2rem;
  }

  /* Actions */
  .cf-insp-actions {
    margin-top: auto;
    padding-top: 1.2rem;
    display: flex;
    gap: 0.6rem;
    flex-wrap: wrap;
  }

  /* ── Buttons ── */
  .btn-support {
    font-family: var(--font-sans, 'Sora', sans-serif);
    font-size: 0.9rem;
    font-weight: 600;
    color: #bbf7d0;
    background: rgba(16, 185, 129, 0.14);
    border: 1px solid rgba(52, 211, 153, 0.40);
    border-radius: 100px;
    padding: 0.55rem 1.2rem;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    transition: background 0.2s, transform 0.15s;
  }
  .btn-support:hover { background: rgba(16, 185, 129, 0.26); transform: translateY(-1px); }
  .btn-support:active { transform: translateY(0) scale(0.97); }

  .btn-soft {
    font-family: var(--font-sans, 'Sora', sans-serif);
    font-size: 0.86rem;
    font-weight: 600;
    color: #e6e6f4;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 11px;
    padding: 0.6rem 0.8rem;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.45rem;
    transition: background 0.2s, border-color 0.2s;
    flex: 1;
  }
  .btn-soft:hover {
    background: rgba(124, 58, 237, 0.16);
    border-color: rgba(124, 58, 237, 0.45);
  }
  .btn-soft em {
    font-style: normal;
    font-size: 0.72rem;
    font-weight: 700;
    color: #c4b5fd;
    background: rgba(124, 58, 237, 0.22);
    border-radius: 100px;
    padding: 0.05rem 0.45rem;
    font-variant-numeric: tabular-nums;
  }
  .btn-soft-wide { width: 100%; }

  /* ── Empty inspector / guidance ── */
  .cf-insp-empty .cf-insp-guidetitle {
    font-family: var(--font-display, 'Frank Ruhl Libre', serif);
    font-weight: 700;
    font-size: 1.2rem;
    color: var(--fg-1, #f0f0f8);
    line-height: 1.35;
    margin-bottom: 1rem;
  }
  .cf-insp-steps {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 0.7rem;
    margin-bottom: 1.3rem;
    padding: 0;
  }
  .cf-insp-steps li {
    display: flex;
    gap: 0.65rem;
    align-items: flex-start;
    font-size: 0.88rem;
    color: var(--fg-2, #9090b8);
    font-weight: 300;
    line-height: 1.5;
  }
  .cf-insp-steps b {
    flex-shrink: 0;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: rgba(124, 58, 237, 0.18);
    border: 1px solid rgba(124, 58, 237, 0.4);
    color: #c4b5fd;
    font-size: 0.78rem;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  :global(.cf-insp-steps em) {
    font-style: normal;
    color: #c4b5fd;
    font-weight: 500;
  }
  .cf-insp-summary {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.5rem;
    padding: 1rem 0;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    margin-bottom: 1.2rem;
  }
  .cf-insp-summary > div {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
  }
  .cf-insp-summary strong {
    font-family: var(--font-sans, 'Sora', sans-serif);
    font-size: 1.4rem;
    font-weight: 700;
    color: #e6e6f4;
    font-variant-numeric: tabular-nums;
  }
  .cf-insp-summary span {
    font-size: 0.7rem;
    color: var(--fg-3, #7070a0);
    margin-top: 0.15rem;
  }

  @media (prefers-reduced-motion: reduce) {
    .cf-core { animation: none; }
    .cf-livedot { animation: none; }
    :global(.cf-rib),
    :global(.cf-needle),
    :global(.cf-tick) { transition: none; }
    .cf-node { transition: box-shadow 0.25s ease, border-color 0.2s; }
    .cf-insp-track-fill { transition: none; }
  }
</style>
