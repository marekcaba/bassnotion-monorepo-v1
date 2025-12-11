/**
 * Types specific to tempo detection module
 */

export interface TempoDetectionConfig {
  minBPM: number;
  maxBPM: number;
  windowSize: number;
  hopSize: number;
  highPrecision: boolean;
}

export interface BeatInterval {
  time: number;
  confidence: number;
}

export interface OnsetPeak {
  time: number;
  strength: number;
}

export interface TempoCandidate {
  bpm: number;
  confidence: number;
  phase: number;
}
