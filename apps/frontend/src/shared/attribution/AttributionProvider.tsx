'use client';

/**
 * Mounted once in the root layout so it runs on EVERY page (the marketing
 * landing page today, the future /app tomorrow). On first mount it:
 *   1. ensures the bn_anonymous_id cookie (the visitor spine),
 *   2. captures first-touch attribution (utm/referrer/src/vid/wall),
 *   3. fires a single landing_view funnel event.
 *
 * Renders nothing — it's a pure side-effect provider. Guarded so the
 * landing_view fires at most once per browser session even under React 18
 * StrictMode's double-mount in development.
 */

import { useEffect } from 'react';

import { ensureFirstTouchAttribution } from './index';
import { trackEvent } from './events';
import { ensureAnonymousId } from './visitor';

const SESSION_FLAG = 'bn_landing_view_fired';

export function AttributionProvider() {
  useEffect(() => {
    // Spine + first-touch capture are idempotent; safe to call every mount.
    ensureAnonymousId();
    ensureFirstTouchAttribution();

    // Fire landing_view once per session (not per route change / StrictMode
    // remount). sessionStorage scopes it to this tab's lifetime.
    try {
      if (sessionStorage.getItem(SESSION_FLAG)) return;
      sessionStorage.setItem(SESSION_FLAG, '1');
    } catch {
      // If sessionStorage is blocked we may double-fire; harmless for a view.
    }

    trackEvent('landing_view');
  }, []);

  return null;
}
