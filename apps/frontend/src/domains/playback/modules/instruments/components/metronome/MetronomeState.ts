/**
 * Metronome State
 *
 * State management and persistence for metronome
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { TimeSignature } from '../../architecture/IInstrumentScheduler.js';
import type { ClickSound } from './MetronomeCore.js';
import { createStructuredLogger } from '@bassnotion/contracts';

const logger = createStructuredLogger('MetronomeState');

export interface MetronomePreset {
  id: string;
  name: string;
  tempo: number;
  timeSignature: TimeSignature;
  accentPattern: number[];
  subdivisions: number;
  includeSubdivisions: boolean;
  clickSounds?: {
    accent?: ClickSound;
    regular?: ClickSound;
    subdivision?: ClickSound;
  };
  swing?: number;
  volume?: number;
}

export interface MetronomeStateData {
  // Current settings
  tempo: number;
  timeSignature: TimeSignature;
  accentPattern: number[];
  subdivisions: number;
  includeSubdivisions: boolean;
  swing: number;
  volume: number;

  // UI state
  isPlaying: boolean;
  currentBeat: number;
  currentSubdivision: number;

  // Presets
  presets: MetronomePreset[];
  currentPresetId: string | null;

  // Visual settings
  visualOptions: {
    enablePendulum: boolean;
    enableFlash: boolean;
    enableBeatIndicators: boolean;
    visualOffset: number;
  };

  // Advanced settings
  preClickCount: number;
  adaptiveTiming: boolean;
  tapTempo: {
    taps: number[];
    lastTapTime: number;
  };
}

export interface MetronomeStateActions {
  // Tempo control
  setTempo: (tempo: number) => void;
  incrementTempo: (amount?: number) => void;
  decrementTempo: (amount?: number) => void;
  tapTempo: () => void;

  // Time signature
  setTimeSignature: (timeSignature: TimeSignature) => void;
  setAccentPattern: (pattern: number[]) => void;

  // Subdivisions
  setSubdivisions: (subdivisions: number) => void;
  toggleSubdivisions: () => void;

  // Playback
  setPlaying: (playing: boolean) => void;
  togglePlaying: () => void;
  updateBeat: (beat: number, subdivision?: number) => void;

  // Presets
  savePreset: (name: string) => string;
  loadPreset: (presetId: string) => void;
  deletePreset: (presetId: string) => void;

  // Settings
  setSwing: (swing: number) => void;
  setVolume: (volume: number) => void;
  setPreClickCount: (count: number) => void;
  setAdaptiveTiming: (enabled: boolean) => void;
  updateVisualOptions: (
    options: Partial<MetronomeStateData['visualOptions']>,
  ) => void;

  // Reset
  reset: () => void;
}

export type MetronomeStore = MetronomeStateData & MetronomeStateActions;

// Default state
const defaultState: MetronomeStateData = {
  tempo: 120,
  timeSignature: { numerator: 4, denominator: 4 },
  accentPattern: [1],
  subdivisions: 1,
  includeSubdivisions: false,
  swing: 0,
  volume: -6,
  isPlaying: false,
  currentBeat: 0,
  currentSubdivision: 0,
  presets: [
    {
      id: 'default-4-4',
      name: '4/4 Basic',
      tempo: 120,
      timeSignature: { numerator: 4, denominator: 4 },
      accentPattern: [1],
      subdivisions: 1,
      includeSubdivisions: false,
      swing: 0,
      volume: -6,
    },
    {
      id: 'default-3-4',
      name: '3/4 Waltz',
      tempo: 90,
      timeSignature: { numerator: 3, denominator: 4 },
      accentPattern: [1],
      subdivisions: 1,
      includeSubdivisions: false,
      swing: 0,
      volume: -6,
    },
    {
      id: 'default-6-8',
      name: '6/8 Compound',
      tempo: 120,
      timeSignature: { numerator: 6, denominator: 8 },
      accentPattern: [1, 4],
      subdivisions: 1,
      includeSubdivisions: false,
      swing: 0,
      volume: -6,
    },
  ],
  currentPresetId: null,
  visualOptions: {
    enablePendulum: true,
    enableFlash: true,
    enableBeatIndicators: true,
    visualOffset: 0,
  },
  preClickCount: 0,
  adaptiveTiming: false,
  tapTempo: {
    taps: [],
    lastTapTime: 0,
  },
};

/**
 * Create metronome store
 */
export const useMetronomeStore = create<MetronomeStore>()(
  persist(
    (set, get) => ({
      ...defaultState,

      // Tempo control
      setTempo: (tempo) => {
        const clampedTempo = Math.max(30, Math.min(300, tempo));
        set({ tempo: clampedTempo, currentPresetId: null });
        logger.info('Tempo changed', { tempo: clampedTempo });
      },

      incrementTempo: (amount = 1) => {
        const { tempo } = get();
        get().setTempo(tempo + amount);
      },

      decrementTempo: (amount = 1) => {
        const { tempo } = get();
        get().setTempo(tempo - amount);
      },

      tapTempo: () => {
        const now = Date.now();
        const { tapTempo } = get();
        const { taps } = tapTempo;

        // Add new tap
        const newTaps = [...taps, now].slice(-8); // Keep last 8 taps

        // Calculate average tempo if we have enough taps
        if (newTaps.length >= 2) {
          const intervals: number[] = [];
          for (let i = 1; i < newTaps.length; i++) {
            intervals.push(newTaps[i] - newTaps[i - 1]);
          }

          const avgInterval =
            intervals.reduce((a, b) => a + b, 0) / intervals.length;
          const bpm = Math.round(60000 / avgInterval);

          if (bpm >= 30 && bpm <= 300) {
            get().setTempo(bpm);
          }
        }

        set({
          tapTempo: {
            taps: newTaps,
            lastTapTime: now,
          },
        });
      },

      // Time signature
      setTimeSignature: (timeSignature) => {
        // Reset accent pattern for new time signature
        const accentPattern = [1];
        set({ timeSignature, accentPattern, currentPresetId: null });
        logger.info('Time signature changed', { timeSignature });
      },

      setAccentPattern: (pattern) => {
        set({ accentPattern: pattern, currentPresetId: null });
      },

      // Subdivisions
      setSubdivisions: (subdivisions) => {
        const clamped = Math.max(1, Math.min(4, subdivisions));
        set({ subdivisions: clamped, currentPresetId: null });
      },

      toggleSubdivisions: () => {
        set((state) => ({
          includeSubdivisions: !state.includeSubdivisions,
          currentPresetId: null,
        }));
      },

      // Playback
      setPlaying: (playing) => {
        set({ isPlaying: playing });
        if (!playing) {
          set({ currentBeat: 0, currentSubdivision: 0 });
        }
        logger.info('Playback state changed', { playing });
      },

      togglePlaying: () => {
        const { isPlaying } = get();
        get().setPlaying(!isPlaying);
      },

      updateBeat: (beat, subdivision = 0) => {
        set({ currentBeat: beat, currentSubdivision: subdivision });
      },

      // Presets
      savePreset: (name) => {
        const state = get();
        const preset: MetronomePreset = {
          id: `preset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name,
          tempo: state.tempo,
          timeSignature: state.timeSignature,
          accentPattern: state.accentPattern,
          subdivisions: state.subdivisions,
          includeSubdivisions: state.includeSubdivisions,
          swing: state.swing,
          volume: state.volume,
        };

        set((state) => ({
          presets: [...state.presets, preset],
          currentPresetId: preset.id,
        }));

        logger.info('Preset saved', { preset });
        return preset.id;
      },

      loadPreset: (presetId) => {
        const { presets } = get();
        const preset = presets.find((p) => p.id === presetId);

        if (preset) {
          set({
            tempo: preset.tempo,
            timeSignature: preset.timeSignature,
            accentPattern: preset.accentPattern,
            subdivisions: preset.subdivisions,
            includeSubdivisions: preset.includeSubdivisions,
            swing: preset.swing || 0,
            volume: preset.volume || -6,
            currentPresetId: presetId,
          });
          logger.info('Preset loaded', { preset });
        }
      },

      deletePreset: (presetId) => {
        set((state) => ({
          presets: state.presets.filter((p) => p.id !== presetId),
          currentPresetId:
            state.currentPresetId === presetId ? null : state.currentPresetId,
        }));
      },

      // Settings
      setSwing: (swing) => {
        const clamped = Math.max(0, Math.min(100, swing));
        set({ swing: clamped, currentPresetId: null });
      },

      setVolume: (volume) => {
        const clamped = Math.max(-60, Math.min(0, volume));
        set({ volume: clamped });
      },

      setPreClickCount: (count) => {
        const clamped = Math.max(0, Math.min(8, count));
        set({ preClickCount: clamped });
      },

      setAdaptiveTiming: (enabled) => {
        set({ adaptiveTiming: enabled });
      },

      updateVisualOptions: (options) => {
        set((state) => ({
          visualOptions: { ...state.visualOptions, ...options },
        }));
      },

      // Reset
      reset: () => {
        set({ ...defaultState });
        logger.info('Metronome state reset');
      },
    }),
    {
      name: 'metronome-state',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        tempo: state.tempo,
        timeSignature: state.timeSignature,
        accentPattern: state.accentPattern,
        subdivisions: state.subdivisions,
        includeSubdivisions: state.includeSubdivisions,
        swing: state.swing,
        volume: state.volume,
        presets: state.presets,
        visualOptions: state.visualOptions,
        preClickCount: state.preClickCount,
        adaptiveTiming: state.adaptiveTiming,
      }),
    },
  ),
);

/**
 * Helper to get common time signatures
 */
export const commonTimeSignatures: TimeSignature[] = [
  { numerator: 4, denominator: 4 },
  { numerator: 3, denominator: 4 },
  { numerator: 2, denominator: 4 },
  { numerator: 6, denominator: 8 },
  { numerator: 9, denominator: 8 },
  { numerator: 12, denominator: 8 },
  { numerator: 5, denominator: 4 },
  { numerator: 7, denominator: 8 },
];
