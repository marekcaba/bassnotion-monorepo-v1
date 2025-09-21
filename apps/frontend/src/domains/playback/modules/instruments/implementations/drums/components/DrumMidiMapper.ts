/**
 * DrumMidiMapper - MIDI note mapping for drum instruments
 *
 * Extracted from DrumInstrumentProcessor to follow single responsibility principle.
 * Handles General MIDI drum mapping and custom BassNotion extensions.
 *
 * Features:
 * - General MIDI standard compliance
 * - Extended percussion mapping
 * - Velocity-based hit type detection
 * - Custom drum piece routing
 */

import { createStructuredLogger } from '../../../../shared/index.js';

const logger = createStructuredLogger('DrumMidiMapper');

export enum DrumPiece {
  KICK = 'kick',
  SNARE = 'snare',
  HIHAT_CLOSED = 'hihat_closed',
  HIHAT_OPEN = 'hihat_open',
  HIHAT_PEDAL = 'hihat_pedal',
  CRASH_1 = 'crash_1',
  CRASH_2 = 'crash_2',
  SPLASH = 'splash',
  CHINA = 'china',
  RIDE = 'ride',
  RIDE_BELL = 'ride_bell',
  TOM_1 = 'tom_1', // High tom
  TOM_2 = 'tom_2', // Mid tom
  TOM_3 = 'tom_3', // Floor tom
  CLAP = 'clap',
  COWBELL = 'cowbell',
  TAMBOURINE = 'tambourine',
  SHAKER = 'shaker',
  SIDE_STICK = 'side_stick',
}

export enum DrumHitType {
  NORMAL = 'normal',
  GHOST = 'ghost', // Low velocity
  ACCENT = 'accent', // High velocity
  FLAM = 'flam',
  ROLL = 'roll',
}

// General MIDI Drum Map (Standard + Extended)
export const GM_DRUM_MAP: Record<number, DrumPiece> = {
  // Standard GM Drum Map
  35: DrumPiece.KICK, // Acoustic Bass Drum
  36: DrumPiece.KICK, // Bass Drum 1
  37: DrumPiece.SIDE_STICK, // Side Stick
  38: DrumPiece.SNARE, // Acoustic Snare
  39: DrumPiece.CLAP, // Hand Clap
  40: DrumPiece.SNARE, // Electric Snare
  41: DrumPiece.TOM_3, // Low Floor Tom
  42: DrumPiece.HIHAT_CLOSED, // Closed Hi Hat
  43: DrumPiece.TOM_3, // High Floor Tom
  44: DrumPiece.HIHAT_PEDAL, // Pedal Hi-Hat
  45: DrumPiece.TOM_2, // Low Tom
  46: DrumPiece.HIHAT_OPEN, // Open Hi-Hat
  47: DrumPiece.TOM_2, // Low-Mid Tom
  48: DrumPiece.TOM_1, // Hi-Mid Tom
  49: DrumPiece.CRASH_1, // Crash Cymbal 1
  50: DrumPiece.TOM_1, // High Tom
  51: DrumPiece.RIDE, // Ride Cymbal 1
  52: DrumPiece.CRASH_2, // Chinese Cymbal
  53: DrumPiece.RIDE_BELL, // Ride Bell
  54: DrumPiece.TAMBOURINE, // Tambourine
  55: DrumPiece.SPLASH, // Splash Cymbal
  56: DrumPiece.COWBELL, // Cowbell
  57: DrumPiece.CRASH_2, // Crash Cymbal 2
  58: DrumPiece.SHAKER, // Vibraslap/Shaker
  59: DrumPiece.RIDE, // Ride Cymbal 2
  60: DrumPiece.TOM_1, // Hi Bongo
  61: DrumPiece.TOM_2, // Low Bongo
  62: DrumPiece.TOM_1, // Mute Hi Conga
  63: DrumPiece.TOM_2, // Open Hi Conga
  64: DrumPiece.TOM_3, // Low Conga
  65: DrumPiece.TOM_1, // High Timbale
  66: DrumPiece.TOM_2, // Low Timbale
  67: DrumPiece.TOM_1, // High Agogo
  68: DrumPiece.TOM_2, // Low Agogo
  69: DrumPiece.SHAKER, // Cabasa
  70: DrumPiece.SHAKER, // Maracas
  71: DrumPiece.SHAKER, // Short Whistle
  72: DrumPiece.SHAKER, // Long Whistle
  73: DrumPiece.SHAKER, // Short Guiro
  74: DrumPiece.SHAKER, // Long Guiro
  75: DrumPiece.CLAP, // Claves
  76: DrumPiece.TOM_1, // Hi Wood Block
  77: DrumPiece.TOM_2, // Low Wood Block
  78: DrumPiece.TOM_1, // Mute Cuica
  79: DrumPiece.TOM_2, // Open Cuica
  80: DrumPiece.TOM_1, // Mute Triangle
  81: DrumPiece.TOM_2, // Open Triangle
};

export interface DrumMidiEvent {
  note: number;
  velocity: number;
  timestamp: number;
  channel?: number;
}

export interface DrumMapping {
  piece: DrumPiece;
  hitType: DrumHitType;
  velocity: number;
}

/**
 * DrumMidiMapper - Handles MIDI note mapping and velocity interpretation
 */
export class DrumMidiMapper {
  private customMapping: Map<number, DrumPiece> = new Map();
  private velocityThresholds = {
    ghost: 30, // Below this = ghost note
    normal: 100, // Between ghost and accent = normal
    accent: 127, // Above normal = accent
  };

  constructor() {
    // Initialize with GM mapping
    Object.entries(GM_DRUM_MAP).forEach(([note, piece]) => {
      this.customMapping.set(parseInt(note), piece);
    });
  }

  /**
   * Map MIDI note to drum piece and hit type
   */
  mapMidiNote(midiEvent: DrumMidiEvent): DrumMapping {
    const { note, velocity } = midiEvent;

    // Get drum piece from mapping
    const piece = this.customMapping.get(note) || DrumPiece.KICK;

    // Determine hit type based on velocity
    const hitType = this.getHitTypeFromVelocity(velocity);

    logger.debug('Mapped MIDI note', {
      note,
      velocity,
      piece,
      hitType,
    });

    return {
      piece,
      hitType,
      velocity,
    };
  }

  /**
   * Get hit type based on velocity
   */
  private getHitTypeFromVelocity(velocity: number): DrumHitType {
    if (velocity <= this.velocityThresholds.ghost) {
      return DrumHitType.GHOST;
    } else if (velocity >= this.velocityThresholds.accent) {
      return DrumHitType.ACCENT;
    } else {
      return DrumHitType.NORMAL;
    }
  }

  /**
   * Set custom mapping for specific MIDI note
   */
  setCustomMapping(note: number, piece: DrumPiece): void {
    this.customMapping.set(note, piece);
    logger.info(`Set custom mapping: MIDI ${note} -> ${piece}`);
  }

  /**
   * Set velocity thresholds for hit type detection
   */
  setVelocityThresholds(
    thresholds: Partial<typeof this.velocityThresholds>,
  ): void {
    this.velocityThresholds = { ...this.velocityThresholds, ...thresholds };
    logger.info('Updated velocity thresholds', this.velocityThresholds);
  }

  /**
   * Get all available drum pieces
   */
  getAvailablePieces(): DrumPiece[] {
    return Object.values(DrumPiece);
  }

  /**
   * Check if MIDI note is mapped
   */
  isMapped(note: number): boolean {
    return this.customMapping.has(note);
  }

  /**
   * Get current mapping for debugging
   */
  getCurrentMapping(): Map<number, DrumPiece> {
    return new Map(this.customMapping);
  }
}

// Export singleton instance for convenience
export const drumMidiMapper = new DrumMidiMapper();
