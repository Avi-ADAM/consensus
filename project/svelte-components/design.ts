/* ============================================================================
   design.ts — presentation helpers that complement scale.ts.
   Exports the HUE palette, text tints, and hueStyle() as TypeScript-typed
   constants so Svelte components can import them directly without touching
   scale.ts itself.
   ========================================================================== */

export const HUE: Record<string, string> = {
  violet:  '#8b5cf6',
  sky:     '#0ea5e9',
  emerald: '#10b981',
  amber:   '#f59e0b',
  rose:    '#f43f5e',
  indigo:  '#6366f1',
  teal:    '#14b8a6',
  fuchsia: '#d946ef',
  lime:    '#84cc16',
};

export const HUE_TEXT: Record<string, string> = {
  violet:  '#ede9fe',
  sky:     '#e0f2fe',
  emerald: '#d1fae5',
  amber:   '#fef3c7',
  rose:    '#ffe4e6',
  indigo:  '#e0e7ff',
  teal:    '#ccfbf1',
  fuchsia: '#fae8ff',
  lime:    '#ecfccb',
};

export function hexToRgba(hex: string, a: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

export interface HueStyle {
  base:     string;
  bg:       string;
  bgStrong: string;
  border:   string;
  glow:     string;
  text:     string;
}

export function hueStyle(color: string): HueStyle {
  const base = HUE[color] ?? HUE.violet;
  return {
    base,
    bg:       hexToRgba(base, 0.15),
    bgStrong: hexToRgba(base, 0.28),
    border:   hexToRgba(base, 0.45),
    glow:     hexToRgba(base, 0.5),
    text:     HUE_TEXT[color] ?? '#ede9fe',
  };
}
