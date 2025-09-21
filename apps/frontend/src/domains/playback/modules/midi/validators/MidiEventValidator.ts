/**
 * MIDI Event Validator
 *
 * Validates individual MIDI events for correctness
 */

import { createStructuredLogger } from '@bassnotion/contracts';
import type { TypedMidiEvent } from '../parser/index.js';

const logger = createStructuredLogger('MidiEventValidator');

export interface EventValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  normalized?: TypedMidiEvent;
}

export interface EventValidationRules {
  allowVelocity0AsNoteOff?: boolean;
  maxVelocity?: number;
  allowOutOfRangeNotes?: boolean;
  allowInvalidControllers?: boolean;
  strictChannelMode?: boolean;
}

/**
 * Validates and normalizes MIDI events
 */
export class MidiEventValidator {
  private static defaultRules: EventValidationRules = {
    allowVelocity0AsNoteOff: true,
    maxVelocity: 127,
    allowOutOfRangeNotes: false,
    allowInvalidControllers: false,
    strictChannelMode: false,
  };

  /**
   * Validate a typed MIDI event
   */
  static validateEvent(
    event: TypedMidiEvent,
    rules: EventValidationRules = {},
  ): EventValidationResult {
    const mergedRules = { ...this.defaultRules, ...rules };
    const errors: string[] = [];
    const warnings: string[] = [];
    let normalized: TypedMidiEvent | undefined;

    switch (event.type) {
      case 'noteOn':
      case 'noteOff':
        const noteResult = this.validateNoteEvent(event, mergedRules);
        errors.push(...noteResult.errors);
        warnings.push(...noteResult.warnings);
        normalized = noteResult.normalized;
        break;

      case 'controlChange':
        const ccResult = this.validateControlChange(event, mergedRules);
        errors.push(...ccResult.errors);
        warnings.push(...ccResult.warnings);
        normalized = ccResult.normalized;
        break;

      case 'programChange':
        const pcResult = this.validateProgramChange(event, mergedRules);
        errors.push(...pcResult.errors);
        warnings.push(...pcResult.warnings);
        normalized = pcResult.normalized;
        break;

      case 'pitchBend':
        const pbResult = this.validatePitchBend(event, mergedRules);
        errors.push(...pbResult.errors);
        warnings.push(...pbResult.warnings);
        normalized = pbResult.normalized;
        break;

      case 'tempo':
        const tempoResult = this.validateTempo(event, mergedRules);
        errors.push(...tempoResult.errors);
        warnings.push(...tempoResult.warnings);
        normalized = tempoResult.normalized;
        break;

      case 'timeSignature':
        const tsResult = this.validateTimeSignature(event, mergedRules);
        errors.push(...tsResult.errors);
        warnings.push(...tsResult.warnings);
        normalized = tsResult.normalized;
        break;

      case 'keySignature':
        const ksResult = this.validateKeySignature(event, mergedRules);
        errors.push(...ksResult.errors);
        warnings.push(...ksResult.warnings);
        normalized = ksResult.normalized;
        break;
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      normalized: normalized || event,
    };
  }

  /**
   * Validate note events
   */
  private static validateNoteEvent(
    event: any,
    rules: EventValidationRules,
  ): EventValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const normalized = { ...event };

    // Validate channel (0-15)
    if (event.channel < 0 || event.channel > 15) {
      errors.push(`Invalid channel: ${event.channel}. Must be 0-15.`);
      normalized.channel = Math.max(0, Math.min(15, event.channel));
    }

    // Validate note number (0-127)
    if (event.note < 0 || event.note > 127) {
      if (rules.allowOutOfRangeNotes) {
        warnings.push(`Note ${event.note} out of MIDI range (0-127)`);
        normalized.note = Math.max(0, Math.min(127, event.note));
      } else {
        errors.push(`Invalid note: ${event.note}. Must be 0-127.`);
      }
    }

    // Check extreme notes
    if (event.note < 21) {
      // Below A0
      warnings.push(
        `Note ${event.noteName}${event.octave} is below piano range`,
      );
    } else if (event.note > 108) {
      // Above C8
      warnings.push(
        `Note ${event.noteName}${event.octave} is above piano range`,
      );
    }

    // Validate velocity (0-127)
    if (event.velocity < 0 || event.velocity > rules.maxVelocity!) {
      errors.push(
        `Invalid velocity: ${event.velocity}. Must be 0-${rules.maxVelocity}.`,
      );
      normalized.velocity = Math.max(
        0,
        Math.min(rules.maxVelocity!, event.velocity),
      );
    }

    // Check note on with velocity 0
    if (event.type === 'noteOn' && event.velocity === 0) {
      if (rules.allowVelocity0AsNoteOff) {
        warnings.push('Note On with velocity 0 (interpreted as Note Off)');
        normalized.type = 'noteOff';
      } else {
        errors.push('Note On events must have velocity > 0');
      }
    }

    return { valid: errors.length === 0, errors, warnings, normalized };
  }

  /**
   * Validate control change events
   */
  private static validateControlChange(
    event: any,
    rules: EventValidationRules,
  ): EventValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const normalized = { ...event };

    // Validate channel
    if (event.channel < 0 || event.channel > 15) {
      errors.push(`Invalid channel: ${event.channel}`);
      normalized.channel = Math.max(0, Math.min(15, event.channel));
    }

    // Validate controller number
    if (event.controller < 0 || event.controller > 127) {
      errors.push(`Invalid controller: ${event.controller}. Must be 0-127.`);
      normalized.controller = Math.max(0, Math.min(127, event.controller));
    }

    // Check reserved controllers
    const reservedControllers = [
      3, 9, 14, 15, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31,
    ];
    if (reservedControllers.includes(event.controller)) {
      warnings.push(`Controller ${event.controller} is undefined/reserved`);
    }

    // Validate value
    if (event.value < 0 || event.value > 127) {
      errors.push(`Invalid value: ${event.value}. Must be 0-127.`);
      normalized.value = Math.max(0, Math.min(127, event.value));
    }

    // Channel mode messages (120-127)
    if (event.controller >= 120 && rules.strictChannelMode) {
      const validChannelModeValues: Record<number, number[]> = {
        120: [0], // All Sound Off
        121: [0], // Reset All Controllers
        122: [0, 127], // Local Control
        123: [0], // All Notes Off
        124: [0], // Omni Mode Off
        125: [0], // Omni Mode On
        126: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], // Mono Mode
        127: [0], // Poly Mode
      };

      const validValues = validChannelModeValues[event.controller];
      if (validValues && !validValues.includes(event.value)) {
        warnings.push(
          `Channel mode message ${event.controller} with non-standard value ${event.value}`,
        );
      }
    }

    return { valid: errors.length === 0, errors, warnings, normalized };
  }

  /**
   * Validate program change events
   */
  private static validateProgramChange(
    event: any,
    rules: EventValidationRules,
  ): EventValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const normalized = { ...event };

    // Validate channel
    if (event.channel < 0 || event.channel > 15) {
      errors.push(`Invalid channel: ${event.channel}`);
      normalized.channel = Math.max(0, Math.min(15, event.channel));
    }

    // Validate program number
    if (event.program < 0 || event.program > 127) {
      errors.push(`Invalid program: ${event.program}. Must be 0-127.`);
      normalized.program = Math.max(0, Math.min(127, event.program));
    }

    // Channel 9 (drums) warning
    if (event.channel === 9) {
      warnings.push('Program change on channel 10 (9) - drum channel');
    }

    return { valid: errors.length === 0, errors, warnings, normalized };
  }

  /**
   * Validate pitch bend events
   */
  private static validatePitchBend(
    event: any,
    rules: EventValidationRules,
  ): EventValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const normalized = { ...event };

    // Validate channel
    if (event.channel < 0 || event.channel > 15) {
      errors.push(`Invalid channel: ${event.channel}`);
      normalized.channel = Math.max(0, Math.min(15, event.channel));
    }

    // Validate value (0-16383, center is 8192)
    if (event.value < 0 || event.value > 16383) {
      errors.push(`Invalid pitch bend value: ${event.value}. Must be 0-16383.`);
      normalized.value = Math.max(0, Math.min(16383, event.value));
    }

    // Recalculate normalized value
    normalized.normalizedValue = (normalized.value - 8192) / 8192;

    // Check extreme values
    if (Math.abs(normalized.normalizedValue) > 0.9) {
      warnings.push(
        `Extreme pitch bend: ${(normalized.normalizedValue * 100).toFixed(1)}%`,
      );
    }

    return { valid: errors.length === 0, errors, warnings, normalized };
  }

  /**
   * Validate tempo events
   */
  private static validateTempo(
    event: any,
    rules: EventValidationRules,
  ): EventValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const normalized = { ...event };

    // Validate BPM (reasonable range: 1-999)
    if (event.bpm < 1 || event.bpm > 999) {
      if (event.bpm < 1) {
        errors.push(`Invalid tempo: ${event.bpm} BPM. Must be > 0.`);
        normalized.bpm = 1;
      } else {
        warnings.push(`Extreme tempo: ${event.bpm} BPM`);
      }
    }

    // Check common tempo ranges
    if (event.bpm < 40) {
      warnings.push(`Very slow tempo: ${event.bpm} BPM`);
    } else if (event.bpm > 208) {
      warnings.push(`Very fast tempo: ${event.bpm} BPM`);
    }

    // Recalculate microseconds per quarter note
    normalized.microsecondsPerQuarterNote = Math.round(
      60000000 / normalized.bpm,
    );

    return { valid: errors.length === 0, errors, warnings, normalized };
  }

  /**
   * Validate time signature events
   */
  private static validateTimeSignature(
    event: any,
    rules: EventValidationRules,
  ): EventValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const normalized = { ...event };

    // Validate numerator
    if (event.numerator < 1 || event.numerator > 99) {
      errors.push(`Invalid time signature numerator: ${event.numerator}`);
      normalized.numerator = Math.max(1, Math.min(99, event.numerator));
    }

    // Validate denominator (must be power of 2)
    const validDenominators = [1, 2, 4, 8, 16, 32, 64];
    if (!validDenominators.includes(event.denominator)) {
      errors.push(
        `Invalid time signature denominator: ${event.denominator}. Must be power of 2.`,
      );
      // Find nearest power of 2
      normalized.denominator = validDenominators.reduce((prev, curr) =>
        Math.abs(curr - event.denominator) < Math.abs(prev - event.denominator)
          ? curr
          : prev,
      );
    }

    // Check unusual signatures
    const commonSignatures = ['4/4', '3/4', '6/8', '2/4', '12/8', '5/4', '7/8'];
    const signature = `${event.numerator}/${event.denominator}`;
    if (!commonSignatures.includes(signature)) {
      warnings.push(`Unusual time signature: ${signature}`);
    }

    return { valid: errors.length === 0, errors, warnings, normalized };
  }

  /**
   * Validate key signature events
   */
  private static validateKeySignature(
    event: any,
    rules: EventValidationRules,
  ): EventValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const normalized = { ...event };

    // Validate sharps/flats (-7 to 7)
    if (event.sharpsOrFlats < -7 || event.sharpsOrFlats > 7) {
      errors.push(
        `Invalid key signature: ${event.sharpsOrFlats} sharps/flats. Must be -7 to 7.`,
      );
      normalized.sharpsOrFlats = Math.max(-7, Math.min(7, event.sharpsOrFlats));
    }

    // Validate scale
    if (event.scale !== 'major' && event.scale !== 'minor') {
      errors.push(`Invalid scale: ${event.scale}. Must be 'major' or 'minor'.`);
      normalized.scale = 'major';
    }

    return { valid: errors.length === 0, errors, warnings, normalized };
  }

  /**
   * Batch validate events
   */
  static validateEvents(
    events: TypedMidiEvent[],
    rules: EventValidationRules = {},
  ): {
    valid: boolean;
    errorCount: number;
    warningCount: number;
    results: EventValidationResult[];
  } {
    const results = events.map((event) => this.validateEvent(event, rules));
    const errorCount = results.reduce((sum, r) => sum + r.errors.length, 0);
    const warningCount = results.reduce((sum, r) => sum + r.warnings.length, 0);

    return {
      valid: errorCount === 0,
      errorCount,
      warningCount,
      results,
    };
  }
}
