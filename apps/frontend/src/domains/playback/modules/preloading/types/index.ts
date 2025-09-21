/**
 * Preloading Module Types
 */

export interface PreloadConfig {
  /**
   * Priority level for loading
   */
  priority?: 'low' | 'medium' | 'high';

  /**
   * Specific instruments to preload
   */
  instruments?: Array<'drums' | 'harmony' | 'bass' | 'metronome'>;

  /**
   * Maximum concurrent downloads
   */
  maxConcurrent?: number;

  /**
   * Timeout for individual sample loads
   */
  timeout?: number;
}

export interface PreloadProgress {
  /**
   * Total samples to load
   */
  total: number;

  /**
   * Samples successfully loaded
   */
  loaded: number;

  /**
   * Progress percentage (0-1)
   */
  progress: number;

  /**
   * Current loading phase
   */
  phase: 'idle' | 'essential' | 'full' | 'complete';
}

export interface PreloadResult {
  /**
   * Whether the preload was successful
   */
  success: boolean;

  /**
   * Error message if failed
   */
  error?: string;

  /**
   * Number of samples loaded
   */
  loaded: number;

  /**
   * Total samples attempted
   */
  total: number;
}
