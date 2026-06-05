/**
 * useEntitlement — the single source of truth for free-vs-member lever caps
 * on the Groove Card / drill panel.
 *
 * Tier is derived from real access:
 *   - member  (active subscription) → all levers uncapped.
 *   - everyone else (anonymous OR signed-in free account) → the UNPAID_CAPS
 *     profile (tempo ±5, transpose ±2, mute free, bar-range loop locked,
 *     deconstruction locked). Anonymous and free play identically — only
 *     persistence (the save/conquer account gate) differs, handled elsewhere.
 *
 * Discipline: NO inline `isMember` checks anywhere else in the card. This is
 * the single source. The `/billing/access` query only runs when authenticated
 * (anonymous users skip it and resolve to UNPAID_CAPS).
 *
 * Tests can still override the whole response via setEntitlementMock(...).
 * Query-key/`grooveId` is reserved for LAUNCH-06 per-pack entitlements.
 */

import { useCallback, useMemo, useState } from 'react';
import type {
  EntitlementResponse,
  EntitlementTier,
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
};

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

function responseForMember(isMember: boolean): EntitlementResponse {
  return {
    tier: isMember ? 'member' : 'free',
    caps: isMember ? ALL_LEVERS_UNCAPPED : UNPAID_CAPS,
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
    const isMember = access?.hasActiveSubscription ?? false;
    return responseForMember(isMember);
  }, [enabled, refetchCount, access?.hasActiveSubscription]);

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
    caps: response.caps,
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
    },
    fetchedAt: new Date().toISOString(),
  };
}
