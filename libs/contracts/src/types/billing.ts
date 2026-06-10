/**
 * Billing / entitlement types — LAUNCH-02.5c.
 *
 * These describe what a user is allowed to do with the per-control levers
 * on the Groove Card (and, later, anywhere the platform meters lever usage
 * for free vs paid tiers). LAUNCH-02 will populate `caps` from real data;
 * 02.5c ships a stub hook that returns `tier: 'member'` so the card's
 * control handlers can already read from a stable shape without coding
 * around an undefined dependency.
 */

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
 */
export interface LeverCaps {
  tempo: LeverCap;
  mute: LeverCap;
  transpose: LeverCap;
  loopRange: LeverCap;
  deconstruction: LeverCap;
  dynamicLoop: LeverCap;
}

export interface EntitlementResponse {
  tier: EntitlementTier;
  caps: LeverCaps;
  /** ISO timestamp of when the response was computed. Useful for cache TTLs. */
  fetchedAt: string;
}
