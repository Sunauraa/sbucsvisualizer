/**
 * The one state palette. Every module uses these tones with these meanings, and every primitive
 * draws the glyph too, so a state never depends on colour alone.
 */
export type Tone = 'idle' | 'active' | 'compare' | 'swap' | 'done' | 'visited' | 'target';

export interface ToneStyle {
  /** Stroke / solid colour. */
  readonly color: string;
  /** Tinted fill that keeps dark text readable. */
  readonly soft: string;
  /** Text-safe dark shade of the tone (AA on white and on `soft`). */
  readonly ink: string;
  /** Small mark drawn next to the shape. Empty for idle. */
  readonly glyph: string;
  readonly meaning: string;
}

export const TONES: Readonly<Record<Tone, ToneStyle>> = {
  idle: { color: '#64748b', soft: '#ffffff', ink: '#334155', glyph: '', meaning: 'not touched by this step' },
  active: { color: '#2563eb', soft: '#dbeafe', ink: '#1e40af', glyph: '▸', meaning: 'being processed now' },
  compare: { color: '#d97706', soft: '#fef3c7', ink: '#92400e', glyph: '?', meaning: 'being compared or inspected' },
  swap: { color: '#dc2626', soft: '#fee2e2', ink: '#991b1b', glyph: '⇄', meaning: 'changing now: swapped, written, removed or rejected' },
  done: { color: '#16a34a', soft: '#dcfce7', ink: '#166534', glyph: '✓', meaning: 'final: will not change again' },
  visited: { color: '#7c3aed', soft: '#ede9fe', ink: '#5b21b6', glyph: '•', meaning: 'seen earlier, not final' },
  target: { color: '#0891b2', soft: '#cffafe', ink: '#155e75', glyph: '◎', meaning: 'goal, source, or chosen item' },
};

export const TONE_NAMES = Object.keys(TONES) as readonly Tone[];

/** Neutral surface tokens, mirrored as CSS variables in src/app/theme.css. */
export const SURFACE = {
  ink: '#0f172a',
  muted: '#475569',
  line: '#cbd5e1',
  grid: '#e2e8f0',
  panel: '#ffffff',
  page: '#f8fafc',
} as const;

/** Chart series colours (validated for colour-vision deficiency on white). Fixed order, never cycled. */
export const SERIES = ['#2563eb', '#ea580c', '#0d9488', '#a21caf'] as const;
