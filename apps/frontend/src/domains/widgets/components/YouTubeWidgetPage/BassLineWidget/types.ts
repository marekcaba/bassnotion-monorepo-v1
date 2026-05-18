/**
 * BassLineWidget Types
 *
 * Centralized type definitions for the BassLineWidget component and its submodules.
 * All types used across hooks, components, and utilities are defined here.
 */

import type { Exercise } from '@bassnotion/contracts';

/**
 * Bass articulation types supported by the bass widget
 */
export const BassArticulation = {
  FINGERSTYLE: 'fingerstyle',
  SLAP: 'slap',
  PICK: 'pick',
  MUTE: 'mute',
  HARMONIC: 'harmonic',
} as const;

export type BassArticulationType =
  (typeof BassArticulation)[keyof typeof BassArticulation];

/**
 * Props for the BassLineWidget component
 */
export interface BassLineWidgetProps {
  /** Current bass pattern name */
  pattern: string;
  /** Whether the widget is visible */
  isVisible: boolean;
  /** Whether playback is active */
  isPlaying: boolean;
  /** Exercise entity with bass notes data */
  exercise?: Exercise;
  /** Callback when pattern changes */
  onPatternChange: (pattern: string) => void;
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
 * Bass note with position information for fretboard visualization
 */
export interface BassNote {
  /** MIDI note number */
  note: number;
  /** String number (1-5 for 5-string bass, 1-4 for 4-string) */
  string: number;
  /** Fret position */
  fret: number;
  /** Beat position within the measure */
  beat: number;
  /** Optional articulation style */
  articulation?: BassArticulationType;
}

/**
 * Currently playing note for visual feedback
 */
export interface CurrentlyPlayingNote {
  midiNote: number;
  string: number;
  fret: number;
}

/**
 * Bass pattern definition with notes and metadata
 */
export interface BassPatternNotes {
  [patternName: string]: BassNote[];
}

/**
 * Fret window for mini fretboard visualization
 */
export interface FretWindow {
  /** Starting fret position */
  start: number;
  /** Ending fret position */
  end: number;
  /** Whether to show open string position */
  showOpenString: boolean;
}

/**
 * Active audio source for cleanup tracking
 */
export interface ActiveSource {
  source: AudioBufferSourceNode;
  gain: GainNode;
}

/**
 * Options for the useVolumeControl hook (bass-specific)
 */
export interface UseBassVolumeControlOptions {
  /** Controlled volume value (0-100) */
  controlledVolume?: number;
  /** Controlled mute state */
  controlledMuted?: boolean;
  /** Callback when volume changes (for controlled mode) */
  onVolumeChange?: (volume: number) => void;
  /** Callback when mute state changes (for controlled mode) */
  onMuteToggle?: () => void;
  /** Reference to the gain node for direct volume control */
  gainNodeRef?: React.RefObject<GainNode | null>;
  /** Reference to the audio context */
  audioContextRef?: React.RefObject<AudioContext | null>;
  /** Default volume when uncontrolled (0-100) */
  defaultVolume?: number;
}

/**
 * Return type for the useVolumeControl hook (bass-specific)
 */
export interface UseBassVolumeControlReturn {
  /** Current volume level (0-100) */
  volume: number;
  /** Whether audio is muted */
  isMuted: boolean;
  /** Handler for volume changes */
  handleVolumeChange: (newVolume: number) => void;
  /** Handler for mute toggle */
  handleMuteToggle: () => void;
  /** Effective volume (0 if muted, otherwise volume/100) */
  effectiveVolume: number;
}

/**
 * Options for the useBassAudioContext hook
 */
export interface UseBassAudioContextOptions {
  /** Initial mute state */
  isMuted: boolean;
  /** Initial volume (0-100) */
  volume: number;
}

/**
 * Return type for the useBassAudioContext hook
 */
export interface UseBassAudioContextReturn {
  /** Reference to the AudioContext */
  audioContextRef: React.RefObject<AudioContext | null>;
  /** Reference to the master gain node */
  gainNodeRef: React.RefObject<GainNode | null>;
  /** Whether the sampler is ready */
  samplerReady: boolean;
  /** Number of samples loaded */
  samplesLoaded: number;
  /** Total number of samples expected */
  totalSamples: number;
  /** Set samples loaded count */
  setSamplesLoaded: (count: number) => void;
  /** Set total samples count */
  setTotalSamples: (count: number) => void;
  /** Set sampler ready state */
  setSamplerReady: (ready: boolean) => void;
}

/**
 * Options for the useSampleLoadingSync hook (bass-specific)
 */
export interface UseSampleLoadingSyncOptions {
  /** Subscribe function from SyncContext (optional) */
  subscribeToEvent?: (
    eventName: string,
    callback: (payload: unknown) => void,
  ) => () => void;
}

/**
 * Return type for the useSampleLoadingSync hook (bass-specific)
 */
export interface UseSampleLoadingSyncReturn {
  /** Trigger counter that increments when samples are loaded */
  samplesLoadedTrigger: number;
}

/**
 * Options for the useBassBufferRegistration hook
 */
export interface UseBassBufferRegistrationOptions {
  /** Current exercise */
  exercise?: Exercise;
  /** Samples loaded trigger from useSampleLoadingSync */
  samplesLoadedTrigger: number;
  /** Whether the track is ready */
  trackIsReady: boolean;
  /** Number of bass notes in the exercise */
  bassNoteCount: number;
  /** Current volume (0-100) */
  volume: number;
  /** Whether muted */
  isMuted: boolean;
  /** Reference to bass buffers */
  bassBuffersRef: React.MutableRefObject<Record<string, AudioBuffer>>;
  /** Callback when samples are loaded */
  onSamplesLoaded: (loaded: number, total: number) => void;
  /** Callback when sampler becomes ready */
  onSamplerReady: (ready: boolean) => void;
}

/**
 * Return type for the useBassBufferRegistration hook
 */
export interface UseBassBufferRegistrationReturn {
  /** Function to manually trigger registration */
  registerBassWithPlaybackEngine: () => Promise<void>;
}

/**
 * Options for the useBassPlayback hook
 */
export interface UseBassPlaybackOptions {
  /** Reference to the AudioContext */
  audioContextRef: React.RefObject<AudioContext | null>;
  /** Reference to the master gain node */
  gainNodeRef: React.RefObject<GainNode | null>;
  /** Reference to bass audio buffers */
  bassBuffersRef: React.RefObject<Record<string, AudioBuffer>>;
  /** Current tempo in BPM */
  tempo: number;
  /** Whether playback is active */
  isPlaying: boolean;
  /** Whether the track is ready */
  trackIsReady: boolean;
  /** Whether the sampler is ready */
  samplerReady: boolean;
  /** Current exercise */
  exercise?: Exercise;
  /** Current pattern name */
  pattern: string;
}

/**
 * Return type for the useBassPlayback hook
 */
export interface UseBassPlaybackReturn {
  /** Play a single bass note */
  playBassNote: (
    midiNote: number,
    velocity?: number,
    duration?: number,
    scheduledTime?: number,
  ) => void;
  /** Stop all active notes */
  stopAllNotes: (graceful?: boolean) => void;
  /** Schedule a pattern for playback */
  schedulePattern: () => void;
  /** Pattern notes from exercise or predefined patterns */
  patternNotes: BassNote[];
  /** Test a single note */
  testNote: () => void;
  /** Test direct playback (diagnostic) */
  testDirectPlayback: () => Promise<void>;
}

/**
 * Options for the useBassEventBus hook
 */
export interface UseBassEventBusOptions {
  /** Reference to the AudioContext */
  audioContextRef: React.RefObject<AudioContext | null>;
  /** Whether the sampler is ready */
  samplerReady: boolean;
  /** Whether the track is playing */
  trackIsPlaying: boolean;
  /** Callback when a note is triggered (for visual feedback) */
  onNoteTrigger: (note: CurrentlyPlayingNote, duration: number) => void;
  /** Callback to update selected notes */
  onSelectedNotesChange: (notes: BassNote[]) => void;
}

/**
 * Return type for the useBassEventBus hook
 */
export interface UseBassEventBusReturn {
  // No return values - all state updates via callbacks
}

/**
 * Props for the MiniFretboard component
 */
export interface MiniFretboardProps {
  /** Selected notes to highlight */
  selectedNotes: BassNote[];
  /** Currently playing note for animation */
  currentlyPlayingNote: CurrentlyPlayingNote | null;
  /** Fret window configuration */
  fretWindow: FretWindow;
  /** Volume level for styling (0-100) */
  volume: number;
  /** Click handler for the fretboard */
  onClick: () => void;
}

/**
 * Props for the ExpandedControls component
 */
export interface ExpandedControlsProps {
  /** Current pattern name */
  pattern: string;
  /** Current articulation type */
  currentArticulation: BassArticulationType;
  /** Whether the sampler is ready */
  samplerReady: boolean;
  /** Number of samples loaded */
  samplesLoaded: number;
  /** Total number of samples expected */
  totalSamples: number;
  /** Available patterns */
  availablePatterns: string[];
  /** Callback when pattern changes */
  onPatternChange: (pattern: string) => void;
  /** Callback when articulation changes */
  onArticulationChange: (articulation: BassArticulationType) => void;
  /** Test note callback */
  onTestNote: () => void;
  /** Close expanded view callback */
  onClose: () => void;
}

/**
 * Predefined bass patterns for quick selection
 */
export const BASS_PATTERNS: BassPatternNotes = {
  'Root-Fifth': [
    { note: 28, string: 1, fret: 0, beat: 0 }, // E1
    { note: 33, string: 2, fret: 0, beat: 1 }, // A1
    { note: 28, string: 1, fret: 0, beat: 2 }, // E1
    { note: 33, string: 2, fret: 0, beat: 3 }, // A1
  ],
  'Walking Bass': [
    { note: 38, string: 2, fret: 5, beat: 0 }, // D2
    { note: 41, string: 2, fret: 8, beat: 1 }, // F2
    { note: 43, string: 3, fret: 0, beat: 2 }, // G2
    { note: 45, string: 3, fret: 2, beat: 3 }, // A2
  ],
  'Chromatic Walk': [
    { note: 28, string: 1, fret: 0, beat: 0 }, // E1
    { note: 29, string: 1, fret: 1, beat: 0.5 }, // F1
    { note: 30, string: 1, fret: 2, beat: 1 }, // F#1
    { note: 31, string: 1, fret: 3, beat: 1.5 }, // G1
    { note: 32, string: 1, fret: 4, beat: 2 }, // G#1
    { note: 33, string: 2, fret: 0, beat: 2.5 }, // A1
    { note: 34, string: 2, fret: 1, beat: 3 }, // Bb1
    { note: 35, string: 2, fret: 2, beat: 3.5 }, // B1
  ],
  Octaves: [
    { note: 38, string: 2, fret: 5, beat: 0 }, // D2
    { note: 50, string: 3, fret: 7, beat: 1 }, // D3
    { note: 38, string: 2, fret: 5, beat: 2 }, // D2
    { note: 50, string: 3, fret: 7, beat: 3 }, // D3
  ],
  'Funky Slap': [
    { note: 28, string: 1, fret: 0, beat: 0, articulation: 'slap' }, // E1 slap
    { note: 40, string: 1, fret: 12, beat: 0.25, articulation: 'slap' }, // E2 ghost
    { note: 33, string: 2, fret: 0, beat: 0.5, articulation: 'slap' }, // A1 slap
    { note: 28, string: 1, fret: 0, beat: 1.5, articulation: 'slap' }, // E1 slap
    { note: 31, string: 1, fret: 3, beat: 2, articulation: 'pick' }, // G1 pop
    { note: 33, string: 2, fret: 0, beat: 3, articulation: 'slap' }, // A1 slap
  ],
};

/**
 * Standard bass tuning - string number to base MIDI note mapping
 * String numbers are from HIGH to LOW: string 1 = G (highest), string 4 = E (lowest)
 * 4-string bass: E1=28, A1=33, D2=38, G2=43
 * 5-string bass adds: B0=23 (low B, string 5)
 */
export const STRING_TO_BASE_MIDI: Record<number, number> = {
  1: 43, // G2 (highest string on 4-string)
  2: 38, // D2
  3: 33, // A1
  4: 28, // E1 (lowest string on 4-string)
  5: 23, // B0 (5-string bass low B)
};

/**
 * Fret markers for visual reference on the fretboard
 */
export const FRET_MARKERS = [3, 5, 7, 9, 12, 15, 17, 19];
