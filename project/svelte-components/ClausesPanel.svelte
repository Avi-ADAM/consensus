<script lang="ts">
  import { onMount } from 'svelte';
  import type { Issue, Clause } from './scale';
  import { hueStyle } from './design';

  // ── Scale helpers (inlined) ───────────────────────────────────────────────
  function missingIssues(positionClauses: Clause[], issues: Issue[]): Issue[] {
    const covered = new Set(positionClauses.map((c) => c.issueId));
    return issues.filter((i) => !covered.has(i.id));
  }
  function dominantClause(clauses: Clause[], selfPlacement: number): Clause | null {
    let best: Clause | null = null;
    let bestGap = -1;
    for (const c of clauses) {
      const gap = Math.abs(c.stanceValue - selfPlacement);
      if (gap > bestGap) { bestGap = gap; best = c; }
    }
    return best;
  }

  // ── Props ─────────────────────────────────────────────────────────────────
  interface Props {
    title: string;
    color?: string;
    clauses: Clause[];
    issues: Issue[];
    selfPlacement?: number;
    derivedLocation?: number;
    canEdit?: boolean;
    loading?: boolean;
    fillingIssueId?: string | null;
    savingClauseId?: string | null;
    onfill?: (issue: Issue) => void;
    onaddmanual?: (issue: Issue, draft: { body: string; stanceValue: number }) => void;
    onupdate?: (clauseId: string, draft: { body: string; stanceValue: number }) => void;
    onconfirm?: (clauseId: string) => void;
    onclose?: () => void;
  }

  let {
    title,
    color = 'violet',
    clauses,
    issues,
    selfPlacement,
    derivedLocation = 50,
    canEdit = false,
    loading = false,
    fillingIssueId = null,
    savingClauseId = null,
    onfill,
    onaddmanual,
    onupdate,
    onconfirm,
    onclose,
  }: Props = $props();

  // ── Derived data ──────────────────────────────────────────────────────────
  const hue = $derived(hueStyle(color));
  const sortedIssues = $derived([...issues].sort((a, b) => a.order - b.order));
  const clausesByIssue = $derived(
    new Map(sortedIssues.map((i) => [i.id, clauses.filter((c) => c.issueId === i.id)]))
  );
  const unclassified = $derived(clauses.filter((c) => c.issueId === null || c.issueId === undefined));
  const gaps = $derived(missingIssues(clauses, issues));
  const pulling = $derived(
    typeof selfPlacement === 'number' ? dominantClause(clauses, selfPlacement) : null
  );
  const drift = $derived(
    typeof selfPlacement === 'number'
      ? Math.round(derivedLocation) - Math.round(selfPlacement)
      : 0
  );

  // ── Local edit state ──────────────────────────────────────────────────────
  let editingId: string | null = $state(null);
  let editBody: string = $state('');
  let editStance: number = $state(50);
  let manualIssueId: string | null = $state(null);
  let manualBody: string = $state('');
  let manualStance: number = $state(50);

  function startEdit(c: Clause) {
    editingId = c.id;
    editBody = c.body;
    editStance = c.stanceValue;
  }
  function cancelEdit() { editingId = null; }
  function saveEdit() {
    const b = editBody.trim();
    if (!editingId || !b) return;
    onupdate?.(editingId, { body: b, stanceValue: editStance });
    editingId = null;
  }
  function startManual(id: string) {
    manualIssueId = id;
    manualBody = '';
    manualStance = 50;
  }
  function cancelManual() { manualIssueId = null; }
  function saveManual(issue: Issue) {
    const b = manualBody.trim();
    if (!b) return;
    onaddmanual?.(issue, { body: b, stanceValue: manualStance });
    manualIssueId = null;
  }

  // ── Keyboard / scroll lock ────────────────────────────────────────────────
  onMount(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onclose?.();
    }
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('keydown', handleKey);
      document.body.style.overflow = prev;
    };
  });

  function handleScrimClick(e: MouseEvent) {
    if (e.target === e.currentTarget) onclose?.();
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="modal-scrim" onmousedown={handleScrimClick}>
  <div class="modal" dir="rtl" role="dialog" aria-modal="true" aria-label="סעיפי הדעה">
    <!-- Header -->
    <header class="modal-head">
      <div class="modal-head-l">
        <span class="modal-eyebrow">
          <i class="modal-dot" style="background:{hue.base}"></i>
          סעיפי הדעה
        </span>
        <h2 class="modal-title">{title}</h2>
      </div>
      <button type="button" class="modal-x" onclick={onclose} aria-label="סגירה">✕</button>
    </header>

    <!-- Drift hint -->
    {#if clauses.length > 0 && typeof selfPlacement === 'number'}
      <div class="cp-derive">
        <div class="cp-derive-row">
          <span>המיקום הנגזר מהסעיפים</span>
          <strong>{Math.round(derivedLocation)}</strong>
          <span class="cp-derive-vs">מול סימון עצמי</span>
          <strong>{Math.round(selfPlacement)}</strong>
        </div>
        {#if Math.abs(drift) >= 5 && pulling}
          <p class="cp-derive-pull">הסעיף שהכי מושך אתכם לכיוון: "{pulling.body}".</p>
        {/if}
      </div>
    {/if}

    <!-- Body -->
    <div class="modal-body">
      <!-- Clauses by issue -->
      {#each sortedIssues as issue (issue.id)}
        {@const list = clausesByIssue.get(issue.id) ?? []}
        {#if list.length > 0}
          <section class="cp-sec">
            <h3 class="cp-sec-title">{issue.title}</h3>
            <ul class="cp-list">
              {#each list as c (c.id)}
                <li class="cp-item">
                  {#if editingId === c.id}
                    <div class="cp-edit">
                      <textarea
                        rows="2"
                        class="cp-ta"
                        bind:value={editBody}
                      ></textarea>
                      <label class="cp-range">
                        עמדה על הציר — {editStance}
                        <input
                          type="range"
                          min="0"
                          max="100"
                          bind:value={editStance}
                        />
                      </label>
                      <div class="cp-edit-actions">
                        <button type="button" class="btn-ghost-sm" onclick={cancelEdit}>ביטול</button>
                        <button
                          type="button"
                          class="btn-violet-sm"
                          disabled={!editBody.trim()}
                          onclick={saveEdit}
                        >שמירה</button>
                      </div>
                    </div>
                  {:else}
                    <div class="cp-item-top">
                      <p class="cp-body">{c.body}</p>
                      {#if c.confirmedByAuthor}
                        <span class="cp-confirmed">✓ מאושר</span>
                      {/if}
                    </div>
                    <span
                      class="cp-bar"
                      style="--accent:{hue.base}"
                    ><i style="width:{c.stanceValue}%"></i></span>
                    {#if canEdit}
                      <div class="cp-item-actions">
                        <button
                          type="button"
                          class="cp-link"
                          disabled={savingClauseId === c.id}
                          onclick={() => startEdit(c)}
                        >עריכה</button>
                        {#if !c.confirmedByAuthor}
                          <button
                            type="button"
                            class="cp-link cp-link-ok"
                            disabled={savingClauseId === c.id}
                            onclick={() => onconfirm?.(c.id)}
                          >
                            {savingClauseId === c.id ? 'שומר…' : 'אישור הסעיף'}
                          </button>
                        {/if}
                      </div>
                    {/if}
                  {/if}
                </li>
              {/each}
            </ul>
          </section>
        {/if}
      {/each}

      <!-- Unclassified clauses -->
      {#if unclassified.length > 0}
        <section class="cp-sec">
          <h3 class="cp-sec-title cp-muted">ללא שיוך להיבט</h3>
          <ul class="cp-list">
            {#each unclassified as c (c.id)}
              <li class="cp-item">
                <p class="cp-body">{c.body}</p>
              </li>
            {/each}
          </ul>
        </section>
      {/if}

      <!-- Gaps -->
      {#if gaps.length > 0}
        <section class="cp-gaps">
          <h3 class="cp-gaps-title">סעיפים חסרים</h3>
          <p class="cp-gaps-sub">היבטים שדעות אחרות התייחסו אליהם — הדעה הזו עדיין לא.</p>
          <ul class="cp-gaps-list">
            {#each gaps as issue (issue.id)}
              <li class="cp-gap">
                <div class="cp-gap-row">
                  <span class="cp-gap-name">{issue.title}</span>
                  {#if canEdit}
                    <div class="cp-gap-actions">
                      <button
                        type="button"
                        class="btn-ghost-sm"
                        onclick={() => startManual(issue.id)}
                      >הוספה ידנית</button>
                      <button
                        type="button"
                        class="btn-amber-sm"
                        disabled={fillingIssueId === issue.id}
                        onclick={() => onfill?.(issue)}
                      >
                        {fillingIssueId === issue.id ? 'ממלא…' : 'השלם עם AI'}
                      </button>
                    </div>
                  {/if}
                </div>
                {#if manualIssueId === issue.id}
                  <div class="cp-edit cp-edit-in">
                    <textarea
                      rows="2"
                      placeholder="נסחו את הסעיף…"
                      class="cp-ta"
                      bind:value={manualBody}
                    ></textarea>
                    <label class="cp-range">
                      עמדה על הציר — {manualStance}
                      <input
                        type="range"
                        min="0"
                        max="100"
                        bind:value={manualStance}
                      />
                    </label>
                    <div class="cp-edit-actions">
                      <button type="button" class="btn-ghost-sm" onclick={cancelManual}>ביטול</button>
                      <button
                        type="button"
                        class="btn-violet-sm"
                        disabled={!manualBody.trim()}
                        onclick={() => saveManual(issue)}
                      >הוספה</button>
                    </div>
                  </div>
                {/if}
              </li>
            {/each}
          </ul>
        </section>
      {/if}

      {#if clauses.length === 0 && gaps.length === 0}
        <p class="cp-muted">אין עדיין סעיפים לדעה זו.</p>
      {/if}
    </div>
  </div>
</div>

<style>
  /* ── Scrim + modal shell ── */
  .modal-scrim {
    position: fixed;
    inset: 0;
    z-index: 50;
    background: rgba(4, 4, 10, 0.66);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    animation: scrimIn 0.25s ease;
  }
  @keyframes scrimIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  .modal {
    width: 100%;
    max-width: 42rem;
    max-height: 86vh;
    display: flex;
    flex-direction: column;
    background: linear-gradient(180deg, #16162c, #111124);
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: 20px;
    padding: 1.6rem;
    color: #fff;
    box-shadow: 0 40px 100px rgba(0, 0, 0, 0.6);
    animation: modalIn 0.32s cubic-bezier(0.2, 0.8, 0.2, 1);
    overflow: hidden;
  }
  @keyframes modalIn {
    from { opacity: 0; transform: translateY(18px) scale(0.98); }
    to   { opacity: 1; transform: none; }
  }

  /* ── Header ── */
  .modal-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    flex-shrink: 0;
  }
  .modal-eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.1em;
    color: var(--fg-3, #7070a0);
  }
  .modal-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    display: inline-block;
    flex-shrink: 0;
  }
  .modal-title {
    font-family: var(--font-display, 'Frank Ruhl Libre', serif);
    font-weight: 700;
    font-size: 1.4rem;
    margin-top: 0.35rem;
    line-height: 1.25;
  }
  .modal-x {
    font-size: 1rem;
    color: var(--fg-3, #7070a0);
    background: none;
    border: none;
    cursor: pointer;
    padding: 0.3rem 0.5rem;
    border-radius: 8px;
    transition: color 0.2s, background 0.2s;
    flex-shrink: 0;
  }
  .modal-x:hover { color: #fff; background: rgba(255, 255, 255, 0.08); }

  /* ── Body ── */
  .modal-body {
    flex: 1;
    overflow-y: auto;
    margin-top: 1.1rem;
    display: flex;
    flex-direction: column;
    gap: 1.1rem;
    padding-inline-end: 0.2rem;
    scrollbar-width: thin;
    scrollbar-color: #2a2a45 transparent;
  }
  .modal-body::-webkit-scrollbar { width: 9px; }
  .modal-body::-webkit-scrollbar-thumb { background: #2a2a45; border-radius: 100px; }
  .modal-body::-webkit-scrollbar-track { background: transparent; }

  /* ── Derive hint ── */
  .cp-derive {
    margin-top: 1.1rem;
    border: 1px solid rgba(124, 58, 237, 0.28);
    background: rgba(124, 58, 237, 0.10);
    border-radius: 12px;
    padding: 0.8rem 0.9rem;
    flex-shrink: 0;
  }
  .cp-derive-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.85rem;
    color: #ddd6fe;
  }
  .cp-derive-row strong {
    font-size: 1.05rem;
    color: #fff;
    font-variant-numeric: tabular-nums;
  }
  .cp-derive-vs { color: #a78bfa; }
  .cp-derive-pull {
    margin-top: 0.45rem;
    font-size: 0.82rem;
    color: #c4b5fd;
    line-height: 1.5;
  }

  /* ── Issue sections ── */
  .cp-sec-title {
    font-size: 0.82rem;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.82);
    margin-bottom: 0.55rem;
  }
  .cp-sec-title.cp-muted { color: var(--fg-4, #60608a); }
  .cp-list {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
    padding: 0;
    margin: 0;
  }
  .cp-item {
    border: 1px solid rgba(255, 255, 255, 0.10);
    background: rgba(255, 255, 255, 0.04);
    border-radius: 11px;
    padding: 0.75rem 0.85rem;
  }
  .cp-item-top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.6rem;
  }
  .cp-body {
    font-size: 0.88rem;
    color: rgba(255, 255, 255, 0.92);
    line-height: 1.5;
    margin: 0;
  }
  .cp-confirmed {
    flex-shrink: 0;
    font-size: 0.68rem;
    color: #a7f3d0;
    background: rgba(16, 185, 129, 0.16);
    border-radius: 100px;
    padding: 0.1rem 0.5rem;
    white-space: nowrap;
  }
  .cp-bar {
    display: block;
    height: 6px;
    border-radius: 100px;
    background: rgba(255, 255, 255, 0.10);
    overflow: hidden;
    margin-top: 0.6rem;
  }
  .cp-bar i {
    display: block;
    height: 100%;
    border-radius: 100px;
    background: var(--accent, #7c3aed);
    transition: width 0.5s ease;
  }
  .cp-item-actions {
    display: flex;
    gap: 0.9rem;
    margin-top: 0.6rem;
  }
  .cp-link {
    font-size: 0.78rem;
    color: var(--fg-3, #7070a0);
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
    transition: color 0.2s;
    text-decoration: none;
  }
  .cp-link:hover { color: #fff; }
  .cp-link:disabled { opacity: 0.5; cursor: default; }
  .cp-link-ok { color: #6ee7b7; }
  .cp-link-ok:hover { color: #a7f3d0; }

  /* ── Edit form ── */
  .cp-edit-in { margin-top: 0.6rem; }
  .cp-ta {
    width: 100%;
    border: 1px solid rgba(255, 255, 255, 0.16);
    background: rgba(255, 255, 255, 0.05);
    border-radius: 10px;
    padding: 0.6rem 0.7rem;
    font-family: var(--font-sans, 'Sora', sans-serif);
    font-size: 0.86rem;
    color: #fff;
    resize: vertical;
    box-sizing: border-box;
  }
  .cp-ta:focus {
    outline: none;
    border-color: rgba(167, 139, 250, 0.6);
  }
  .cp-range {
    display: block;
    font-size: 0.76rem;
    color: var(--fg-2, #9090b8);
    margin-top: 0.6rem;
    line-height: 1.4;
  }
  .cp-range input {
    width: 100%;
    margin-top: 0.35rem;
    accent-color: var(--accent, #7c3aed);
    display: block;
  }
  .cp-edit-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
    margin-top: 0.7rem;
  }

  /* ── Gaps section ── */
  .cp-gaps {
    border: 1px solid rgba(251, 191, 36, 0.30);
    background: rgba(245, 158, 11, 0.06);
    border-radius: 13px;
    padding: 0.9rem 1rem;
  }
  .cp-gaps-title {
    font-size: 0.86rem;
    font-weight: 600;
    color: #fde68a;
    margin: 0 0 0.2rem;
  }
  .cp-gaps-sub {
    font-size: 0.78rem;
    color: rgba(253, 230, 138, 0.7);
    margin-top: 0.2rem;
    margin-bottom: 0.8rem;
  }
  .cp-gaps-list {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 0.7rem;
    padding: 0;
    margin: 0;
  }
  .cp-gap-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.8rem;
  }
  .cp-gap-name {
    font-size: 0.88rem;
    color: rgba(255, 255, 255, 0.9);
  }
  .cp-gap-actions {
    display: flex;
    gap: 0.5rem;
    flex-shrink: 0;
  }

  /* ── Empty state ── */
  .cp-muted {
    color: var(--fg-4, #60608a);
    font-size: 0.9rem;
  }

  /* ── Small buttons ── */
  .btn-ghost-sm {
    font-family: var(--font-sans, 'Sora', sans-serif);
    font-size: 0.78rem;
    color: var(--fg-2, #9090b8);
    background: none;
    border: 1px solid rgba(255, 255, 255, 0.18);
    border-radius: 9px;
    padding: 0.4rem 0.8rem;
    cursor: pointer;
    transition: color 0.2s, border-color 0.2s;
    white-space: nowrap;
  }
  .btn-ghost-sm:hover { color: #fff; border-color: rgba(255, 255, 255, 0.35); }

  .btn-violet-sm {
    font-family: var(--font-sans, 'Sora', sans-serif);
    font-size: 0.78rem;
    font-weight: 600;
    color: #fff;
    background: var(--accent, #7c3aed);
    border: none;
    border-radius: 9px;
    padding: 0.42rem 0.9rem;
    cursor: pointer;
    transition: filter 0.2s;
    white-space: nowrap;
  }
  .btn-violet-sm:hover { filter: brightness(1.12); }
  .btn-violet-sm:disabled { opacity: 0.4; cursor: default; }

  .btn-amber-sm {
    font-family: var(--font-sans, 'Sora', sans-serif);
    font-size: 0.78rem;
    font-weight: 600;
    color: #fde68a;
    background: rgba(245, 158, 11, 0.10);
    border: 1px solid rgba(251, 191, 36, 0.42);
    border-radius: 9px;
    padding: 0.42rem 0.9rem;
    cursor: pointer;
    transition: background 0.2s;
    white-space: nowrap;
  }
  .btn-amber-sm:hover { background: rgba(245, 158, 11, 0.22); }
  .btn-amber-sm:disabled { opacity: 0.5; cursor: default; }

  @media (prefers-reduced-motion: reduce) {
    .modal { animation: none; }
    .modal-scrim { animation: none; }
    .cp-bar i { transition: none; }
  }
</style>
