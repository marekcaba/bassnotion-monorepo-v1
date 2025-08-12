/**
 * Professional DAW Pattern System
 * 
 * Widgets define patterns in musical time
 * Transport handles all timing and scheduling
 */

/**
 * Musical position in bars:beats:sixteenths format
 * Examples: "0:0:0" (start), "1:2:0" (bar 1, beat 2)
 */
export type MusicalPosition = string;

/**
 * Base pattern event that all patterns extend
 */
export interface PatternEvent {
  position: MusicalPosition;
  velocity: number; // 0-1
  duration?: string; // Tone.js duration notation (e.g., "4n", "8n")
}

/**
 * Drum pattern definition
 */
export interface DrumPatternEvent extends PatternEvent {
  drum: 'kick' | 'snare' | 'hihat' | 'crash' | 'ride' | 'tom1' | 'tom2' | 'tom3';
}

export interface DrumPattern {
  id: string;
  events: DrumPatternEvent[];
  loopLength: number; // in bars
}

/**
 * Metronome pattern definition
 */
export interface MetronomePatternEvent extends PatternEvent {
  type: 'click' | 'accent';
  pitch?: string; // Note name (e.g., "C4", "C5")
}

export interface MetronomePattern {
  id: string;
  events: MetronomePatternEvent[];
  timeSignature: {
    numerator: number;
    denominator: number;
  };
}

/**
 * Harmony/Chord pattern definition
 */
export interface ChordPatternEvent extends PatternEvent {
  chord: string; // Chord symbol (e.g., "Cmaj7", "Dm7")
  notes?: string[]; // Specific notes if needed
  voicing?: 'root' | 'first' | 'second' | 'third'; // Inversion
}

export interface HarmonyPattern {
  id: string;
  events: ChordPatternEvent[];
  loopLength: number; // in bars
}

/**
 * Bass pattern definition (for future use)
 */
export interface BassPatternEvent extends PatternEvent {
  note: string; // Note name (e.g., "E2")
  technique?: 'normal' | 'slap' | 'pop' | 'mute' | 'harmonic';
}

export interface BassPattern {
  id: string;
  events: BassPatternEvent[];
  loopLength: number; // in bars
}

/**
 * Generic pattern type
 */
export type Pattern = DrumPattern | MetronomePattern | HarmonyPattern | BassPattern;

/**
 * Pattern registration for transport
 */
export interface RegisteredPattern {
  widgetId: string;
  widgetType: 'drums' | 'metronome' | 'harmony' | 'bass';
  pattern: Pattern;
  enabled: boolean;
  // Callback for the transport to trigger events
  triggerCallback: (event: PatternEvent, time: number) => void;
}

/**
 * Pattern registry interface
 */
export interface PatternRegistry {
  register(widgetId: string, registration: Omit<RegisteredPattern, 'widgetId'>): void;
  unregister(widgetId: string): void;
  update(widgetId: string, pattern: Pattern): void;
  setEnabled(widgetId: string, enabled: boolean): void;
  getAll(): Map<string, RegisteredPattern>;
  clear(): void;
}

/**
 * Helper to convert beat/sixteenth to musical position
 */
export function toMusicalPosition(bar: number, beat: number, sixteenth: number = 0): MusicalPosition {
  return `${bar}:${beat}:${sixteenth}`;
}

/**
 * Helper to parse musical position
 */
export function parseMusicalPosition(position: MusicalPosition): {
  bar: number;
  beat: number;
  sixteenth: number;
} {
  const [bar, beat, sixteenth] = position.split(':').map(Number);
  return { bar, beat, sixteenth };
}