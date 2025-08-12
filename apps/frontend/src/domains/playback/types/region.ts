import type { MusicalPosition } from './pattern.js';

/**
 * Musical region - container for musical data like Logic regions or Ableton clips
 */
export interface Region {
  /** Unique region identifier */
  id: string;
  
  /** Parent track ID */
  trackId: string;
  
  /** Region name for UI */
  name: string;

  // === Timing Properties ===
  /** Start position in musical time (e.g., "1:0:0" = bar 1, beat 0) */
  startPosition: MusicalPosition;
  
  /** Duration in musical time (e.g., "4:0:0" = 4 bars) */
  duration: MusicalPosition;

  // === Content Properties (one of these) ===
  /** Existing pattern data for backward compatibility */
  pattern?: Pattern;
  
  /** MIDI events for advanced sequencing */
  midiEvents?: MidiEvent[];
  
  /** Audio clip reference for future audio regions */
  audioClipId?: string;

  // === Playback Properties ===
  /** Loop count: 0 = infinite, 1 = play once, n = loop n times */
  loopCount: number;
  
  /** Region mute state */
  muted: boolean;
  
  /** Quantization override */
  quantization?: QuantizationSettings;

  // === Visual Properties ===
  /** Region color for UI */
  color?: string;
  
  /** Lane index for multi-lane track view */
  laneIndex?: number;
  
  /** UI position and size */
  uiState?: {
    collapsed: boolean;
    height: number;
  };
}

/**
 * MIDI event for regions
 */
export interface MidiEvent {
  /** Event type */
  type: 'noteOn' | 'noteOff' | 'cc' | 'programChange' | 'pitchBend';
  
  /** Time relative to region start */
  time: MusicalPosition;
  
  /** MIDI channel (1-16) */
  channel: number;
  
  /** Event-specific data */
  data: MidiEventData;
}

export type MidiEventData = 
  | NoteEventData 
  | ControlChangeData 
  | ProgramChangeData 
  | PitchBendData;

export interface NoteEventData {
  pitch: number;    // 0-127
  velocity: number; // 0-127
}

export interface ControlChangeData {
  controller: number; // 0-127
  value: number;      // 0-127
}

export interface ProgramChangeData {
  program: number; // 0-127
}

export interface PitchBendData {
  value: number; // -8192 to 8191
}

/**
 * Quantization settings for regions
 */
export interface QuantizationSettings {
  enabled: boolean;
  gridSize: '1/4' | '1/8' | '1/16' | '1/32' | 'triplet';
  strength: number; // 0-1
  swing: number;    // -1 to 1
}

// Import Pattern type
import type { Pattern } from './pattern.js';
import type { TimeSignature } from './timing.js';