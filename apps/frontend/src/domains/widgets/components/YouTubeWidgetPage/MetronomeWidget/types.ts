/**
 * MetronomeWidget Types
 *
 * Centralized type definitions for the MetronomeWidget component and its submodules.
 * All types used across hooks, components, and utilities are defined here.
 */

import type {
  MetronomePattern,
  MetronomePatternEvent,
} from '@/domains/playback/types/pattern';

/**
 * Metronome sound presets
 */
export const MetronomeSound = {
  CLASSIC: 'classic',
  ELECTRONIC: 'electronic',
  ACOUSTIC: 'acoustic',
  SUBTLE: 'subtle',
} as const;

export type MetronomeSoundType =
  (typeof MetronomeSound)[keyof typeof MetronomeSound];

/**
 * Time signature configuration
 */
export interface TimeSignature {
  numerator: number;
  denominator: number;
}

/**
 * Props for the MetronomeWidget component
 */
export interface MetronomeWidgetProps {
  /** Whether the widget is visible */
  isVisible: boolean;
  /** Whether playback is active */
  isPlaying: boolean;
  /** Callback to toggle visibility */
  onToggleVisibility?: () => void;
  /** Callback to toggle playback */
  onTogglePlay?: () => void;
  /** Time signature configuration */
  timeSignature?: TimeSignature;
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
 * Metronome beat indicator dot state
 */
export interface MetronomeDot {
  /** Unique identifier for the dot */
  id: number;
  /** Whether this beat position is active in the pattern */
  isActive: boolean;
  /** Whether this is the currently playing beat */
  isCurrent: boolean;
}

/**
 * Initial state for metronome dots (default 4/4 time)
 */
export const initialDots: MetronomeDot[] = Array.from({ length: 8 }, (_, i) => ({
  id: i,
  isActive: i < 4,
  isCurrent: i === 0,
}));

// Re-export pattern types from playback domain
export type { MetronomePattern, MetronomePatternEvent };

/**
 * Options for the useVolumeControl hook (metronome-specific)
 */
export interface UseMetronomeVolumeControlOptions {
  /** Controlled volume value (0-100) */
  controlledVolume?: number;
  /** Controlled mute state */
  controlledMuted?: boolean;
  /** Callback when volume changes (for controlled mode) */
  onVolumeChange?: (volume: number) => void;
  /** Callback when mute state changes (for controlled mode) */
  onMuteToggle?: () => void;
  /** Reference to the metronome plugin */
  metronomePluginRef?: React.RefObject<any>;
  /** Default volume when uncontrolled (0-100) */
  defaultVolume?: number;
}

/**
 * Return type for the useVolumeControl hook (metronome-specific)
 */
export interface UseMetronomeVolumeControlReturn {
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
 * Options for the usePluginLoading hook
 */
export interface UsePluginLoadingOptions {
  /** Whether the plugin class is already loaded */
  pluginClassLoaded: boolean;
  /** Callback when plugin class is loaded */
  onPluginClassLoaded: (pluginClass: any) => void;
}

/**
 * Return type for the usePluginLoading hook
 */
export interface UsePluginLoadingReturn {
  /** Whether the plugin class is loaded */
  pluginClassLoaded: boolean;
}

/**
 * Options for the usePluginCreation hook
 */
export interface UsePluginCreationOptions {
  /** Whether the plugin class is loaded */
  pluginClassLoaded: boolean;
  /** Reference to the WAM plugin class */
  wamPluginClassRef: React.RefObject<any>;
  /** Reference to the metronome plugin instance */
  metronomePluginRef: React.MutableRefObject<any>;
  /** Whether the track is ready */
  trackIsReady: boolean;
  /** Whether the plugin is already loaded */
  wamPluginLoaded: boolean;
  /** Number of plugin load attempts (for retry) */
  pluginLoadAttempts: number;
  /** Number of beats per measure */
  beats: number;
  /** Current volume (0-100) */
  volume: number;
  /** Whether muted */
  isMuted: boolean;
  /** Function to create metronome pattern */
  createMetronomePattern: () => MetronomePattern;
  /** Callback when plugin is loaded */
  onPluginLoaded: () => void;
  /** Reference to current region ID */
  currentRegionRef: React.MutableRefObject<string | null>;
}

/**
 * Return type for the usePluginCreation hook
 */
export interface UsePluginCreationReturn {
  // No direct return values - state updates via callbacks and refs
}

/**
 * Options for the useMetronomePattern hook
 */
export interface UseMetronomePatternOptions {
  /** Number of beats per measure */
  beats: number;
  /** Note value (denominator) */
  noteValue: number;
  /** Number of subdivisions */
  subdivisions: number;
}

/**
 * Return type for the useMetronomePattern hook
 */
export interface UseMetronomePatternReturn {
  /** Create a metronome pattern based on current settings */
  createMetronomePattern: () => MetronomePattern;
}

/**
 * Options for the useTimeSignature hook
 */
export interface UseTimeSignatureOptions {
  /** Time signature from props */
  timeSignature?: TimeSignature;
  /** Default number of beats */
  defaultBeats?: number;
  /** Default note value */
  defaultNoteValue?: number;
}

/**
 * Return type for the useTimeSignature hook
 */
export interface UseTimeSignatureReturn {
  /** Number of beats per measure */
  beats: number;
  /** Note value (denominator of time signature) */
  noteValue: number;
  /** Set beats per measure */
  setBeats: (beats: number) => void;
  /** Set note value */
  setNoteValue: (noteValue: number) => void;
}

/**
 * Options for the useSubdivisions hook
 */
export interface UseSubdivisionsOptions {
  /** Reference to the metronome plugin */
  metronomePluginRef: React.RefObject<any>;
  /** Whether the plugin is loaded */
  wamPluginLoaded: boolean;
  /** Number of beats per measure */
  beats: number;
  /** Function to create metronome pattern */
  createMetronomePattern: () => MetronomePattern;
  /** Reference to current region ID */
  currentRegionRef: React.MutableRefObject<string | null>;
  /** Track instance for pattern registration */
  track: any;
}

/**
 * Return type for the useSubdivisions hook
 */
export interface UseSubdivisionsReturn {
  /** Current subdivision value */
  subdivisions: number;
  /** Handler for subdivision changes */
  handleSubdivisionChange: (subdiv: number) => void;
}

/**
 * Options for the useTempoSync hook
 */
export interface UseTempoSyncOptions {
  /** Reference to the metronome plugin */
  metronomePluginRef: React.RefObject<any>;
  /** Current tempo from transport */
  bpm: number;
}

/**
 * Return type for the useTempoSync hook
 */
export interface UseTempoSyncReturn {
  // No return values - effect only
}

/**
 * Options for the useMetronomeRegistration hook
 */
export interface UseMetronomeRegistrationOptions {
  /** Reference to the metronome plugin */
  metronomePluginRef: React.RefObject<any>;
  /** Whether the plugin is loaded */
  wamPluginLoaded: boolean;
  /** Number of beats per measure */
  beats: number;
  /** Note value (denominator) */
  noteValue: number;
  /** Function to create metronome pattern */
  createMetronomePattern: () => MetronomePattern;
  /** Reference to current region ID */
  currentRegionRef: React.MutableRefObject<string | null>;
  /** Track instance for pattern registration */
  track: any;
}

/**
 * Return type for the useMetronomeRegistration hook
 */
export interface UseMetronomeRegistrationReturn {
  // No return values - effect only
}

/**
 * Props for the BeatIndicators component
 */
export interface BeatIndicatorsProps {
  /** Number of beats to display */
  beats: number;
  /** Whether playback is active */
  isPlaying: boolean;
  /** Whether the widget is visible */
  isVisible: boolean;
  /** Whether volume is muted or zero */
  isMutedOrZero: boolean;
  /** Callback when clicking the indicators (to expand) */
  onClick: () => void;
}

/**
 * Props for the ExpandedControls component
 */
export interface ExpandedControlsProps {
  /** Current sound preset */
  currentSound: MetronomeSoundType;
  /** Current subdivision value */
  subdivisions: number;
  /** Whether the track is ready */
  trackIsReady: boolean;
  /** Callback when sound changes */
  onSoundChange: (sound: MetronomeSoundType) => void;
  /** Callback when subdivision changes */
  onSubdivisionChange: (subdiv: number) => void;
  /** Test click callback */
  onTestClick: () => void;
  /** Close expanded view callback */
  onClose: () => void;
}
