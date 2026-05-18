/**
 * Page Initialization State Machine (XState v5)
 *
 * Phase 1: Shadow mode implementation
 *
 * Manages the complex initialization flow for YouTubeWidgetPage:
 * idle -> preInitializing -> downloadingSamples -> awaitingUserGesture
 *      -> initializingAudio -> injectingBuffers -> ready
 *
 * Benefits:
 * - Eliminates race conditions between scroll trigger and play button
 * - Centralizes error handling with recovery paths
 * - Provides loading progress for UI feedback
 * - Makes AudioContext user-gesture requirement explicit
 */

import { setup, assign, fromPromise } from 'xstate';

// ============================================================================
// Types
// ============================================================================

/**
 * Tutorial data structure
 */
export interface TutorialData {
  id: string;
  title: string;
  slug: string;
  // Add other fields as needed
}

/**
 * Exercise data structure
 */
export interface ExerciseData {
  id: string;
  name: string;
  tutorialId: string;
  // Add other fields as needed
}

/**
 * Error record for tracking initialization failures
 */
export interface InitializationError {
  step: string;
  message: string;
  timestamp: number;
  recoverable: boolean;
}

/**
 * Machine context
 */
export interface PageInitContext {
  // Dependencies loaded
  toneLoaded: boolean;
  coreServicesPreInitialized: boolean;
  coreServicesInitialized: boolean;
  audioContextReady: boolean;

  // Sample loading
  samplesDownloaded: boolean;
  samplesDecoded: boolean;
  buffersInjected: boolean;

  // Data dependencies
  tutorialData: TutorialData | null;
  exercises: ExerciseData[] | null;
  selectedExerciseId: string | null;

  // Transport
  transportReady: boolean;

  // Errors
  errors: InitializationError[];

  // Retry tracking
  retryCount: number;
  maxRetries: number;

  // User gesture tracking
  userGestureReceived: boolean;

  // Progress tracking (0-100)
  progress: number;
  currentStep: string;
}

/**
 * Machine events
 */
export type PageInitEvent =
  | { type: 'SCROLL_DETECTED' }
  | { type: 'USER_GESTURE' }
  | { type: 'TONE_LOADED' }
  | { type: 'CORE_SERVICES_PRE_INIT_COMPLETE' }
  | { type: 'PLUGINS_REGISTERED' }
  | { type: 'SAMPLES_DOWNLOADED' }
  | { type: 'AUDIO_CONTEXT_READY' }
  | { type: 'CORE_SERVICES_INIT_COMPLETE' }
  | { type: 'BUFFERS_INJECTED' }
  | { type: 'TRANSPORT_READY' }
  | { type: 'EXERCISE_SELECTED'; exerciseId: string }
  | {
      type: 'SET_TUTORIAL_DATA';
      tutorial: TutorialData;
      exercises: ExerciseData[];
    }
  | { type: 'ERROR'; step: string; message: string; recoverable: boolean }
  | { type: 'RETRY' }
  | { type: 'DISPOSE' };

/**
 * Machine input
 */
export interface PageInitInput {
  tutorial?: TutorialData;
  exercises?: ExerciseData[];
  maxRetries?: number;
}

// ============================================================================
// Machine Definition
// ============================================================================

export const pageInitializationMachine = setup({
  types: {
    context: {} as PageInitContext,
    events: {} as PageInitEvent,
    input: {} as PageInitInput,
  },

  // -------------------------------------------------------------------------
  // Guards
  // -------------------------------------------------------------------------
  guards: {
    canRetry: ({ context }) => context.retryCount < context.maxRetries,
    hasUserGesture: ({ context }) => context.userGestureReceived,
    hasTutorialData: ({ context }) => context.tutorialData !== null,
    hasExercises: ({ context }) => (context.exercises?.length ?? 0) > 0,
    isSamplesReady: ({ context }) => context.samplesDownloaded,
  },

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------
  actions: {
    // Error handling
    recordError: assign({
      errors: ({ context, event }) => {
        if (event.type !== 'ERROR') return context.errors;
        return [
          ...context.errors,
          {
            step: event.step,
            message: event.message,
            timestamp: Date.now(),
            recoverable: event.recoverable,
          },
        ];
      },
    }),

    incrementRetry: assign({
      retryCount: ({ context }) => context.retryCount + 1,
    }),

    resetRetryCount: assign({
      retryCount: () => 0,
    }),

    // State updates
    markToneLoaded: assign({ toneLoaded: () => true }),
    markCoreServicesPreInit: assign({ coreServicesPreInitialized: () => true }),
    markCoreServicesInit: assign({ coreServicesInitialized: () => true }),
    markAudioContextReady: assign({ audioContextReady: () => true }),
    markSamplesDownloaded: assign({ samplesDownloaded: () => true }),
    markSamplesDecoded: assign({ samplesDecoded: () => true }),
    markBuffersInjected: assign({ buffersInjected: () => true }),
    markTransportReady: assign({ transportReady: () => true }),
    markUserGesture: assign({ userGestureReceived: () => true }),

    setTutorialData: assign({
      tutorialData: ({ event }) => {
        if (event.type === 'SET_TUTORIAL_DATA') return event.tutorial;
        return null;
      },
      exercises: ({ event }) => {
        if (event.type === 'SET_TUTORIAL_DATA') return event.exercises;
        return null;
      },
    }),

    setSelectedExercise: assign({
      selectedExerciseId: ({ event }) =>
        event.type === 'EXERCISE_SELECTED' ? event.exerciseId : null,
    }),

    // Progress updates - using inline assign with params
    setProgressIdle: assign({
      progress: () => 0,
      currentStep: () => 'Waiting to start...',
    }),
    setProgressPreInit: assign({
      progress: () => 20,
      currentStep: () => 'Loading audio engine...',
    }),
    setProgressDownloading: assign({
      progress: () => 40,
      currentStep: () => 'Downloading samples...',
    }),
    setProgressAwaitingGesture: assign({
      progress: () => 60,
      currentStep: () => 'Ready! Click play to start',
    }),
    setProgressInitAudio: assign({
      progress: () => 80,
      currentStep: () => 'Initializing audio...',
    }),
    setProgressInjectingBuffers: assign({
      progress: () => 90,
      currentStep: () => 'Preparing instruments...',
    }),
    setProgressReady: assign({
      progress: () => 100,
      currentStep: () => 'Ready to play!',
    }),
    setProgressLoadingExercise: assign({
      progress: () => 95,
      currentStep: () => 'Loading exercise...',
    }),

    // Logging
    logTransition: (_, params: { from: string; to: string }) => {
      console.log(`[PageInit] ${params.from} -> ${params.to}`);
    },

    logError: ({ context }) => {
      const lastError = context.errors[context.errors.length - 1];
      console.error('[PageInit] Error:', lastError);
    },

    // Event dispatching (for integration with existing code)
    dispatchPageInitReady: () => {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('pageInitReady', {
            detail: { awaitingGesture: true },
          }),
        );
      }
    },

    dispatchPageInitComplete: () => {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('pageInitComplete', {
            detail: { ready: true, timestamp: Date.now() },
          }),
        );
      }
    },

    dispatchPageInitError: ({ context }) => {
      if (typeof window !== 'undefined') {
        const lastError = context.errors[context.errors.length - 1];
        window.dispatchEvent(
          new CustomEvent('pageInitError', {
            detail: { error: lastError, canRetry: lastError?.recoverable },
          }),
        );
      }
    },

    dispatchPageInitFailed: () => {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('pageInitFailed', {
            detail: {
              message: 'Audio initialization failed after maximum retries',
            },
          }),
        );
      }
    },
  },

  // -------------------------------------------------------------------------
  // Actors (async services)
  // -------------------------------------------------------------------------
  actors: {
    // Pre-initialize CoreServices (loads Tone.js, registers plugins)
    preInitializeCoreServices: fromPromise<void, { context: PageInitContext }>(
      async () => {
        console.log('[PageInit] Pre-initializing CoreServices...');

        // In shadow mode, we check if the real initialization happened
        // The actual initialization is done by existing code
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Check if Tone.js is loaded
        if (typeof window !== 'undefined') {
          const tone = window.Tone || window.__globalTone;
          if (!tone) {
            console.log('[PageInit] Waiting for Tone.js to load...');
            // Wait for Tone.js (with timeout)
            await new Promise<void>((resolve, reject) => {
              const timeout = setTimeout(() => {
                reject(new Error('Tone.js load timeout'));
              }, 10000);

              const check = () => {
                const t = window.Tone || window.__globalTone;
                if (t) {
                  clearTimeout(timeout);
                  resolve();
                } else {
                  setTimeout(check, 100);
                }
              };
              check();
            });
          }
        }

        console.log('[PageInit] CoreServices pre-initialized');
      },
    ),

    // Download and cache samples
    downloadSamples: fromPromise<void, { context: PageInitContext }>(
      async () => {
        console.log('[PageInit] Downloading samples...');

        // In shadow mode, check if samples are ready
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Check for samplesReady flag
        if (typeof window !== 'undefined') {
          const samplesReady = window.__samplesReady;
          if (!samplesReady) {
            console.log('[PageInit] Waiting for samples to be ready...');
            // Wait for samples (with timeout)
            await new Promise<void>((resolve) => {
              const handler = () => {
                resolve();
              };
              window.addEventListener('samplesReady', handler, { once: true });

              // Check if already ready
              if (window.__samplesReady) {
                window.removeEventListener('samplesReady', handler);
                resolve();
              }

              // Timeout fallback
              setTimeout(() => {
                window.removeEventListener('samplesReady', handler);
                resolve(); // Continue anyway
              }, 30000);
            });
          }
        }

        console.log('[PageInit] Samples downloaded');
      },
    ),

    // Initialize CoreServices (creates AudioContext - requires user gesture)
    initializeCoreServices: fromPromise<void, { context: PageInitContext }>(
      async () => {
        console.log('[PageInit] Initializing CoreServices (AudioContext)...');

        // In shadow mode, check if CoreServices is initialized
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Check for audioServicesReady
        if (typeof window !== 'undefined') {
          const coreServices = window.__globalCoreServices as
            | { isInitialized?: () => boolean }
            | undefined;
          if (!coreServices?.isInitialized?.()) {
            console.log(
              '[PageInit] Waiting for CoreServices initialization...',
            );
            await new Promise<void>((resolve) => {
              const handler = () => {
                resolve();
              };
              window.addEventListener('audioServicesReady', handler, {
                once: true,
              });
              window.addEventListener('core-services:initialized', handler, {
                once: true,
              });

              // Check if already ready
              const cs = window.__globalCoreServices as
                | { isInitialized?: () => boolean }
                | undefined;
              if (cs?.isInitialized?.()) {
                window.removeEventListener('audioServicesReady', handler);
                window.removeEventListener(
                  'core-services:initialized',
                  handler,
                );
                resolve();
              }

              // Timeout fallback
              setTimeout(() => {
                window.removeEventListener('audioServicesReady', handler);
                window.removeEventListener(
                  'core-services:initialized',
                  handler,
                );
                resolve(); // Continue anyway
              }, 10000);
            });
          }
        }

        console.log('[PageInit] CoreServices initialized');
      },
    ),

    // Inject buffers into PlaybackEngine
    injectBuffers: fromPromise<void, { context: PageInitContext }>(async () => {
      console.log('[PageInit] Injecting buffers...');

      // In shadow mode, this is handled by existing code
      await new Promise((resolve) => setTimeout(resolve, 50));

      console.log('[PageInit] Buffers injected');
    }),

    // Load exercise-specific samples
    loadExerciseSamples: fromPromise<void, { exercise: ExerciseData | null }>(
      async ({ input }) => {
        if (!input.exercise) {
          console.log('[PageInit] No exercise to load samples for');
          return;
        }

        console.log('[PageInit] Loading exercise samples...', {
          exerciseId: input.exercise.id,
        });

        // In shadow mode, this is handled by existing code
        await new Promise((resolve) => setTimeout(resolve, 100));

        console.log('[PageInit] Exercise samples loaded');
      },
    ),

    // Dispose resources
    disposeResources: fromPromise<void, { context: PageInitContext }>(
      async () => {
        console.log('[PageInit] Disposing resources...');
        await new Promise((resolve) => setTimeout(resolve, 50));
        console.log('[PageInit] Resources disposed');
      },
    ),
  },
}).createMachine({
  id: 'pageInitialization',
  initial: 'idle',

  context: ({ input }) => ({
    toneLoaded: false,
    coreServicesPreInitialized: false,
    coreServicesInitialized: false,
    audioContextReady: false,
    samplesDownloaded: false,
    samplesDecoded: false,
    buffersInjected: false,
    tutorialData: input?.tutorial ?? null,
    exercises: input?.exercises ?? null,
    selectedExerciseId: null,
    transportReady: false,
    errors: [],
    retryCount: 0,
    maxRetries: input?.maxRetries ?? 3,
    userGestureReceived: false,
    progress: 0,
    currentStep: 'Waiting to start...',
  }),

  states: {
    // =========================================================================
    // IDLE - Waiting for scroll or user gesture
    // =========================================================================
    idle: {
      entry: ['setProgressIdle'],

      on: {
        SCROLL_DETECTED: {
          target: 'preInitializing',
          actions: [
            {
              type: 'logTransition',
              params: { from: 'idle', to: 'preInitializing' },
            },
          ],
        },
        USER_GESTURE: {
          target: 'preInitializing',
          actions: [
            'markUserGesture',
            {
              type: 'logTransition',
              params: { from: 'idle', to: 'preInitializing' },
            },
          ],
        },
        SET_TUTORIAL_DATA: {
          actions: 'setTutorialData',
        },
      },
    },

    // =========================================================================
    // PRE-INITIALIZING - Loading Tone.js and registering plugins
    // =========================================================================
    preInitializing: {
      entry: ['setProgressPreInit'],

      invoke: {
        src: 'preInitializeCoreServices',
        input: ({ context }) => ({ context }),
        onDone: {
          target: 'downloadingSamples',
          actions: [
            'markToneLoaded',
            'markCoreServicesPreInit',
            {
              type: 'logTransition',
              params: { from: 'preInitializing', to: 'downloadingSamples' },
            },
          ],
        },
        onError: {
          target: 'error',
          actions: [
            {
              type: 'recordError',
              params: {
                step: 'preInitialize',
                message: 'Failed to load audio engine',
                recoverable: true,
              },
            },
            {
              type: 'logTransition',
              params: { from: 'preInitializing', to: 'error' },
            },
          ],
        },
      },

      on: {
        USER_GESTURE: {
          actions: 'markUserGesture',
        },
        SET_TUTORIAL_DATA: {
          actions: 'setTutorialData',
        },
      },
    },

    // =========================================================================
    // DOWNLOADING SAMPLES - Fetching audio samples
    // =========================================================================
    downloadingSamples: {
      entry: ['setProgressDownloading'],

      invoke: {
        src: 'downloadSamples',
        input: ({ context }) => ({ context }),
        onDone: {
          target: 'awaitingUserGesture',
          actions: [
            'markSamplesDownloaded',
            {
              type: 'logTransition',
              params: { from: 'downloadingSamples', to: 'awaitingUserGesture' },
            },
          ],
        },
        onError: {
          target: 'error',
          actions: [
            {
              type: 'recordError',
              params: {
                step: 'downloadSamples',
                message: 'Failed to download samples',
                recoverable: true,
              },
            },
            {
              type: 'logTransition',
              params: { from: 'downloadingSamples', to: 'error' },
            },
          ],
        },
      },

      on: {
        USER_GESTURE: {
          actions: 'markUserGesture',
        },
        SET_TUTORIAL_DATA: {
          actions: 'setTutorialData',
        },
      },
    },

    // =========================================================================
    // AWAITING USER GESTURE - Ready, waiting for click
    // =========================================================================
    awaitingUserGesture: {
      entry: ['setProgressAwaitingGesture', 'dispatchPageInitReady'],

      on: {
        USER_GESTURE: {
          target: 'initializingAudio',
          actions: [
            'markUserGesture',
            {
              type: 'logTransition',
              params: { from: 'awaitingUserGesture', to: 'initializingAudio' },
            },
          ],
        },
        SET_TUTORIAL_DATA: {
          actions: 'setTutorialData',
        },
      },

      // Auto-transition if we already have a gesture
      always: {
        guard: 'hasUserGesture',
        target: 'initializingAudio',
      },
    },

    // =========================================================================
    // INITIALIZING AUDIO - Creating AudioContext
    // =========================================================================
    initializingAudio: {
      entry: ['setProgressInitAudio'],

      invoke: {
        src: 'initializeCoreServices',
        input: ({ context }) => ({ context }),
        onDone: {
          target: 'injectingBuffers',
          actions: [
            'markAudioContextReady',
            'markCoreServicesInit',
            {
              type: 'logTransition',
              params: { from: 'initializingAudio', to: 'injectingBuffers' },
            },
          ],
        },
        onError: {
          target: 'error',
          actions: [
            {
              type: 'recordError',
              params: {
                step: 'initializeAudio',
                message: 'Failed to create AudioContext',
                recoverable: false,
              },
            },
            {
              type: 'logTransition',
              params: { from: 'initializingAudio', to: 'error' },
            },
          ],
        },
      },
    },

    // =========================================================================
    // INJECTING BUFFERS - Decoding and injecting audio buffers
    // =========================================================================
    injectingBuffers: {
      entry: ['setProgressInjectingBuffers'],

      invoke: {
        src: 'injectBuffers',
        input: ({ context }) => ({ context }),
        onDone: {
          target: 'ready',
          actions: [
            'markBuffersInjected',
            'markTransportReady',
            {
              type: 'logTransition',
              params: { from: 'injectingBuffers', to: 'ready' },
            },
          ],
        },
        onError: {
          target: 'error',
          actions: [
            {
              type: 'recordError',
              params: {
                step: 'injectBuffers',
                message: 'Failed to prepare instruments',
                recoverable: true,
              },
            },
            {
              type: 'logTransition',
              params: { from: 'injectingBuffers', to: 'error' },
            },
          ],
        },
      },
    },

    // =========================================================================
    // READY - All systems go
    // =========================================================================
    ready: {
      entry: ['setProgressReady', 'dispatchPageInitComplete'],

      on: {
        EXERCISE_SELECTED: {
          target: 'loadingExercise',
          actions: 'setSelectedExercise',
        },
        SET_TUTORIAL_DATA: {
          actions: 'setTutorialData',
        },
        DISPOSE: {
          target: 'disposing',
        },
      },
    },

    // =========================================================================
    // LOADING EXERCISE - Loading exercise-specific samples
    // =========================================================================
    loadingExercise: {
      entry: ['setProgressLoadingExercise'],

      invoke: {
        src: 'loadExerciseSamples',
        input: ({ context }) => {
          const exercise = context.exercises?.find(
            (e) => e.id === context.selectedExerciseId,
          );
          return { exercise: exercise ?? null };
        },
        onDone: {
          target: 'ready',
          actions: [
            {
              type: 'logTransition',
              params: { from: 'loadingExercise', to: 'ready' },
            },
          ],
        },
        onError: {
          target: 'ready', // Don't fail completely, just log warning
          actions: [
            {
              type: 'recordError',
              params: {
                step: 'loadExerciseSamples',
                message: 'Failed to load exercise samples',
                recoverable: true,
              },
            },
          ],
        },
      },
    },

    // =========================================================================
    // ERROR - Something went wrong
    // =========================================================================
    error: {
      entry: ['logError', 'dispatchPageInitError'],

      on: {
        RETRY: [
          {
            guard: 'canRetry',
            target: 'preInitializing',
            actions: ['incrementRetry', 'resetRetryCount'],
          },
          {
            target: 'failed',
          },
        ],
        USER_GESTURE: {
          actions: 'markUserGesture',
        },
      },
    },

    // =========================================================================
    // FAILED - Unrecoverable failure
    // =========================================================================
    failed: {
      entry: ['dispatchPageInitFailed'],
      type: 'final',
    },

    // =========================================================================
    // DISPOSING - Cleaning up
    // =========================================================================
    disposing: {
      invoke: {
        src: 'disposeResources',
        input: ({ context }) => ({ context }),
        onDone: {
          target: 'disposed',
        },
        onError: {
          target: 'disposed',
        },
      },
    },

    // =========================================================================
    // DISPOSED - Cleanup complete
    // =========================================================================
    disposed: {
      type: 'final',
    },
  },
});

// ============================================================================
// Type Exports
// ============================================================================

export type PageInitMachine = typeof pageInitializationMachine;
export type PageInitMachineState = ReturnType<
  typeof pageInitializationMachine.transition
>;
