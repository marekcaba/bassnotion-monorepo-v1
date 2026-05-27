/**
 * useEntitlement — LAUNCH-02.5c stub.
 *
 * Returns a hard-coded `tier: 'member'` with all four lever caps un-capped.
 * Wired into every cap-relevant control handler on the Groove Card so
 * LAUNCH-02 can swap in the real backed-by-server implementation without
 * touching any caller.
 *
 * Discipline: NO inline `isMember` checks anywhere else in the card. NO
 * scattered tier logic. This is the single source.
 *
 * Why `'member'` not `'free'`: the card ships before LAUNCH-02 builds the
 * caps. If the stub returned `'free'`, the card's controls would silently
 * behave as if capped while nothing actually caps them — confusing for QA.
 * `'member'` keeps the card behaving the way LAUNCH-02 will make it
 * behave for paying members.
 *
 * Query-key shape supports a future `grooveId` parameter for LAUNCH-06
 * per-pack entitlements (e.g. user owns Funk Vol. 1 but not Bridge).
 */

import { useCallback, useMemo, useState } from 'react';
import type {
  EntitlementResponse,
  EntitlementTier,
  LeverCap,
  LeverCaps,
} from '@bassnotion/contracts';

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
  deconstruction: { isCapped: false, message: '' },
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

function defaultResponse(): EntitlementResponse {
  return {
    tier: 'member',
    caps: ALL_LEVERS_UNCAPPED,
    fetchedAt: new Date().toISOString(),
  };
}

export function useEntitlement(
  options: UseEntitlementOptions = {},
): UseEntitlementReturn {
  const { enabled = true } = options;

  // refetch toggle lets tests force a re-read of the mock without a full
  // remount. LAUNCH-02's real implementation will swap this for a
  // useQuery({ queryKey: ['entitlement', grooveId] }) call.
  const [refetchCount, setRefetchCount] = useState(0);

  const response = useMemo<EntitlementResponse | null>(() => {
    if (!enabled) return null;
    // Tests can override via setEntitlementMock(...).
    void refetchCount; // include in deps so refetch() forces recompute
    return ENTITLEMENT_MOCK.response ?? defaultResponse();
  }, [enabled, refetchCount]);

  const refetch = useCallback(() => {
    setRefetchCount((n) => n + 1);
  }, []);

  const invalidate = useCallback(async () => {
    setRefetchCount((n) => n + 1);
  }, []);

  if (!enabled || !response) {
    return {
      tier: 'free',
      caps: ALL_LEVERS_UNCAPPED,
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
      tempo: partial.tempo ?? cap('Upgrade to push tempo past ±10 BPM', 10),
      mute: partial.mute ?? cap('Upgrade to mute stems individually'),
      transpose: partial.transpose ?? cap('Upgrade to transpose past ±2', 2),
      deconstruction:
        partial.deconstruction ?? cap('Upgrade for stem deconstruction'),
    },
    fetchedAt: new Date().toISOString(),
  };
}
