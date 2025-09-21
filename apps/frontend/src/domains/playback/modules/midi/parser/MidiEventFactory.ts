/**
 * MIDI Event Factory
 *
 * Creates typed MIDI events from raw data
 */

import { createStructuredLogger } from '@bassnotion/contracts';
import type { MidiEvent } from './MidiFileParser.js';

const logger = createStructuredLogger('MidiEventFactory');

// Typed MIDI Events
export interface MidiNoteEvent {
  deltaTime: number;
  type: 'noteOn' | 'noteOff';
  channel: number;
  note: number;
  velocity: number;
  noteName: string;
  octave: number;
}

export interface MidiControlChangeEvent {
  deltaTime: number;
  type: 'controlChange';
  channel: number;
  controller: number;
  value: number;
  controllerName: string;
}

export interface MidiProgramChangeEvent {
  deltaTime: number;
  type: 'programChange';
  channel: number;
  program: number;
  programName?: string;
}

export interface MidiPitchBendEvent {
  deltaTime: number;
  type: 'pitchBend';
  channel: number;
  value: number;
  normalizedValue: number; // -1 to 1
}

export interface MidiTempoEvent {
  deltaTime: number;
  type: 'tempo';
  bpm: number;
  microsecondsPerQuarterNote: number;
}

export interface MidiTimeSignatureEvent {
  deltaTime: number;
  type: 'timeSignature';
  numerator: number;
  denominator: number;
  metronomeClick: number;
  thirtySecondNotes: number;
}

export interface MidiKeySignatureEvent {
  deltaTime: number;
  type: 'keySignature';
  key: string;
  scale: 'major' | 'minor';
  sharpsOrFlats: number;
}

export interface MidiTextEvent {
  deltaTime: number;
  type:
    | 'text'
    | 'lyrics'
    | 'marker'
    | 'cuePoint'
    | 'trackName'
    | 'instrumentName'
    | 'copyright';
  text: string;
}

export type TypedMidiEvent =
  | MidiNoteEvent
  | MidiControlChangeEvent
  | MidiProgramChangeEvent
  | MidiPitchBendEvent
  | MidiTempoEvent
  | MidiTimeSignatureEvent
  | MidiKeySignatureEvent
  | MidiTextEvent;

/**
 * Factory for creating typed MIDI events
 */
export class MidiEventFactory {
  private static noteNames = [
    'C',
    'C#',
    'D',
    'D#',
    'E',
    'F',
    'F#',
    'G',
    'G#',
    'A',
    'A#',
    'B',
  ];

  /**
   * Create typed event from raw MIDI event
   */
  static createEvent(rawEvent: MidiEvent): TypedMidiEvent | null {
    switch (rawEvent.type) {
      case 'channelNoteOn':
        return this.createNoteOnEvent(rawEvent);

      case 'channelNoteOff':
        return this.createNoteOffEvent(rawEvent);

      case 'channelControlChange':
        return this.createControlChangeEvent(rawEvent);

      case 'channelProgramChange':
        return this.createProgramChangeEvent(rawEvent);

      case 'channelPitchBend':
        return this.createPitchBendEvent(rawEvent);

      case 'setTempo':
        return this.createTempoEvent(rawEvent);

      case 'timeSignature':
        return this.createTimeSignatureEvent(rawEvent);

      case 'keySignature':
        return this.createKeySignatureEvent(rawEvent);

      case 'text':
      case 'lyrics':
      case 'marker':
      case 'cuePoint':
      case 'trackName':
      case 'instrumentName':
      case 'copyright':
        return this.createTextEvent(rawEvent);

      default:
        return null;
    }
  }

  /**
   * Create note on event
   */
  private static createNoteOnEvent(rawEvent: MidiEvent): MidiNoteEvent | null {
    if (
      !rawEvent.data ||
      rawEvent.data.length < 2 ||
      rawEvent.channel === undefined
    ) {
      return null;
    }

    const [note, velocity] = rawEvent.data;

    // Note on with velocity 0 is actually note off
    if (velocity === 0) {
      return this.createNoteOffEvent(rawEvent);
    }

    return {
      deltaTime: rawEvent.deltaTime,
      type: 'noteOn',
      channel: rawEvent.channel,
      note,
      velocity,
      noteName: this.noteNames[note % 12],
      octave: Math.floor(note / 12) - 1,
    };
  }

  /**
   * Create note off event
   */
  private static createNoteOffEvent(rawEvent: MidiEvent): MidiNoteEvent | null {
    if (
      !rawEvent.data ||
      rawEvent.data.length < 2 ||
      rawEvent.channel === undefined
    ) {
      return null;
    }

    const [note, velocity] = rawEvent.data;

    return {
      deltaTime: rawEvent.deltaTime,
      type: 'noteOff',
      channel: rawEvent.channel,
      note,
      velocity,
      noteName: this.noteNames[note % 12],
      octave: Math.floor(note / 12) - 1,
    };
  }

  /**
   * Create control change event
   */
  private static createControlChangeEvent(
    rawEvent: MidiEvent,
  ): MidiControlChangeEvent | null {
    if (
      !rawEvent.data ||
      rawEvent.data.length < 2 ||
      rawEvent.channel === undefined
    ) {
      return null;
    }

    const [controller, value] = rawEvent.data;

    return {
      deltaTime: rawEvent.deltaTime,
      type: 'controlChange',
      channel: rawEvent.channel,
      controller,
      value,
      controllerName: this.getControllerName(controller),
    };
  }

  /**
   * Create program change event
   */
  private static createProgramChangeEvent(
    rawEvent: MidiEvent,
  ): MidiProgramChangeEvent | null {
    if (
      !rawEvent.data ||
      rawEvent.data.length < 1 ||
      rawEvent.channel === undefined
    ) {
      return null;
    }

    const [program] = rawEvent.data;

    return {
      deltaTime: rawEvent.deltaTime,
      type: 'programChange',
      channel: rawEvent.channel,
      program,
      programName: this.getProgramName(program),
    };
  }

  /**
   * Create pitch bend event
   */
  private static createPitchBendEvent(
    rawEvent: MidiEvent,
  ): MidiPitchBendEvent | null {
    if (
      !rawEvent.data ||
      rawEvent.data.length < 3 ||
      rawEvent.channel === undefined
    ) {
      return null;
    }

    const value = rawEvent.data[2]; // Combined value
    const normalizedValue = (value - 8192) / 8192; // Normalize to -1 to 1

    return {
      deltaTime: rawEvent.deltaTime,
      type: 'pitchBend',
      channel: rawEvent.channel,
      value,
      normalizedValue,
    };
  }

  /**
   * Create tempo event
   */
  private static createTempoEvent(rawEvent: MidiEvent): MidiTempoEvent | null {
    if (!rawEvent.data || rawEvent.data.length < 3) {
      return null;
    }

    // Tempo is stored as microseconds per quarter note (24-bit value)
    const microsecondsPerQuarterNote =
      (rawEvent.data[0] << 16) | (rawEvent.data[1] << 8) | rawEvent.data[2];

    const bpm = Math.round(60000000 / microsecondsPerQuarterNote);

    return {
      deltaTime: rawEvent.deltaTime,
      type: 'tempo',
      bpm,
      microsecondsPerQuarterNote,
    };
  }

  /**
   * Create time signature event
   */
  private static createTimeSignatureEvent(
    rawEvent: MidiEvent,
  ): MidiTimeSignatureEvent | null {
    if (!rawEvent.data || rawEvent.data.length < 4) {
      return null;
    }

    const [numerator, denominatorPower, metronomeClick, thirtySecondNotes] =
      rawEvent.data;
    const denominator = Math.pow(2, denominatorPower);

    return {
      deltaTime: rawEvent.deltaTime,
      type: 'timeSignature',
      numerator,
      denominator,
      metronomeClick,
      thirtySecondNotes,
    };
  }

  /**
   * Create key signature event
   */
  private static createKeySignatureEvent(
    rawEvent: MidiEvent,
  ): MidiKeySignatureEvent | null {
    if (!rawEvent.data || rawEvent.data.length < 2) {
      return null;
    }

    const [sharpsOrFlats, scaleType] = rawEvent.data;
    const scale = scaleType === 0 ? 'major' : 'minor';
    const key = this.getKeyName(sharpsOrFlats, scale);

    return {
      deltaTime: rawEvent.deltaTime,
      type: 'keySignature',
      key,
      scale,
      sharpsOrFlats,
    };
  }

  /**
   * Create text event
   */
  private static createTextEvent(rawEvent: MidiEvent): MidiTextEvent | null {
    if (!rawEvent.data) {
      return null;
    }

    const text = String.fromCharCode(...rawEvent.data);

    return {
      deltaTime: rawEvent.deltaTime,
      type: rawEvent.type as MidiTextEvent['type'],
      text,
    };
  }

  /**
   * Get controller name
   */
  private static getControllerName(controller: number): string {
    const controllerNames: Record<number, string> = {
      0: 'Bank Select',
      1: 'Modulation Wheel',
      2: 'Breath Controller',
      7: 'Channel Volume',
      10: 'Pan',
      11: 'Expression Controller',
      64: 'Sustain Pedal',
      65: 'Portamento',
      66: 'Sostenuto',
      67: 'Soft Pedal',
      68: 'Legato Footswitch',
      91: 'Effects 1 Depth',
      92: 'Effects 2 Depth',
      93: 'Effects 3 Depth',
      94: 'Effects 4 Depth',
      95: 'Effects 5 Depth',
    };

    return controllerNames[controller] || `Controller ${controller}`;
  }

  /**
   * Get program name (General MIDI)
   */
  private static getProgramName(program: number): string {
    // This is a simplified version - full GM program names would be much longer
    const categories = [
      'Piano',
      'Chromatic Percussion',
      'Organ',
      'Guitar',
      'Bass',
      'Strings',
      'Ensemble',
      'Brass',
      'Reed',
      'Pipe',
      'Synth Lead',
      'Synth Pad',
      'Synth Effects',
      'Ethnic',
      'Percussive',
      'Sound Effects',
    ];

    const category = Math.floor(program / 8);
    const instrument = (program % 8) + 1;

    return category < categories.length
      ? `${categories[category]} ${instrument}`
      : `Program ${program}`;
  }

  /**
   * Get key name from sharps/flats
   */
  private static getKeyName(
    sharpsOrFlats: number,
    scale: 'major' | 'minor',
  ): string {
    const majorKeys = [
      'C',
      'G',
      'D',
      'A',
      'E',
      'B',
      'F#',
      'C',
      'F',
      'Bb',
      'Eb',
      'Ab',
      'Db',
      'Gb',
    ];

    const minorKeys = [
      'A',
      'E',
      'B',
      'F#',
      'C#',
      'G#',
      'D#',
      'A',
      'D',
      'G',
      'C',
      'F',
      'Bb',
      'Eb',
    ];

    const keys = scale === 'major' ? majorKeys : minorKeys;
    const index = sharpsOrFlats + 7;

    return index >= 0 && index < keys.length ? keys[index] : `Unknown ${scale}`;
  }
}
