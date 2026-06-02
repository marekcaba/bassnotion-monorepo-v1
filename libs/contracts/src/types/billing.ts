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
 * Four lever surfaces the Groove Card exposes. Naming intentionally
 * matches the lever vocabulary in LAUNCH-02 so the same identifiers
 * thread through analytics, copy decks, and entitlement responses.
 */
export interface LeverCaps {
  tempo: LeverCap;
  mute: LeverCap;
  transpose: LeverCap;
  deconstruction: LeverCap;
}

export interface EntitlementResponse {
  tier: EntitlementTier;
  caps: LeverCaps;
  /** ISO timestamp of when the response was computed. Useful for cache TTLs. */
  fetchedAt: string;
}
