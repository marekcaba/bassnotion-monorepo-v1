/**
 * Tone.js Export Module
 * Updated for Story 3.18.3: Uses dependency injection
 *
 * This module provides access to the singleton Tone.js instance.
 * ALWAYS import Tone from this module instead of directly from 'tone'.
 *
 * This ensures all components use the same AudioContext.
 */

// ServiceAdapter was removed in Epic 3.18
// import { getTone as getAdapterTone, areServicesInitialized } from '../services/ServiceAdapter.js';
import { getAudioArchitectureFlags } from '../config/featureFlags.js';

// Lazy getter that returns the singleton Tone instance
let cachedTone: any = null;

/**
 * Get the singleton Tone.js instance
 * Note: This will throw if accessed before AudioProvider initializes
 */
export async function getTone() {
  if (!cachedTone) {
    // Epic 3.18: Always use direct import now that ServiceAdapter is removed
    cachedTone = await import('tone');
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
export const Transport = new Proxy(
  {},
  {
    get(target, prop) {
      if (cachedTone?.Transport) {
        return cachedTone.Transport[prop];
      }
      return undefined;
    },
  },
);
