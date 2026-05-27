/**
 * Waitlist Groove Card config — LAUNCH-02.5d.
 *
 * The marketing surface mounts the real Groove Card with a single,
 * hard-coded block config (no admin form, no DB read, no auth). When
 * the asset bucket gets a new "demo groove" Marek wants to feature on
 * the waitlist, update this file and ship.
 *
 * Asset paths use a stable convention:
 *   /storage/v1/object/public/audio-samples/waitlist/{key}/{stem}.ogg
 *
 * The 4-key fallback set sits at the default offset (0) since the
 * waitlist surface only ever loads the default key set. The other 4
 * slots are present for type-shape compatibility with
 * GrooveCardBlockConfig but never get fetched (useGrooveCardStemPreload
 * is told `keySetIndicesToLoad: [defaultIndex]`).
 *
 * Countdown click URL lives at a fixed bucket path; the pre-warm hook
 * fetches it once on first viewport intersection.
 */

import type { GrooveCardBlockConfig } from '@bassnotion/contracts';

const BUCKET_BASE = '/storage/v1/object/public/audio-samples';
const DEMO_KEY = 'waitlist/greasy-pocket/E';
const stemUrl = (stem: 'bass' | 'drums' | 'harmony'): string =>
  `${BUCKET_BASE}/${DEMO_KEY}/${stem}.ogg`;

// Placeholder URLs for the four non-default key slots. The waitlist
// preloader is told to only load index 2 (the default), so these URLs
// are never fetched. They satisfy GrooveCardBlockConfig's "exactly 5
// key sets" shape requirement. (The metronome click is not a stem —
// the countdown uses WAITLIST_COUNTDOWN_CLICK_URL below.)
const PLACEHOLDER = `${BUCKET_BASE}/waitlist/placeholder/silence.ogg`;
const placeholderStems = {
  bass: PLACEHOLDER,
  drums: PLACEHOLDER,
  harmony: PLACEHOLDER,
};

export const WAITLIST_DEMO_BLOCK_ID = 'waitlist-demo-groove';

export const WAITLIST_DEMO_CONFIG: GrooveCardBlockConfig = {
  title: 'Greasy Pocket',
  subtitle: 'Funk in E',
  originalBpm: 104,
  originalKey: 'E',
  lengthBars: 4,
  keys: [
    {
      label: 'C',
      semitoneOffset: -8,
      isDefault: false,
      stems: placeholderStems,
    },
    {
      label: 'C♯',
      semitoneOffset: -4,
      isDefault: false,
      stems: placeholderStems,
    },
    {
      label: 'E',
      semitoneOffset: 0,
      isDefault: true,
      stems: {
        bass: stemUrl('bass'),
        drums: stemUrl('drums'),
        harmony: stemUrl('harmony'),
      },
    },
    {
      label: 'G',
      semitoneOffset: 4,
      isDefault: false,
      stems: placeholderStems,
    },
    {
      label: 'A',
      semitoneOffset: 8,
      isDefault: false,
      stems: placeholderStems,
    },
  ],
  previewCaption:
    'Press play. Then touch a control below — hear the band bend to you.',
  stateCaptions: {
    'mute-bass': 'Bass muted. That’s your seat now.',
    'solo-drums': 'Just the drums. Feel the pocket.',
    'key-change': 'Queued for the next loop — every instrument transposes.',
    'tempo-change': 'Tempo changed. The whole band followed.',
  },
  allowBookmark: false,
};

/** Public path to the bundled countdown click sample. */
export const WAITLIST_COUNTDOWN_CLICK_URL = `${BUCKET_BASE}/waitlist/countdown-click.ogg`;
