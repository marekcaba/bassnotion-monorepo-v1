/**
 * useEntitlement tests.
 *
 * The hook now derives tier from real access (useUserAccess → /billing/access):
 *   - no auth / no subscription → tier 'free' with the UNPAID_CAPS profile
 *     (tempo ±5, transpose ±2, mute uncapped, loopRange + deconstruction gated)
 *   - active subscription → tier 'member', all levers uncapped
 *
 * In tests there's no auth, so the default resolves to 'free' (unpaid). The
 * setEntitlementMock(...) path still short-circuits to a fixed response.
 *
 * Because the hook reads a useQuery, every render needs a QueryClientProvider —
 * hence the `wrapper` below (mirrors production, where ReactQueryProvider wraps
 * the whole app).
 */

import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useEntitlement,
  useIsLeverCapped,
  useUpsellMessage,
  setEntitlementMock,
  clearEntitlementMock,
  freeTierCappedResponse,
} from '../useEntitlement';

// A fresh QueryClient per test, with retries off so the (disabled, unauth'd)
// access query never noisily retries.
function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

beforeEach(() => {
  clearEntitlementMock();
});

describe('useEntitlement — default (unauthenticated → free/unpaid)', () => {
  it('returns tier="free" with the unpaid cap profile by default', () => {
    const { result } = renderHook(() => useEntitlement(), {
      wrapper: makeWrapper(),
    });
    expect(result.current.tier).toBe('free');
    expect(result.current.error).toBeNull();
    // Band levers capped; mute never capped; loop/decon gated.
    expect(result.current.caps.tempo.isCapped).toBe(true);
    expect(result.current.caps.tempo.limit).toBe(5);
    expect(result.current.caps.transpose.isCapped).toBe(true);
    expect(result.current.caps.transpose.limit).toBe(2);
    expect(result.current.caps.mute.isCapped).toBe(false);
    expect(result.current.caps.loopRange.isCapped).toBe(true);
    expect(result.current.caps.deconstruction.isCapped).toBe(true);
  });

  it('returns a stable shape (tier + caps defined)', () => {
    const { result } = renderHook(() => useEntitlement(), {
      wrapper: makeWrapper(),
    });
    expect(typeof result.current.tier).toBe('string');
    expect(result.current.caps).toBeDefined();
  });

  it('returns a loading state when `enabled: false`', () => {
    const { result } = renderHook(() => useEntitlement({ enabled: false }), {
      wrapper: makeWrapper(),
    });
    expect(result.current.isLoading).toBe(true);
    expect(result.current.tier).toBe('free');
  });

  it('accepts an optional grooveId (LAUNCH-06 reservation) without changing output', () => {
    const { result: a } = renderHook(() => useEntitlement(), {
      wrapper: makeWrapper(),
    });
    const { result: b } = renderHook(
      () => useEntitlement({ grooveId: 'funk-vol-1' }),
      { wrapper: makeWrapper() },
    );
    expect(b.current.tier).toBe(a.current.tier);
    expect(b.current.caps).toEqual(a.current.caps);
  });

  it('refetch() and invalidate() force a recompute without throwing', async () => {
    const { result } = renderHook(() => useEntitlement(), {
      wrapper: makeWrapper(),
    });
    expect(() => result.current.refetch()).not.toThrow();
    await expect(result.current.invalidate()).resolves.toBeUndefined();
  });
});

describe('useEntitlement — mock injection', () => {
  it('reflects a setEntitlementMock(...) override', () => {
    setEntitlementMock(freeTierCappedResponse());
    const { result } = renderHook(() => useEntitlement(), {
      wrapper: makeWrapper(),
    });
    expect(result.current.tier).toBe('free');
    expect(result.current.caps.tempo.isCapped).toBe(true);
    expect(result.current.caps.tempo.limit).toBe(5);
    expect(result.current.caps.tempo.message).toMatch(/members/i);
  });

  it('clearEntitlementMock() restores the default (free, unauthenticated)', () => {
    setEntitlementMock(freeTierCappedResponse());
    const { result, rerender } = renderHook(() => useEntitlement(), {
      wrapper: makeWrapper(),
    });
    expect(result.current.tier).toBe('free');
    clearEntitlementMock();
    act(() => result.current.refetch());
    rerender();
    expect(result.current.tier).toBe('free');
  });

  it('a partial cap override leaves other caps at the free defaults', () => {
    setEntitlementMock(
      freeTierCappedResponse({
        tempo: { isCapped: true, limit: 3, message: 'tighter cap' },
      }),
    );
    const { result } = renderHook(() => useEntitlement(), {
      wrapper: makeWrapper(),
    });
    expect(result.current.caps.tempo.limit).toBe(3);
    expect(result.current.caps.tempo.message).toBe('tighter cap');
    expect(result.current.caps.transpose.isCapped).toBe(true);
  });
});

describe('useIsLeverCapped — helper read', () => {
  it('reflects the unpaid profile by default (band levers capped, mute not)', () => {
    const { result: tempo } = renderHook(() => useIsLeverCapped('tempo'), {
      wrapper: makeWrapper(),
    });
    const { result: mute } = renderHook(() => useIsLeverCapped('mute'), {
      wrapper: makeWrapper(),
    });
    expect(tempo.current).toBe(true);
    expect(mute.current).toBe(false);
  });

  it('returns true for a capped lever after setEntitlementMock(free)', () => {
    setEntitlementMock(freeTierCappedResponse());
    const { result } = renderHook(() => useIsLeverCapped('tempo'), {
      wrapper: makeWrapper(),
    });
    expect(result.current).toBe(true);
  });
});

describe('useUpsellMessage — helper read', () => {
  it('returns an empty string for an un-capped lever (mute)', () => {
    const { result } = renderHook(() => useUpsellMessage('mute'), {
      wrapper: makeWrapper(),
    });
    expect(result.current).toBe('');
  });

  it('returns the cap.message for a capped lever', () => {
    setEntitlementMock(freeTierCappedResponse());
    const { result } = renderHook(() => useUpsellMessage('tempo'), {
      wrapper: makeWrapper(),
    });
    expect(result.current).toMatch(/members/i);
  });
});
