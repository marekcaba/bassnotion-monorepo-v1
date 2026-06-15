/**
 * drillCompletionToSignal — behavior tests (Bass Gym Training Engine, Phase 1).
 *
 * The pure mapper that translates the drill executor's DrillCompletionData into
 * the engine's source-abstracted ProgressSignal. Stays pure (no clock).
 */

import { describe, it, expect } from 'vitest';

import { drillCompletionToSignal } from '../../types/training';
import type { DrillCompletionData } from '../../types/block';

const AT = 1_700_000_000_000;

describe('drillCompletionToSignal', () => {
  it("maps 'conquered' to a button signal with value 1", () => {
    const data: DrillCompletionData = {
      result: 'conquered',
      achievedTier: 'gold',
    };
    expect(drillCompletionToSignal(data, AT)).toEqual({
      kind: 'button',
      value: 1,
      at: AT,
    });
  });

  it("maps 'released' to a button signal with value 0", () => {
    const data: DrillCompletionData = { result: 'released' };
    expect(drillCompletionToSignal(data, AT)).toEqual({
      kind: 'button',
      value: 0,
      at: AT,
    });
  });

  it("maps 'completed' to a completion signal", () => {
    const data: DrillCompletionData = {
      result: 'completed',
      criterion: 'time',
    };
    expect(drillCompletionToSignal(data, AT)).toEqual({
      kind: 'completion',
      value: 1,
      at: AT,
    });
  });

  it('returns null when there is no result (non-drill completion)', () => {
    expect(drillCompletionToSignal({}, AT)).toBeNull();
  });

  it('does not read a clock — uses the passed timestamp verbatim', () => {
    const sig = drillCompletionToSignal({ result: 'conquered' }, 42);
    expect(sig?.at).toBe(42);
  });
});
