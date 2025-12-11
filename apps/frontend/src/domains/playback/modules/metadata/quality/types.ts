/**
 * Types specific to quality assessment module
 */

export interface QualityAssessmentConfig {
  clippingThreshold: number;
  silenceThreshold: number;
  targetLUFS: number;
}

export interface ClippingSample {
  position: number;
  value: number;
}

export interface DynamicRangeMetrics {
  peak: number;
  rms: number;
  crestFactor: number;
  lufs: number;
}

export interface QualityMetrics {
  snr: number;
  thd: number;
  clarity: number;
}
