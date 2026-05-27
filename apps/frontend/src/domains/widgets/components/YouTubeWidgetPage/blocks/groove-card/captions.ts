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
