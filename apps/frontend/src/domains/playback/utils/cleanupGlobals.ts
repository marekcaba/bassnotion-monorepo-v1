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

  // Deprecate legacy drum sample globals
  Object.defineProperty(window, '__preloadedDrumPads', {
    get() {
      console.warn(
        '⚠️ DEPRECATED: window.__preloadedDrumPads is deprecated. Use GlobalSampleCache instead.',
      );
      return undefined;
    },
    set(value) {
      console.warn(
        '⚠️ DEPRECATED: Setting window.__preloadedDrumPads is deprecated. Use GlobalSampleCache.cacheInstrument() instead.',
      );
    },
  });

  Object.defineProperty(window, '__samplesLoadOnDemand', {
    get() {
      console.warn(
        '⚠️ DEPRECATED: window.__samplesLoadOnDemand is deprecated. Samples always load on demand now.',
      );
      return true;
    },
    set(value) {
      console.warn(
        '⚠️ DEPRECATED: Setting window.__samplesLoadOnDemand is deprecated and has no effect.',
      );
    },
  });

  Object.defineProperty(window, '__drumsLoadOnDemand', {
    get() {
      console.warn(
        '⚠️ DEPRECATED: window.__drumsLoadOnDemand is deprecated. Drums always load on demand now.',
      );
      return true;
    },
    set(value) {
      console.warn(
        '⚠️ DEPRECATED: Setting window.__drumsLoadOnDemand is deprecated and has no effect.',
      );
    },
  });

  // Deprecate WindowRegistry legacy globals (BUG #8 - Window Object Pollution Prevention)
  Object.defineProperty(window, '__globalCoreServices', {
    get() {
      console.warn(
        '⚠️ DEPRECATED: window.__globalCoreServices is deprecated. Use WindowRegistry.getCoreServices() instead.',
      );
      return (window as any).__bassnotion_coreServices;
    },
    set(value) {
      console.warn(
        '⚠️ DEPRECATED: Setting window.__globalCoreServices is deprecated. Use WindowRegistry.setCoreServices() instead.',
      );
      (window as any).__bassnotion_coreServices = value;
    },
  });

  Object.defineProperty(window, '__coreServices', {
    get() {
      console.warn(
        '⚠️ DEPRECATED: window.__coreServices is deprecated. Use WindowRegistry.getCoreServices() instead.',
      );
      return (window as any).__bassnotion_coreServices;
    },
    set(value) {
      console.warn(
        '⚠️ DEPRECATED: Setting window.__coreServices is deprecated. Use WindowRegistry.setCoreServices() instead.',
      );
      (window as any).__bassnotion_coreServices = value;
    },
  });

  Object.defineProperty(window, '__globalTone', {
    get() {
      console.warn(
        '⚠️ DEPRECATED: window.__globalTone is deprecated. Use WindowRegistry.getTone() instead.',
      );
      return (window as any).__bassnotion_tone;
    },
    set(value) {
      console.warn(
        '⚠️ DEPRECATED: Setting window.__globalTone is deprecated. Use WindowRegistry.setTone() instead.',
      );
      (window as any).__bassnotion_tone = value;
    },
  });

  Object.defineProperty(window, '__globalEventBus', {
    get() {
      console.warn(
        '⚠️ DEPRECATED: window.__globalEventBus is deprecated. Use WindowRegistry.getEventBus() instead.',
      );
      return (window as any).__bassnotion_eventBus;
    },
    set(value) {
      console.warn(
        '⚠️ DEPRECATED: Setting window.__globalEventBus is deprecated. Use WindowRegistry.setEventBus() instead.',
      );
      (window as any).__bassnotion_eventBus = value;
    },
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
 * Uses WindowRegistry to avoid triggering deprecation warnings
 */
export function hasGlobalCoreServices(): boolean {
  if (typeof window === 'undefined') return false;
  // Access the new key directly to avoid deprecation warning
  return (window as any).__bassnotion_coreServices !== undefined;
}

/**
 * Export type guard to check if samples are preloaded
 */
export function areSamplesPreloaded(): boolean {
  return typeof window !== 'undefined' && window.__samplesPreloaded === true;
}
