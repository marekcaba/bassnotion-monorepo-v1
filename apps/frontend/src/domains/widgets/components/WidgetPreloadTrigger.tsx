'use client';

/**
 * WidgetPreloadTrigger - Client Component for Early Widget Loading
 *
 * FAANG PATTERN: Parallel Resource Preloading
 *
 * This component triggers parallel widget chunk preloading as early as possible
 * in the React lifecycle. It renders nothing but initiates background loading
 * of all 4 widget chunks simultaneously.
 *
 * PLACEMENT:
 * - Must be in a client component (uses browser APIs)
 * - Should be placed in the layout alongside TonePreloadTrigger
 * - Runs before FourWidgetsCard renders
 *
 * TIMING:
 * - useEffect runs after first paint but before user interaction
 * - requestIdleCallback ensures we don't block critical rendering
 * - All 4 widgets load in parallel, not sequentially
 * - Widgets are cached and ready for instant use by FourWidgetsCard
 *
 * PERFORMANCE IMPACT:
 * - Eliminates ~1.5 second sequential widget load delay
 * - Widget chunks are pre-cached before FourWidgetsCard needs them
 */

import { useEffect } from 'react';
import { WidgetPreloader } from '../utils/WidgetPreloader.js';

export function WidgetPreloadTrigger() {
  useEffect(() => {
    // Trigger warmup immediately on mount
    // This starts parallel loading of all 4 widget chunks during idle time
    WidgetPreloader.warmup();
  }, []);

  // This component renders nothing - it's purely for side effects
  return null;
}
