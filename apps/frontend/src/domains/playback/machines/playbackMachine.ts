/**
 * PlaybackEngine State Machine (XState v5)
 *
 * Phase 1: Shadow mode implementation alongside existing PlaybackEngine
 *
 * This machine formalizes the 7-state playback lifecycle:
 * idle -> loading -> ready -> playing <-> paused -> stopped
 *
 * Benefits:
 * - Compile-time transition validation
 * - Visual state diagram via Stately
 * - Built-in async handling for initialization
 * - Testable state transitions
 */

import { setup, assign, fromPromise } from 'xstate';
import type { EventBus } from '../services/core/EventBus.js';
import { musicalTruth } from '../modules/tempo/MusicalTruthAuthority.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Track structure (mirrors PlaybackEngine.Track)
 */
export interface MachineTrack {
  id: string;
  name: string;
  instrumentType: string;
  regions: MachineRegion[];
  exerciseId?: string;
}

/**
 * Region structure (mirrors PlaybackEngine.Region)
 */
export interface MachineRegion {
  id: string;
  trackId: string;
  startTime: number;
  duration: number;
  skipCountdownOffset?: boolean;
  pattern?: {
    id?: string;
    name?: string;
    type?: string;
    events?: MachinePatternEvent[];
  };
}

/**
 * Pattern event structure
 */
export interface MachinePatternEvent {
  position: string;
  type: string;
  velocity?: number;
  duration?: string;
  midiNote?: number;
  noteName?: string;
}

/**
 * Playback state type (matches existing PlaybackState)
 */
export type PlaybackStateValue =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'starting'
  | 'playing'
  | 'paused'
  | 'stopping'
  | 'stopped'
  | 'error'
  | 'disposing';

/**
 * Machine context - all data the machine operates on
 */
export interface PlaybackMachineContext {
  // Instance identification
  instanceId: string;

  // Audio infrastructure
  audioContext: AudioContext | null;
  audioDestination: AudioNode | null;
  sampleRate: number;

  // Track management
  tracks: Map<string, MachineTrack>;

  // Configuration
  countdownBeats: number;
  countdownEnabled: boolean;
  lookAheadTime: number;
  currentTempo: number;

  // Timing
  transportStartTime: number;

  // Error handling
  error: Error | null;
  lastErrorStep: string | null;

  // External dependencies (injected)
  eventBus: EventBus | null;

  // Scheduling state
  scheduledIds: Set<number>;
  scheduledEvents: Map<string, Set<string>>;

  // Harmony instrument (for dynamic switching)
  currentHarmonyInstrument: string | null;
}

/**
 * All possible events the machine can receive
 */
export type PlaybackMachineEvent =
  | { type: 'INITIALIZE'; audioContext: AudioContext; audioDestination: AudioNode }
  | { type: 'START' }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'STOP' }
  | { type: 'DISPOSE' }
  | { type: 'REGISTER_TRACK'; track: MachineTrack }
  | { type: 'UNREGISTER_TRACK'; trackId: string }
  | { type: 'UPDATE_TRACKS'; tracks: MachineTrack[]; harmonyInstrument?: string }
  | { type: 'SET_TEMPO'; bpm: number }
  | { type: 'SET_COUNTDOWN'; beats: number; enabled: boolean }
  | { type: 'ERROR'; error: Error; step?: string }
  | { type: 'RETRY' }
  | { type: 'FORCE_READY' }; // For recovery scenarios

/**
 * Input provided when creating the machine
 */
export interface PlaybackMachineInput {
  eventBus?: EventBus;
  instanceId?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

function generateInstanceId(): string {
  return `pb-${Math.random().toString(36).substring(2, 11)}`;
}

// ============================================================================
// Machine Definition
// ============================================================================

export const playbackMachine = setup({
  types: {
    context: {} as PlaybackMachineContext,
    events: {} as PlaybackMachineEvent,
    input: {} as PlaybackMachineInput,
  },

  // -------------------------------------------------------------------------
  // Guards - Conditions for transitions
  // -------------------------------------------------------------------------
  guards: {
    hasAudioContext: ({ context }) => context.audioContext !== null,
    hasTracks: ({ context }) => context.tracks.size > 0,
    isRecoverable: ({ context }) => {
      // Error is recoverable if we still have audio context
      return context.audioContext !== null;
    },
    hasEventBus: ({ context }) => context.eventBus !== null,
  },

  // -------------------------------------------------------------------------
  // Actions - Synchronous side effects
  // -------------------------------------------------------------------------
  actions: {
    // Context mutations
    setAudioContext: assign({
      audioContext: ({ event }) => {
        if (event.type === 'INITIALIZE') return event.audioContext;
        return null;
      },
      audioDestination: ({ event }) => {
        if (event.type === 'INITIALIZE') return event.audioDestination;
        return null;
      },
      sampleRate: ({ event }) => {
        if (event.type === 'INITIALIZE') return event.audioContext.sampleRate;
        return 44100;
      },
    }),

    setError: assign({
      error: ({ event }) => {
        if (event.type === 'ERROR') return event.error;
        return null;
      },
      lastErrorStep: ({ event }) => {
        if (event.type === 'ERROR') return event.step ?? 'unknown';
        return null;
      },
    }),

    clearError: assign({
      error: () => null,
      lastErrorStep: () => null,
    }),

    registerTrack: assign({
      tracks: ({ context, event }) => {
        if (event.type !== 'REGISTER_TRACK') return context.tracks;

        const newTracks = new Map(context.tracks);
        const track = event.track;

        // Handle singleton instrument types
        const singletonTypes = ['metronome', 'voice-cue'];
        if (track.instrumentType && singletonTypes.includes(track.instrumentType)) {
          // Remove existing track of same type
          const entries = Array.from(newTracks.entries());
          for (const [id, existingTrack] of entries) {
            if (existingTrack.instrumentType === track.instrumentType && id !== track.id) {
              newTracks.delete(id);
              break;
            }
          }
        }

        newTracks.set(track.id, track);
        return newTracks;
      },
    }),

    unregisterTrack: assign({
      tracks: ({ context, event }) => {
        if (event.type !== 'UNREGISTER_TRACK') return context.tracks;
        const newTracks = new Map(context.tracks);
        newTracks.delete(event.trackId);
        return newTracks;
      },
    }),

    updateTracks: assign({
      tracks: ({ context, event }) => {
        if (event.type !== 'UPDATE_TRACKS') return context.tracks;

        const newTracks = new Map(context.tracks);

        // Update or add new tracks
        for (const track of event.tracks) {
          newTracks.set(track.id, track);
        }

        return newTracks;
      },
      currentHarmonyInstrument: ({ context, event }) => {
        if (event.type !== 'UPDATE_TRACKS') return context.currentHarmonyInstrument;
        return event.harmonyInstrument ?? context.currentHarmonyInstrument;
      },
    }),

    setTempo: assign({
      currentTempo: ({ context, event }) => {
        if (event.type === 'SET_TEMPO') return event.bpm;
        return context.currentTempo;
      },
    }),

    setCountdown: assign({
      countdownBeats: ({ context, event }) => {
        if (event.type === 'SET_COUNTDOWN') return event.beats;
        return context.countdownBeats;
      },
      countdownEnabled: ({ context, event }) => {
        if (event.type === 'SET_COUNTDOWN') return event.enabled;
        return context.countdownEnabled;
      },
    }),

    captureTransportStartTime: assign({
      transportStartTime: ({ context }) => {
        if (!context.audioContext) return 0;
        const STARTUP_LOOKAHEAD = 0.1; // 100ms
        return context.audioContext.currentTime + STARTUP_LOOKAHEAD;
      },
    }),

    clearScheduledState: assign({
      scheduledIds: () => new Set<number>(),
      scheduledEvents: () => new Map<string, Set<string>>(),
      transportStartTime: () => 0,
    }),

    resetContext: assign({
      audioContext: () => null,
      audioDestination: () => null,
      tracks: () => new Map<string, MachineTrack>(),
      error: () => null,
      lastErrorStep: () => null,
      scheduledIds: () => new Set<number>(),
      scheduledEvents: () => new Map<string, Set<string>>(),
      transportStartTime: () => 0,
    }),

    // Event emissions (via EventBus)
    emitStateChange: ({ context }, params: { oldState: string; newState: string }) => {
      if (context.eventBus) {
        context.eventBus.emit('playback:state-change', {
          oldState: params.oldState,
          newState: params.newState,
          instanceId: context.instanceId,
          source: 'xstate', // Mark as coming from XState
        });
      }
    },

    emitStarting: ({ context }) => {
      if (context.eventBus) {
        // Calculate countdown duration for visual beat indicators
        const countdownBeats = musicalTruth.getCountdownBeats();
        const bpm = musicalTruth.getBPM();
        const countdownDurationMs = (countdownBeats / bpm) * 60 * 1000;

        context.eventBus.emit('playback:starting', {
          instanceId: context.instanceId,
          position: 0,
          timestamp: Date.now(),
          countdownDurationMs, // For jitter-free visual beat calculation
          source: 'xstate',
        });
      }
    },

    emitStart: ({ context }) => {
      if (context.eventBus) {
        context.eventBus.emit('playback:start', {
          instanceId: context.instanceId,
          source: 'xstate',
        });
      }
    },

    emitPause: ({ context }) => {
      if (context.eventBus) {
        context.eventBus.emit('playback:pause', {
          instanceId: context.instanceId,
          source: 'xstate',
        });
      }
    },

    emitResume: ({ context }) => {
      if (context.eventBus) {
        context.eventBus.emit('playback:resume', {
          instanceId: context.instanceId,
          source: 'xstate',
        });
      }
    },

    emitStop: ({ context }) => {
      if (context.eventBus) {
        context.eventBus.emit('playback:stop', {
          instanceId: context.instanceId,
          source: 'xstate',
        });
      }
    },

    emitTransportStartTime: ({ context }) => {
      if (context.eventBus) {
        context.eventBus.emit('playback:transportStartTime', {
          transportStartTime: context.transportStartTime,
          source: 'xstate',
        });
      }
    },

    emitTempoChange: ({ context }) => {
      if (context.eventBus) {
        context.eventBus.emit('playback:tempo-change', {
          bpm: context.currentTempo,
          instanceId: context.instanceId,
          source: 'xstate',
        });
      }
    },

    // Logging
    logTransition: (_, params: { from: string; to: string }) => {
      console.log(`[PlaybackMachine] ${params.from} -> ${params.to}`);
    },

    logError: ({ context }) => {
      console.error('[PlaybackMachine] Error:', {
        error: context.error?.message,
        step: context.lastErrorStep,
        instanceId: context.instanceId,
      });
    },
  },

  // -------------------------------------------------------------------------
  // Actors - Async operations
  // -------------------------------------------------------------------------
  actors: {
    // Initialize audio infrastructure
    initializeAudio: fromPromise<void, { context: PlaybackMachineContext }>(async ({ input }) => {
      const { context } = input;

      console.log('[PlaybackMachine] Initializing audio infrastructure...', {
        instanceId: context.instanceId,
        sampleRate: context.sampleRate,
      });

      // In shadow mode, we don't actually initialize - the real PlaybackEngine does
      // This is a placeholder for when we fully migrate
      await new Promise((resolve) => setTimeout(resolve, 50));

      console.log('[PlaybackMachine] Audio infrastructure ready');
    }),

    // Schedule all regions
    scheduleRegions: fromPromise<void, { context: PlaybackMachineContext }>(async ({ input }) => {
      const { context } = input;

      console.log('[PlaybackMachine] Scheduling regions...', {
        tracksCount: context.tracks.size,
        transportStartTime: context.transportStartTime,
      });

      // In shadow mode, we don't actually schedule - the real PlaybackEngine does
      await new Promise((resolve) => setTimeout(resolve, 25));

      console.log('[PlaybackMachine] Regions scheduled');
    }),

    // Stop all audio
    stopAudio: fromPromise<void, { context: PlaybackMachineContext }>(async () => {
      console.log('[PlaybackMachine] Stopping audio...');

      // In shadow mode, we don't actually stop - the real PlaybackEngine does
      await new Promise((resolve) => setTimeout(resolve, 10));

      console.log('[PlaybackMachine] Audio stopped');
    }),

    // Dispose resources
    disposeResources: fromPromise<void, { context: PlaybackMachineContext }>(async () => {
      console.log('[PlaybackMachine] Disposing resources...');

      await new Promise((resolve) => setTimeout(resolve, 10));

      console.log('[PlaybackMachine] Resources disposed');
    }),
  },
}).createMachine({
  id: 'playback',
  initial: 'idle',

  context: ({ input }) => ({
    instanceId: input?.instanceId ?? generateInstanceId(),
    audioContext: null,
    audioDestination: null,
    sampleRate: 44100,
    tracks: new Map(),
    countdownBeats: 4,
    countdownEnabled: false,
    lookAheadTime: 0.1,
    currentTempo: 120,
    transportStartTime: 0,
    error: null,
    lastErrorStep: null,
    eventBus: input?.eventBus ?? null,
    scheduledIds: new Set(),
    scheduledEvents: new Map(),
    currentHarmonyInstrument: null,
  }),

  states: {
    // =========================================================================
    // IDLE - Not initialized
    // =========================================================================
    idle: {
      on: {
        INITIALIZE: {
          target: 'loading',
          actions: [
            'setAudioContext',
            { type: 'logTransition', params: { from: 'idle', to: 'loading' } },
          ],
        },
        // FIX: Ignore STOP in idle state (nothing to stop, stay idle)
        // Prevents XState shadow mode mismatch if stop() called before initialization
        STOP: {
          // Stay in idle, do nothing
        },
      },
    },

    // =========================================================================
    // LOADING - Initializing audio infrastructure
    // =========================================================================
    loading: {
      entry: [{ type: 'emitStateChange', params: { oldState: 'idle', newState: 'loading' } }],

      invoke: {
        id: 'initializeAudio',
        src: 'initializeAudio',
        input: ({ context }) => ({ context }),
        onDone: {
          target: 'ready',
          actions: [{ type: 'logTransition', params: { from: 'loading', to: 'ready' } }],
        },
        onError: {
          target: 'error',
          actions: [
            {
              type: 'setError',
              params: ({ event }: { event: { error: Error } }) => ({
                error: event.error,
                step: 'initialize',
              }),
            },
            { type: 'logTransition', params: { from: 'loading', to: 'error' } },
          ],
        },
      },

      on: {
        // FIX: Ignore STOP during loading (nothing playing yet, stay loading)
        // Prevents XState shadow mode mismatch if stop() called during initialization
        STOP: {
          // Stay in loading, do nothing - will complete initialization normally
        },
      },
    },

    // =========================================================================
    // READY - Initialized and ready to play
    // =========================================================================
    ready: {
      entry: [{ type: 'emitStateChange', params: { oldState: 'loading', newState: 'ready' } }],

      on: {
        START: {
          target: 'starting',
          guard: 'hasAudioContext',
          actions: [
            'clearScheduledState',
            'captureTransportStartTime',
            'emitTransportStartTime',
            'emitStarting',
            { type: 'logTransition', params: { from: 'ready', to: 'starting' } },
          ],
        },
        // FIX: Allow STOP in ready state to transition to stopped
        // This fixes XState shadow mode mismatch when stop() is called before playback starts
        STOP: {
          target: 'stopped',
          actions: [
            'emitStop',
            { type: 'logTransition', params: { from: 'ready', to: 'stopped' } },
          ],
        },
        REGISTER_TRACK: {
          actions: 'registerTrack',
        },
        UNREGISTER_TRACK: {
          actions: 'unregisterTrack',
        },
        UPDATE_TRACKS: {
          actions: 'updateTracks',
        },
        SET_TEMPO: {
          actions: ['setTempo', 'emitTempoChange'],
        },
        SET_COUNTDOWN: {
          actions: 'setCountdown',
        },
        DISPOSE: {
          target: 'disposing',
        },
      },
    },

    // =========================================================================
    // STARTING - Scheduling regions (async)
    // =========================================================================
    starting: {
      invoke: {
        id: 'scheduleRegions',
        src: 'scheduleRegions',
        input: ({ context }) => ({ context }),
        onDone: {
          target: 'playing',
          actions: [
            'emitStart',
            { type: 'logTransition', params: { from: 'starting', to: 'playing' } },
          ],
        },
        onError: {
          target: 'error',
          actions: [
            {
              type: 'setError',
              params: ({ event }: { event: { error: Error } }) => ({
                error: event.error,
                step: 'schedule',
              }),
            },
            { type: 'logTransition', params: { from: 'starting', to: 'error' } },
          ],
        },
      },

      on: {
        STOP: {
          target: 'stopping',
          actions: [{ type: 'logTransition', params: { from: 'starting', to: 'stopping' } }],
        },
      },
    },

    // =========================================================================
    // PLAYING - Actively playing audio
    // =========================================================================
    playing: {
      entry: [{ type: 'emitStateChange', params: { oldState: 'ready', newState: 'playing' } }],

      on: {
        PAUSE: {
          target: 'paused',
          actions: [
            'emitPause',
            { type: 'logTransition', params: { from: 'playing', to: 'paused' } },
          ],
        },
        STOP: {
          target: 'stopping',
          actions: [{ type: 'logTransition', params: { from: 'playing', to: 'stopping' } }],
        },
        SET_TEMPO: {
          actions: ['setTempo', 'emitTempoChange'],
        },
        REGISTER_TRACK: {
          actions: 'registerTrack',
          // Could trigger rescheduling for new track
        },
        UPDATE_TRACKS: {
          actions: 'updateTracks',
        },
      },
    },

    // =========================================================================
    // PAUSED - Playback paused
    // =========================================================================
    paused: {
      entry: [{ type: 'emitStateChange', params: { oldState: 'playing', newState: 'paused' } }],

      on: {
        RESUME: {
          target: 'playing',
          actions: [
            'emitResume',
            { type: 'logTransition', params: { from: 'paused', to: 'playing' } },
          ],
        },
        STOP: {
          target: 'stopping',
          actions: [{ type: 'logTransition', params: { from: 'paused', to: 'stopping' } }],
        },
      },
    },

    // =========================================================================
    // STOPPING - Stopping playback (async cleanup)
    // =========================================================================
    stopping: {
      invoke: {
        id: 'stopAudio',
        src: 'stopAudio',
        input: ({ context }) => ({ context }),
        onDone: {
          target: 'stopped',
          actions: [
            'clearScheduledState',
            'emitStop',
            { type: 'logTransition', params: { from: 'stopping', to: 'stopped' } },
          ],
        },
        onError: {
          // Even if stop fails, go to stopped state
          target: 'stopped',
          actions: [
            'clearScheduledState',
            { type: 'logTransition', params: { from: 'stopping', to: 'stopped' } },
          ],
        },
      },
    },

    // =========================================================================
    // STOPPED - Playback stopped
    // =========================================================================
    stopped: {
      entry: [{ type: 'emitStateChange', params: { oldState: 'playing', newState: 'stopped' } }],

      on: {
        START: {
          target: 'starting',
          guard: 'hasAudioContext',
          actions: [
            'clearScheduledState',
            'captureTransportStartTime',
            'emitTransportStartTime',
            'emitStarting',
            { type: 'logTransition', params: { from: 'stopped', to: 'starting' } },
          ],
        },
        REGISTER_TRACK: {
          actions: 'registerTrack',
        },
        UNREGISTER_TRACK: {
          actions: 'unregisterTrack',
        },
        UPDATE_TRACKS: {
          actions: 'updateTracks',
        },
        SET_TEMPO: {
          actions: ['setTempo', 'emitTempoChange'],
        },
        SET_COUNTDOWN: {
          actions: 'setCountdown',
        },
        DISPOSE: {
          target: 'disposing',
        },
        // Allow transitioning back to ready state
        FORCE_READY: {
          target: 'ready',
          actions: [{ type: 'logTransition', params: { from: 'stopped', to: 'ready' } }],
        },
      },
    },

    // =========================================================================
    // ERROR - Something went wrong
    // =========================================================================
    error: {
      entry: ['logError', { type: 'emitStateChange', params: { oldState: '*', newState: 'error' } }],

      on: {
        RETRY: [
          {
            guard: 'isRecoverable',
            target: 'loading',
            actions: [
              'clearError',
              { type: 'logTransition', params: { from: 'error', to: 'loading' } },
            ],
          },
          {
            // Not recoverable, stay in error
            target: 'error',
          },
        ],
        DISPOSE: {
          target: 'disposing',
        },
      },
    },

    // =========================================================================
    // DISPOSING - Cleaning up resources
    // =========================================================================
    disposing: {
      invoke: {
        id: 'disposeResources',
        src: 'disposeResources',
        input: ({ context }) => ({ context }),
        onDone: {
          target: 'idle',
          actions: [
            'resetContext',
            { type: 'logTransition', params: { from: 'disposing', to: 'idle' } },
          ],
        },
        onError: {
          // Even if dispose fails, go to idle
          target: 'idle',
          actions: [
            'resetContext',
            { type: 'logTransition', params: { from: 'disposing', to: 'idle' } },
          ],
        },
      },
    },
  },
});

// ============================================================================
// Type Exports
// ============================================================================

export type PlaybackMachine = typeof playbackMachine;
export type PlaybackMachineState = ReturnType<typeof playbackMachine.transition>;
