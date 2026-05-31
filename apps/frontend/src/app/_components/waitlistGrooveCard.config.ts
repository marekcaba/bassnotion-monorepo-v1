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
 * Count-in samples reuse the in-app metronome's high (accent, beat 1)
 * and low (click, beats 2-4) pair from `metronome/`; the pre-warm hook
 * fetches both once on first viewport intersection.
 */

import type { GrooveCardBlockConfig } from '@bassnotion/contracts';

// Bucket path convention created by the admin stem-upload endpoint:
//   audio-samples/grooves/{tutorialSlug}/{keyFolder}/{stem}.ogg
// (see apps/backend/src/domains/tutorials/admin-tutorials.controller.ts).
// Stems get sanitised to lowercase + alphanumeric on upload, hence "e".
const SUPABASE_PROJECT_REF = 'iuuplfrktnzsbzibpfjm';
const BUCKET_BASE = `https://${SUPABASE_PROJECT_REF}.supabase.co/storage/v1/object/public/audio-samples`;
const DEMO_GROOVE_SLUG = 'economy-groove-1';
const DEMO_KEY_FOLDER = 'e';
const stemUrl = (stem: 'bass' | 'drums' | 'harmony'): string =>
  `${BUCKET_BASE}/grooves/${DEMO_GROOVE_SLUG}/${DEMO_KEY_FOLDER}/${stem}.ogg`;

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
} as const;

export const WAITLIST_DEMO_BLOCK_ID = 'waitlist-demo-groove';

export const WAITLIST_DEMO_CONFIG: GrooveCardBlockConfig = {
  title: 'Economy Groove 1',
  subtitle: '',
  originalBpm: 133,
  originalKey: 'E',
  lengthBars: 8,
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
  // Captions intentionally omitted: the card falls back to the baked-in
  // DEFAULT_PREVIEW_CAPTION + DEFAULT_STATE_CAPTIONS in
  // groove-card/captions.ts. That gives the marketing card the same hover
  // hints and "Playing…" copy as the in-app surface, edited in one place.
  allowBookmark: false,
};

/**
 * Public paths to the count-in samples.
 *
 * Reuses the in-app metronome's existing pair — `Click_high2_fixed.mp3`
 * for the accented downbeat (beat 1) and `Click_low2_fixed.mp3` for the
 * three following beats — so the waitlist count-in is tonally identical
 * to the metronome the user will hear inside the app. Both samples are
 * already in production and proven decoder-friendly across every browser
 * the app targets, so no waitlist-specific upload is needed.
 */
export const WAITLIST_COUNTDOWN_ACCENT_URL = `${BUCKET_BASE}/metronome/Click_high2_fixed.mp3`;
export const WAITLIST_COUNTDOWN_CLICK_URL = `${BUCKET_BASE}/metronome/Click_low2_fixed.mp3`;
