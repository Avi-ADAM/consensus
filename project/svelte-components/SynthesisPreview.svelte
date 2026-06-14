<script lang="ts">
  import { onMount } from 'svelte';

  // ── Types ─────────────────────────────────────────────────────────────────
  export interface SynthesisClause {
    issueId: string;
    issueTitle?: string;
    body: string;
    stanceValue: number;
  }

  export interface SynthesisDraft {
    heading: string;
    description?: string;
    rationale?: string;
    clauses: SynthesisClause[];
  }

  interface Props {
    draft: SynthesisDraft;
    saving?: boolean;
    onconfirm?: () => void;
    onclose?: () => void;
  }

  let { draft, saving = false, onconfirm, onclose }: Props = $props();

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
  <div class="modal modal-emerald" dir="rtl" role="dialog" aria-modal="true" aria-label="נוסחת אמצע מוצעת">
    <!-- Header -->
    <header class="modal-head">
      <div class="modal-head-l">
        <span class="modal-eyebrow sp-eyebrow">
          <i class="modal-dot sp-dot"></i>
          נוסחת אמצע מוצעת
        </span>
        <h2 class="modal-title">{draft.heading}</h2>
      </div>
      <button type="button" class="modal-x" onclick={onclose} aria-label="סגירה">✕</button>
    </header>

    <!-- Description -->
    {#if draft.description}
      <p class="sp-desc">{draft.description}</p>
    {/if}

    <!-- Rationale box -->
    {#if draft.rationale}
      <div class="sp-why">
        <span class="sp-why-tag">למה זה עובד לשני הצדדים</span>
        <p>{draft.rationale}</p>
      </div>
    {/if}

    <!-- Clause list -->
    <div class="modal-body">
      <p class="sp-list-title">סעיפי הנוסחה לפי היבט</p>
      {#each draft.clauses as c, i (i)}
        <div class="sp-clause">
          {#if c.issueTitle}
            <p class="sp-clause-issue">{c.issueTitle}</p>
          {/if}
          <p class="sp-clause-body">{c.body}</p>
          <span class="sp-bar"><i style="width:{c.stanceValue}%"></i></span>
        </div>
      {/each}
      {#if draft.clauses.length === 0}
        <p class="cp-muted">לא הופקו סעיפים.</p>
      {/if}
    </div>

    <!-- Footer -->
    <footer class="modal-foot">
      <button type="button" class="btn-ghost-sm" onclick={onclose}>ביטול</button>
      <button
        type="button"
        class="btn-emerald"
        disabled={draft.clauses.length === 0 || saving}
        onclick={onconfirm}
      >
        {saving ? 'מוסיף…' : 'הוספה לדיון כדעה'}
      </button>
    </footer>
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
  .modal-emerald { border-color: rgba(52, 211, 153, 0.30); }
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
  .sp-eyebrow { color: #6ee7b7; }
  .modal-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    display: inline-block;
    flex-shrink: 0;
  }
  .sp-dot { background: #4ade80; }
  @media (prefers-reduced-motion: no-preference) {
    .sp-dot { animation: pulse 2s ease-in-out infinite; }
  }
  @keyframes pulse {
    0%, 100% { transform: scale(1); opacity: 1; }
    50%       { transform: scale(1.35); opacity: 0.65; }
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

  /* ── Description + rationale ── */
  .sp-desc {
    color: rgba(255, 255, 255, 0.74);
    font-size: 0.95rem;
    margin-top: 0.7rem;
    font-weight: 300;
    line-height: 1.6;
    flex-shrink: 0;
  }
  .sp-why {
    margin-top: 0.9rem;
    border: 1px solid rgba(52, 211, 153, 0.28);
    background: rgba(16, 185, 129, 0.12);
    border-radius: 13px;
    padding: 0.85rem 1rem;
    flex-shrink: 0;
  }
  .sp-why-tag {
    display: block;
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    color: #6ee7b7;
    margin-bottom: 0.35rem;
  }
  .sp-why p {
    font-size: 0.88rem;
    color: #d1fae5;
    line-height: 1.6;
    margin: 0;
  }

  /* ── Clause list ── */
  .modal-body {
    flex: 1;
    overflow-y: auto;
    margin-top: 1.1rem;
    display: flex;
    flex-direction: column;
    gap: 0.8rem;
    padding-inline-end: 0.2rem;
    scrollbar-width: thin;
    scrollbar-color: #2a2a45 transparent;
  }
  .modal-body::-webkit-scrollbar { width: 9px; }
  .modal-body::-webkit-scrollbar-thumb { background: #2a2a45; border-radius: 100px; }
  .modal-body::-webkit-scrollbar-track { background: transparent; }

  .sp-list-title {
    font-size: 0.74rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--fg-3, #7070a0);
    margin: 0;
    flex-shrink: 0;
  }
  .sp-clause {
    border: 1px solid rgba(255, 255, 255, 0.10);
    background: rgba(255, 255, 255, 0.04);
    border-radius: 11px;
    padding: 0.75rem 0.85rem;
  }
  .sp-clause-issue {
    font-size: 0.72rem;
    font-weight: 600;
    color: var(--fg-3, #7070a0);
    margin-bottom: 0.3rem;
    margin-top: 0;
  }
  .sp-clause-body {
    font-size: 0.88rem;
    color: rgba(255, 255, 255, 0.92);
    line-height: 1.5;
    margin: 0;
  }
  .sp-bar {
    display: block;
    height: 6px;
    border-radius: 100px;
    background: rgba(255, 255, 255, 0.10);
    overflow: hidden;
    margin-top: 0.6rem;
  }
  .sp-bar i {
    display: block;
    height: 100%;
    border-radius: 100px;
    background: #34d399;
    transition: width 0.5s ease;
  }

  /* ── Empty ── */
  .cp-muted {
    color: var(--fg-4, #60608a);
    font-size: 0.9rem;
    margin: 0;
  }

  /* ── Footer ── */
  .modal-foot {
    display: flex;
    justify-content: flex-end;
    gap: 0.6rem;
    border-top: 1px solid rgba(255, 255, 255, 0.10);
    padding-top: 1.1rem;
    margin-top: 1.2rem;
    flex-shrink: 0;
  }

  /* ── Buttons ── */
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
  }
  .btn-ghost-sm:hover { color: #fff; border-color: rgba(255, 255, 255, 0.35); }

  .btn-emerald {
    font-family: var(--font-sans, 'Sora', sans-serif);
    font-size: 0.9rem;
    font-weight: 600;
    color: #fff;
    background: #10b981;
    border: none;
    border-radius: 11px;
    padding: 0.62rem 1.3rem;
    cursor: pointer;
    transition: filter 0.2s, transform 0.15s;
  }
  .btn-emerald:hover { filter: brightness(1.1); transform: translateY(-1px); }
  .btn-emerald:disabled { opacity: 0.4; cursor: default; transform: none; filter: none; }

  @media (prefers-reduced-motion: reduce) {
    .modal { animation: none; }
    .modal-scrim { animation: none; }
    .sp-dot { animation: none; }
    .sp-bar i { transition: none; }
  }
</style>
