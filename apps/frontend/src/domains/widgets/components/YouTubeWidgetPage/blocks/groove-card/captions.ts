/**
 * Baked-in caption copy for the Groove Card.
 *
 * Captions are card-wide UX behaviour — the same five strings on every
 * groove. Keeping them here (not in the per-block admin config) means
 *   - Marek edits copy in one place instead of every tutorial
 *   - the admin form is shorter and less intimidating
 *   - the BlockConfig stays the contract-only `stateCaptions` field
 *     for any future per-card overrides (e.g. a specific groove with
 *     bespoke voice)
 *
 * The block config's own `stateCaptions` / `previewCaption` still wins
 * when an admin chooses to override; this file is the FALLBACK only.
 */

import type { GrooveCardStateCaptions } from '@bassnotion/contracts';

export const DEFAULT_PREVIEW_CAPTION =
  'Press play. Then touch a control below — hear the band bend to you.';

export const DEFAULT_STATE_CAPTIONS: Required<GrooveCardStateCaptions> = {
  'mute-bass': "Bass muted. That's your seat now. Play the line.",
  'solo-drums': 'Just the drums. Feel the pocket.',
  'key-change': 'Queued for the next loop — every instrument transposes.',
  'tempo-change': 'Tempo changed. The whole band followed.',
};

// ─────────────────────────────────────────────────────────────────────────────
// Hover hints
// One-line "what does this button do" copy shown in the caption row while
// the user hovers an interactive control. Pure UX affordance — touch users
// don't see them (they tap → reactive state caption kicks in). When the
// user moves the cursor off a control, the reactive caption resumes.
// ─────────────────────────────────────────────────────────────────────────────

export type HoverHintKey =
  | 'mute-bass'
  | 'solo-drums'
  | 'play-pause-play'
  | 'play-pause-pause'
  | 'key'
  | 'tempo'
  | 'metronome';

export const HOVER_HINTS: Record<HoverHintKey, string> = {
  'mute-bass': 'Drop the bass — practice the line with the rest of the band.',
  'solo-drums': 'Isolate the drums to lock in with the pocket.',
  'play-pause-play': 'Start the groove. A 1-2-3-4 count-in plays first.',
  'play-pause-pause': 'Pause and reset to the top of the groove.',
  key: 'Transpose the whole band. The change lands at the next bar.',
  tempo: 'Speed up or slow down. Practice slow, perform fast.',
  metronome: 'Toggle the click track on or off.',
};
