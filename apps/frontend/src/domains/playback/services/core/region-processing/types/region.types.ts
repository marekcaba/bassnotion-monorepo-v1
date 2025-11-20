/**
 * Shared type definitions for RegionProcessor modules
 */

export interface PatternEvent {
  position: string; // MUSICAL TIME - Tone.js format: "bar:beat:sixteenth" - SINGLE SOURCE OF TRUTH
  type: string;
  velocity?: number;
  duration?: string;
  // NOTE: We deliberately do NOT cache absolute time here
  // Time is calculated on-demand via parsePosition() using current Tone.Transport.bpm
  // This ensures tempo changes work correctly
}

export interface Region {
  id: string;
  trackId: string;
  startTime: number;
  duration: number;
  skipCountdownOffset?: boolean; // If true, don't apply countdown offset to this region
  pattern?: {
    id?: string;
    name?: string;
    type?: string;
    events?: PatternEvent[];
  };
}

export interface Track {
  id?: string;
  track?: { id?: string };
  name?: string;
  regions: Region[];
  instrumentType?: string;
  exerciseId?: string; // Optional: For caching event schedules per exercise
  audioNode?: any; // Optional: Reference to WAM plugin node
}

export interface TransportPosition {
  bars: number;
  beats: number;
  sixteenths: number;
  seconds: number;
}

/**
 * Cached schedule data for an exercise
 * Contains pre-calculated CC64 timeline and event schedule
 * to avoid recalculating on every playback
 */
export interface CachedSchedule {
  cc64Timeline: Map<number, boolean>; // Map of audioTime → pedalDown state
  calculatedEvents: Array<{
    absoluteTime: number;
    event: PatternEvent;
    instrumentType: string;
    eventKey: string;
    regionId: string;
  }>;
  cachedAt: number; // Timestamp when cached
  bpm: number; // BPM used for calculations
  countdownBeats: number; // Countdown setting used
}

/**
 * Parsed musical position result
 */
export interface ParsedPosition {
  bars: number;
  beats: number;
  sixteenths: number;
}

/**
 * Detailed position with tick precision (for sorting)
 */
export interface DetailedPosition {
  measure: number;
  beat: number;
  subdivision: number;
  tick: number;
}
