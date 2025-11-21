import { Injectable, Logger } from '@nestjs/common';
import type { ParsedMeasure } from '../dto/parse-midi-response.dto.js';

// Import types from shared contracts
import type { DrumHit, MidiDrumType } from '@bassnotion/contracts';

/**
 * Service for converting MIDI drum data to structured drum hits
 * Similar to FretboardMapperService but for drums
 */
@Injectable()
export class DrumMapperService {
  private readonly logger = new Logger(DrumMapperService.name);

  /**
   * Drum MIDI Map - Supports both General MIDI and Keyboard-based drum programming
   *
   * KEYBOARD MAPPING (for producers programming drums on piano keyboard):
   * - C1  (24) = Kick
   * - D#1 (27) = Snare
   * - F#1 (30) = Hi-Hat
   *
   * NOTE: Maps to simplified pad names (kick, snare, hihat) to match available drum samples
   *
   * GENERAL MIDI STANDARD (MIDI notes 35-81):
   * https://www.midi.org/specifications-old/item/gm-level-1-sound-set
   */
  private readonly DRUM_MAP: Record<number, MidiDrumType> = {
    // === KEYBOARD-BASED DRUM MAPPING (Primary for BassNotion producers) ===
    24: 'kick',   // C1 - Kick (keyboard mapping)
    27: 'snare',  // D#1/Eb1 - Snare (keyboard mapping)
    30: 'hihat',  // F#1/Gb1 - Hi-Hat (keyboard mapping) - simplified to match available pads

    // === GENERAL MIDI STANDARD ===
    // Kick drums
    35: 'kick', // Acoustic Bass Drum
    36: 'kick', // Bass Drum 1

    // Snares
    38: 'snare', // Acoustic Snare
    39: 'snare', // D#2 / Hand Clap note - USER REQUIREMENT: Map to snare
    40: 'snare', // Electric Snare
    37: 'snare_rimshot', // Side Stick / Rimshot

    // Hi-hats - simplified to 'hihat' to match available drum pads
    42: 'hihat', // Closed Hi-Hat (was hihat_closed)
    44: 'hihat', // Pedal Hi-Hat (was hihat_pedal)
    46: 'hihat', // Open Hi-Hat (was hihat_open)

    // Cymbals
    49: 'crash', // Crash Cymbal 1
    57: 'crash', // Crash Cymbal 2
    51: 'ride', // Ride Cymbal 1
    59: 'ride', // Ride Cymbal 2
    53: 'ride_bell', // Ride Bell

    // Toms
    41: 'tom_low', // Low Floor Tom
    43: 'tom_low', // High Floor Tom
    45: 'tom_mid', // Low Tom
    47: 'tom_mid', // Low-Mid Tom
    48: 'tom_high', // Hi-Mid Tom
    50: 'tom_high', // High Tom
    58: 'tom_low', // Vibraslap (map to low tom)

    // Percussion
    56: 'cowbell', // Cowbell
    54: 'tambourine', // Tambourine
  };

  /**
   * Convert MIDI drum data to structured drum hits
   */
  async convertMidiToDrumPattern(
    measures: ParsedMeasure[],
    correlationId?: string,
  ): Promise<DrumHit[]> {
    const startTime = Date.now();

    this.logger.log('Converting MIDI to drum pattern', {
      measureCount: measures.length,
      correlationId,
    });

    const allHits: DrumHit[] = [];
    let hitIdCounter = 1;

    for (const measure of measures) {
      if (measure.notes.length === 0) {
        this.logger.debug('Skipping empty measure', {
          measureNumber: measure.measureNumber,
          correlationId,
        });
        continue;
      }

      // Convert each note to a drum hit
      for (const note of measure.notes) {
        // Skip notes without position data
        if (!note.position) {
          this.logger.warn('Skipping drum note without position', {
            midiNote: note.pitch,
            measure: measure.measureNumber,
            correlationId,
          });
          continue;
        }

        const drumType = this.mapMidiNoteToDrum(note.pitch);

        const hit: DrumHit = {
          id: `drum-${hitIdCounter++}`,
          drum: drumType,
          velocity: note.velocity,
          position: note.position,
          durationTicks: note.durationTicks ?? 0,
          midiNote: note.pitch,
        };

        allHits.push(hit);

        // Log unknown drum mappings for admin review
        if (drumType === 'unknown') {
          this.logger.warn('Unknown drum MIDI note detected', {
            midiNote: note.pitch,
            measure: measure.measureNumber,
            position: note.position,
            correlationId,
          });
        }
      }
    }

    const processingTime = Date.now() - startTime;

    this.logger.log('MIDI to drum pattern conversion completed', {
      totalHits: allHits.length,
      processingTimeMs: processingTime,
      unknownHits: allHits.filter((h) => h.drum === 'unknown').length,
      correlationId,
    });

    return allHits;
  }

  /**
   * Map MIDI note number to drum type using General MIDI drum map
   */
  private mapMidiNoteToDrum(midiNote: number): MidiDrumType {
    return this.DRUM_MAP[midiNote] || 'unknown';
  }

  /**
   * Get human-readable drum name
   */
  getDrumDisplayName(drum: MidiDrumType): string {
    const displayNames: Record<MidiDrumType, string> = {
      kick: 'Kick Drum',
      snare: 'Snare',
      snare_rimshot: 'Rimshot',
      hihat: 'Hi-Hat',
      hihat_closed: 'Hi-Hat (Closed)',
      hihat_open: 'Hi-Hat (Open)',
      hihat_pedal: 'Hi-Hat (Pedal)',
      crash: 'Crash Cymbal',
      ride: 'Ride Cymbal',
      ride_bell: 'Ride Bell',
      tom_low: 'Low Tom',
      tom_mid: 'Mid Tom',
      tom_high: 'High Tom',
      floor_tom: 'Floor Tom',
      cowbell: 'Cowbell',
      tambourine: 'Tambourine',
      clap: 'Hand Clap',
      unknown: 'Unknown',
    };

    return displayNames[drum] || 'Unknown';
  }

  /**
   * Get statistics about drum pattern
   */
  getDrumPatternStats(hits: DrumHit[]): {
    totalHits: number;
    uniqueDrums: number;
    drumCounts: Record<MidiDrumType, number>;
    unknownCount: number;
    measureCount: number;
  } {
    const drumCounts: Record<MidiDrumType, number> = {} as any;
    const uniqueDrums = new Set<MidiDrumType>();
    let unknownCount = 0;
    const measures = new Set<number>();

    for (const hit of hits) {
      // Count drums
      drumCounts[hit.drum] = (drumCounts[hit.drum] || 0) + 1;
      uniqueDrums.add(hit.drum);
      measures.add(hit.position.measure);

      if (hit.drum === 'unknown') {
        unknownCount++;
      }
    }

    return {
      totalHits: hits.length,
      uniqueDrums: uniqueDrums.size,
      drumCounts,
      unknownCount,
      measureCount: measures.size,
    };
  }

  /**
   * Validate drum pattern
   */
  validateDrumPattern(hits: DrumHit[]): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (hits.length === 0) {
      errors.push('Drum pattern is empty');
    }

    const stats = this.getDrumPatternStats(hits);

    if (stats.unknownCount > 0) {
      warnings.push(
        `${stats.unknownCount} unknown drum hits detected. Please review and assign correct drums.`,
      );
    }

    if (stats.uniqueDrums < 2) {
      warnings.push('Drum pattern uses very few drums. Consider adding variety.');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }
}
