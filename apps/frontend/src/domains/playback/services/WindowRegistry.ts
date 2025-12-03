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
 */

/**
 * BassNotion Window Interface
 * Extends the global Window object with our application-specific globals
 */
interface BassNotionWindow {
  // Core Services
  __bassnotion_coreServices?: any;

  // Event System
  __bassnotion_eventBus?: any;

  // AudioContext Management
  __bassnotion_audioContext?: AudioContext;
  __bassnotion_audioContextUnsubscribe?: () => void;

  // Playback Engines (Phase 1 Task 1.5 - Dual-Engine Tracking)
  __bassnotion_regionProcessor?: any;
  __bassnotion_playbackEngine?: any;

  // Initialization Flags
  __bassnotion_samplesReady?: boolean;
  __bassnotion_essentialSamplesLoaded?: boolean;
  __bassnotion_initializationFailed?: boolean;

  // Service Registry (for debugging)
  __bassnotion_serviceRegistry?: any;

  // Legacy keys (for migration period - will be removed)
  __globalCoreServices?: any;
  __coreServices?: any;
  __serviceRegistry?: any;
  __persistentAudioContext?: AudioContext;
  __globalEventBus?: any;
  __samplesReady?: boolean;
  __essentialSamplesLoaded?: boolean;
  __initializationFailed?: boolean;
  __audioContextUnsubscribe?: () => void;
}

declare global {
  interface Window extends BassNotionWindow {}
}

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
    delete (window as any).__globalCoreServices;
    delete (window as any).__coreServices;
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
      (window as any).__globalCoreServices ||
      (window as any).__coreServices
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
    delete (window as any).__serviceRegistry;
  }

  /**
   * Get the service registry
   */
  static getServiceRegistry(): any {
    if (typeof window === 'undefined') return null;

    return (
      window.__bassnotion_serviceRegistry ||
      (window as any).__serviceRegistry
    );
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
    delete (window as any).__globalEventBus;
  }

  /**
   * Get the global EventBus instance
   */
  static getEventBus(): any {
    if (typeof window === 'undefined') return null;

    return (
      window.__bassnotion_eventBus || (window as any).__globalEventBus
    );
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
    delete (window as any).__persistentAudioContext;
  }

  /**
   * Get the global AudioContext instance
   */
  static getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;

    return (
      window.__bassnotion_audioContext ||
      (window as any).__persistentAudioContext ||
      null
    );
  }

  /**
   * Set the AudioContext unsubscribe function
   */
  static setAudioContextUnsubscribe(unsubscribe: (() => void) | undefined): void {
    if (typeof window === 'undefined') return;

    window.__bassnotion_audioContextUnsubscribe = unsubscribe;

    if (!unsubscribe) {
      delete window.__bassnotion_audioContextUnsubscribe;
      delete (window as any).__audioContextUnsubscribe;
    }
  }

  /**
   * Get the AudioContext unsubscribe function
   */
  static getAudioContextUnsubscribe(): (() => void) | undefined {
    if (typeof window === 'undefined') return undefined;

    return (
      window.__bassnotion_audioContextUnsubscribe ||
      (window as any).__audioContextUnsubscribe
    );
  }

  // ============================================================================
  // PLAYBACK ENGINES (Phase 1 Task 1.5)
  // ============================================================================

  /**
   * Set the RegionProcessor instance
   * This is the legacy playback engine that will eventually be replaced
   */
  static setRegionProcessor(processor: any): void {
    if (typeof window === 'undefined') return;

    window.__bassnotion_regionProcessor = processor;
  }

  /**
   * Get the RegionProcessor instance
   */
  static getRegionProcessor(): any {
    if (typeof window === 'undefined') return null;

    return window.__bassnotion_regionProcessor || null;
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
    (window as any).__samplesReady = ready;
  }

  /**
   * Get the samplesReady flag
   */
  static getSamplesReady(): boolean {
    if (typeof window === 'undefined') return false;

    return (
      window.__bassnotion_samplesReady ||
      (window as any).__samplesReady ||
      false
    );
  }

  /**
   * Set the essentialSamplesLoaded flag
   */
  static setEssentialSamplesLoaded(loaded: boolean): void {
    if (typeof window === 'undefined') return;

    window.__bassnotion_essentialSamplesLoaded = loaded;

    // Clean up legacy key
    delete (window as any).__essentialSamplesLoaded;
  }

  /**
   * Get the essentialSamplesLoaded flag
   */
  static getEssentialSamplesLoaded(): boolean {
    if (typeof window === 'undefined') return false;

    return (
      window.__bassnotion_essentialSamplesLoaded ||
      (window as any).__essentialSamplesLoaded ||
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
    delete (window as any).__initializationFailed;
  }

  /**
   * Get the initializationFailed flag
   */
  static getInitializationFailed(): boolean {
    if (typeof window === 'undefined') return false;

    return (
      window.__bassnotion_initializationFailed ||
      (window as any).__initializationFailed ||
      false
    );
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
        delete (window as any)[key];
      }
    });

    // Clean up legacy keys
    delete (window as any).__globalCoreServices;
    delete (window as any).__coreServices;
    delete (window as any).__serviceRegistry;
    delete (window as any).__persistentAudioContext;
    delete (window as any).__globalEventBus;
    delete (window as any).__samplesReady;
    delete (window as any).__essentialSamplesLoaded;
    delete (window as any).__initializationFailed;
    delete (window as any).__audioContextUnsubscribe;
  }

  /**
   * Get all active BassNotion globals (for debugging)
   * Returns key-value pairs of all __bassnotion_* variables
   */
  static debugGetAll(): Record<string, any> {
    if (typeof window === 'undefined') return {};

    const result: Record<string, any> = {};

    Object.keys(window).forEach((key) => {
      if (key.startsWith(WindowRegistry.PREFIX)) {
        result[key] = (window as any)[key];
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
