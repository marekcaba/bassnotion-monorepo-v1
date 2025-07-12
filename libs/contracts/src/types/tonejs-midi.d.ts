/**
 * Type declarations for @tonejs/midi
 */

declare module '@tonejs/midi' {
  export interface MidiHeader {
    format: number;
    numTracks: number;
    ticksPerQuarter: number;
  }

  export interface MidiControlChange {
    number: number;
    value: number;
    time: number;
    ticks: number;
  }

  export interface MidiNote {
    midi: number;
    time: number;
    ticks: number;
    name: string;
    pitch: string;
    octave: number;
    velocity: number;
    duration: number;
    durationTicks: number;
  }

  export interface MidiTrack {
    name: string;
    channel: number;
    instrument: {
      family: string;
      name: string;
      number: number;
    };
    notes: MidiNote[];
    controlChanges: {
      [controller: number]: MidiControlChange[];
    };
    pitchBends: Array<{
      time: number;
      ticks: number;
      value: number;
    }>;
  }

  export interface MidiKeySignature {
    key: string;
    scale: string;
    ticks: number;
    time: number;
  }

  export interface MidiTimeSignature {
    numerator: number;
    denominator: number;
    ticks: number;
    time: number;
  }

  export interface MidiTempo {
    bpm: number;
    ticks: number;
    time: number;
  }

  export interface MidiData {
    header: MidiHeader;
    tracks: MidiTrack[];
    duration: number;
    durationTicks: number;
    keySignatures: MidiKeySignature[];
    timeSignatures: MidiTimeSignature[];
    tempos: MidiTempo[];
  }

  class Midi {
    constructor(data?: ArrayBuffer);
    
    header: MidiHeader;
    tracks: MidiTrack[];
    duration: number;
    durationTicks: number;
    keySignatures: MidiKeySignature[];
    timeSignatures: MidiTimeSignature[];
    tempos: MidiTempo[];
    
    static fromUrl(url: string): Promise<Midi>;
    fromJSON(json: any): void;
    toJSON(): any;
    toArray(): Uint8Array;
  }

  export { Midi };
  export default Midi;
}