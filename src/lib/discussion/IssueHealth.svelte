<script lang="ts">
  import type { Issue, Clause } from './scale';

  interface Props {
    issues: Issue[];
    clauses: Clause[];
  }

  let { issues, clauses }: Props = $props();

  // ── Scale helpers (inlined) ───────────────────────────────────────────────
  function spreadToScore(values: number[]): number {
    if (values.length < 2) return 0;
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
    return Math.round(Math.min(100, Math.max(0, 100 - Math.sqrt(variance))));
  }

  const rows = $derived(
    [...issues]
      .sort((a, b) => a.order - b.order)
      .map((issue) => {
        const values = clauses
          .filter((c) => c.issueId === issue.id)
          .map((c) => c.stanceValue);
        return {
          issueId: issue.id,
          title: issue.title,
          score: spreadToScore(values),
          clauseCount: values.length,
        };
      })
      .filter((r) => r.clauseCount > 0)
  );

  function tone(score: number): string {
    if (score >= 70) return 'is-settled';
    if (score >= 40) return 'is-mid';
    return 'is-hot';
  }
</script>

{#if rows.length > 0}
  <div class="ih" dir="rtl">
    <div class="ih-top">
      <span class="ih-title">קונצנזוס לפי היבט</span>
      <span class="ih-legend">
        <i class="d-em"></i>מוסכם
        <i class="d-am"></i>חלקי
        <i class="d-ro"></i>שנוי במחלוקת
      </span>
    </div>
    <div class="ih-row">
      {#each rows as r (r.issueId)}
        <div class="ih-chip {tone(r.score)}">
          <span class="ih-chip-title">{r.title}</span>
          <span class="ih-chip-score">{r.score}%</span>
          <span class="ih-chip-bar"><i style="width:{r.score}%"></i></span>
        </div>
      {/each}
    </div>
  </div>
{/if}

<style>
  .ih {
    margin-top: 1.5rem;
    background: rgba(255, 255, 255, 0.025);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 16px;
    padding: 1rem 1.1rem;
  }
  .ih-top {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.8rem;
  }
  .ih-title {
    font-size: 0.74rem;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--fg-3, #7070a0);
  }
  .ih-legend {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.72rem;
    color: var(--fg-4, #60608a);
  }
  .ih-legend i {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    margin-inline-start: 0.5rem;
    display: inline-block;
    flex-shrink: 0;
  }
  .ih-legend i:first-child {
    margin-inline-start: 0;
  }
  .d-em { background: #34d399; }
  .d-am { background: #fbbf24; }
  .d-ro { background: #f43f5e; }

  .ih-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem;
  }
  .ih-chip {
    flex: 1 1 150px;
    min-width: 140px;
    border: 1px solid;
    border-radius: 12px;
    padding: 0.6rem 0.75rem;
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 0.15rem 0.5rem;
    align-items: center;
  }
  .ih-chip-title {
    font-size: 0.85rem;
    font-weight: 600;
    grid-column: 1;
  }
  .ih-chip-score {
    font-size: 0.9rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    grid-column: 2;
    grid-row: 1;
  }
  .ih-chip-bar {
    grid-column: 1 / 3;
    height: 4px;
    border-radius: 100px;
    background: rgba(255, 255, 255, 0.10);
    overflow: hidden;
    margin-top: 0.35rem;
    display: block;
  }
  .ih-chip-bar i {
    display: block;
    height: 100%;
    border-radius: 100px;
    transition: width 0.6s cubic-bezier(0.2, 0.8, 0.2, 1);
  }

  /* Tone variants */
  .ih-chip.is-settled {
    border-color: rgba(52, 211, 153, 0.38);
    background: rgba(16, 185, 129, 0.10);
    color: #a7f3d0;
  }
  .ih-chip.is-settled .ih-chip-bar i { background: #34d399; }

  .ih-chip.is-mid {
    border-color: rgba(251, 191, 36, 0.38);
    background: rgba(245, 158, 11, 0.10);
    color: #fde68a;
  }
  .ih-chip.is-mid .ih-chip-bar i { background: #fbbf24; }

  .ih-chip.is-hot {
    border-color: rgba(251, 113, 133, 0.38);
    background: rgba(244, 63, 94, 0.10);
    color: #fecdd3;
  }
  .ih-chip.is-hot .ih-chip-bar i { background: #f43f5e; }

  @media (prefers-reduced-motion: reduce) {
    .ih-chip-bar i { transition: none; }
  }
</style>
