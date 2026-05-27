/**
 * Active Groove Card store — LAUNCH-02.5c.
 *
 * `useTransport()` is a context, not a singleton. Inside `/app`, only one
 * `<TransportProvider>` mounts per tutorial page, which means two Groove
 * Cards on the same page share one `PlaybackEngine` and one
 * `Tone.Transport`. Coordination needs BOTH:
 *
 *   1. A "which card is active" flag (this store) so only one card's
 *      controls drive the shared transport at a time.
 *   2. Per-card track cleanup via `playbackEngine.unregisterTracksByPrefix`
 *      (shipped by 02.5b) so the previous card's audio-* tracks don't
 *      keep firing when a new card starts. The flag alone is not enough.
 *
 * `clearActiveCard(cardId)` only clears if `cardId === activeCardId` so a
 * stale unmount from a previously-active-but-already-replaced card can't
 * wipe the current active.
 *
 * No persistence — purely runtime coordination.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export interface ActiveGrooveCardState {
  /** ID of the card currently driving playback, or null when no card is
   * active. Card IDs are the block IDs from `TutorialBlock.id`. */
  activeCardId: string | null;
  /** Mark `cardId` as the active card. Idempotent. */
  setActiveCard: (cardId: string) => void;
  /** Clear the active card — but ONLY if `cardId === activeCardId`. This
   * makes the call safe to fire from an unmount effect without racing
   * with a subsequent card's setActiveCard. */
  clearActiveCard: (cardId: string) => void;
  /** True when the given cardId is the active card. Pure derivation,
   * exposed so consumers can subscribe with shallow equality. */
  isActiveCard: (cardId: string) => boolean;
}

export const useActiveGrooveCardStore = create<ActiveGrooveCardState>()(
  devtools(
    (set, get) => ({
      activeCardId: null,
      setActiveCard: (cardId) => {
        if (get().activeCardId === cardId) return;
        set({ activeCardId: cardId }, false, 'setActiveCard');
      },
      clearActiveCard: (cardId) => {
        if (get().activeCardId !== cardId) return;
        set({ activeCardId: null }, false, 'clearActiveCard');
      },
      isActiveCard: (cardId) => get().activeCardId === cardId,
    }),
    { name: 'active-groove-card-store' },
  ),
);
