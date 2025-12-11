/**
 * MIDI File Parser
 *
 * Handles binary MIDI file parsing
 * Extracted from MidiParserProcessor for better modularity
 */

import { createStructuredLogger } from '@bassnotion/contracts';

const logger = createStructuredLogger('MidiFileParser');

export interface MidiHeader {
  format: 0 | 1 | 2;
  trackCount: number;
  ticksPerQuarterNote: number;
}

export interface MidiEvent {
  deltaTime: number;
  type: string;
  channel?: number;
  data?: number[];
}

export interface MidiTrack {
  name?: string;
  events: MidiEvent[];
}

export interface ParsedMidiFile {
  header: MidiHeader;
  tracks: MidiTrack[];
}

/**
 * Core MIDI file parser
 * Handles binary MIDI file format parsing
 */
export class MidiFileParser {
  private dataView: DataView | null = null;
  private position = 0;

  /**
   * Parse a MIDI file from binary data
   */
  async parseMidiFile(data: ArrayBuffer): Promise<ParsedMidiFile> {
    this.dataView = new DataView(data);
    this.position = 0;

    try {
      const header = this.parseHeader();
      const tracks = this.parseTracks(header.trackCount);

      logger.info('MIDI file parsed successfully', {
        format: header.format,
        trackCount: header.trackCount,
        totalEvents: tracks.reduce(
          (sum, track) => sum + track.events.length,
          0,
        ),
      });

      return { header, tracks };
    } catch (error) {
      logger.error('Failed to parse MIDI file', error);
      throw new Error(
        `MIDI parsing failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Parse MIDI header chunk
   */
  private parseHeader(): MidiHeader {
    const chunkType = this.readString(4);
    if (chunkType !== 'MThd') {
      throw new Error(`Invalid MIDI header: ${chunkType}`);
    }

    const chunkLength = this.readUint32();
    if (chunkLength !== 6) {
      throw new Error(`Invalid header length: ${chunkLength}`);
    }

    const format = this.readUint16() as 0 | 1 | 2;
    const trackCount = this.readUint16();
    const ticksPerQuarterNote = this.readUint16();

    if (format > 2) {
      throw new Error(`Invalid MIDI format: ${format}`);
    }

    return { format, trackCount, ticksPerQuarterNote };
  }

  /**
   * Parse all tracks
   */
  private parseTracks(trackCount: number): MidiTrack[] {
    const tracks: MidiTrack[] = [];

    for (let i = 0; i < trackCount; i++) {
      tracks.push(this.parseTrack());
    }

    return tracks;
  }

  /**
   * Parse a single track
   */
  private parseTrack(): MidiTrack {
    const chunkType = this.readString(4);
    if (chunkType !== 'MTrk') {
      throw new Error(`Invalid track header: ${chunkType}`);
    }

    const chunkLength = this.readUint32();
    const endPosition = this.position + chunkLength;
    const events: MidiEvent[] = [];
    let trackName: string | undefined;
    let runningStatus = 0;

    while (this.position < endPosition) {
      const event = this.parseEvent(runningStatus);

      if (event) {
        events.push(event);

        // Track name from meta event
        if (event.type === 'trackName' && event.data) {
          trackName = this.dataToString(event.data);
        }

        // Update running status
        if (event.type.startsWith('channel') && event.data?.[0]) {
          runningStatus = event.data[0] & 0xf0;
        }
      }
    }

    return { name: trackName, events };
  }

  /**
   * Parse a single MIDI event
   */
  private parseEvent(runningStatus: number): MidiEvent | null {
    const deltaTime = this.readVariableLength();
    let statusByte = this.readUint8();

    // Handle running status
    if ((statusByte & 0x80) === 0) {
      this.position--;
      statusByte = runningStatus;
    }

    // Meta events
    if (statusByte === 0xff) {
      return this.parseMetaEvent(deltaTime);
    }

    // System exclusive
    if (statusByte === 0xf0 || statusByte === 0xf7) {
      return this.parseSysExEvent(deltaTime, statusByte);
    }

    // Channel events
    const eventType = statusByte & 0xf0;
    const channel = statusByte & 0x0f;

    switch (eventType) {
      case 0x80: // Note Off
        return {
          deltaTime,
          type: 'channelNoteOff',
          channel,
          data: [this.readUint8(), this.readUint8()], // note, velocity
        };

      case 0x90: // Note On
        return {
          deltaTime,
          type: 'channelNoteOn',
          channel,
          data: [this.readUint8(), this.readUint8()], // note, velocity
        };

      case 0xa0: // Polyphonic Aftertouch
        return {
          deltaTime,
          type: 'channelAftertouch',
          channel,
          data: [this.readUint8(), this.readUint8()], // note, pressure
        };

      case 0xb0: // Control Change
        return {
          deltaTime,
          type: 'channelControlChange',
          channel,
          data: [this.readUint8(), this.readUint8()], // controller, value
        };

      case 0xc0: // Program Change
        return {
          deltaTime,
          type: 'channelProgramChange',
          channel,
          data: [this.readUint8()], // program
        };

      case 0xd0: // Channel Aftertouch
        return {
          deltaTime,
          type: 'channelPressure',
          channel,
          data: [this.readUint8()], // pressure
        };

      case 0xe0: // Pitch Bend
        const lsb = this.readUint8();
        const msb = this.readUint8();
        return {
          deltaTime,
          type: 'channelPitchBend',
          channel,
          data: [lsb, msb, (msb << 7) | lsb], // lsb, msb, combined value
        };

      default:
        // Silently skip unknown MIDI events (likely padding or unused data)
        // Common examples: 0x20 (32) appears in some MIDI files as padding
        // Only log if it's actually a valid status byte range (0x80-0xEF)
        if (statusByte >= 0x80 && statusByte <= 0xef) {
          logger.warn('Unknown MIDI event type', { eventType, statusByte });
        }
        return null;
    }
  }

  /**
   * Parse meta event
   */
  private parseMetaEvent(deltaTime: number): MidiEvent {
    const metaType = this.readUint8();
    const length = this.readVariableLength();
    const data: number[] = [];

    for (let i = 0; i < length; i++) {
      data.push(this.readUint8());
    }

    const typeMap: Record<number, string> = {
      0x00: 'sequenceNumber',
      0x01: 'text',
      0x02: 'copyright',
      0x03: 'trackName',
      0x04: 'instrumentName',
      0x05: 'lyrics',
      0x06: 'marker',
      0x07: 'cuePoint',
      0x20: 'midiChannelPrefix',
      0x2f: 'endOfTrack',
      0x51: 'setTempo',
      0x54: 'smpteOffset',
      0x58: 'timeSignature',
      0x59: 'keySignature',
      0x7f: 'sequencerSpecific',
    };

    return {
      deltaTime,
      type: typeMap[metaType] || `meta${metaType}`,
      data,
    };
  }

  /**
   * Parse system exclusive event
   */
  private parseSysExEvent(deltaTime: number, statusByte: number): MidiEvent {
    const length = this.readVariableLength();
    const data: number[] = [];

    for (let i = 0; i < length; i++) {
      data.push(this.readUint8());
    }

    return {
      deltaTime,
      type: statusByte === 0xf0 ? 'sysEx' : 'sysExContinuation',
      data,
    };
  }

  /**
   * Read variable length value
   */
  private readVariableLength(): number {
    let value = 0;
    let byte: number;

    do {
      byte = this.readUint8();
      value = (value << 7) | (byte & 0x7f);
    } while ((byte & 0x80) !== 0);

    return value;
  }

  /**
   * Read string from data
   */
  private readString(length: number): string {
    if (!this.dataView) throw new Error('No data to read');

    let result = '';
    for (let i = 0; i < length; i++) {
      result += String.fromCharCode(this.dataView.getUint8(this.position++));
    }
    return result;
  }

  /**
   * Read 8-bit unsigned integer
   */
  private readUint8(): number {
    if (!this.dataView) throw new Error('No data to read');
    return this.dataView.getUint8(this.position++);
  }

  /**
   * Read 16-bit unsigned integer (big-endian)
   */
  private readUint16(): number {
    if (!this.dataView) throw new Error('No data to read');
    const value = this.dataView.getUint16(this.position, false);
    this.position += 2;
    return value;
  }

  /**
   * Read 32-bit unsigned integer (big-endian)
   */
  private readUint32(): number {
    if (!this.dataView) throw new Error('No data to read');
    const value = this.dataView.getUint32(this.position, false);
    this.position += 4;
    return value;
  }

  /**
   * Convert data array to string
   */
  private dataToString(data: number[]): string {
    return String.fromCharCode(...data);
  }
}
