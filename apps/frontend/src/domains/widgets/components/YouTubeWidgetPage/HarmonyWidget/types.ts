/**
 * HarmonyWidget Types
 *
 * Centralized type definitions for the HarmonyWidget component and its submodules.
 * All types used across hooks, components, and utilities are defined here.
 */

import type { MusicalPosition } from '@bassnotion/contracts/types/musical-time';

/**
 * Keyboard instrument types supported by the harmony widget
 */
export const KeyboardInstrument = {
  GRAND_PIANO: 'grandpiano',
  FENDER_RHODES: 'rhodes',
  WURLITZER: 'wurlitzer',
} as const;

export type KeyboardInstrumentType =
  (typeof KeyboardInstrument)[keyof typeof KeyboardInstrument];

/**
 * Props for the HarmonyWidget component
 */
export interface HarmonyWidgetProps {
  /** Current chord progression */
  progression: string[];
  /** Index of the current chord being played */
  currentChord: number;
  /** Whether playback is active */
  isPlaying: boolean;
  /** Whether the widget is visible */
  isVisible: boolean;
  /** Tutorial ID for pattern library integration */
  tutorialId?: string;
  /** Harmony instrument to use */
  harmonyInstrument?: KeyboardInstrumentType | 'pad';
  /** Exercise entity with harmony_notes data */
  exercise?: HarmonyExercise;
  /** Callback when chord advances */
  onNextChord: () => void;
  /** Callback when progression changes */
  onProgressionChange: (progression: string[]) => void;
  /** Callback to toggle visibility */
  onToggleVisibility?: () => void;
  /** Callback to toggle playback */
  onTogglePlay?: () => void;
  /** Whether admin mode is enabled */
  isAdminMode?: boolean;
  /** Controlled volume (0-100). If provided, widget uses this instead of local state */
  volume?: number;
  /** Controlled mute state. If provided, widget uses this instead of local state */
  isMuted?: boolean;
  /** Callback when volume changes (for controlled mode) */
  onVolumeChange?: (volume: number) => void;
  /** Callback when mute state changes (for controlled mode) */
  onMuteToggle?: () => void;
}

/**
 * Harmony note from exercise data
 */
export interface HarmonyNote {
  id?: string;
  pitch: number;
  noteName?: string;
  velocity: number;
  position: MusicalPosition;
  durationTicks?: number;
  ticks?: number;
}

/**
 * Control change event from MIDI data
 */
export interface HarmonyControlChange {
  cc: number;
  value: number;
  position: MusicalPosition;
  ticks?: number;
}

/**
 * Exercise data structure with harmony information
 */
export interface HarmonyExercise {
  id?: { value: string } | string;
  title?: string;
  bpm?: number;
  durationBeats?: number;
  harmonyInstrument?: KeyboardInstrumentType;
  harmonyNotes?: HarmonyNote[];
  harmonyControlChanges?: HarmonyControlChange[];
}

/**
 * Chord progression item with duration
 */
export interface ChordProgressionItem {
  chord: string;
  duration: number;
}

/**
 * Named chord progressions
 */
export interface ChordProgressions {
  [name: string]: ChordProgressionItem[];
}

/**
 * Pattern library item for harmony patterns
 */
export interface HarmonyPatternLibraryItem {
  id: string;
  name: string;
  genre?: string;
  midiFileUrl?: string;
  midiData?: unknown;
}

/**
 * WAM keyboard plugin interface
 */
export interface WamKeyboardPlugin {
  audioNode?: WamKeyboardAudioNode;
  playChord?: (
    chord: string,
    velocity: number,
    duration: number,
    octave: number
  ) => void;
  /** Reset plugin state for tutorial/exercise switching (clears notes, sustain pedal, resets instrument) */
  resetState?: () => void;
}

/**
 * WAM keyboard audio node interface
 */
export interface WamKeyboardAudioNode {
  context: AudioContext;
  currentInstrument?: KeyboardInstrumentType;
  gainNode?: GainNode;
  numberOfOutputs?: number;
  isConnected?: boolean;
  activeSampler?: {
    releaseAll?: () => void;
  };
  connect: (destination: AudioNode) => void;
  disconnect: () => void;
  setParameterValues: (params: { volume?: number; instrument?: number }) => Promise<void>;
  loadInstrument: (instrument: KeyboardInstrumentType) => Promise<void>;
  clearEvents: () => void;
  triggerNote: (note: number, velocity: number, time: number) => void;
  releaseNote: (note: number) => void;
}

/**
 * Harmony event for PlaybackEngine registration
 */
export interface HarmonyEvent {
  position: {
    measure: number;
    beat: number;
    subdivision: number;
    tick: number;
  };
  type: 'harmony-note' | 'harmony-control-change';
  velocity: number;
  durationTicks?: number;
  data: {
    pitch?: number;
    noteName?: string;
    midiNote?: number;
    velocity?: number;
    ticks?: number;
    durationTicks?: number;
    originalBpm?: number;
    cc?: number;
    value?: number;
  };
}

/**
 * Harmony region for PlaybackEngine
 */
export interface HarmonyRegion {
  id: string;
  trackId: string;
  startTime: number;
  duration: number;
  pattern: {
    id: string;
    name: string;
    type: 'harmony';
    events: HarmonyEvent[];
  };
}

/**
 * Track data for PlaybackEngine registration
 */
export interface HarmonyTrackData {
  id: string;
  name: string;
  instrumentType: 'harmony';
  exerciseId?: string;
  regions: HarmonyRegion[];
  audioNode?: WamKeyboardAudioNode;
}

/**
 * Per-note velocity range configuration from instrument config
 */
export interface PerNoteVelocityRanges {
  [noteName: string]: Array<{
    minVelocity: number;
    maxVelocity: number;
    layer: string;
  }>;
}

/**
 * Props for the HarmonyDisplay component
 */
export interface HarmonyDisplayProps {
  /** Current chord progression */
  progression: string[];
  /** Index of current chord */
  currentChordIndex: number;
  /** Whether widget is muted (for styling) */
  isMuted: boolean;
  /** Current volume (for styling) */
  volume: number;
  /** Ref callback for chord indicators (for direct DOM updates) */
  registerChordIndicator: (index: number, element: HTMLDivElement | null) => void;
}

/**
 * Props for the InstrumentSelector component
 */
export interface InstrumentSelectorProps {
  /** Currently selected instrument */
  currentInstrument: KeyboardInstrumentType | undefined;
  /** Callback when instrument changes */
  onInstrumentChange: (instrument: KeyboardInstrumentType) => void;
}

/**
 * Props for the PatternLibraryButton component
 */
export interface PatternLibraryButtonProps {
  /** Whether to show the pattern library */
  isOpen: boolean;
  /** Toggle pattern library visibility */
  onToggle: () => void;
  /** Whether patterns are loading */
  isLoading: boolean;
  /** Available harmony patterns */
  patterns: HarmonyPatternLibraryItem[];
  /** Currently selected pattern */
  selectedPattern?: HarmonyPatternLibraryItem;
  /** Callback when pattern is selected */
  onPatternSelect: (pattern: HarmonyPatternLibraryItem) => void;
}

/**
 * Props for the ChordProgressionView component
 */
export interface ChordProgressionViewProps {
  /** Current chord progression */
  progression: string[];
  /** Selected progression name */
  selectedProgression: string;
  /** Available progressions */
  availableProgressions: string[];
  /** Callback when progression changes */
  onProgressionChange: (progression: string) => void;
  /** Ref callback for chord indicators */
  registerChordIndicator: (index: number, element: HTMLDivElement | null) => void;
}

/**
 * State for the harmony plugin
 */
export interface HarmonyPluginState {
  wamPluginLoaded: boolean;
  pluginClassLoaded: boolean;
  audioServicesReady: boolean;
  retryCount: number;
}
