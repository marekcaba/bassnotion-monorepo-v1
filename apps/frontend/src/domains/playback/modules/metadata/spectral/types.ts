/**
 * Types specific to spectral analysis module
 */

import type { FrequencyBinData, HarmonicContent } from '@bassnotion/contracts';

export interface SpectralAnalysisConfig {
  fftSize: number;
  windowFunction: 'hanning' | 'hamming' | 'blackman';
  smoothingTimeConstant: number;
}

export interface SpectralFrame {
  spectrum: Float32Array;
  timestamp: number;
  energy: number;
}

export interface FrequencyRange {
  minFreq: number;
  maxFreq: number;
  label: string;
}

export const FREQUENCY_RANGES: Record<keyof FrequencyBinData, FrequencyRange> =
  {
    subBass: { minFreq: 20, maxFreq: 60, label: 'Sub Bass' },
    bass: { minFreq: 60, maxFreq: 250, label: 'Bass' },
    lowMids: { minFreq: 250, maxFreq: 500, label: 'Low Mids' },
    mids: { minFreq: 500, maxFreq: 2000, label: 'Mids' },
    highMids: { minFreq: 2000, maxFreq: 4000, label: 'High Mids' },
    highs: { minFreq: 4000, maxFreq: 8000, label: 'Highs' },
    airFreqs: { minFreq: 8000, maxFreq: 20000, label: 'Air Frequencies' },
  };
