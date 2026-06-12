import { describe, it, expect } from 'vitest';
import { Midi } from '@tonejs/midi';
import { MIDIFileParser } from '../midifile-parser.js';

/**
 * Regression coverage for the MIDI parser. Like the MusicXML path, MIDI import
 * was never wired to a working UI, so this pins that a real MIDI buffer parses
 * into ExerciseNotes with the {measure, beat, subdivision} position shape the
 * groove sheet view + Zod schema expect.
 */
function buildBassMidi(): ArrayBuffer {
  const midi = new Midi();
  midi.header.setTempo(120);
  const track = midi.addTrack();
  track.name = 'Bass';
  ['E1', 'A1', 'D2', 'G2'].forEach((n, i) =>
    track.addNote({ name: n, time: i * 0.5, duration: 0.5 }),
  );
  const u8 = midi.toArray();
  return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);
}

describe('MIDIFileParser', () => {
  it('parses a bass MIDI into ExerciseNotes', async () => {
    const result = await new MIDIFileParser().parseFile(
      buildBassMidi(),
      'bass.mid',
    );
    expect(result.success).toBe(true);
    expect(result.exercise?.notes?.length).toBe(4);
  });

  it('emits the {measure, beat, subdivision} position shape', async () => {
    const result = await new MIDIFileParser().parseFile(
      buildBassMidi(),
      'bass.mid',
    );
    const first = result.exercise?.notes?.[0];
    expect(first?.position).toMatchObject({ measure: 1, beat: 1 });
    expect(first?.position?.subdivision).toBeTypeOf('number');
  });
});
