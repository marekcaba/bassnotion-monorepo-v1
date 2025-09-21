/**
 * Types specific to musical feature extraction module
 */

export interface MusicalFeatureConfig {
  onsetSensitivity: number;
  genreModelVersion: string;
  instrumentModelVersion: string;
}

export interface Onset {
  time: number;
  strength: number;
  type: 'percussive' | 'harmonic' | 'mixed';
}

export interface RhythmPattern {
  pattern: number[];
  confidence: number;
  timeSignature: string;
}

export interface GenreFeatures {
  tempo: number;
  rhythmComplexity: number;
  harmonicContent: number;
  spectralVariance: number;
}

export interface InstrumentFeatures {
  attackTime: number;
  spectralCentroid: number;
  harmonicRatio: number;
  noisiness: number;
}