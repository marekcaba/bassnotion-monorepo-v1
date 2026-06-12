import { describe, it, expect } from 'vitest';
import { MusicXMLParser } from '../musicxml-parser.js';

/**
 * Regression coverage for the MusicXML parser. The parser was wired to a stub
 * upload UI and never exercised end-to-end, so a key bug went unnoticed:
 * fast-xml-parser produces HYPHENATED tag names and single-element OBJECTS,
 * while the converter reads camelCase keys and indexes arrays. The parser now
 * transforms tag names → camelCase and force-arrays the structural collections.
 * These tests pin that a minimal real MusicXML actually parses to notes.
 */
const minimalBassXML = `<?xml version="1.0"?>
<score-partwise version="3.1">
 <part-list><score-part id="P1"><part-name>Bass</part-name></score-part></part-list>
 <part id="P1">
  <measure number="1">
   <attributes>
     <divisions>1</divisions>
     <time><beats>4</beats><beat-type>4</beat-type></time>
     <clef><sign>F</sign><line>4</line></clef>
   </attributes>
   <note><pitch><step>E</step><octave>2</octave></pitch><duration>1</duration><type>quarter</type></note>
   <note><pitch><step>A</step><octave>2</octave></pitch><duration>1</duration><type>quarter</type></note>
   <note><pitch><step>D</step><octave>3</octave></pitch><duration>1</duration><type>quarter</type></note>
   <note><pitch><step>G</step><octave>3</octave></pitch><duration>1</duration><type>quarter</type></note>
  </measure>
 </part>
</score-partwise>`;

describe('MusicXMLParser', () => {
  it('parses a single-part bass score into ExerciseNotes', async () => {
    const result = await new MusicXMLParser().parseFile(minimalBassXML);
    expect(result.success).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.notes).toHaveLength(4);
  });

  it('emits notes with the {measure, beat, subdivision} position shape', async () => {
    const { notes } = await new MusicXMLParser().parseFile(minimalBassXML);
    expect(notes[0]?.note).toBe('E');
    expect(notes[0]?.position).toMatchObject({ measure: 1, beat: 1 });
    // four quarter notes in one bar → beats 1..4
    expect(notes.map((n) => n.position?.beat)).toEqual([1, 2, 3, 4]);
    expect(notes.every((n) => n.duration === 'quarter')).toBe(true);
  });

  it('rejects non-MusicXML input cleanly', async () => {
    const result = await new MusicXMLParser().parseFile('<not-music/>');
    expect(result.success).toBe(false);
    expect(result.notes).toHaveLength(0);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
