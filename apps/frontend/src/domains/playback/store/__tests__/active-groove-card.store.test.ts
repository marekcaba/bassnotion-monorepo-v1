/**
 * Active Groove Card store — LAUNCH-02.5c tests.
 *
 * Verifies the coordination contract that prevents two Groove Cards on
 * one tutorial page from both driving the shared transport:
 *   - setActiveCard / clearActiveCard semantics
 *   - clearActiveCard is a no-op for a non-active card (guards stale
 *     unmounts)
 *   - isActiveCard returns the expected boolean
 *   - The store starts with activeCardId === null
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useActiveGrooveCardStore } from '../active-groove-card.store';

beforeEach(() => {
  // Reset between tests so the module-level Zustand store doesn't leak.
  useActiveGrooveCardStore.setState({ activeCardId: null });
});

describe('useActiveGrooveCardStore — LAUNCH-02.5c', () => {
  it('starts with activeCardId === null', () => {
    expect(useActiveGrooveCardStore.getState().activeCardId).toBeNull();
  });

  it('setActiveCard(cardId) makes that card active', () => {
    useActiveGrooveCardStore.getState().setActiveCard('card-a');
    expect(useActiveGrooveCardStore.getState().activeCardId).toBe('card-a');
  });

  it('setActiveCard(newCardId) replaces the previous active card', () => {
    useActiveGrooveCardStore.getState().setActiveCard('card-a');
    useActiveGrooveCardStore.getState().setActiveCard('card-b');
    expect(useActiveGrooveCardStore.getState().activeCardId).toBe('card-b');
  });

  it('clearActiveCard(currentActiveId) clears the active card', () => {
    useActiveGrooveCardStore.getState().setActiveCard('card-a');
    useActiveGrooveCardStore.getState().clearActiveCard('card-a');
    expect(useActiveGrooveCardStore.getState().activeCardId).toBeNull();
  });

  it('clearActiveCard(staleCardId) is a no-op when a different card is active', () => {
    // Scenario: card-a was active, then card-b became active, then card-a
    // unmounts late and tries to clear. The clear must be guarded.
    useActiveGrooveCardStore.getState().setActiveCard('card-a');
    useActiveGrooveCardStore.getState().setActiveCard('card-b');
    useActiveGrooveCardStore.getState().clearActiveCard('card-a');
    expect(useActiveGrooveCardStore.getState().activeCardId).toBe('card-b');
  });

  it('clearActiveCard(anyId) when nothing is active is a no-op', () => {
    useActiveGrooveCardStore.getState().clearActiveCard('card-a');
    expect(useActiveGrooveCardStore.getState().activeCardId).toBeNull();
  });

  it('isActiveCard returns true only for the current active card', () => {
    useActiveGrooveCardStore.getState().setActiveCard('card-a');
    const state = useActiveGrooveCardStore.getState();
    expect(state.isActiveCard('card-a')).toBe(true);
    expect(state.isActiveCard('card-b')).toBe(false);
    expect(state.isActiveCard('')).toBe(false);
  });

  it('setActiveCard with the same id twice is idempotent', () => {
    useActiveGrooveCardStore.getState().setActiveCard('card-a');
    useActiveGrooveCardStore.getState().setActiveCard('card-a');
    expect(useActiveGrooveCardStore.getState().activeCardId).toBe('card-a');
  });
});
