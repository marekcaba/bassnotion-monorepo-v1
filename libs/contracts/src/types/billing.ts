/**
 * Billing / entitlement types — LAUNCH-02.5c, extended by LAUNCH-06
 * (product-aware feature entitlement).
 *
 * These describe what a user is allowed to do with the per-control levers
 * on the Groove Card (and, later, anywhere the platform meters lever usage
 * for free vs paid tiers). Caps are DERIVED from `grantedFeatures` — the set
 * of features the user's owned products / membership tier grant (see
 * `features.ts`).
 */

import type { FeatureKey } from './features.js';

export type EntitlementTier = 'free' | 'member';

/** Per-lever cap. `isCapped === false` means the lever is uncapped. */
export interface LeverCap {
  isCapped: boolean;
  /** When capped, the inclusive ceiling the user is allowed to reach. */
  limit?: number;
  /** UX-facing message shown when the cap is hit. */
  message: string;
}

/**
 * Lever surfaces the Groove Card exposes. Naming intentionally matches the
 * lever vocabulary in LAUNCH-02 so the same identifiers thread through
 * analytics, copy decks, and entitlement responses.
 *
 * - tempo / transpose: band levers — when capped, `limit` is the ± range the
 *   user may move AROUND the groove's default (e.g. ±5 BPM, ±2 semitones).
 * - mute: never capped in the current model (the headline AHA — take the seat).
 * - loopRange: bar-range looping (drag-select). Capped = whole-groove loop only;
 *   uncapped = loop any bar range. Whole-groove loop is always free.
 * - deconstruction: stem/element isolation drilling (Pack-gated).
 * - dynamicLoop: the auto key-cycle dial (engage to cycle keys every N loops).
 *   Members-only — capped = the dial is visible but engaging it surfaces the
 *   upgrade pitch instead of running the cycle; uncapped = full use.
 * - linesAndFills: the premium alternate-bassline swap (Lines & Fills section).
 *   Product-granted (e.g. Bass College) — capped = the section is shown locked
 *   and engaging surfaces the upgrade pitch; uncapped = click-to-swap basslines.
 *
 * NOTE on the key sets: every LeverCaps key EXCEPT `mute` maps 1:1 to a
 * `FeatureKey` of the same name. `mute` has NO feature key — it is never capped
 * for anyone (by design), so the cap-derivation must treat it as always-uncapped
 * rather than looking it up in the granted-feature set.
 */
export interface LeverCaps {
  tempo: LeverCap;
  mute: LeverCap;
  transpose: LeverCap;
  loopRange: LeverCap;
  deconstruction: LeverCap;
  dynamicLoop: LeverCap;
  linesAndFills: LeverCap;
}

export interface EntitlementResponse {
  tier: EntitlementTier;
  caps: LeverCaps;
  /**
   * The set of features the user's owned products / membership tier grant.
   * Caps are derived from this set. OPTIONAL for back-compat: a response without
   * it (older fixtures, stubs) falls back to tier-based derivation. Anonymous
   * users resolve to `[]` (every gateable lever capped).
   */
  grantedFeatures?: FeatureKey[];
  /** ISO timestamp of when the response was computed. Useful for cache TTLs. */
  fetchedAt: string;
}
