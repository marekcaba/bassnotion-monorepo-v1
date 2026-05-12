/**
 * Sample Manifest Configuration
 * Defines quality tiers and loading priorities for all instruments
 */

export interface SampleDefinition {
  url: string;
  note?: string;
  velocity?: number;
  size?: number; // bytes
}

export interface SampleTier {
  quality: 'essential' | 'standard' | 'premium';
  description: string;
  samples: SampleDefinition[];
  estimatedSize: number; // total bytes
  loadTime: number; // estimated ms at 1Mbps
}

export interface InstrumentManifest {
  name: string;
  displayName: string;
  tiers: SampleTier[];
}

/**
 * Complete manifest of all audio samples with quality tiers
 */
export const SAMPLE_MANIFEST: Record<string, InstrumentManifest> = {
  harmony: {
    name: 'harmony',
    displayName: 'Harmony (Piano)',
    tiers: [
      {
        quality: 'essential',
        description: 'Single velocity, core notes only',
        samples: [
          { url: 'C3.mp3', note: 'C3', velocity: 64, size: 50000 },
          { url: 'D3.mp3', note: 'D3', velocity: 64, size: 50000 },
          { url: 'E3.mp3', note: 'E3', velocity: 64, size: 50000 },
          { url: 'F3.mp3', note: 'F3', velocity: 64, size: 50000 },
          { url: 'G3.mp3', note: 'G3', velocity: 64, size: 50000 },
          { url: 'A3.mp3', note: 'A3', velocity: 64, size: 50000 },
          { url: 'B3.mp3', note: 'B3', velocity: 64, size: 50000 },
          { url: 'C4.mp3', note: 'C4', velocity: 64, size: 50000 },
        ],
        estimatedSize: 400000, // 400KB
        loadTime: 3200, // 3.2 seconds at 1Mbps
      },
      {
        quality: 'standard',
        description: '3 velocity layers, chromatic scale',
        samples: [
          // Velocity layer 1 (pp - pianissimo)
          { url: 'C3v1.mp3', note: 'C3', velocity: 32, size: 45000 },
          { url: 'Ds3v1.mp3', note: 'D#3', velocity: 32, size: 45000 },
          { url: 'Fs3v1.mp3', note: 'F#3', velocity: 32, size: 45000 },
          { url: 'A3v1.mp3', note: 'A3', velocity: 32, size: 45000 },
          { url: 'C4v1.mp3', note: 'C4', velocity: 32, size: 45000 },
          // Velocity layer 2 (mf - mezzo-forte)
          { url: 'C3v2.mp3', note: 'C3', velocity: 64, size: 50000 },
          { url: 'Ds3v2.mp3', note: 'D#3', velocity: 64, size: 50000 },
          { url: 'Fs3v2.mp3', note: 'F#3', velocity: 64, size: 50000 },
          { url: 'A3v2.mp3', note: 'A3', velocity: 64, size: 50000 },
          { url: 'C4v2.mp3', note: 'C4', velocity: 64, size: 50000 },
          // Velocity layer 3 (ff - fortissimo)
          { url: 'C3v3.mp3', note: 'C3', velocity: 96, size: 55000 },
          { url: 'Ds3v3.mp3', note: 'D#3', velocity: 96, size: 55000 },
          { url: 'Fs3v3.mp3', note: 'F#3', velocity: 96, size: 55000 },
          { url: 'A3v3.mp3', note: 'A3', velocity: 96, size: 55000 },
          { url: 'C4v3.mp3', note: 'C4', velocity: 96, size: 55000 },
        ],
        estimatedSize: 1500000, // 1.5MB
        loadTime: 12000, // 12 seconds at 1Mbps
      },
      {
        quality: 'premium',
        description: '5+ velocity layers, full range, release samples',
        samples: [
          // This would be the full Salamander Grand Piano
          // 88 keys × 5 velocities × ~100KB per sample = ~44MB
        ],
        estimatedSize: 44000000, // 44MB
        loadTime: 352000, // 5.8 minutes at 1Mbps (why we need background loading!)
      },
    ],
  },

  drums: {
    name: 'drums',
    displayName: 'Drum Kit',
    tiers: [
      {
        quality: 'essential',
        description: 'Basic synth drums',
        samples: [], // Synths don't need samples
        estimatedSize: 0,
        loadTime: 0,
      },
      {
        quality: 'standard',
        description: 'Colombo Acoustic samples',
        samples: [
          { url: 'kick-v1.wav', size: 125746 }, // kick
          { url: 'snare-v1.wav', size: 227378 }, // snare
          { url: 'hihat-v1.wav', size: 137350 }, // closed hihat
        ],
        estimatedSize: 490474, // ~490KB (126+227+137)
        loadTime: 3924, // ~3.9 seconds at 1Mbps
      },
      {
        quality: 'premium',
        description: 'Multi-layered acoustic kit',
        samples: [
          // Full kit with round-robins and velocity layers
          // ~20 drums × 4 velocities × 3 round-robins × 50KB = ~12MB
        ],
        estimatedSize: 12000000, // 12MB
        loadTime: 96000, // 1.6 minutes at 1Mbps
      },
    ],
  },

  bass: {
    name: 'bass',
    displayName: 'Bass Guitar',
    tiers: [
      {
        quality: 'essential',
        description: 'Open strings only',
        samples: [
          { url: 'E1.mp3', note: 'E1', size: 60000 },
          { url: 'A1.mp3', note: 'A1', size: 60000 },
          { url: 'D2.mp3', note: 'D2', size: 60000 },
          { url: 'G2.mp3', note: 'G2', size: 60000 },
        ],
        estimatedSize: 240000, // 240KB
        loadTime: 1920, // 2 seconds at 1Mbps
      },
      {
        quality: 'standard',
        description: 'Chromatic, single velocity',
        samples: [
          // E1 to G3, chromatic
        ],
        estimatedSize: 2000000, // 2MB
        loadTime: 16000, // 16 seconds at 1Mbps
      },
      {
        quality: 'premium',
        description: 'Multi-velocity with articulations',
        samples: [
          // Full range with slaps, pops, harmonics
        ],
        estimatedSize: 8000000, // 8MB
        loadTime: 64000, // 1 minute at 1Mbps
      },
    ],
  },

  metronome: {
    name: 'metronome',
    displayName: 'Metronome',
    tiers: [
      {
        quality: 'essential',
        description: 'Basic click',
        samples: [], // Synth-based
        estimatedSize: 0,
        loadTime: 0,
      },
      {
        quality: 'standard',
        description: 'Woodblock and click samples',
        samples: [
          { url: 'Click_High.mp3', size: 5000 }, // High pitched
          { url: 'Click_Low.mp3', size: 5000 }, // Low pitched
          { url: 'woodblock_hi.mp3', size: 8000 },
          { url: 'woodblock_lo.mp3', size: 8000 },
        ],
        estimatedSize: 26000, // 26KB
        loadTime: 208, // 0.2 seconds at 1Mbps
      },
      {
        quality: 'premium',
        description: 'Multiple click types',
        samples: [
          // Various click sounds, cowbell, rimshot, etc.
        ],
        estimatedSize: 100000, // 100KB
        loadTime: 800, // 0.8 seconds at 1Mbps
      },
    ],
  },

  'voice-cue': {
    name: 'voice-cue',
    displayName: 'Voice Countdown Cues',
    tiers: [
      {
        quality: 'essential',
        description: 'Voice countdown samples',
        samples: [
          { url: 'metronome/Cues/one.ogg', size: 11000 }, // "One"
          { url: 'metronome/Cues/two.ogg', size: 11000 }, // "Two"
          { url: 'metronome/Cues/three.ogg', size: 4500 }, // "Three"
          { url: 'metronome/Cues/four.ogg', size: 11000 }, // "Four"
        ],
        estimatedSize: 37500, // 37.5KB (much smaller than MP3!)
        loadTime: 300, // ~0.3 seconds at 1Mbps
      },
      {
        quality: 'standard',
        description: 'Extended voice cues',
        samples: [
          { url: 'metronome/Cues/one.ogg', size: 11000 },
          { url: 'metronome/Cues/two.ogg', size: 11000 },
          { url: 'metronome/Cues/three.ogg', size: 4500 },
          { url: 'metronome/Cues/four.ogg', size: 11000 },
          { url: 'metronome/Cues/ready.ogg', size: 11000 }, // "Ready" (future)
          { url: 'metronome/Cues/go.ogg', size: 11000 }, // "Go!" (future)
        ],
        estimatedSize: 59500, // 59.5KB
        loadTime: 476, // ~0.5 seconds at 1Mbps
      },
      {
        quality: 'premium',
        description: 'Full voice guidance pack',
        samples: [
          // Future: Multiple voice packs, languages, phrases
        ],
        estimatedSize: 500000, // 500KB
        loadTime: 4000, // 4 seconds at 1Mbps
      },
    ],
  },
};

/**
 * Get loading priority order based on typical user needs
 */
export function getLoadingPriority(): string[] {
  return [
    'voice-cue:essential', // Load voice cues first for countdown
    'harmony:essential',
    'drums:essential',
    'metronome:essential',
    'harmony:standard',
    'drums:standard',
    'bass:essential',
    'metronome:standard',
    'voice-cue:standard',
    'harmony:premium',
    'drums:premium',
    'bass:standard',
    'bass:premium',
    'metronome:premium',
    'voice-cue:premium',
  ];
}

/**
 * Calculate total size for a given quality tier across all instruments
 */
export function calculateTotalSize(
  quality: 'essential' | 'standard' | 'premium',
): number {
  let totalSize = 0;

  Object.values(SAMPLE_MANIFEST).forEach((instrument) => {
    const tier = instrument.tiers.find((t) => t.quality === quality);
    if (tier) {
      totalSize += tier.estimatedSize;
    }
  });

  return totalSize;
}

/**
 * Get human-readable size string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Estimate loading time based on connection speed
 */
export function estimateLoadTime(bytes: number, mbps = 1): number {
  const bytesPerSecond = (mbps * 1000000) / 8; // Convert Mbps to bytes/second
  return Math.round((bytes / bytesPerSecond) * 1000); // Return milliseconds
}

/**
 * Get recommended quality tier based on connection speed
 */
export function getRecommendedQuality(
  connectionType?: string,
): 'essential' | 'standard' | 'premium' {
  // Use Network Information API if available (typed in window.d.ts)
  if (navigator.connection) {
    const effectiveType = navigator.connection.effectiveType;

    switch (effectiveType) {
      case 'slow-2g':
      case '2g':
        return 'essential';
      case '3g':
        return 'standard';
      case '4g':
      default:
        return 'premium';
    }
  }

  // Default to standard if we can't detect
  return 'standard';
}
