'use client';

import { useLayoutEffect } from 'react';

/**
 * ScrollToTop - Ensures page starts at the top on navigation
 *
 * This component resets the scroll position to the top of the page when mounted.
 * It's critical for pages that rely on scroll detection (IntersectionObserver)
 * for initialization, as browser scroll restoration could prevent initialization
 * triggers from firing properly.
 *
 * Uses useLayoutEffect to reset scroll BEFORE browser paint, preventing:
 * 1. Visual flash of content at wrong scroll position
 * 2. Race conditions with IntersectionObserver setup
 * 3. Missed initialization triggers due to restored scroll position
 *
 * Usage: Place in layout to ensure scroll reset on every navigation
 */
export function ScrollToTop(): null {
  useLayoutEffect(() => {
    // Reset scroll position to top
    // Using both methods for maximum browser compatibility
    window.scrollTo(0, 0);

    // Also reset document scroll for browsers that track it separately
    if (document.documentElement) {
      document.documentElement.scrollTop = 0;
    }
    if (document.body) {
      document.body.scrollTop = 0;
    }
  }, []);

  // This component renders nothing
  return null;
}
