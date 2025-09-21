/**
 * Transport Repository Store
 *
 * Zustand store for transport state management
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { TransportState } from '../entities/index.js';
import { Tempo } from '../value-objects/index.js';
import { TransportRepository } from './TransportRepository.js';
import type { TransportPosition } from '../entities/index.js';

export interface TransportRepositoryState {
  // State
  transportState: TransportState | null;
  isLoading: boolean;
  error: Error | null;

  // Repository instance
  repository: TransportRepository;

  // Actions
  loadTransportState: () => Promise<void>;
  saveTransportState: () => Promise<void>;
  resetTransportState: () => Promise<void>;

  // Playback control
  play: () => Promise<void>;
  pause: () => Promise<void>;
  stop: () => Promise<void>;
  togglePlayPause: () => Promise<void>;

  // Recording
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;

  // Position
  updatePosition: (position: TransportPosition) => void;
  seek: (position: TransportPosition) => Promise<void>;

  // Tempo
  setTempo: (bpm: number) => Promise<void>;
  increaseTempo: (amount?: number) => Promise<void>;
  decreaseTempo: (amount?: number) => Promise<void>;
  tapTempo: () => void;

  // Time signature
  setTimeSignature: (numerator: number, denominator: number) => Promise<void>;

  // Loop
  toggleLoop: () => Promise<void>;
  setLoopRange: (
    start: TransportPosition,
    end: TransportPosition,
  ) => Promise<void>;
  clearLoop: () => Promise<void>;

  // Metronome
  toggleMetronome: () => Promise<void>;
  setMetronomeEnabled: (enabled: boolean) => Promise<void>;

  // Count-in
  setCountIn: (enabled: boolean, bars?: number) => Promise<void>;

  // Utility
  clearError: () => void;
}

// Tap tempo tracking
let tapTimes: number[] = [];
const MAX_TAP_INTERVAL = 2000; // 2 seconds
const MIN_TAPS = 3;

export const useTransportRepositoryStore = create<TransportRepositoryState>()(
  devtools(
    (set, get) => ({
      // Initial state
      transportState: null,
      isLoading: false,
      error: null,
      repository: new TransportRepository(),

      // Load transport state
      loadTransportState: async () => {
        set({ isLoading: true, error: null });
        try {
          const state = await get().repository.get();
          set({ transportState: state, isLoading: false });
        } catch (error) {
          set({ error: error as Error, isLoading: false });
        }
      },

      // Save transport state
      saveTransportState: async () => {
        const { transportState, repository } = get();
        if (!transportState) return;

        try {
          await repository.save(transportState);
        } catch (error) {
          set({ error: error as Error });
          throw error;
        }
      },

      // Reset transport state
      resetTransportState: async () => {
        const { repository } = get();
        try {
          await repository.reset();
          const newState = TransportState.createInitial();
          set({ transportState: newState });
        } catch (error) {
          set({ error: error as Error });
          throw error;
        }
      },

      // Play
      play: async () => {
        const { transportState, saveTransportState } = get();
        if (!transportState || !transportState.canStart()) return;

        transportState.start();
        set({ transportState });
        await saveTransportState();
      },

      // Pause
      pause: async () => {
        const { transportState, saveTransportState } = get();
        if (!transportState || !transportState.canPause()) return;

        transportState.pause();
        set({ transportState });
        await saveTransportState();
      },

      // Stop
      stop: async () => {
        const { transportState, saveTransportState } = get();
        if (!transportState || !transportState.canStop()) return;

        transportState.stop();
        set({ transportState });
        await saveTransportState();
      },

      // Toggle play/pause
      togglePlayPause: async () => {
        const { transportState, play, pause } = get();
        if (!transportState) return;

        if (transportState.isPlaying()) {
          await pause();
        } else {
          await play();
        }
      },

      // Start recording
      startRecording: async () => {
        const { transportState, saveTransportState } = get();
        if (!transportState || !transportState.canRecord()) return;

        transportState.enableRecording();
        set({ transportState });
        await saveTransportState();
      },

      // Stop recording
      stopRecording: async () => {
        const { transportState, saveTransportState } = get();
        if (!transportState || !transportState.isRecording) return;

        transportState.disableRecording();
        set({ transportState });
        await saveTransportState();
      },

      // Update position (no save - called frequently)
      updatePosition: (position: TransportPosition) => {
        const { transportState } = get();
        if (!transportState) return;

        transportState.updatePosition(position);
        set({ transportState });
      },

      // Seek
      seek: async (position: TransportPosition) => {
        const { transportState, saveTransportState } = get();
        if (!transportState) return;

        transportState.updatePosition(position);
        set({ transportState });
        await saveTransportState();
      },

      // Set tempo
      setTempo: async (bpm: number) => {
        const { transportState, saveTransportState } = get();
        if (!transportState) return;

        const tempo = Tempo.create(bpm);
        transportState.setTempo(tempo);
        set({ transportState });
        await saveTransportState();
      },

      // Increase tempo
      increaseTempo: async (amount = 5) => {
        const { transportState, setTempo } = get();
        if (!transportState) return;

        const newBpm = Math.min(999, transportState.tempo.value + amount);
        await setTempo(newBpm);
      },

      // Decrease tempo
      decreaseTempo: async (amount = 5) => {
        const { transportState, setTempo } = get();
        if (!transportState) return;

        const newBpm = Math.max(20, transportState.tempo.value - amount);
        await setTempo(newBpm);
      },

      // Tap tempo
      tapTempo: () => {
        const now = Date.now();

        // Clear old taps if too much time has passed
        tapTimes = tapTimes.filter((time) => now - time < MAX_TAP_INTERVAL);
        tapTimes.push(now);

        if (tapTimes.length >= MIN_TAPS) {
          // Calculate average interval
          let totalInterval = 0;
          for (let i = 1; i < tapTimes.length; i++) {
            const current = tapTimes[i];
            const previous = tapTimes[i - 1];
            if (current !== undefined && previous !== undefined) {
              totalInterval += current - previous;
            }
          }

          const avgInterval = totalInterval / (tapTimes.length - 1);
          const bpm = Math.round(60000 / avgInterval);

          // Set the calculated tempo
          get().setTempo(bpm);

          // Keep only recent taps for next calculation
          tapTimes = tapTimes.slice(-4);
        }
      },

      // Set time signature
      setTimeSignature: async (numerator: number, denominator: number) => {
        const { transportState, saveTransportState } = get();
        if (!transportState) return;

        transportState.setTimeSignature(numerator, denominator);
        set({ transportState });
        await saveTransportState();
      },

      // Toggle loop
      toggleLoop: async () => {
        const { transportState, saveTransportState } = get();
        if (!transportState) return;

        transportState.setLooping(!transportState.isLooping);
        set({ transportState });
        await saveTransportState();
      },

      // Set loop range
      setLoopRange: async (
        start: TransportPosition,
        end: TransportPosition,
      ) => {
        const { transportState, saveTransportState } = get();
        if (!transportState) return;

        transportState.setLoopRange(start, end);
        set({ transportState });
        await saveTransportState();
      },

      // Clear loop
      clearLoop: async () => {
        const { transportState, saveTransportState } = get();
        if (!transportState) return;

        transportState.setLooping(false);
        set({ transportState });
        await saveTransportState();
      },

      // Toggle metronome
      toggleMetronome: async () => {
        const { transportState, saveTransportState } = get();
        if (!transportState) return;

        transportState.toggleMetronome();
        set({ transportState });
        await saveTransportState();
      },

      // Set metronome enabled
      setMetronomeEnabled: async (enabled: boolean) => {
        const { transportState, saveTransportState } = get();
        if (!transportState) return;

        transportState.setMetronomeEnabled(enabled);
        set({ transportState });
        await saveTransportState();
      },

      // Set count-in
      setCountIn: async (enabled: boolean, bars?: number) => {
        const { transportState, saveTransportState } = get();
        if (!transportState) return;

        transportState.setCountIn(enabled, bars);
        set({ transportState });
        await saveTransportState();
      },

      // Clear error
      clearError: () => {
        set({ error: null });
      },
    }),
    {
      name: 'transport-repository',
    },
  ),
);
