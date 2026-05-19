/**
 * Tone.js Export Module
 * Updated for Story 3.18.3: Uses dependency injection
 * Updated for FAANG-style preloading: Uses TonePreloader for eager loading
 *
 * This module provides access to the singleton Tone.js instance.
 * ALWAYS import Tone from this module instead of directly from 'tone'.
 *
 * This ensures all components use the same AudioContext.
 *
 * PERFORMANCE OPTIMIZATION:
 * When TonePreloader.warmup() is called early (from layout), Tone.js
 * is loaded in parallel with the data fetch, saving ~730ms on first load.
 */

// ServiceAdapter was removed in Epic 3.18
// import { getTone as getAdapterTone, areServicesInitialized } from '../services/ServiceAdapter.js';
import { TonePreloader } from './TonePreloader.js';

// Lazy getter that returns the singleton Tone instance
let cachedTone: any = null;

/**
 * Get the singleton Tone.js instance
 * Uses TonePreloader for optimized loading when available
 */
export async function getTone() {
  if (!cachedTone) {
    // Check if preloader has already loaded Tone.js
    if (TonePreloader.isReady()) {
      cachedTone = await TonePreloader.getTone();
      console.log('✅ [TONE] Using preloaded Tone.js instance');
    } else {
      // Fallback: Use preloader which handles caching
      console.log('⚠️ [TONE] Preloader not ready, loading via preloader...');
      cachedTone = await TonePreloader.getTone();
    }
  }
  return cachedTone;
}

/**
 * Export a proxy object that mimics the Tone namespace
 * This allows `import * as Tone from '@/domains/playback/utils/tone'` to work
 */
const ToneProxy = new Proxy(
  {},
  {
    get(target, prop) {
      // Return the cached Tone instance property if available
      if (cachedTone && prop in cachedTone) {
        return cachedTone[prop];
      }

      // For async initialization, return a promise
      return getTone().then((tone) => tone[prop]);
    },
  },
);

// Export both named and default exports for flexibility
export default ToneProxy;
export { ToneProxy as Tone };

// Re-export commonly used Tone.js types/classes
// These will be populated once Tone is loaded
// Re-resolve via getTransport() each access so we always read against the
// CURRENT Tone Context (safe across setContext swaps). The deprecated
// `cachedTone.Transport` const captures whichever Context existed at
// module-load time and breaks after a setContext().
export const Transport = new Proxy(
  {},
  {
    get(target, prop) {
      const t = cachedTone?.getTransport
        ? cachedTone.getTransport()
        : cachedTone?.Transport;
      if (t) {
        return t[prop];
      }
      return undefined;
    },
  },
);
