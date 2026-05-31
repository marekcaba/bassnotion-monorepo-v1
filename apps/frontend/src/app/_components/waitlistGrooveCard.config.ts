/**
 * Waitlist Groove Card config — LAUNCH-02.5d, updated for 02.5e
 * (single-key-set + PitchShift).
 *
 * The marketing surface mounts the real Groove Card with a single,
 * hard-coded block config (no admin form, no DB read, no auth). When
 * the asset bucket gets a new "demo groove" Marek wants to feature on
 * the waitlist, update this file and ship.
 *
 * Asset paths use the same bucket convention the admin stem-upload
 * endpoint creates:
 *   /storage/v1/object/public/audio-samples/grooves/{slug}/{key}/{stem}.ogg
 *
 * The waitlist delivers ONE stem set at originalKey; the runtime
 * pitch-shifts ±6 semitones via the pitch-shift engine on bass + harmony.
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

export const WAITLIST_DEMO_BLOCK_ID = 'waitlist-demo-groove';

export const WAITLIST_DEMO_CONFIG: GrooveCardBlockConfig = {
  title: 'Economy Groove 1',
  subtitle: '',
  originalBpm: 133,
  originalKey: 'E',
  lengthBars: 8,
  stems: {
    bass: stemUrl('bass'),
    drums: stemUrl('drums'),
    harmony: stemUrl('harmony'),
  },
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
