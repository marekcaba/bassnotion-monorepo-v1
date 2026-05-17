/**
 * WindowRegistry - Centralized registry for window globals
 *
 * 🔧 BUG #8 FIX: Window Object Pollution Prevention
 *
 * This module provides a centralized, type-safe way to manage global window
 * variables used for debugging and development. It prevents naming collisions
 * and provides clear documentation of all globals.
 *
 * All BassNotion globals use the `__bassnotion_` prefix to avoid conflicts.
 *
 * NOTE: Window interface extensions are defined in /src/types/window.d.ts
 * which provides comprehensive type definitions for all window properties
 * used throughout the codebase. That file is automatically included via
 * tsconfig.json includes.
 */

/**
 * Centralized registry for all window globals
 * Provides type-safe accessors and cleanup methods
 */
export class WindowRegistry {
  private static readonly PREFIX = '__bassnotion_';

  // ============================================================================
  // CORE SERVICES
  // ============================================================================

  /**
   * Set the global CoreServices instance
   * This is the primary entry point for the entire playback system
   */
  static setCoreServices(services: any): void {
    if (typeof window === 'undefined') return;

    window.__bassnotion_coreServices = services;

    // Clean up legacy keys
    delete window.__globalCoreServices;
    delete window.__coreServices;
  }

  /**
   * Get the global CoreServices instance
   * Checks new key first, falls back to legacy for migration
   */
  static getCoreServices(): any {
    if (typeof window === 'undefined') return null;

    // Check new key first
    return (
      window.__bassnotion_coreServices ||
      // Fallback to legacy for migration period
      window.__globalCoreServices ||
      window.__coreServices
    );
  }

  // ============================================================================
  // SERVICE REGISTRY
  // ============================================================================

  /**
   * Set the service registry (for debugging)
   */
  static setServiceRegistry(registry: any): void {
    if (typeof window === 'undefined') return;

    window.__bassnotion_serviceRegistry = registry;

    // Clean up legacy key
    delete window.__serviceRegistry;
  }

  /**
   * Get the service registry
   */
  static getServiceRegistry(): any {
    if (typeof window === 'undefined') return null;

    return window.__bassnotion_serviceRegistry || window.__serviceRegistry;
  }

  // ============================================================================
  // EVENT BUS
  // ============================================================================

  /**
   * Set the global EventBus instance
   */
  static setEventBus(eventBus: any): void {
    if (typeof window === 'undefined') return;

    window.__bassnotion_eventBus = eventBus;

    // Clean up legacy key
    delete window.__globalEventBus;
  }

  /**
   * Get the global EventBus instance
   */
  static getEventBus(): any {
    if (typeof window === 'undefined') return null;

    return window.__bassnotion_eventBus || window.__globalEventBus;
  }

  // ============================================================================
  // AUDIOCONTEXT
  // ============================================================================

  /**
   * Set the global AudioContext instance
   */
  static setAudioContext(context: AudioContext): void {
    if (typeof window === 'undefined') return;

    window.__bassnotion_audioContext = context;

    // Clean up legacy key
    delete window.__persistentAudioContext;
  }

  /**
   * Get the global AudioContext instance
   */
  static getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;

    return (
      window.__bassnotion_audioContext ||
      window.__persistentAudioContext ||
      null
    );
  }

  /**
   * Set the AudioContext unsubscribe function
   */
  static setAudioContextUnsubscribe(
    unsubscribe: (() => void) | undefined,
  ): void {
    if (typeof window === 'undefined') return;

    window.__bassnotion_audioContextUnsubscribe = unsubscribe;

    if (!unsubscribe) {
      delete window.__bassnotion_audioContextUnsubscribe;
      delete window.__audioContextUnsubscribe;
    }
  }

  /**
   * Get the AudioContext unsubscribe function
   */
  static getAudioContextUnsubscribe(): (() => void) | undefined {
    if (typeof window === 'undefined') return undefined;

    return (
      window.__bassnotion_audioContextUnsubscribe ||
      window.__audioContextUnsubscribe
    );
  }

  // ============================================================================
  // PLAYBACK ENGINES (Phase 1 Task 1.5)
  // ============================================================================

  /**
   * Set the RegionProcessor instance
   * @deprecated RegionProcessor has been removed. Use setPlaybackEngine() instead.
   * This method is a no-op and kept only for backward compatibility.
   * Phase 3.3: RegionProcessor deleted, PlaybackEngine is at 100% rollout
   */
  static setRegionProcessor(processor: any): void {
    // No-op - RegionProcessor no longer exists
    // This method is kept for backward compatibility during migration
    return;
  }

  /**
   * Get the RegionProcessor instance
   * @deprecated RegionProcessor has been removed. Use getPlaybackEngine() instead.
   * This method is kept only for backward compatibility in tests.
   * Phase 3.3: RegionProcessor deleted, PlaybackEngine is at 100% rollout
   */
  static getRegionProcessor(): any {
    if (typeof window === 'undefined') return null;

    // Return null - RegionProcessor no longer exists
    // Tests should migrate to getPlaybackEngine()
    return null;
  }

  /**
   * Set the PlaybackEngine instance
   * This is the new playback engine (feature flag controlled)
   */
  static setPlaybackEngine(engine: any): void {
    if (typeof window === 'undefined') return;

    window.__bassnotion_playbackEngine = engine;
  }

  /**
   * Get the PlaybackEngine instance
   * Returns null if feature flag is disabled
   */
  static getPlaybackEngine(): any {
    if (typeof window === 'undefined') return null;

    return window.__bassnotion_playbackEngine || null;
  }

  // ============================================================================
  // INITIALIZATION FLAGS
  // ============================================================================

  /**
   * Set the samplesReady flag
   */
  static setSamplesReady(ready: boolean): void {
    if (typeof window === 'undefined') return;

    window.__bassnotion_samplesReady = ready;

    // ✅ FIX: Also set legacy key for backward compatibility with GlobalControls
    window.__samplesReady = ready;
  }

  /**
   * Get the samplesReady flag
   */
  static getSamplesReady(): boolean {
    if (typeof window === 'undefined') return false;

    return window.__bassnotion_samplesReady || window.__samplesReady || false;
  }

  /**
   * Set the essentialSamplesLoaded flag
   */
  static setEssentialSamplesLoaded(loaded: boolean): void {
    if (typeof window === 'undefined') return;

    window.__bassnotion_essentialSamplesLoaded = loaded;

    // Clean up legacy key
    delete window.__essentialSamplesLoaded;
  }

  /**
   * Get the essentialSamplesLoaded flag
   */
  static getEssentialSamplesLoaded(): boolean {
    if (typeof window === 'undefined') return false;

    return (
      window.__bassnotion_essentialSamplesLoaded ||
      window.__essentialSamplesLoaded ||
      false
    );
  }

  /**
   * Set the initializationFailed flag
   */
  static setInitializationFailed(failed: boolean): void {
    if (typeof window === 'undefined') return;

    window.__bassnotion_initializationFailed = failed;

    // Clean up legacy key
    delete window.__initializationFailed;
  }

  /**
   * Get the initializationFailed flag
   */
  static getInitializationFailed(): boolean {
    if (typeof window === 'undefined') return false;

    return (
      window.__bassnotion_initializationFailed ||
      window.__initializationFailed ||
      false
    );
  }

  // ============================================================================
  // BASS BUFFERS READINESS
  // ============================================================================

  /**
   * Set the bass buffers ready flag for a specific exercise
   * @param ready - Whether bass buffers are ready
   * @param exerciseId - The exercise ID for which buffers are ready
   */
  static setBassBuffersReady(ready: boolean, exerciseId?: string): void {
    if (typeof window === 'undefined') return;

    window.__bassnotion_bassBuffersReady = ready;
    window.__bassnotion_bassBuffersExerciseId = exerciseId;

    // Dispatch event for listeners
    if (ready && exerciseId) {
      window.dispatchEvent(
        new CustomEvent('bassBuffersReady', { detail: { exerciseId } }),
      );
      console.log('🎸 [BASS-REGISTRY] Bass buffers ready event dispatched', {
        exerciseId,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Get the bass buffers ready flag
   * @param exerciseId - Optional exercise ID to check readiness for specific exercise
   */
  static getBassBuffersReady(exerciseId?: string): boolean {
    if (typeof window === 'undefined') return false;

    const isReady = window.__bassnotion_bassBuffersReady || false;
    const readyExerciseId = window.__bassnotion_bassBuffersExerciseId;

    // If no exercise ID specified, just return the ready flag
    if (!exerciseId) return isReady;

    // If exercise ID specified, check if buffers are ready for THAT exercise
    return isReady && readyExerciseId === exerciseId;
  }

  /**
   * Clear bass buffers ready flag (call when switching exercises)
   */
  static clearBassBuffersReady(): void {
    if (typeof window === 'undefined') return;

    window.__bassnotion_bassBuffersReady = false;
    window.__bassnotion_bassBuffersExerciseId = undefined;
  }

  // ============================================================================
  // ACT 2 PRELOAD TRACKING
  // ============================================================================

  /**
   * Set the Act 2 preload progress (0-100)
   * Used by useActAwarePreload to track background sample loading progress
   */
  static setAct2PreloadProgress(progress: number): void {
    if (typeof window === 'undefined') return;

    window.__bassnotion_act2PreloadProgress = Math.min(
      100,
      Math.max(0, progress),
    );
  }

  /**
   * Get the Act 2 preload progress (0-100)
   */
  static getAct2PreloadProgress(): number {
    if (typeof window === 'undefined') return 0;

    return window.__bassnotion_act2PreloadProgress || 0;
  }

  /**
   * Set the Act 2 samples ready flag
   * When true, user can transition to Act 2 without seeing loading overlay
   */
  static setAct2SamplesReady(ready: boolean): void {
    if (typeof window === 'undefined') return;

    window.__bassnotion_act2SamplesReady = ready;

    // Dispatch event for listeners
    if (ready) {
      window.dispatchEvent(new Event('act2SamplesReady'));
    }
  }

  /**
   * Get the Act 2 samples ready flag
   */
  static getAct2SamplesReady(): boolean {
    if (typeof window === 'undefined') return false;

    return window.__bassnotion_act2SamplesReady || false;
  }

  /**
   * Reset Act 2 preload state (call when navigating away from tutorial)
   */
  static resetAct2PreloadState(): void {
    if (typeof window === 'undefined') return;

    window.__bassnotion_act2PreloadProgress = 0;
    window.__bassnotion_act2SamplesReady = false;
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  /**
   * Clean up all BassNotion globals
   * Should be called on application unmount or reset
   */
  static cleanup(): void {
    if (typeof window === 'undefined') return;

    // Clean up all BassNotion-prefixed keys
    Object.keys(window).forEach((key) => {
      if (key.startsWith(WindowRegistry.PREFIX)) {
        delete (window as { [key: string]: unknown })[key];
      }
    });

    // Clean up legacy keys
    delete window.__globalCoreServices;
    delete window.__coreServices;
    delete window.__serviceRegistry;
    delete window.__persistentAudioContext;
    delete window.__globalEventBus;
    delete window.__samplesReady;
    delete window.__essentialSamplesLoaded;
    delete window.__initializationFailed;
    delete window.__audioContextUnsubscribe;
  }

  /**
   * Get all active BassNotion globals (for debugging)
   * Returns key-value pairs of all __bassnotion_* variables
   */
  static debugGetAll(): Record<string, unknown> {
    if (typeof window === 'undefined') return {};

    const result: Record<string, unknown> = {};

    Object.keys(window).forEach((key) => {
      if (key.startsWith(WindowRegistry.PREFIX)) {
        result[key] = (window as { [key: string]: unknown })[key];
      }
    });

    return result;
  }

  /**
   * Check if any legacy keys still exist (for migration monitoring)
   */
  static debugCheckLegacyKeys(): string[] {
    if (typeof window === 'undefined') return [];

    const legacyKeys = [
      '__globalCoreServices',
      '__coreServices',
      '__serviceRegistry',
      '__persistentAudioContext',
      '__globalEventBus',
      '__samplesReady',
      '__essentialSamplesLoaded',
      '__initializationFailed',
      '__audioContextUnsubscribe',
    ];

    return legacyKeys.filter((key) => key in window);
  }
}
