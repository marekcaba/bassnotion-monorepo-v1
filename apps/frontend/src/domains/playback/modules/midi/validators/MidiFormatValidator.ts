/**
 * MIDI Format Validator
 *
 * Validates MIDI file format and structure
 */

import { createStructuredLogger } from '@bassnotion/contracts';
import type { ParsedMidiFile, MidiHeader } from '../parser/index.js';

const logger = createStructuredLogger('MidiFormatValidator');

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  summary: ValidationSummary;
}

export interface ValidationError {
  code: string;
  message: string;
  location?: {
    track?: number;
    event?: number;
    byte?: number;
  };
  severity: 'error' | 'critical';
}

export interface ValidationWarning {
  code: string;
  message: string;
  location?: {
    track?: number;
    event?: number;
  };
  suggestion?: string;
}

export interface ValidationSummary {
  formatType: string;
  trackCount: number;
  eventCount: number;
  duration: number;
  hasErrors: boolean;
  hasWarnings: boolean;
}

/**
 * Validates MIDI file format and structure
 */
export class MidiFormatValidator {
  private static readonly MAX_TRACK_COUNT = 256;
  private static readonly MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
  private static readonly MAX_DELTA_TIME = 0x0fffffff;

  /**
   * Validate a parsed MIDI file
   */
  static validate(parsedFile: ParsedMidiFile): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Validate header
    this.validateHeader(parsedFile.header, errors, warnings);

    // Validate tracks
    this.validateTracks(parsedFile, errors, warnings);

    // Check file structure
    this.validateFileStructure(parsedFile, errors, warnings);

    // Calculate summary
    const summary = this.createSummary(parsedFile, errors, warnings);

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      summary,
    };
  }

  /**
   * Validate MIDI header
   */
  private static validateHeader(
    header: MidiHeader,
    errors: ValidationError[],
    warnings: ValidationWarning[],
  ): void {
    // Check format
    if (header.format < 0 || header.format > 2) {
      errors.push({
        code: 'INVALID_FORMAT',
        message: `Invalid MIDI format: ${header.format}. Must be 0, 1, or 2.`,
        severity: 'critical',
      });
    }

    // Check track count
    if (header.trackCount === 0) {
      errors.push({
        code: 'NO_TRACKS',
        message: 'MIDI file has no tracks',
        severity: 'critical',
      });
    } else if (header.trackCount > this.MAX_TRACK_COUNT) {
      warnings.push({
        code: 'EXCESSIVE_TRACKS',
        message: `Track count (${header.trackCount}) exceeds recommended maximum (${this.MAX_TRACK_COUNT})`,
        suggestion: 'Consider splitting into multiple files',
      });
    }

    // Format-specific validation
    if (header.format === 0 && header.trackCount !== 1) {
      errors.push({
        code: 'FORMAT0_TRACK_COUNT',
        message: `Format 0 must have exactly 1 track, found ${header.trackCount}`,
        severity: 'error',
      });
    }

    // Check ticks per quarter note
    if (header.ticksPerQuarterNote === 0) {
      errors.push({
        code: 'INVALID_DIVISION',
        message: 'Ticks per quarter note cannot be 0',
        severity: 'critical',
      });
    } else if (header.ticksPerQuarterNote < 0) {
      warnings.push({
        code: 'SMPTE_TIMING',
        message: 'File uses SMPTE time division',
        suggestion: 'Ensure proper SMPTE frame rate handling',
      });
    } else if (header.ticksPerQuarterNote > 960) {
      warnings.push({
        code: 'HIGH_RESOLUTION',
        message: `Very high tick resolution (${header.ticksPerQuarterNote})`,
        suggestion: 'May cause performance issues with some software',
      });
    }
  }

  /**
   * Validate all tracks
   */
  private static validateTracks(
    parsedFile: ParsedMidiFile,
    errors: ValidationError[],
    warnings: ValidationWarning[],
  ): void {
    for (
      let trackIndex = 0;
      trackIndex < parsedFile.tracks.length;
      trackIndex++
    ) {
      const track = parsedFile.tracks[trackIndex];

      // Check track has events
      if (track.events.length === 0) {
        warnings.push({
          code: 'EMPTY_TRACK',
          message: `Track ${trackIndex} has no events`,
          location: { track: trackIndex },
        });
        continue;
      }

      // Check for end of track event
      const lastEvent = track.events[track.events.length - 1];
      if (lastEvent.type !== 'endOfTrack') {
        errors.push({
          code: 'MISSING_END_OF_TRACK',
          message: `Track ${trackIndex} missing End of Track event`,
          location: { track: trackIndex },
          severity: 'error',
        });
      }

      // Check delta times
      let hasInvalidDeltaTimes = false;
      for (let eventIndex = 0; eventIndex < track.events.length; eventIndex++) {
        const event = track.events[eventIndex];

        if (event.deltaTime < 0) {
          errors.push({
            code: 'NEGATIVE_DELTA_TIME',
            message: `Negative delta time in track ${trackIndex}`,
            location: { track: trackIndex, event: eventIndex },
            severity: 'error',
          });
          hasInvalidDeltaTimes = true;
        } else if (event.deltaTime > this.MAX_DELTA_TIME) {
          warnings.push({
            code: 'EXCESSIVE_DELTA_TIME',
            message: `Very large delta time in track ${trackIndex}`,
            location: { track: trackIndex, event: eventIndex },
            suggestion: 'May indicate corrupted data',
          });
        }
      }

      // Track-specific checks
      if (!hasInvalidDeltaTimes) {
        this.validateTrackContent(track, trackIndex, warnings);
      }
    }
  }

  /**
   * Validate track content
   */
  private static validateTrackContent(
    track: any,
    trackIndex: number,
    warnings: ValidationWarning[],
  ): void {
    const channelsUsed = new Set<number>();
    const noteOns = new Map<string, number>(); // key -> event index
    let hasNoteEvents = false;
    let hasControlEvents = false;
    let hasProgramChange = false;

    for (let eventIndex = 0; eventIndex < track.events.length; eventIndex++) {
      const event = track.events[eventIndex];

      // Track channels used
      if (event.channel !== undefined) {
        channelsUsed.add(event.channel);
      }

      // Check for hanging notes
      if (event.type === 'channelNoteOn' && event.data) {
        hasNoteEvents = true;
        const key = `${event.channel}-${event.data[0]}`;

        if (noteOns.has(key)) {
          warnings.push({
            code: 'HANGING_NOTE',
            message: `Note on without note off in track ${trackIndex}`,
            location: { track: trackIndex, event: noteOns.get(key) },
            suggestion: 'Add corresponding note off event',
          });
        }

        if (event.data[1] > 0) {
          // velocity > 0
          noteOns.set(key, eventIndex);
        } else {
          noteOns.delete(key); // Note on with velocity 0 = note off
        }
      } else if (event.type === 'channelNoteOff' && event.data) {
        const key = `${event.channel}-${event.data[0]}`;
        noteOns.delete(key);
      } else if (event.type === 'channelControlChange') {
        hasControlEvents = true;
      } else if (event.type === 'channelProgramChange') {
        hasProgramChange = true;
      }
    }

    // Check for remaining hanging notes
    for (const [key, eventIndex] of noteOns) {
      warnings.push({
        code: 'UNCLOSED_NOTE',
        message: `Note never released in track ${trackIndex}`,
        location: { track: trackIndex, event: eventIndex },
        suggestion: 'Add note off event before end of track',
      });
    }

    // Multi-channel warning
    if (channelsUsed.size > 1) {
      warnings.push({
        code: 'MULTI_CHANNEL_TRACK',
        message: `Track ${trackIndex} uses ${channelsUsed.size} different channels`,
        location: { track: trackIndex },
        suggestion: 'Consider splitting into separate tracks per channel',
      });
    }

    // Track type detection
    if (hasNoteEvents && !hasProgramChange) {
      warnings.push({
        code: 'NO_PROGRAM_CHANGE',
        message: `Track ${trackIndex} has notes but no program change`,
        location: { track: trackIndex },
        suggestion: 'Add program change to specify instrument',
      });
    }
  }

  /**
   * Validate overall file structure
   */
  private static validateFileStructure(
    parsedFile: ParsedMidiFile,
    errors: ValidationError[],
    warnings: ValidationWarning[],
  ): void {
    // Check tempo events
    let tempoEventCount = 0;
    let tempoTrack = -1;

    for (let i = 0; i < parsedFile.tracks.length; i++) {
      const track = parsedFile.tracks[i];
      const trackTempos = track.events.filter(
        (e: any) => e.type === 'setTempo',
      );

      if (trackTempos.length > 0) {
        tempoEventCount += trackTempos.length;
        if (tempoTrack === -1) tempoTrack = i;
        else if (tempoTrack !== i) {
          warnings.push({
            code: 'TEMPO_IN_MULTIPLE_TRACKS',
            message: 'Tempo events found in multiple tracks',
            suggestion: 'Place all tempo events in first track',
          });
        }
      }
    }

    if (tempoEventCount === 0) {
      warnings.push({
        code: 'NO_TEMPO',
        message: 'No tempo events found, will use default 120 BPM',
        suggestion: 'Add SetTempo meta event',
      });
    }

    // Check time signature
    const hasTimeSignature = parsedFile.tracks.some((track) =>
      track.events.some((e: any) => e.type === 'timeSignature'),
    );

    if (!hasTimeSignature) {
      warnings.push({
        code: 'NO_TIME_SIGNATURE',
        message: 'No time signature found, will use default 4/4',
        suggestion: 'Add TimeSignature meta event',
      });
    }
  }

  /**
   * Create validation summary
   */
  private static createSummary(
    parsedFile: ParsedMidiFile,
    errors: ValidationError[],
    warnings: ValidationWarning[],
  ): ValidationSummary {
    const formatNames = ['Single Track', 'Multi Track', 'Multi Song'];
    const eventCount = parsedFile.tracks.reduce(
      (sum, track) => sum + track.events.length,
      0,
    );

    return {
      formatType: formatNames[parsedFile.header.format] || 'Unknown',
      trackCount: parsedFile.tracks.length,
      eventCount,
      duration: 0, // Would need tempo calculation
      hasErrors: errors.length > 0,
      hasWarnings: warnings.length > 0,
    };
  }

  /**
   * Quick validation for streaming
   */
  static quickValidate(data: ArrayBuffer): {
    valid: boolean;
    error?: string;
  } {
    if (data.byteLength < 14) {
      return { valid: false, error: 'File too small to be valid MIDI' };
    }

    if (data.byteLength > this.MAX_FILE_SIZE) {
      return { valid: false, error: 'File exceeds maximum size limit' };
    }

    const view = new DataView(data);
    const header = String.fromCharCode(
      view.getUint8(0),
      view.getUint8(1),
      view.getUint8(2),
      view.getUint8(3),
    );

    if (header !== 'MThd') {
      return { valid: false, error: 'Invalid MIDI header' };
    }

    return { valid: true };
  }
}
