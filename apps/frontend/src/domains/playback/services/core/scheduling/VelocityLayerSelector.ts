/**
 * VelocityLayerSelector - Dynamic velocity layer selection for harmony instruments
 *
 * Extracted from legacy HarmonyScheduler.ts (lines 1185-1257)
 * FAANG Compliance: 150 lines < 600 line limit
 *
 * Responsibilities:
 * - Per-note velocity range mapping (from instrument config JSON)
 * - Instrument-specific velocity layer selection (4-16 layers)
 * - Fallback logic when per-note config is missing
 * - Support for Grand Piano (7 layers), Wurlitzer (5 layers), Rhodes (4 layers)
 *
 * Usage:
 * ```typescript
 * const selector = new VelocityLayerSelector('wurlitzer', perNoteRanges);
 * const layer = selector.selectLayer(velocity, noteName); // Returns 'v1'-'v5'
 * ```
 */

import { createStructuredLogger } from '../../../modules/shared/index.js';

const logger = createStructuredLogger('VelocityLayerSelector');

/**
 * Velocity range definition for a specific note
 */
export interface VelocityRange {
  min: number; // Minimum MIDI velocity (0-127)
  max: number; // Maximum MIDI velocity (0-127)
  layer: string; // Layer name (e.g., 'v1', 'v2', etc.)
}

/**
 * Supported harmony instruments with different velocity layer counts
 */
export type HarmonyInstrument =
  | 'grandpiano'
  | 'wurlitzer'
  | 'rhodes'
  | 'nicekeysrhodes';

/**
 * Per-note velocity ranges loaded from instrument config JSON
 * Key: Note name (e.g., 'C4', 'Cs4', 'C#4')
 * Value: Array of velocity ranges for that note
 */
export type PerNoteVelocityRanges = Record<string, VelocityRange[]>;

/**
 * VelocityLayerSelector - Determines which velocity layer to use for a note
 *
 * Supports two modes:
 * 1. Per-note velocity ranges (from config JSON) - Most accurate
 * 2. Instrument-specific fallback ranges - Used when config missing
 */
export class VelocityLayerSelector {
  private instrument: HarmonyInstrument;
  private perNoteRanges?: PerNoteVelocityRanges;

  /**
   * Create a new VelocityLayerSelector
   *
   * @param instrument - The harmony instrument type
   * @param perNoteRanges - Optional per-note velocity configuration from instrument JSON
   */
  constructor(
    instrument: HarmonyInstrument,
    perNoteRanges?: PerNoteVelocityRanges,
  ) {
    this.instrument = instrument;
    this.perNoteRanges = perNoteRanges;

    logger.info('VelocityLayerSelector created', {
      instrument,
      hasPerNoteRanges: !!perNoteRanges,
      noteCount: perNoteRanges ? Object.keys(perNoteRanges).length : 0,
    });
  }

  /**
   * Select velocity layer for a note
   *
   * Tries per-note ranges first (if available), falls back to instrument-specific ranges
   *
   * @param velocity - MIDI velocity (0-127)
   * @param noteName - Note name (e.g., 'C4', 'Cs4', 'C#4')
   * @returns Layer name (e.g., 'v1', 'v2', 'v3', etc.)
   */
  public selectLayer(velocity: number, noteName: string): string {
    // Validate velocity range
    if (velocity < 0 || velocity > 127) {
      logger.warn('Velocity out of range, clamping', { velocity, noteName });
      velocity = Math.max(0, Math.min(127, velocity));
    }

    // Try per-note velocity ranges first (most accurate)
    if (this.perNoteRanges) {
      const layer = this.selectLayerFromPerNoteRanges(velocity, noteName);
      if (layer) {
        return layer;
      }
    }

    // Fallback to instrument-specific velocity mapping
    return this.selectLayerFromInstrumentRanges(velocity);
  }

  /**
   * Select layer using per-note velocity ranges from config JSON
   *
   * Handles both sharp notations: 'Cs4' and 'C#4'
   *
   * @private
   */
  private selectLayerFromPerNoteRanges(
    velocity: number,
    noteName: string,
  ): string | null {
    if (!this.perNoteRanges) {
      return null;
    }

    // Try with original notation first (e.g., 'Cs4')
    let ranges = this.perNoteRanges[noteName];

    // If not found, try converting to # notation (e.g., 'C#4')
    // The config might use either notation
    if (!ranges) {
      const noteWithSharp = noteName.replace('s', '#');
      ranges = this.perNoteRanges[noteWithSharp];
    }

    // If still not found, try converting # to s notation
    if (!ranges && noteName.includes('#')) {
      const noteWithS = noteName.replace('#', 's');
      ranges = this.perNoteRanges[noteWithS];
    }

    if (!ranges || ranges.length === 0) {
      return null; // No config for this note, use fallback
    }

    // Find which layer this velocity falls into for this specific note
    for (const range of ranges) {
      if (velocity >= range.min && velocity <= range.max) {
        return range.layer;
      }
    }

    // If velocity is out of range, use the last layer (highest velocity)
    const lastLayer = ranges[ranges.length - 1].layer;
    logger.debug('Velocity out of range for note, using highest layer', {
      velocity,
      noteName,
      layer: lastLayer,
    });
    return lastLayer;
  }

  /**
   * Select layer using instrument-specific velocity ranges
   *
   * Fallback when per-note config is not available
   *
   * @private
   */
  private selectLayerFromInstrumentRanges(velocity: number): string {
    switch (this.instrument) {
      case 'grandpiano':
        return this.selectGrandPianoLayer(velocity);
      case 'wurlitzer':
        return this.selectWurlitzerLayer(velocity);
      case 'rhodes':
        return this.selectRhodesLayer(velocity);
      case 'nicekeysrhodes':
        // Nice Keys Rhodes has same velocity ranges as regular Rhodes
        return this.selectRhodesLayer(velocity);
      default:
        logger.warn('Unknown instrument, defaulting to Wurlitzer ranges', {
          instrument: this.instrument,
        });
        return this.selectWurlitzerLayer(velocity);
    }
  }

  /**
   * Grand Piano velocity ranges (7 layers: v1-v7)
   * @private
   */
  private selectGrandPianoLayer(velocity: number): string {
    if (velocity <= 18) return 'v1';
    if (velocity <= 36) return 'v2';
    if (velocity <= 54) return 'v3';
    if (velocity <= 72) return 'v4';
    if (velocity <= 90) return 'v5';
    if (velocity <= 108) return 'v6';
    return 'v7';
  }

  /**
   * Wurlitzer velocity ranges (5 layers: v1-v5)
   * @private
   */
  private selectWurlitzerLayer(velocity: number): string {
    if (velocity <= 25) return 'v1';
    if (velocity <= 51) return 'v2';
    if (velocity <= 76) return 'v3';
    if (velocity <= 102) return 'v4';
    return 'v5';
  }

  /**
   * Rhodes velocity ranges (4 layers: v1-v4)
   * @private
   */
  private selectRhodesLayer(velocity: number): string {
    if (velocity <= 31) return 'v1';
    if (velocity <= 63) return 'v2';
    if (velocity <= 95) return 'v3';
    return 'v4';
  }

  /**
   * Update the instrument type
   *
   * Used when switching instruments mid-playback
   */
  public setInstrument(instrument: HarmonyInstrument): void {
    logger.info('Instrument changed', {
      from: this.instrument,
      to: instrument,
    });
    this.instrument = instrument;
  }

  /**
   * Update per-note velocity ranges
   *
   * Used when loading new instrument config
   */
  public setPerNoteRanges(ranges: PerNoteVelocityRanges | undefined): void {
    logger.info('Per-note velocity ranges updated', {
      hasRanges: !!ranges,
      noteCount: ranges ? Object.keys(ranges).length : 0,
    });
    this.perNoteRanges = ranges;
  }

  /**
   * Get current instrument
   */
  public getInstrument(): HarmonyInstrument {
    return this.instrument;
  }

  /**
   * Check if per-note ranges are available
   */
  public hasPerNoteRanges(): boolean {
    return !!this.perNoteRanges && Object.keys(this.perNoteRanges).length > 0;
  }
}
