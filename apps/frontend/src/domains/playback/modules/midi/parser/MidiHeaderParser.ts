/**
 * MIDI Header Parser
 *
 * Specialized parser for MIDI file headers and metadata
 */

import { createStructuredLogger } from '@bassnotion/contracts';
import type { ParsedMidiFile, MidiHeader } from './MidiFileParser.js';
import type { TypedMidiEvent } from './MidiEventFactory.js';

const logger = createStructuredLogger('MidiHeaderParser');

export interface MidiFileMetadata {
  format: 0 | 1 | 2;
  trackCount: number;
  ticksPerQuarterNote: number;
  duration: number; // in seconds
  tempo: number; // BPM
  timeSignature: {
    numerator: number;
    denominator: number;
  };
  keySignature?: {
    key: string;
    scale: 'major' | 'minor';
  };
  title?: string;
  copyright?: string;
  instruments: string[];
  markers: Array<{
    time: number;
    text: string;
  }>;
}

/**
 * Parser for extracting metadata from MIDI files
 */
export class MidiHeaderParser {
  /**
   * Extract comprehensive metadata from parsed MIDI file
   */
  static extractMetadata(
    parsedFile: ParsedMidiFile,
    typedEvents: TypedMidiEvent[][],
  ): MidiFileMetadata {
    const metadata: MidiFileMetadata = {
      format: parsedFile.header.format,
      trackCount: parsedFile.header.trackCount,
      ticksPerQuarterNote: parsedFile.header.ticksPerQuarterNote,
      duration: 0,
      tempo: 120, // Default tempo
      timeSignature: { numerator: 4, denominator: 4 }, // Default
      instruments: [],
      markers: [],
    };

    // Process all tracks for metadata
    for (let trackIndex = 0; trackIndex < typedEvents.length; trackIndex++) {
      const track = parsedFile.tracks[trackIndex];
      const events = typedEvents[trackIndex];

      // Track name might be an instrument
      if (track.name) {
        metadata.instruments.push(track.name);
      }

      // Process typed events
      for (const event of events) {
        switch (event.type) {
          case 'tempo':
            metadata.tempo = event.bpm;
            break;

          case 'timeSignature':
            metadata.timeSignature = {
              numerator: event.numerator,
              denominator: event.denominator,
            };
            break;

          case 'keySignature':
            metadata.keySignature = {
              key: event.key,
              scale: event.scale,
            };
            break;

          case 'trackName':
            if (trackIndex === 0 && !metadata.title) {
              metadata.title = event.text;
            } else if (!metadata.instruments.includes(event.text)) {
              metadata.instruments.push(event.text);
            }
            break;

          case 'instrumentName':
            if (!metadata.instruments.includes(event.text)) {
              metadata.instruments.push(event.text);
            }
            break;

          case 'copyright':
            metadata.copyright = event.text;
            break;

          case 'marker':
          case 'cuePoint':
            metadata.markers.push({
              time: this.deltaTimeToSeconds(
                event.deltaTime,
                metadata.tempo,
                metadata.ticksPerQuarterNote,
              ),
              text: event.text,
            });
            break;
        }
      }
    }

    // Calculate duration
    metadata.duration = this.calculateDuration(
      parsedFile,
      metadata.tempo,
      metadata.ticksPerQuarterNote,
    );

    return metadata;
  }

  /**
   * Analyze MIDI format and provide recommendations
   */
  static analyzeFormat(header: MidiHeader): {
    formatName: string;
    description: string;
    recommendations: string[];
  } {
    const formatInfo = {
      0: {
        name: 'Single Track',
        description: 'All MIDI data in one track',
        recommendations: [
          'Good for simple playback',
          'Consider splitting into multiple tracks for editing',
        ],
      },
      1: {
        name: 'Multi Track',
        description: 'Multiple simultaneous tracks',
        recommendations: [
          'Standard format for most MIDI files',
          'Each track typically represents one instrument',
        ],
      },
      2: {
        name: 'Multi Song',
        description: 'Multiple independent sequences',
        recommendations: [
          'Rarely used format',
          'Consider converting to Format 1',
        ],
      },
    };

    const info = formatInfo[header.format];

    return {
      formatName: info.name,
      description: info.description,
      recommendations: [...info.recommendations],
    };
  }

  /**
   * Extract timing information
   */
  static extractTimingInfo(
    header: MidiHeader,
    tempoEvents: Array<{ time: number; bpm: number }>,
  ): {
    isConstantTempo: boolean;
    tempoChanges: number;
    averageTempo: number;
    tempoRange: { min: number; max: number };
  } {
    if (tempoEvents.length === 0) {
      return {
        isConstantTempo: true,
        tempoChanges: 0,
        averageTempo: 120,
        tempoRange: { min: 120, max: 120 },
      };
    }

    const tempos = tempoEvents.map((e) => e.bpm);
    const min = Math.min(...tempos);
    const max = Math.max(...tempos);
    const average = tempos.reduce((sum, t) => sum + t, 0) / tempos.length;

    return {
      isConstantTempo: min === max,
      tempoChanges: tempoEvents.length - 1,
      averageTempo: Math.round(average),
      tempoRange: { min, max },
    };
  }

  /**
   * Calculate total duration of MIDI file
   */
  private static calculateDuration(
    parsedFile: ParsedMidiFile,
    tempo: number,
    ticksPerQuarterNote: number,
  ): number {
    let maxTicks = 0;

    // Find the maximum tick time across all tracks
    for (const track of parsedFile.tracks) {
      let currentTick = 0;

      for (const event of track.events) {
        currentTick += event.deltaTime;
      }

      maxTicks = Math.max(maxTicks, currentTick);
    }

    // Convert ticks to seconds
    const quarterNotesPerMinute = tempo;
    const quarterNotesPerSecond = quarterNotesPerMinute / 60;
    const ticksPerSecond = ticksPerQuarterNote * quarterNotesPerSecond;

    return maxTicks / ticksPerSecond;
  }

  /**
   * Convert delta time to seconds
   */
  private static deltaTimeToSeconds(
    deltaTime: number,
    tempo: number,
    ticksPerQuarterNote: number,
  ): number {
    const quarterNotesPerMinute = tempo;
    const quarterNotesPerSecond = quarterNotesPerMinute / 60;
    const ticksPerSecond = ticksPerQuarterNote * quarterNotesPerSecond;

    return deltaTime / ticksPerSecond;
  }

  /**
   * Validate MIDI header
   */
  static validateHeader(header: MidiHeader): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate format
    if (header.format < 0 || header.format > 2) {
      errors.push(`Invalid format: ${header.format}`);
    }

    // Validate track count
    if (header.trackCount === 0) {
      errors.push('No tracks in MIDI file');
    } else if (header.format === 0 && header.trackCount !== 1) {
      errors.push(
        `Format 0 must have exactly 1 track, found ${header.trackCount}`,
      );
    }

    // Validate ticks per quarter note
    if (header.ticksPerQuarterNote === 0) {
      errors.push('Invalid ticks per quarter note: 0');
    } else if (header.ticksPerQuarterNote > 960) {
      warnings.push(
        `Very high ticks per quarter note: ${header.ticksPerQuarterNote}`,
      );
    }

    // Check for SMPTE time code (negative value)
    if (header.ticksPerQuarterNote < 0) {
      warnings.push('SMPTE time code detected - may need special handling');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }
}
