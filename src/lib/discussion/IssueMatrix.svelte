<script lang="ts">
  import type { Issue, Clause, Opinion } from './scale';
  import { hueStyle } from './design';
  import { _ } from 'svelte-i18n';

  interface Props {
    issues: Issue[];
    clauses: Clause[];
    opinions: Opinion[];
    selectedId?: string | null;
    onselect?: (id: string) => void;
  }

  let {
    issues,
    clauses,
    opinions,
    selectedId = null,
    onselect,
  }: Props = $props();

  // ── Derived layout data ───────────────────────────────────────────────────
  const sortedIssues = $derived([...issues].sort((a, b) => a.order - b.order));
  const cols = $derived([...opinions].sort((a, b) => a.location - b.location));
  const cellMap = $derived(
    new Map(clauses.map((c) => [c.positionId + ':' + c.issueId, c]))
  );
</script>

{#if !sortedIssues.length || !cols.length}
  <p class="mx-empty">{$_('issueMatrix.empty')}</p>
{:else}
  <div class="mx-wrap">
    <table class="mx">
      <thead>
        <tr>
          <th class="mx-corner">{$_('issueMatrix.aspect')}</th>
          {#each cols as o (o.id)}
            {@const hue = hueStyle(o.color)}
            <th
              class="mx-colh {selectedId === o.id ? 'is-sel' : ''}"
              style="--hue:{hue.base}"
              onclick={() => onselect?.(o.id)}
              role="columnheader"
              aria-selected={selectedId === o.id}
              tabindex="0"
              onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') onselect?.(o.id); }}
            >
              <span class="mx-coldot" style="background:{hue.base}"></span>
              <span class="mx-coltext">{o.heading}</span>
            </th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each sortedIssues as issue (issue.id)}
          <tr>
            <th class="mx-rowh">{issue.title}</th>
            {#each cols as o (o.id)}
              {@const c = cellMap.get(o.id + ':' + issue.id)}
              {@const hue = hueStyle(o.color)}
              <td class="mx-cell">
                {#if c}
                  <p class="mx-body">{c.body}</p>
                  <span class="mx-bar"><i style="width:{c.stanceValue}%;background:{hue.base}"></i></span>
                {:else}
                  <span class="mx-missing">{$_('issueMatrix.missing')}</span>
                {/if}
              </td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/if}

<style>
  .mx-empty {
    color: var(--fg-4, #60608a);
    font-size: 0.9rem;
    text-align: center;
    padding: 2rem;
  }
  .mx-wrap {
    overflow-x: auto;
    border: 1px solid rgba(255, 255, 255, 0.10);
    border-radius: 16px;
    background: rgba(255, 255, 255, 0.02);
    /* custom scrollbar */
    scrollbar-width: thin;
    scrollbar-color: #2a2a45 transparent;
  }
  .mx-wrap::-webkit-scrollbar { height: 9px; }
  .mx-wrap::-webkit-scrollbar-thumb { background: #2a2a45; border-radius: 100px; }
  .mx-wrap::-webkit-scrollbar-track { background: transparent; }

  .mx {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.85rem;
    min-width: 560px;
  }
  .mx th,
  .mx td {
    padding: 0.7rem 0.8rem;
    text-align: start;
    vertical-align: top;
  }

  /* Sticky row-header column (RTL: sticks to inline-end) */
  .mx-corner {
    position: sticky;
    inset-inline-end: 0;
    z-index: 3;
    background: var(--bg-2, #15152a);
    font-size: 0.72rem;
    font-weight: 600;
    color: var(--fg-3, #7070a0);
    min-width: 104px;
    white-space: nowrap;
  }
  .mx-colh {
    min-width: 150px;
    cursor: pointer;
    border-bottom: 1px solid rgba(255, 255, 255, 0.10);
    transition: background 0.2s;
    white-space: nowrap;
    user-select: none;
  }
  .mx-colh:hover { background: rgba(255, 255, 255, 0.04); }
  .mx-colh.is-sel {
    /* color-mix isn't universally available; use rgba approximation */
    background: rgba(var(--hue, 139, 92, 246), 0.14);
    background: color-mix(in oklab, var(--hue) 14%, transparent);
  }
  .mx-coldot {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    margin-inline-end: 0.4rem;
    vertical-align: middle;
    flex-shrink: 0;
  }
  .mx-coltext {
    font-weight: 600;
    color: #e6e6f4;
    display: inline;
  }
  .mx-rowh {
    position: sticky;
    inset-inline-end: 0;
    z-index: 2;
    background: var(--bg-2, #15152a);
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--fg-2, #9090b8);
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    min-width: 104px;
  }
  .mx-cell {
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }
  .mx-body {
    font-size: 0.8rem;
    line-height: 1.45;
    color: rgba(255, 255, 255, 0.85);
    margin: 0;
  }
  .mx-bar {
    display: block;
    height: 4px;
    border-radius: 100px;
    background: rgba(255, 255, 255, 0.10);
    overflow: hidden;
    margin-top: 0.45rem;
  }
  .mx-bar i {
    display: block;
    height: 100%;
    border-radius: 100px;
    transition: width 0.5s cubic-bezier(0.2, 0.8, 0.2, 1);
  }
  .mx-missing {
    display: inline-block;
    font-size: 0.7rem;
    color: rgba(251, 191, 36, 0.8);
    border: 1px solid rgba(251, 191, 36, 0.35);
    background: rgba(245, 158, 11, 0.08);
    border-radius: 7px;
    padding: 0.1rem 0.45rem;
  }

  @media (prefers-reduced-motion: reduce) {
    .mx-bar i { transition: none; }
  }
</style>
