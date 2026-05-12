/**
 * Global Window Type Extensions for BassNotion
 *
 * This file extends the global Window interface with all application-specific
 * properties used throughout the codebase. Using this file eliminates the need
 * for `(window as any)` casts when accessing these properties.
 *
 * ## Usage
 *
 * Simply access window properties directly:
 * ```typescript
 * // Before (with cast)
 * const tone = (window as any).Tone;
 *
 * // After (type-safe)
 * const tone = window.Tone;
 * ```
 *
 * ## Categories
 *
 * 1. **BassNotion Core** - Application-specific globals (prefixed with __bassnotion_)
 * 2. **Legacy Keys** - Older naming conventions (for migration compatibility)
 * 3. **Debug Flags** - Runtime debugging toggles (prefixed with __DEBUG_)
 * 4. **Debug Utilities** - Developer tools exposed on window
 * 5. **Third-Party Libraries** - Tone.js, Analytics, Sentry, etc.
 * 6. **Browser APIs** - WebKit prefixed and optional browser APIs
 * 7. **Testing/E2E** - Playwright and other testing framework globals
 */

// =============================================================================
// LOG LEVEL ENUM (duplicated to avoid import issues in .d.ts)
// =============================================================================

/**
 * Log levels for the application logger
 * Duplicated here to avoid import issues with module augmentation
 */
declare const enum BassNotionLogLevel {
  NONE = 0,
  ERROR = 1,
  WARN = 2,
  INFO = 3,
  DEBUG = 4,
  VERBOSE = 5,
}

// =============================================================================
// LOGGER TYPES
// =============================================================================

/**
 * Logger interface for window.logger
 * Provides category-based logging with configurable levels
 */
interface WindowLogger {
  setLevel: (level: BassNotionLogLevel) => void;
  getLevel: () => BassNotionLogLevel;
  error: (message: string, ...args: unknown[]) => void;
  warn: (message: string, ...args: unknown[]) => void;
  info: (message: string, ...args: unknown[]) => void;
  debug: (message: string, ...args: unknown[]) => void;
  verbose: (message: string, ...args: unknown[]) => void;
  category: (name: string) => CategoryLoggerInterface;
}

interface CategoryLoggerInterface {
  error: (message: string, ...args: unknown[]) => void;
  warn: (message: string, ...args: unknown[]) => void;
  info: (message: string, ...args: unknown[]) => void;
  debug: (message: string, ...args: unknown[]) => void;
  verbose: (message: string, ...args: unknown[]) => void;
}

// =============================================================================
// DEBUG UTILITIES TYPES
// =============================================================================

/**
 * Dot inspector summary returned by __INSPECT_DOTS__
 */
interface DotInspectorSummary {
  total: number;
  current: number;
  nextFirst: number;
  next: number;
  other: number;
  active: number;
  played: number;
  noMeasureClass: number;
  issues: string[];
}

/**
 * Debug console interface for aggressive console restoration
 */
interface DebugConsoleInterface {
  restore: () => void;
  original: Console;
}

/**
 * Lifecycle logger interface
 */
interface LifecycleLoggerInterface {
  log: (event: string, data?: Record<string, unknown>) => void;
  getEvents: () => unknown[];
  clear: () => void;
}

/**
 * Init sequence logger interface
 */
interface InitSeqInterface {
  log: (step: string, data?: Record<string, unknown>) => void;
  getSequence: () => unknown[];
  clear: () => void;
}

/**
 * Transition stats interface
 */
interface TransitionStatsInterface {
  totalTransitions: number;
  successfulTransitions: number;
  failedTransitions: number;
  averageDuration: number;
}

// =============================================================================
// THIRD-PARTY LIBRARY TYPES
// =============================================================================

/**
 * Google Analytics gtag function
 */
type GtagFunction = (
  command: 'config' | 'event' | 'set' | 'js',
  targetId: string,
  config?: Record<string, unknown>
) => void;

/**
 * Sentry SDK interface (partial - commonly used methods)
 */
interface SentryInterface {
  captureException: (error: Error, context?: Record<string, unknown>) => void;
  captureMessage: (message: string, level?: string) => void;
  addBreadcrumb: (breadcrumb: {
    category?: string;
    message?: string;
    level?: string;
    data?: Record<string, unknown>;
  }) => void;
  setUser: (user: { id?: string; email?: string; [key: string]: unknown } | null) => void;
  setContext: (name: string, context: Record<string, unknown> | null) => void;
  withScope: (callback: (scope: unknown) => void) => void;
}

// =============================================================================
// TONE.JS TYPE (simplified for window reference)
// =============================================================================

/**
 * Simplified Tone.js type for window reference
 * Full types come from the tone package when imported directly
 */
interface ToneNamespace {
  Transport: {
    state: string;
    bpm: { value: number };
    position: string;
    seconds: number;
    start: (time?: number) => void;
    stop: (time?: number) => void;
    pause: (time?: number) => void;
    cancel: (time?: number) => void;
    schedule: (callback: (time: number) => void, time: number) => number;
    scheduleRepeat: (callback: (time: number) => void, interval: number | string, startTime?: number) => number;
    clear: (id: number) => void;
  };
  Destination: unknown;
  context: AudioContext;
  start: () => Promise<void>;
  now: () => number;
  immediate: () => number;
  getContext: () => AudioContext;
  setContext: (context: AudioContext) => void;
  Player: new (url?: string) => unknown;
  Sampler: new (options?: unknown) => unknown;
  Buffer: new (url?: string) => unknown;
  Time: (value: string | number) => { toSeconds: () => number };
  [key: string]: unknown;
}

// =============================================================================
// WINDOW INTERFACE EXTENSION
// =============================================================================

declare global {
  interface Window {
    // =========================================================================
    // BASSNOTION CORE (prefixed with __bassnotion_)
    // =========================================================================

    /** Global CoreServices instance - primary entry point for playback system */
    __bassnotion_coreServices?: unknown;

    /** Global EventBus instance for cross-component communication */
    __bassnotion_eventBus?: unknown;

    /** Persistent AudioContext instance */
    __bassnotion_audioContext?: AudioContext;

    /** Unsubscribe function for AudioContext listeners */
    __bassnotion_audioContextUnsubscribe?: () => void;

    /** RegionProcessor instance (deprecated - use PlaybackEngine) */
    __bassnotion_regionProcessor?: unknown;

    /** PlaybackEngine instance (new playback system) */
    __bassnotion_playbackEngine?: unknown;

    /** Flag indicating samples are ready for playback */
    __bassnotion_samplesReady?: boolean;

    /** Flag indicating essential samples have loaded */
    __bassnotion_essentialSamplesLoaded?: boolean;

    /** Flag indicating initialization has failed */
    __bassnotion_initializationFailed?: boolean;

    /** Flag indicating bass buffers are ready */
    __bassnotion_bassBuffersReady?: boolean;

    /** Exercise ID for which bass buffers are ready */
    __bassnotion_bassBuffersExerciseId?: string;

    /** Service registry for debugging */
    __bassnotion_serviceRegistry?: unknown;

    /** Act 2 preload progress (0-100) */
    __bassnotion_act2PreloadProgress?: number;

    /** Flag indicating Act 2 samples are ready */
    __bassnotion_act2SamplesReady?: boolean;

    // =========================================================================
    // LEGACY KEYS (for migration period - will be removed)
    // =========================================================================

    /** @deprecated Use __bassnotion_coreServices */
    __globalCoreServices?: unknown;

    /** @deprecated Use __bassnotion_coreServices */
    __coreServices?: unknown;

    /** @deprecated Use __bassnotion_serviceRegistry */
    __serviceRegistry?: unknown;

    /** @deprecated Use __bassnotion_audioContext */
    __persistentAudioContext?: AudioContext;

    /** @deprecated Use __bassnotion_eventBus */
    __globalEventBus?: unknown;

    /** @deprecated Use __bassnotion_samplesReady */
    __samplesReady?: boolean;

    /** @deprecated Use __bassnotion_essentialSamplesLoaded */
    __essentialSamplesLoaded?: boolean;

    /** @deprecated Use __bassnotion_initializationFailed */
    __initializationFailed?: boolean;

    /** @deprecated Use __bassnotion_audioContextUnsubscribe */
    __audioContextUnsubscribe?: () => void;

    /** @deprecated Use __bassnotion_audioContext */
    __audioContext?: AudioContext;

    /** @deprecated Flag indicating all samples have loaded */
    __allSamplesLoaded?: boolean;

    /** Tutorial-specific CoreServices reference (debugging) */
    __tutorialCoreServices?: unknown;

    /** Tutorial-specific transport reference (debugging) */
    __tutorialTransport?: unknown;

    /** Preloaded Tone.js module */
    __preloadedTone?: unknown;

    /** Global Tone.js reference */
    __globalTone?: ToneNamespace;

    /** Preloadable component registry */
    __preloadableRegistry?: unknown;

    /** Audio debugger instance for console access */
    __audioDebugger?: unknown;

    /** Samples preloaded flag */
    __samplesPreloaded?: boolean;

    /** Tracks pre-configured flag */
    __tracksPreConfigured?: boolean;

    /** Sample files downloaded flag */
    __sampleFilesDownloaded?: boolean;

    /** Playback EventBus instance (for logging decorators) */
    __playbackEventBus?: unknown;

    /** Playback ProductionLogger instance (for logging decorators) */
    __playbackLogger?: unknown;

    // =========================================================================
    // DEBUG FLAGS (boolean toggles)
    // =========================================================================

    /** General fretboard sync debugging */
    __DEBUG_FRETBOARD_SYNC?: boolean;

    /** Ultra verbose logging for every DOM mutation */
    __ULTRA_DEBUG__?: boolean;

    /** Connection line state tracking */
    __DEBUG_LINE_LIFECYCLE__?: boolean;

    /** Atomic playback clock debugging */
    __DEBUG_ATOMIC_CLOCK?: boolean;

    /** DOM timing debugging */
    __DEBUG_DOM_TIMING?: boolean;

    /** Memo timing debugging in useFretboardExercise */
    __DEBUG_MEMO_TIMING__?: boolean;

    /** Unified state debugging in useFretboardExercise */
    __DEBUG_UNIFIED_STATE__?: boolean;

    /** Measure transition debugging */
    __DEBUG_MEASURE_TRANSITION__?: boolean;

    /** Fretboard general debugging */
    __DEBUG_FRETBOARD__?: boolean;

    /** Opacity calculation debugging */
    __DEBUG_OPACITY__?: boolean;

    /** Measure sync debugging */
    __DEBUG_MEASURE_SYNC__?: boolean;

    /** Grid render debugging */
    __DEBUG_GRID_RENDER__?: boolean;

    /** Render state debugging */
    __DEBUG_RENDER_STATE__?: boolean;

    /** Line memo debugging */
    __DEBUG_LINE_MEMO__?: boolean;

    /** All dots debugging */
    __DEBUG_ALL_DOTS__?: boolean;

    /** Measure transitions debugging */
    __DEBUG_MEASURE_TRANSITIONS__?: boolean;

    /** Dot CSS debugging */
    __DEBUG_DOT_CSS__?: boolean;

    /** 3D ring overlay debugging */
    RING_DEBUG?: boolean;

    /** Scroll offset debugging (logs only lag) */
    SCROLL_DEBUG?: boolean;

    /** Scroll offset debugging (logs every frame) */
    SCROLL_DEBUG_ALL?: boolean;

    /** Verbose debug override (set via __enableVerboseDebug) */
    __VERBOSE_DEBUG_OVERRIDE?: boolean;

    // =========================================================================
    // DEBUG UTILITIES (functions exposed on window)
    // =========================================================================

    /** Start watching dot mutations */
    __START_MUTATION_WATCH__?: () => void;

    /** Stop watching dot mutations */
    __STOP_MUTATION_WATCH__?: () => void;

    /** Inspect all dot states. Pass true for continuous monitoring. */
    __INSPECT_DOTS__?: (continuous?: boolean) => DotInspectorSummary;

    /** Watch a specific dot position. Pass null to stop watching. */
    __WATCH_DOT__?: (positionKey: string | null) => void;

    /** Enable verbose debug mode */
    __enableVerboseDebug?: (enabled: boolean) => void;

    /** Check if verbose debug is enabled */
    __isVerboseDebugEnabled?: () => boolean;

    /** Debug console utilities */
    __debugConsole?: DebugConsoleInterface;

    /** Sync provider debug info */
    __syncProviderDebug?: {
      widgetSyncService: unknown;
      getState: () => unknown;
    };

    /** Widget sync service instance (for debugging) */
    widgetSyncService?: unknown;

    /** Clear exercise cache function */
    clearExerciseCache?: () => void;

    /** Internal clear exercise cache function */
    __clearExerciseCache?: () => void;

    /** Audio flow diagnostic function */
    diagnoseAudioFlow?: () => void;

    /** Persistent context verification function */
    verifyPersistentContext?: () => void;

    /** Transition stats function */
    __bassnotionTransitionStats?: () => TransitionStatsInterface;

    /** Cache monitor instance */
    cacheMonitor?: unknown;

    /** WAM plugin singleton */
    wamPluginSingleton?: unknown;

    /** Timing diagnostic class */
    __timingDiagnostic?: unknown;

    /** Lifecycle logger */
    __lifecycle?: LifecycleLoggerInterface;

    /** Init sequence logger */
    initSeq?: InitSeqInterface;

    /** Debug logger instance */
    __debugLogger?: unknown;

    /** Production debugger interface */
    __bassnotionDebug?: {
      start: (key: string) => string;
      stop: () => void;
      snapshot: () => unknown;
      replay: (sessionId: string) => Promise<void>;
      export: () => string;
      status: () => { enabled: boolean; activeSession?: string; captures: number; sessions: string[] };
    };

    // =========================================================================
    // LOGGING
    // =========================================================================

    /** Application logger instance */
    logger?: WindowLogger;

    /** Log level enum for runtime configuration */
    LogLevel?: {
      NONE: 0;
      ERROR: 1;
      WARN: 2;
      INFO: 3;
      DEBUG: 4;
      VERBOSE: 5;
    };

    // =========================================================================
    // THIRD-PARTY LIBRARIES
    // =========================================================================

    /** Tone.js library */
    Tone?: ToneNamespace;

    /** Global Tone.js instance (legacy key) */
    __globalTone?: ToneNamespace;

    /** Google Analytics gtag function */
    gtag?: GtagFunction;

    /** Sentry error tracking SDK */
    Sentry?: SentryInterface;

    /** Global audio context reference */
    audioContext?: AudioContext;

    /** Audio engine reference */
    __AudioEngine?: unknown;

    /** Global sample cache */
    GlobalSampleCache?: unknown;

    // =========================================================================
    // BROWSER APIS (WebKit prefixed / optional)
    // =========================================================================

    /** WebKit prefixed AudioContext for Safari */
    webkitAudioContext?: typeof AudioContext;

    // =========================================================================
    // TESTING / E2E
    // =========================================================================

    /** Playwright test runner flag */
    __playwright?: boolean;

    /** Playwright instance */
    playwright?: unknown;

    /** Cypress test runner flag */
    Cypress?: unknown;

    /** WebDriver flag (Selenium) */
    __webdriver?: boolean;

    /** PhantomJS flag */
    _phantom?: boolean;

    // =========================================================================
    // SKELETON DEBUG
    // =========================================================================

    /** Skeleton debug baseline timestamp */
    __SKELETON_DEBUG_START?: number;

    // =========================================================================
    // RUNTIME APIs
    // =========================================================================

    /** Garbage collection function (available when Chrome run with --expose-gc) */
    gc?: () => void;

    /** Request idle callback API */
    requestIdleCallback?: (
      callback: (deadline: IdleDeadline) => void,
      options?: { timeout?: number }
    ) => number;

    /** Cancel idle callback */
    cancelIdleCallback?: (handle: number) => void;

    // =========================================================================
    // PERFORMANCE
    // =========================================================================

    /** Enhanced performance interface (extends standard Performance) */
    performance: Performance & {
      memory?: {
        usedJSHeapSize: number;
        totalJSHeapSize: number;
        jsHeapSizeLimit: number;
      };
    };
  }
}

// =============================================================================
// NAVIGATOR EXTENSION - Network Information API & User-Agent Client Hints
// =============================================================================

/**
 * Network Information API types
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Network_Information_API
 */
interface NetworkInformation {
  readonly effectiveType: 'slow-2g' | '2g' | '3g' | '4g';
  readonly downlink: number;
  readonly rtt: number;
  readonly saveData: boolean;
  readonly type?: 'bluetooth' | 'cellular' | 'ethernet' | 'none' | 'wifi' | 'wimax' | 'other' | 'unknown';
  onchange?: ((this: NetworkInformation, ev: Event) => void) | null;
}

/**
 * User-Agent Client Hints API types
 * @see https://developer.mozilla.org/en-US/docs/Web/API/User-Agent_Client_Hints_API
 */
interface NavigatorUAData {
  readonly brands: ReadonlyArray<{ brand: string; version: string }>;
  readonly mobile: boolean;
  readonly platform: string;
  getHighEntropyValues(hints: string[]): Promise<{
    architecture?: string;
    bitness?: string;
    model?: string;
    platformVersion?: string;
    uaFullVersion?: string;
    fullVersionList?: Array<{ brand: string; version: string }>;
  }>;
}

/**
 * Battery Status API types
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Battery_Status_API
 */
interface BatteryManager extends EventTarget {
  readonly charging: boolean;
  readonly chargingTime: number;
  readonly dischargingTime: number;
  readonly level: number;
  onchargingchange: ((this: BatteryManager, ev: Event) => void) | null;
  onchargingtimechange: ((this: BatteryManager, ev: Event) => void) | null;
  ondischargingtimechange: ((this: BatteryManager, ev: Event) => void) | null;
  onlevelchange: ((this: BatteryManager, ev: Event) => void) | null;
}

interface Navigator {
  /** Network Information API */
  readonly connection?: NetworkInformation;
  /** Mozilla-prefixed Network Information API */
  readonly mozConnection?: NetworkInformation;
  /** WebKit-prefixed Network Information API */
  readonly webkitConnection?: NetworkInformation;
  /** User-Agent Client Hints API */
  readonly userAgentData?: NavigatorUAData;
  /** Device Memory API (experimental) - returns device memory in GB */
  readonly deviceMemory?: number;
  /** Battery Status API (experimental) */
  getBattery?(): Promise<BatteryManager>;
  /** Mock platform for testing (non-standard) */
  mockPlatform?: 'desktop' | 'mobile' | 'tablet' | 'embedded';
}

// =============================================================================
// GLOBALTHIS EXTENSION - Test Environment Detection
// =============================================================================

/**
 * Vitest globals for test environment detection
 * These are defined when running in Vitest test environment
 */
declare global {
  // Test framework globals - only present in test environment
  var vi: unknown | undefined;
  var describe: unknown | undefined;
  var it: unknown | undefined;
  var expect: unknown | undefined;
  var test: unknown | undefined;
  var beforeEach: unknown | undefined;
  var afterEach: unknown | undefined;
  var beforeAll: unknown | undefined;
  var afterAll: unknown | undefined;
}

// Ensure this file is treated as a module for the declare global to work
export {};
