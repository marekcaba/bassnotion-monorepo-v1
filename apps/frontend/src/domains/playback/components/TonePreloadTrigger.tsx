'use client';

/**
 * TonePreloadTrigger - Client Component for Early Tone.js Loading
 *
 * FAANG PATTERN: Eager Resource Loading
 *
 * This component triggers Tone.js preloading as early as possible in
 * the React lifecycle. It renders nothing but initiates the background
 * loading of Tone.js in parallel with the data fetch.
 *
 * PLACEMENT:
 * - Must be in a client component (uses browser APIs)
 * - Should be placed in the layout or near the top of the component tree
 * - Runs before ScrollTriggerLoader (which waits for user interaction)
 *
 * TIMING:
 * - useEffect runs after first paint but before user interaction
 * - requestIdleCallback ensures we don't block critical rendering
 * - Tone.js is ready by the time widgets need it (~1-2 seconds later)
 */

import { useEffect } from 'react';
import { TonePreloader } from '../utils/TonePreloader.js';

export function TonePreloadTrigger() {
  useEffect(() => {
    // Trigger warmup immediately on mount
    // This runs during idle time, not blocking the main thread
    TonePreloader.warmup();
  }, []);

  // This component renders nothing - it's purely for side effects
  return null;
}
