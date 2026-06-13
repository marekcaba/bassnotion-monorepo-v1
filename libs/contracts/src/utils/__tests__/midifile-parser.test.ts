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

  it('reads ticks-per-quarter from @tonejs/midi ppq (not a 480 fallback)', async () => {
    // @tonejs/midi default ppq is NOT 480; reading the wrong header name made
    // division silently fall back to 480, mis-scaling positions (a phantom lead
    // rest). division must equal the file's real ppq.
    const midi = new Midi();
    midi.header.setTempo(120);
    const track = midi.addTrack();
    track.addNote({ name: 'E1', time: 0, duration: 1 }); // tick 0 → beat 1
    const u8 = midi.toArray();
    const buffer = u8.buffer.slice(
      u8.byteOffset,
      u8.byteOffset + u8.byteLength,
    );
    const result = await new MIDIFileParser().parseFile(buffer, 'bass.mid');
    expect(result.metadata?.division).toBe(midi.header.ppq);
    // a note at tick 0 must land on measure 1, beat 0 (the downbeat) — no
    // leading rest. (beat is 0-indexed, matching the renderer.)
    expect(result.exercise?.notes?.[0]?.position).toMatchObject({
      measure: 1,
      beat: 0,
    });
  });

  it('emits the {measure, beat (0-indexed), subdivision, tick} position shape', async () => {
    const result = await new MIDIFileParser().parseFile(
      buildBassMidi(),
      'bass.mid',
    );
    const notes = result.exercise?.notes ?? [];
    // beat is 0-INDEXED (the downbeat = beat 0), which is what
    // exerciseToMusicXML/SheetMusicDisplay consume. The four quarter notes land
    // on beats 0,1,2,3 of bar 1.
    expect(notes[0]?.position).toMatchObject({ measure: 1, beat: 0 });
    expect(notes.map((n) => n.position?.beat)).toEqual([0, 1, 2, 3]);
    expect(notes[0]?.position?.tick).toBe(0); // sub-beat offset, not absolute
    expect(notes[0]?.position?.subdivision).toBeTypeOf('number');
  });

  it('auto-tags soft (low-velocity) notes as ghost notes', async () => {
    const midi = new Midi();
    midi.header.setTempo(120);
    const track = midi.addTrack();
    track.name = 'Bass';
    // loud (≈115) then soft/ghost (≈25)
    track.addNote({ name: 'E1', time: 0, duration: 0.5, velocity: 0.9 });
    track.addNote({ name: 'A1', time: 0.5, duration: 0.5, velocity: 0.2 });
    const u8 = midi.toArray();
    const buffer = u8.buffer.slice(
      u8.byteOffset,
      u8.byteOffset + u8.byteLength,
    );
    const result = await new MIDIFileParser().parseFile(buffer, 'bass.mid');
    const notes = result.exercise?.notes ?? [];
    expect(notes[0]?.is_ghost_note).toBeFalsy(); // loud note
    expect(notes[1]?.is_ghost_note).toBe(true); // soft note → ghost
  });
});
