/**
 * Funnel event emitter — fire-and-forget inserts into funnel_events.
 *
 * Each call resolves the visitor's anonymous id + first-touch attribution and
 * writes one append-only row via the anon Supabase client (same low-trust
 * insert posture as the waitlist). Errors are swallowed: analytics must never
 * block or break the page. Skipped during SSR.
 *
 * landing_view is fired once by AttributionProvider; conversion events
 * (waitlist_submitted, founder_interest_click) are fired from the flows that
 * cause them.
 */

import type { FunnelEventName } from '@bassnotion/contracts';

import { supabase } from '@/infrastructure/supabase/client';

import { getStoredAttribution } from './index';
import { ensureAnonymousId } from './visitor';

export function trackEvent(
  event: FunnelEventName,
  props?: Record<string, unknown>,
): void {
  if (typeof window === 'undefined') return;

  try {
    const anonymousId = ensureAnonymousId();
    if (!anonymousId) return; // no identity (SSR/blocked) — nothing to join on

    const attribution = getStoredAttribution();

    // Fire-and-forget. We intentionally don't await; a failed insert must not
    // affect the user. .then(noop, noop) keeps the unhandled-rejection lint
    // quiet without surfacing analytics errors.
    void supabase
      .from('funnel_events')
      .insert({
        anonymous_id: anonymousId,
        event,
        attribution: Object.keys(attribution).length > 0 ? attribution : null,
        props: props ?? null,
      })
      .then(
        () => undefined,
        () => undefined,
      );
  } catch {
    // Resolving id/attribution can throw if storage is locked — non-fatal.
  }
}
