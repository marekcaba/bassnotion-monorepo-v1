/**
 * MIDI Stream Parser
 *
 * Supports streaming MIDI data for real-time processing
 */

import { createStructuredLogger } from '@bassnotion/contracts';
import { MidiEventFactory, type TypedMidiEvent } from './MidiEventFactory.js';
import type { MidiHeader, MidiEvent } from './MidiFileParser.js';

const logger = createStructuredLogger('MidiStreamParser');

export interface StreamParserOptions {
  bufferSize?: number;
  realTime?: boolean;
  onEvent?: (event: TypedMidiEvent) => void;
  onError?: (error: Error) => void;
}

interface StreamState {
  header?: MidiHeader;
  currentTrack: number;
  bytesProcessed: number;
  runningStatus: number;
  buffer: Uint8Array;
  bufferPosition: number;
}

/**
 * Streaming MIDI parser for real-time processing
 */
export class MidiStreamParser {
  private options: Required<StreamParserOptions>;
  private state: StreamState;
  private isProcessing = false;

  constructor(options: StreamParserOptions = {}) {
    this.options = {
      bufferSize: options.bufferSize || 4096,
      realTime: options.realTime || false,
      onEvent: options.onEvent || (() => {}),
      onError:
        options.onError || ((error) => logger.error('Stream error', error)),
    };

    this.state = {
      currentTrack: 0,
      bytesProcessed: 0,
      runningStatus: 0,
      buffer: new Uint8Array(this.options.bufferSize),
      bufferPosition: 0,
    };
  }

  /**
   * Process a chunk of MIDI data
   */
  async processChunk(data: Uint8Array): Promise<void> {
    if (this.isProcessing) {
      throw new Error('Parser is already processing');
    }

    this.isProcessing = true;

    try {
      // Add data to buffer
      this.appendToBuffer(data);

      // Process buffer
      while (this.bufferPosition > 0) {
        const processed = await this.processBuffer();
        if (!processed) break;
      }
    } catch (error) {
      this.options.onError(
        error instanceof Error ? error : new Error(String(error)),
      );
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process buffered data
   */
  private async processBuffer(): Promise<boolean> {
    // Need at least 14 bytes for header
    if (!this.state.header && this.bufferPosition < 14) {
      return false;
    }

    // Parse header if not done
    if (!this.state.header) {
      const header = this.parseStreamHeader();
      if (!header) return false;
      this.state.header = header;
      logger.info('Stream header parsed', header);
    }

    // Parse track data
    return this.parseStreamTrack();
  }

  /**
   * Parse header from stream
   */
  private parseStreamHeader(): MidiHeader | null {
    if (this.bufferPosition < 14) return null;

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

    return { format, trackCount, ticksPerQuarterNote };
  }

  /**
   * Parse track data from stream
   */
  private parseStreamTrack(): boolean {
    // Check for track header
    if (this.bufferPosition < 8) return false;

    const pos = this.state.bytesProcessed;
    const chunkType = this.peekString(4);

    if (chunkType === 'MTrk') {
      // New track
      this.readString(4); // Consume MTrk
      const chunkLength = this.readUint32();
      logger.info(
        `Starting track ${this.state.currentTrack}, length: ${chunkLength}`,
      );
    }

    // Parse events until buffer is exhausted
    while (this.bufferPosition > 0) {
      const event = this.parseStreamEvent();
      if (!event) return false;

      // Convert to typed event
      const typedEvent = MidiEventFactory.createEvent(event);
      if (typedEvent && this.options.onEvent) {
        this.options.onEvent(typedEvent);
      }

      // Real-time mode: yield control
      if (this.options.realTime) {
        return true;
      }
    }

    return true;
  }

  /**
   * Parse a single event from stream
   */
  private parseStreamEvent(): MidiEvent | null {
    if (this.bufferPosition < 2) return null;

    const deltaTime = this.readVariableLength();
    if (deltaTime === null) return null;

    const statusByte = this.peekUint8();
    if (statusByte === null) return null;

    // Handle running status
    let actualStatus = statusByte;
    if ((statusByte & 0x80) === 0) {
      actualStatus = this.state.runningStatus;
    } else {
      this.readUint8(); // Consume status byte
      this.state.runningStatus = statusByte;
    }

    // Parse based on status
    if (actualStatus === 0xff) {
      return this.parseStreamMetaEvent(deltaTime);
    } else if (actualStatus === 0xf0 || actualStatus === 0xf7) {
      return this.parseStreamSysExEvent(deltaTime, actualStatus);
    } else {
      return this.parseStreamChannelEvent(deltaTime, actualStatus);
    }
  }

  /**
   * Parse channel event from stream
   */
  private parseStreamChannelEvent(
    deltaTime: number,
    statusByte: number,
  ): MidiEvent | null {
    const eventType = statusByte & 0xf0;
    const channel = statusByte & 0x0f;

    // Determine data bytes needed
    let dataBytes = 2;
    if (eventType === 0xc0 || eventType === 0xd0) {
      dataBytes = 1;
    }

    if (this.bufferPosition < dataBytes) return null;

    const data: number[] = [];
    for (let i = 0; i < dataBytes; i++) {
      const byte = this.readUint8();
      if (byte === null) return null;
      data.push(byte);
    }

    // Map event type
    const typeMap: Record<number, string> = {
      0x80: 'channelNoteOff',
      0x90: 'channelNoteOn',
      0xa0: 'channelAftertouch',
      0xb0: 'channelControlChange',
      0xc0: 'channelProgramChange',
      0xd0: 'channelPressure',
      0xe0: 'channelPitchBend',
    };

    const type = typeMap[eventType];
    if (!type) return null;

    // Special handling for pitch bend
    if (eventType === 0xe0 && data.length === 2) {
      data.push((data[1] << 7) | data[0]); // Combined value
    }

    return { deltaTime, type, channel, data };
  }

  /**
   * Parse meta event from stream
   */
  private parseStreamMetaEvent(deltaTime: number): MidiEvent | null {
    if (this.bufferPosition < 2) return null;

    const metaType = this.readUint8();
    if (metaType === null) return null;

    const length = this.readVariableLength();
    if (length === null) return null;

    if (this.bufferPosition < length) return null;

    const data: number[] = [];
    for (let i = 0; i < length; i++) {
      const byte = this.readUint8();
      if (byte === null) return null;
      data.push(byte);
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
   * Parse SysEx event from stream
   */
  private parseStreamSysExEvent(
    deltaTime: number,
    statusByte: number,
  ): MidiEvent | null {
    const length = this.readVariableLength();
    if (length === null || this.bufferPosition < length) return null;

    const data: number[] = [];
    for (let i = 0; i < length; i++) {
      const byte = this.readUint8();
      if (byte === null) return null;
      data.push(byte);
    }

    return {
      deltaTime,
      type: statusByte === 0xf0 ? 'sysEx' : 'sysExContinuation',
      data,
    };
  }

  /**
   * Append data to internal buffer
   */
  private appendToBuffer(data: Uint8Array): void {
    const spaceAvailable = this.state.buffer.length - this.bufferPosition;

    if (data.length > spaceAvailable) {
      // Compact buffer
      this.state.buffer.copyWithin(0, this.state.bytesProcessed);
      this.bufferPosition -= this.state.bytesProcessed;
      this.state.bytesProcessed = 0;
    }

    // Copy new data
    this.state.buffer.set(data, this.bufferPosition);
    this.bufferPosition += data.length;
  }

  /**
   * Read variable length value
   */
  private readVariableLength(): number | null {
    let value = 0;
    let bytesRead = 0;

    while (bytesRead < 4) {
      if (this.bufferPosition <= bytesRead) return null;

      const byte = this.state.buffer[this.state.bytesProcessed + bytesRead];
      value = (value << 7) | (byte & 0x7f);
      bytesRead++;

      if ((byte & 0x80) === 0) {
        this.state.bytesProcessed += bytesRead;
        this.bufferPosition -= bytesRead;
        return value;
      }
    }

    throw new Error('Variable length value too long');
  }

  // Helper methods for reading from buffer
  private readString(length: number): string {
    if (this.bufferPosition < length) throw new Error('Buffer underrun');

    let result = '';
    for (let i = 0; i < length; i++) {
      result += String.fromCharCode(
        this.state.buffer[this.state.bytesProcessed++],
      );
    }
    this.bufferPosition -= length;
    return result;
  }

  private peekString(length: number): string | null {
    if (this.bufferPosition < length) return null;

    let result = '';
    for (let i = 0; i < length; i++) {
      result += String.fromCharCode(
        this.state.buffer[this.state.bytesProcessed + i],
      );
    }
    return result;
  }

  private readUint8(): number | null {
    if (this.bufferPosition < 1) return null;
    this.bufferPosition--;
    return this.state.buffer[this.state.bytesProcessed++];
  }

  private peekUint8(): number | null {
    if (this.bufferPosition < 1) return null;
    return this.state.buffer[this.state.bytesProcessed];
  }

  private readUint16(): number {
    if (this.bufferPosition < 2) throw new Error('Buffer underrun');
    const value =
      (this.state.buffer[this.state.bytesProcessed] << 8) |
      this.state.buffer[this.state.bytesProcessed + 1];
    this.state.bytesProcessed += 2;
    this.bufferPosition -= 2;
    return value;
  }

  private readUint32(): number {
    if (this.bufferPosition < 4) throw new Error('Buffer underrun');
    const value =
      (this.state.buffer[this.state.bytesProcessed] << 24) |
      (this.state.buffer[this.state.bytesProcessed + 1] << 16) |
      (this.state.buffer[this.state.bytesProcessed + 2] << 8) |
      this.state.buffer[this.state.bytesProcessed + 3];
    this.state.bytesProcessed += 4;
    this.bufferPosition -= 4;
    return value;
  }

  /**
   * Reset parser state
   */
  reset(): void {
    this.state = {
      currentTrack: 0,
      bytesProcessed: 0,
      runningStatus: 0,
      buffer: new Uint8Array(this.options.bufferSize),
      bufferPosition: 0,
    };
  }
}
