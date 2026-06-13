/**
 * Feature registry — the canonical, stable set of GATEABLE features on the
 * platform. This is the vocabulary the product-aware entitlement model is keyed
 * on: a product (or the membership tier) grants a SET of these features, and the
 * frontend derives per-lever caps from whether each feature is in the user's
 * granted set.
 *
 * Relationship to `LeverCaps` (billing.ts):
 *   - The 5 "lever" features below map 1:1 to LeverCaps keys of the same name.
 *   - `mute` is a LeverCaps key but is NOT a feature key — it is NEVER capped for
 *     anyone (the headline "take the seat" AHA), so it has no grant to resolve.
 *   - `linesAndFills` is a feature key AND a (new) LeverCaps key — the premium
 *     alternate-bassline swap feature.
 *
 * So: `FEATURE_KEYS` ⊂ `keyof LeverCaps` ∪ {linesAndFills}, minus `mute`.
 * Do not iterate FEATURE_KEYS expecting to cover every LeverCaps key — mute is
 * intentionally absent and must be treated as always-uncapped.
 */

export const FEATURE_KEYS = [
  'tempo',
  'transpose',
  'loopRange',
  'deconstruction',
  'dynamicLoop',
  'linesAndFills',
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];

/** Type guard — narrows an arbitrary string to a known FeatureKey. */
export function isFeatureKey(value: string): value is FeatureKey {
  return (FEATURE_KEYS as readonly string[]).includes(value);
}
