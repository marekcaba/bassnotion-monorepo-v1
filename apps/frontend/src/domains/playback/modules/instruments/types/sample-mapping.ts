/**
 * Sample Mapping Types
 *
 * Type definitions for instrument sample mappings
 * Used by SampleMappingLoader to load external JSON configurations
 */

/**
 * Velocity range definition for multi-velocity instruments
 */
export interface VelocityRange {
  min: number; // MIDI velocity minimum (0-127)
  max: number; // MIDI velocity maximum (0-127)
  layer: string; // Layer identifier (e.g., 'v1', 'v2', etc.)
}

/**
 * Note-to-file mapping for samples
 */
export interface SampleMapping {
  [note: string]: string; // e.g., { "C4": "C4.mp3", "D4": "D4.mp3" }
}

/**
 * Complete instrument sample configuration
 */
export interface InstrumentSampleConfig {
  /**
   * Instrument metadata
   */
  name: string;
  version: string;
  author?: string;
  description?: string;

  /**
   * Sample storage configuration
   */
  storage: {
    baseUrl?: string; // Base URL for samples (if remote)
    localPath?: string; // Local path for samples
    bucketPath?: string; // Supabase/S3 bucket path
  };

  /**
   * Velocity layers configuration
   */
  velocityRanges: VelocityRange[];

  /**
   * Note-to-file mappings
   */
  sampleMapping: SampleMapping;

  /**
   * Default velocity layers to load on init
   */
  defaultLayers?: string[];

  /**
   * Sampler configuration
   */
  samplerConfig?: {
    attack?: number;
    release?: number;
    curve?: 'exponential' | 'linear';
    volume?: number;
  };

  /**
   * Mechanical sounds (optional)
   */
  mechanicalSounds?: {
    damperRelease?: {
      samples: SampleMapping;
      volume?: number;
      offset?: number;
    };
    pedalNoise?: {
      samples: SampleMapping;
      volume?: number;
    };
  };

  /**
   * Performance optimization hints
   */
  optimization?: {
    preloadPriority?: string[]; // Layers to preload first
    memoryLimit?: number; // Max memory usage in MB
    streamingEnabled?: boolean; // Use streaming for large samples
    compressionFormat?: string; // e.g., 'mp3', 'ogg', 'opus'
  };
}

/**
 * Drum kit specific configuration
 */
export interface DrumKitConfig {
  name: string;
  version: string;

  /**
   * Drum piece mappings
   */
  pieces: {
    [pieceName: string]: {
      noteMapping: number | number[]; // MIDI note(s) that trigger this piece
      samples: {
        [velocity: string]: string; // Velocity layer to sample file
      };
      defaultSample?: string; // Fallback sample
      volume?: number; // Relative volume adjustment
      pan?: number; // Stereo position (-1 to 1)
      envelope?: {
        attack?: number;
        decay?: number;
        sustain?: number;
        release?: number;
      };
    };
  };

  /**
   * Global drum kit settings
   */
  settings?: {
    humanizeAmount?: number;
    swingAmount?: number;
    defaultVelocity?: number;
  };
}

/**
 * Simplified sample set for quick loading
 */
export interface SimpleSampleSet {
  name: string;
  samples: SampleMapping;
  baseUrl?: string;
}
