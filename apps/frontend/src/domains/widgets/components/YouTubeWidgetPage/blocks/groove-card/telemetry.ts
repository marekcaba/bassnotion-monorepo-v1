/**
 * Groove Card telemetry — LAUNCH-02.5d.
 *
 * The project's convention is Sentry breadcrumbs via the shared
 * `trackEvent(message, category, data?)` helper. This file gives the
 * Groove Card a single source of truth for the events it fires, named
 * once and called from anywhere in the card family.
 *
 * The only event introduced by 02.5d's acceptance criteria is
 * `groove_card_waitlist_cap_hit` — fired when a waitlist visitor taps
 * the key stepper beyond the ±4 cap. The other events documented here
 * are small, surface-level events the card was implicitly meant to fire
 * (the 02.5c story assumed "existing card-level telemetry"; this file
 * gives that assumption a concrete home).
 *
 * All events live under the `groove-card` category so they roll up
 * cleanly in Sentry's breadcrumb view.
 */

import { trackEvent } from '@/shared/utils/sentry';

const CATEGORY = 'groove-card';

export interface GrooveCardCommonProps {
  blockId: string;
  /** 'block' = inside /app tutorial; 'waitlist' = public marketing page */
  mode: 'block' | 'waitlist';
}

/**
 * Fired when a waitlist visitor attempts to push the key stepper beyond
 * the ±4 cap. The cap-as-CTA mechanism — does this correlate with
 * signups? — depends on this event firing reliably.
 */
export function trackWaitlistKeyCapHit(params: {
  blockId: string;
  valueAttempted: number;
}): void {
  trackEvent('groove_card_waitlist_cap_hit', CATEGORY, {
    blockId: params.blockId,
    lever: 'key',
    valueAttempted: params.valueAttempted,
  });
}

/**
 * Fired when the play button is tapped for the first time on a
 * given card mount. Lets us measure tap-through against scroll-to-card.
 */
export function trackPlayFirst(params: GrooveCardCommonProps): void {
  trackEvent('groove_card_play_first', CATEGORY, {
    blockId: params.blockId,
    mode: params.mode,
  });
}

/**
 * Fired on any later play press (resumes, restarts). Distinguished from
 * `play_first` so the funnel chart shows first-tap conversion separately
 * from sustained engagement.
 */
export function trackPlay(params: GrooveCardCommonProps): void {
  trackEvent('groove_card_play', CATEGORY, {
    blockId: params.blockId,
    mode: params.mode,
  });
}

/**
 * Fired when the card unmounts. Lets us measure time-on-card. The card
 * lifecycle hook will compute mount → unmount duration and pass it.
 */
export function trackUnmount(
  params: GrooveCardCommonProps & { dwellMs: number },
): void {
  trackEvent('groove_card_unmount', CATEGORY, {
    blockId: params.blockId,
    mode: params.mode,
    dwellMs: params.dwellMs,
  });
}
