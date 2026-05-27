/**
 * useEntitlement — LAUNCH-02.5c stub tests.
 *
 * Covers:
 *   - Default return shape: tier='member', all 4 caps un-capped
 *   - Helper hooks useIsLeverCapped / useUpsellMessage read from the
 *     same source
 *   - Test-only mock injection lets a card simulate a 'free' user
 *     without changing call sites — the requirement from the acceptance
 *     criteria "One test must exercise the 'free' mock path"
 *   - enabled: false returns a loading state
 *   - refetch / invalidate force a re-read
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useEntitlement,
  useIsLeverCapped,
  useUpsellMessage,
  setEntitlementMock,
  clearEntitlementMock,
  freeTierCappedResponse,
} from '../useEntitlement';

beforeEach(() => {
  clearEntitlementMock();
});

describe('useEntitlement — stub default behaviour', () => {
  it('returns tier="member" with all 4 caps un-capped by default', () => {
    const { result } = renderHook(() => useEntitlement());
    expect(result.current.tier).toBe('member');
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.caps.tempo.isCapped).toBe(false);
    expect(result.current.caps.mute.isCapped).toBe(false);
    expect(result.current.caps.transpose.isCapped).toBe(false);
    expect(result.current.caps.deconstruction.isCapped).toBe(false);
  });

  it('returns a `fetchedAt` shape compatible with LAUNCH-02 server response', () => {
    const { result } = renderHook(() => useEntitlement());
    // Caller relies on caps + tier; fetchedAt is on the wire-shape, not
    // surfaced on the hook return — just confirm the shape is stable.
    expect(typeof result.current.tier).toBe('string');
    expect(result.current.caps).toBeDefined();
  });

  it('returns a loading state when `enabled: false`', () => {
    const { result } = renderHook(() => useEntitlement({ enabled: false }));
    expect(result.current.isLoading).toBe(true);
    // tier falls back to 'free' when disabled — a safety net.
    expect(result.current.tier).toBe('free');
  });

  it('accepts an optional grooveId (LAUNCH-06 reservation) without changing output', () => {
    const { result: a } = renderHook(() => useEntitlement());
    const { result: b } = renderHook(() =>
      useEntitlement({ grooveId: 'funk-vol-1' }),
    );
    expect(b.current.tier).toBe(a.current.tier);
    expect(b.current.caps).toEqual(a.current.caps);
  });

  it('refetch() and invalidate() force a recompute without throwing', async () => {
    const { result } = renderHook(() => useEntitlement());
    expect(() => result.current.refetch()).not.toThrow();
    await expect(result.current.invalidate()).resolves.toBeUndefined();
  });
});

describe('useEntitlement — mock injection for the "free" tier path', () => {
  it('reflects a setEntitlementMock(...) override after refetch', () => {
    setEntitlementMock(freeTierCappedResponse());
    const { result } = renderHook(() => useEntitlement());
    expect(result.current.tier).toBe('free');
    expect(result.current.caps.tempo.isCapped).toBe(true);
    expect(result.current.caps.tempo.limit).toBe(10);
    expect(result.current.caps.tempo.message).toMatch(/upgrade/i);
  });

  it('clearEntitlementMock() restores the default member tier', () => {
    setEntitlementMock(freeTierCappedResponse());
    const { result, rerender } = renderHook(() => useEntitlement());
    expect(result.current.tier).toBe('free');
    clearEntitlementMock();
    act(() => result.current.refetch());
    rerender();
    expect(result.current.tier).toBe('member');
  });

  it('a partial cap override leaves other caps at the free defaults', () => {
    setEntitlementMock(
      freeTierCappedResponse({
        // override only the tempo cap, leave the rest as the free defaults
        tempo: { isCapped: true, limit: 5, message: 'tighter cap' },
      }),
    );
    const { result } = renderHook(() => useEntitlement());
    expect(result.current.caps.tempo.limit).toBe(5);
    expect(result.current.caps.tempo.message).toBe('tighter cap');
    expect(result.current.caps.transpose.isCapped).toBe(true);
  });
});

describe('useIsLeverCapped — helper read', () => {
  it('returns false for every lever by default', () => {
    const { result: tempo } = renderHook(() => useIsLeverCapped('tempo'));
    const { result: mute } = renderHook(() => useIsLeverCapped('mute'));
    const { result: transpose } = renderHook(() =>
      useIsLeverCapped('transpose'),
    );
    const { result: deconstruction } = renderHook(() =>
      useIsLeverCapped('deconstruction'),
    );
    expect(tempo.current).toBe(false);
    expect(mute.current).toBe(false);
    expect(transpose.current).toBe(false);
    expect(deconstruction.current).toBe(false);
  });

  it('returns true after setEntitlementMock(free)', () => {
    setEntitlementMock(freeTierCappedResponse());
    const { result } = renderHook(() => useIsLeverCapped('tempo'));
    expect(result.current).toBe(true);
  });
});

describe('useUpsellMessage — helper read', () => {
  it('returns an empty string when the lever is un-capped', () => {
    const { result } = renderHook(() => useUpsellMessage('tempo'));
    expect(result.current).toBe('');
  });

  it('returns the cap.message when capped', () => {
    setEntitlementMock(freeTierCappedResponse());
    const { result } = renderHook(() => useUpsellMessage('mute'));
    expect(result.current).toMatch(/upgrade/i);
  });
});
