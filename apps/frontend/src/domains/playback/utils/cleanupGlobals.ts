/**
 * Global Variables Cleanup Documentation
 * 
 * Lists all window globals used in the playback system and their status.
 * Part of Story 3.25: Unified Sample Loading System Fix
 */

// ============================================================================
// GLOBALS TO KEEP
// ============================================================================

/**
 * These globals are essential for the system to work:
 * 
 * 1. window.__globalCoreServices - Used by widgets to access core services
 *    - Required for AudioEngine, Transport, etc.
 *    - Set by ToneProvider/AudioProvider
 *    
 * 2. window.__globalTone - Global Tone.js instance
 *    - Required for singleton pattern
 *    - Set by AudioEngine
 *    
 * 3. window.__samplesPreloaded - Indicates Phase 3 completion
 *    - Used by legacy code for compatibility
 *    - Set by InitialSamplePreloader
 */

// ============================================================================
// GLOBALS TO DEPRECATE (but keep for compatibility)
// ============================================================================

/**
 * These are marked as deprecated but kept for backward compatibility:
 * 
 * 1. window.__preloadedDrumPads - Legacy drum preloading
 *    - Replaced by GlobalSampleCache
 *    - Still checked by some widgets
 *    
 * 2. window.__samplesLoadOnDemand - Legacy loading flag
 *    - No longer used in new system
 *    
 * 3. window.__drumsLoadOnDemand - Legacy drum loading flag
 *    - No longer used in new system
 */

// ============================================================================
// GLOBALS TO REMOVE (test only)
// ============================================================================

/**
 * These are only used in tests and should not be in production:
 * 
 * 1. window.__mockAudioContext - Test mock
 * 2. window.__widgetsLoadedLogged - Test logging flag
 * 3. window.__toneInitLogged - Test logging flag
 */

// ============================================================================
// CLEANUP HELPER
// ============================================================================

/**
 * Marks deprecated globals with warnings
 */
export function markDeprecatedGlobals() {
  if (typeof window === 'undefined') return;

  // Add deprecation warnings
  Object.defineProperty(window, '__preloadedDrumPads', {
    get() {
      logger.warn('⚠️ window.__preloadedDrumPads is deprecated. Use GlobalSampleCache instead.');
      return undefined;
    },
    set(value) {
      logger.warn('⚠️ Setting window.__preloadedDrumPads is deprecated. Use GlobalSampleCache.cacheInstrument() instead.');
    }
  });

  Object.defineProperty(window, '__samplesLoadOnDemand', {
    get() {
      logger.warn('⚠️ window.__samplesLoadOnDemand is deprecated. Samples always load on demand now.');
      return true;
    },
    set(value) {
      logger.warn('⚠️ Setting window.__samplesLoadOnDemand is deprecated and has no effect.');
    }
  });

  Object.defineProperty(window, '__drumsLoadOnDemand', {
    get() {
      logger.warn('⚠️ window.__drumsLoadOnDemand is deprecated. Drums always load on demand now.');
      return true;
    },
    set(value) {
      logger.warn('⚠️ Setting window.__drumsLoadOnDemand is deprecated and has no effect.');
    }
  });
}

/**
 * Type declarations for the globals we're keeping
 */
declare global {
  interface Window {
    // Core globals (keep)
    __globalCoreServices?: any;
    __globalTone?: any;
    __samplesPreloaded?: boolean;
    
    // Deprecated (remove in future)
    __preloadedDrumPads?: any;
    __samplesLoadOnDemand?: boolean;
    __drumsLoadOnDemand?: boolean;
  }
}

/**
 * Export type guard to check if core services are available
 */
export function hasGlobalCoreServices(): boolean {
  return typeof window !== 'undefined' && 
         window.__globalCoreServices !== undefined;
}

/**
 * Export type guard to check if samples are preloaded
 */
export function areSamplesPreloaded(): boolean {
  return typeof window !== 'undefined' && 
         window.__samplesPreloaded === true;
}