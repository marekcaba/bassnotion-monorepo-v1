/**
 * useEntitlement — the single source of truth for the Groove Card / drill-panel
 * lever caps.
 *
 * Caps are DERIVED from the user's GRANTED FEATURE SET (`grantedFeatures` on the
 * /billing/access response), not from a free/member binary:
 *   - For each gateable lever, if its feature key is in the granted set the lever
 *     is UNCAPPED (its ALL_LEVERS_UNCAPPED value); otherwise it gets the
 *     UNPAID_CAPS value (with its load-bearing numeric limit + upsell copy).
 *   - `mute` has NO feature key — it is NEVER capped for anyone (the headline
 *     AHA), so it is hardcoded uncapped outside the feature mapping.
 *   - Anonymous visitors never query /billing/access (auth-gated) → granted set
 *     is [] → every gateable lever capped (the UNPAID profile). Same playing
 *     power as a signed-in free account; only persistence differs (elsewhere).
 *
 * Back-compat: a response WITHOUT `grantedFeatures` (older fixtures, the test
 * mock) falls back to tier-based derivation (member → all uncapped, else
 * UNPAID). New responses always carry the set.
 *
 * Discipline: NO inline `isMember` / feature checks anywhere else in the card.
 * This is the single source.
 */

import { useCallback, useMemo, useState } from 'react';
import type {
  EntitlementResponse,
  EntitlementTier,
  FeatureKey,
  LeverCap,
  LeverCaps,
} from '@bassnotion/contracts';

import { useAuth } from '@/domains/user/hooks/use-auth';

import { useUserAccess } from './useBilling';

export interface UseEntitlementOptions {
  /** Optional groove-id scope. Reserved for LAUNCH-06; ignored today. */
  grooveId?: string;
  /** When false, the hook returns a loading state and does not compute caps.
   *  Defaults to true. */
  enabled?: boolean;
}

export interface UseEntitlementReturn {
  tier: EntitlementTier;
  caps: LeverCaps;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
  /** Marker for the future TanStack-Query-backed implementation. */
  invalidate: () => Promise<void>;
}

/** Lever names the Groove Card meters. */
export type LeverName = keyof LeverCaps;

const ALL_LEVERS_UNCAPPED: LeverCaps = {
  tempo: { isCapped: false, message: '' },
  mute: { isCapped: false, message: '' },
  transpose: { isCapped: false, message: '' },
  loopRange: { isCapped: false, message: '' },
  deconstruction: { isCapped: false, message: '' },
  dynamicLoop: { isCapped: false, message: '' },
  linesAndFills: { isCapped: false, message: '' },
};

/**
 * The "unpaid" cap profile — shared by anonymous visitors AND signed-in free
 * accounts (they play identically; only persistence differs). The wall each
 * cap teaches IS the membership pitch.
 *
 * - tempo: movable ±5 BPM around the groove's default.
 * - transpose: movable ±2 semitones.
 * - mute: NEVER capped — muting the bass ("take the seat") is the headline AHA.
 * - loopRange: whole-groove loop is free; selecting a bar range is members-only.
 * - deconstruction: stem/element drilling is Pack-gated.
 * - dynamicLoop: the auto key-cycle dial is members-only.
 * - linesAndFills: the premium alternate-bassline swap is product-granted.
 */
const UNPAID_CAPS: LeverCaps = {
  tempo: {
    isCapped: true,
    limit: 5,
    message: 'Members get the full 40–200 tempo dial',
  },
  mute: { isCapped: false, message: '' },
  transpose: {
    isCapped: true,
    limit: 2,
    message: 'Members play all 12 keys',
  },
  loopRange: {
    isCapped: true,
    message: 'Members loop any bar infinitely',
  },
  deconstruction: {
    isCapped: true,
    message: 'Drill the layers with a Groove Pack',
  },
  dynamicLoop: {
    isCapped: true,
    message: 'Members auto-cycle keys with the Dynamic Loop',
  },
  linesAndFills: {
    isCapped: true,
    message: 'Swap basslines with Bass College',
  },
};

/**
 * Maps each GATEABLE lever to the FeatureKey that unlocks it. `mute` is absent
 * by design — it is never capped, so it is not feature-gated. The cap derivation
 * iterates THIS map (so a missing/unmapped lever like mute defaults to uncapped,
 * never accidentally capped).
 */
const LEVER_FEATURE: Record<Exclude<LeverName, 'mute'>, FeatureKey> = {
  tempo: 'tempo',
  transpose: 'transpose',
  loopRange: 'loopRange',
  deconstruction: 'deconstruction',
  dynamicLoop: 'dynamicLoop',
  linesAndFills: 'linesAndFills',
};

/**
 * Build the LeverCaps from a granted-feature set. For each gateable lever, the
 * grant selects WHICH value table (uncapped vs unpaid); the cap VALUES (isCapped,
 * limit, message) come from the constants — never synthesized — so the
 * load-bearing numeric limits (tempo ±5, transpose ±2) and upsell copy survive.
 * `mute` is always uncapped (no feature key).
 */
function capsFromFeatures(granted: ReadonlySet<FeatureKey>): LeverCaps {
  const caps = { mute: { isCapped: false, message: '' } } as LeverCaps;
  for (const lever of Object.keys(LEVER_FEATURE) as Array<
    keyof typeof LEVER_FEATURE
  >) {
    caps[lever] = granted.has(LEVER_FEATURE[lever])
      ? ALL_LEVERS_UNCAPPED[lever]
      : UNPAID_CAPS[lever];
  }
  return caps;
}

/**
 * Internal mock-injection point used ONLY by tests. The default never
 * changes shape between renders; tests can swap the response by
 * monkey-patching `useEntitlement._mock` before mounting the hook.
 *
 * @internal
 */
const ENTITLEMENT_MOCK: { response: EntitlementResponse | null } = {
  response: null,
};

/**
 * Resolve caps from a response. Prefer the granted-feature set (the real model);
 * fall back to tier-based derivation when a response carries no `grantedFeatures`
 * (older fixtures / the test mock that injects raw caps).
 */
function capsFromResponse(response: EntitlementResponse): LeverCaps {
  if (response.grantedFeatures) {
    return capsFromFeatures(new Set(response.grantedFeatures));
  }
  // Legacy fallback: a response without the set carries caps directly (mock) or
  // is tier-derived.
  return response.caps;
}

function responseFromAccess(
  grantedFeatures: FeatureKey[],
  hasActiveSubscription: boolean,
): EntitlementResponse {
  return {
    // `tier` is retained for copy/analytics only — caps derive from features.
    tier: hasActiveSubscription ? 'member' : 'free',
    caps: capsFromFeatures(new Set(grantedFeatures)),
    grantedFeatures,
    fetchedAt: new Date().toISOString(),
  };
}

export function useEntitlement(
  options: UseEntitlementOptions = {},
): UseEntitlementReturn {
  const { enabled = true } = options;

  const { isAuthenticated, isReady } = useAuth();

  // The /billing/access endpoint requires auth — only query it once we know
  // the visitor is signed in. Anonymous visitors skip it and resolve to the
  // unpaid profile (same playing power as a free account).
  const { data: access, isLoading: accessLoading } = useUserAccess(
    enabled && isReady && isAuthenticated,
  );

  // refetch toggle lets tests force a re-read of the mock without a full
  // remount.
  const [refetchCount, setRefetchCount] = useState(0);

  const response = useMemo<EntitlementResponse | null>(() => {
    if (!enabled) return null;
    void refetchCount; // include in deps so refetch() forces recompute
    // Tests can override the whole response via setEntitlementMock(...).
    if (ENTITLEMENT_MOCK.response) return ENTITLEMENT_MOCK.response;
    // Anonymous visitors never query /billing/access → access is undefined →
    // granted set is [] → every gateable lever capped (UNPAID profile), with NO
    // network call. Authed free users likewise resolve to [].
    const grantedFeatures = access?.grantedFeatures ?? [];
    const hasActiveSubscription = access?.hasActiveSubscription ?? false;
    return responseFromAccess(grantedFeatures, hasActiveSubscription);
  }, [
    enabled,
    refetchCount,
    access?.grantedFeatures,
    access?.hasActiveSubscription,
  ]);

  const refetch = useCallback(() => {
    setRefetchCount((n) => n + 1);
  }, []);

  const invalidate = useCallback(async () => {
    setRefetchCount((n) => n + 1);
  }, []);

  // Loading only while we genuinely don't know the tier yet: enabled, auth
  // resolved to "signed in", and the access query still in flight. Anonymous
  // users are never "loading" — they're definitively unpaid.
  const isResolving =
    enabled &&
    isReady &&
    isAuthenticated &&
    accessLoading &&
    !ENTITLEMENT_MOCK.response;

  if (!enabled || !response || isResolving) {
    // Default to the SAFE (capped) profile while resolving — never flash
    // member-level access to a user we haven't confirmed is a member.
    return {
      tier: 'free',
      caps: UNPAID_CAPS,
      isLoading: true,
      error: null,
      refetch,
      invalidate,
    };
  }

  return {
    tier: response.tier,
    caps: capsFromResponse(response),
    isLoading: false,
    error: null,
    refetch,
    invalidate,
  };
}

/**
 * Read a single lever's cap. Saves callers from `useEntitlement().caps.tempo`.
 */
export function useIsLeverCapped(lever: LeverName): boolean {
  const { caps } = useEntitlement();
  return caps[lever].isCapped;
}

/**
 * Read the upsell copy a capped lever should surface. Empty string when
 * the lever is not capped (callers can `if (msg)` to decide whether to
 * render the upsell affordance).
 */
export function useUpsellMessage(lever: LeverName): string {
  const { caps } = useEntitlement();
  return caps[lever].message;
}

// ---------------------------------------------------------------------------
// Test-only helpers (exposed so unit tests can drive cap-aware behaviour).
// LAUNCH-02 will delete these when the hook becomes server-backed.
// ---------------------------------------------------------------------------

/** @internal — test use only. */
export function setEntitlementMock(response: EntitlementResponse | null): void {
  ENTITLEMENT_MOCK.response = response;
}

/** @internal — test use only. */
export function clearEntitlementMock(): void {
  ENTITLEMENT_MOCK.response = null;
}

/** Factory the tests use to fabricate a free-tier capped response. */
export function freeTierCappedResponse(
  partial: Partial<LeverCaps> = {},
): EntitlementResponse {
  const cap = (message: string, limit?: number): LeverCap => ({
    isCapped: true,
    limit,
    message,
  });
  return {
    tier: 'free',
    caps: {
      tempo: partial.tempo ?? cap('Members get the full 40–200 tempo dial', 5),
      // Mute is never capped in the current model; tests can still override.
      mute: partial.mute ?? { isCapped: false, message: '' },
      transpose: partial.transpose ?? cap('Members play all 12 keys', 2),
      loopRange: partial.loopRange ?? cap('Members loop any bar infinitely'),
      deconstruction:
        partial.deconstruction ?? cap('Drill the layers with a Groove Pack'),
      dynamicLoop:
        partial.dynamicLoop ??
        cap('Members auto-cycle keys with the Dynamic Loop'),
      linesAndFills:
        partial.linesAndFills ?? cap('Swap basslines with Bass College'),
    },
    fetchedAt: new Date().toISOString(),
  };
}
