import type { ExerciseNote, TimeSignature } from '@bassnotion/contracts';

/**
 * Converts exercise data to MusicXML format for OpenSheetMusicDisplay
 *
 * This utility transforms our internal exercise note format into the standard
 * MusicXML format, which OSMD can then render with professional notation rules.
 *
 * Uses a template-based approach for simplicity and reliability.
 */

interface ExerciseToMusicXMLOptions {
  notes: ExerciseNote[];
  bpm: number;
  timeSignature: TimeSignature;
  title?: string;
  maxMeasuresPerSystem?: number;
}

interface TimelineItem {
  type: 'note' | 'rest';
  note?: ExerciseNote;
  duration: string;
  startBeat: number;
}

/**
 * Maps our note duration format to MusicXML note types and divisions
 */
function getDurationData(duration: string): {
  type: string;
  dots: number;
  divisions: number;
} {
  const map: Record<string, { type: string; dots: number; divisions: number }> = {
    // Standard naming (used in contracts)
    whole: { type: 'whole', dots: 0, divisions: 3840 },
    'whole-dotted': { type: 'whole', dots: 1, divisions: 5760 },
    'dotted-half': { type: 'half', dots: 1, divisions: 2880 },
    'half-dotted': { type: 'half', dots: 1, divisions: 2880 },
    half: { type: 'half', dots: 0, divisions: 1920 },
    'dotted-quarter': { type: 'quarter', dots: 1, divisions: 1440 },
    'quarter-dotted': { type: 'quarter', dots: 1, divisions: 1440 },
    quarter: { type: 'quarter', dots: 0, divisions: 480 },
    'dotted-eighth': { type: 'eighth', dots: 1, divisions: 720 },
    'eighth-dotted': { type: 'eighth', dots: 1, divisions: 720 },
    eighth: { type: 'eighth', dots: 0, divisions: 480 },
    'dotted-sixteenth': { type: '16th', dots: 1, divisions: 360 },
    'sixteenth-dotted': { type: '16th', dots: 1, divisions: 360 },
    sixteenth: { type: '16th', dots: 0, divisions: 240 },
    'dotted-thirty-second': { type: '32nd', dots: 1, divisions: 180 },
    'thirty-second': { type: '32nd', dots: 0, divisions: 120 },
    'sixty-fourth': { type: '64th', dots: 0, divisions: 60 },

    // Alternative naming (for backwards compatibility)
    'half.': { type: 'half', dots: 1, divisions: 2880 },
    'quarter.': { type: 'quarter', dots: 1, divisions: 1440 },
    'eighth.': { type: 'eighth', dots: 1, divisions: 720 },
    '16th.': { type: '16th', dots: 1, divisions: 360 },
    '16th': { type: '16th', dots: 0, divisions: 240 },
    '32nd.': { type: '32nd', dots: 1, divisions: 180 },
    '32nd': { type: '32nd', dots: 0, divisions: 120 },
  };

  return map[duration] || { type: 'quarter', dots: 0, divisions: 480 };
}

/**
 * Extract octave from note name and transpose up one octave for standard bass notation
 * Bass guitar is notated one octave higher than it sounds
 * e.g., "A2" (sounds) -> 3 (written), "C3" (sounds) -> 4 (written)
 * If no octave specified, default to 2 (bass guitar range) -> written as 3
 */
function extractOctave(note: string): number {
  const match = note.match(/\d+$/);
  const soundingOctave = match ? parseInt(match[0]) : 2;
  // Bass notation convention: write one octave higher than sounding pitch
  return soundingOctave + 1;
}

/**
 * Converts note name to MusicXML pitch (step, alter, octave)
 */
function getPitchXML(note: string): string {
  const step = note[0].toUpperCase();
  let alterXML = '';

  if (note.includes('#')) {
    alterXML = '<alter>1</alter>';
  } else if (note.includes('b')) {
    alterXML = '<alter>-1</alter>';
  }

  const octave = extractOctave(note);

  return `
      <pitch>
        <step>${step}</step>${alterXML}
        <octave>${octave}</octave>
      </pitch>`;
}

/**
 * Gets duration in quarter notes for timeline calculation
 */
function getDurationInQuarters(duration: string): number {
  const map: Record<string, number> = {
    // Standard naming
    whole: 4,
    'whole-dotted': 6,
    'dotted-half': 3,
    'half-dotted': 3,
    half: 2,
    'dotted-quarter': 1.5,
    'quarter-dotted': 1.5,
    quarter: 1,
    'dotted-eighth': 0.75,
    'eighth-dotted': 0.75,
    eighth: 0.5,
    'dotted-sixteenth': 0.375,
    'sixteenth-dotted': 0.375,
    sixteenth: 0.25,
    'dotted-thirty-second': 0.1875,
    'thirty-second': 0.125,
    'sixty-fourth': 0.0625,

    // Alternative naming
    'half.': 3,
    'quarter.': 1.5,
    'eighth.': 0.75,
    '16th.': 0.375,
    '16th': 0.25,
    '32nd.': 0.1875,
    '32nd': 0.125,
  };

  return map[duration] || 1;
}

/**
 * Converts duration in quarter notes to rest duration type
 */
function getRestDurationType(durationInQuarters: number): string {
  if (durationInQuarters >= 5.5) return 'whole-dotted';
  if (durationInQuarters >= 3.9) return 'whole';
  if (durationInQuarters >= 2.8) return 'half-dotted';
  if (durationInQuarters >= 1.9) return 'half';
  if (durationInQuarters >= 1.4) return 'quarter-dotted';
  if (durationInQuarters >= 0.9) return 'quarter';
  if (durationInQuarters >= 0.7) return 'eighth-dotted';
  if (durationInQuarters >= 0.45) return 'eighth';
  if (durationInQuarters >= 0.35) return 'sixteenth-dotted';
  if (durationInQuarters >= 0.2) return 'sixteenth';
  if (durationInQuarters >= 0.15) return 'dotted-thirty-second';
  if (durationInQuarters >= 0.1) return 'thirty-second';
  return 'sixty-fourth';
}

/**
 * Organizes notes into measures based on their position
 */
function organizeNotesIntoMeasures(
  notes: ExerciseNote[],
  _timeSignature: TimeSignature
): ExerciseNote[][] {
  const measures: ExerciseNote[][] = [];

  // Group notes by measure
  notes.forEach((note) => {
    const measureIndex = (note.position?.measure || 1) - 1;

    if (!measures[measureIndex]) {
      measures[measureIndex] = [];
    }

    measures[measureIndex].push(note);
  });

  // Sort notes within each measure by beat position
  measures.forEach((measure) => {
    measure.sort((a, b) => {
      const aPos = (a.position?.beat || 1) + (a.position?.subdivision || 0) / 480;
      const bPos = (b.position?.beat || 1) + (b.position?.subdivision || 0) / 480;
      return aPos - bPos;
    });
  });

  return measures;
}

/**
 * Fills gaps in a measure with rests
 */
function fillMeasureWithRests(
  measureNotes: ExerciseNote[],
  beatsPerMeasure: number
): TimelineItem[] {
  const timeline: TimelineItem[] = [];
  let currentBeat = 0;

  measureNotes.forEach((note) => {
    const ticksPerQuarterNote = 480;
    const subdivisionBeats = (note.position?.subdivision || 0) / ticksPerQuarterNote;
    const noteBeat = (note.position?.beat || 1) - 1 + subdivisionBeats;
    const noteDuration = getDurationInQuarters(note.duration);

    // Fill gap with rest if needed
    if (noteBeat > currentBeat + 0.001) {
      const restDuration = noteBeat - currentBeat;
      const restType = getRestDurationType(restDuration);
      timeline.push({
        type: 'rest',
        duration: restType,
        startBeat: currentBeat,
      });
    }

    // Add note
    timeline.push({
      type: 'note',
      note: note,
      duration: note.duration,
      startBeat: noteBeat,
    });

    currentBeat = noteBeat + noteDuration;
  });

  // Fill end of measure if needed
  if (currentBeat < beatsPerMeasure - 0.001) {
    const restDuration = beatsPerMeasure - currentBeat;
    const restType = getRestDurationType(restDuration);
    timeline.push({
      type: 'rest',
      duration: restType,
      startBeat: currentBeat,
    });
  }

  return timeline;
}

/**
 * Generates XML for a single note or rest with optional beam information
 */
function generateNoteXML(
  item: TimelineItem,
  beamInfo?: { beamType: 'begin' | 'continue' | 'end' }
): string {
  const { type: noteType, dots, divisions } = getDurationData(item.duration);
  const dotXML = dots > 0 ? '<dot/>' : '';

  // Add beam tags for beamable notes (eighth and shorter)
  // Support both standard and alternative duration formats
  const beamableDurations = [
    'eighth', 'dotted-eighth', 'eighth-dotted',
    'sixteenth', 'dotted-sixteenth', 'sixteenth-dotted',
    'thirty-second', 'sixty-fourth',
    'eighth.', '16th', '16th.', '32nd', '32nd.'
  ];
  let beamXML = '';
  if (beamInfo && item.type === 'note' && beamableDurations.includes(item.duration)) {
    beamXML = `
      <beam number="1">${beamInfo.beamType}</beam>`;
  }

  if (item.type === 'rest') {
    return `
    <note>
      <rest/>
      <duration>${divisions}</duration>
      <type>${noteType}</type>${dotXML}
    </note>`;
  } else if (item.note) {
    const pitchXML = getPitchXML(item.note.note);
    return `
    <note>${pitchXML}
      <duration>${divisions}</duration>
      <type>${noteType}</type>${dotXML}${beamXML}
    </note>`;
  }

  return '';
}

/**
 * Calculate beam groups for a measure following professional notation rules:
 * 1. Beams only connect NOTES (not rests)
 * 2. Notes must be within the same beat
 * 3. Minimum 2 notes required to form a beam
 * 4. Rests at the beginning or end of a beat don't participate in beams
 */
function calculateBeamGroups(timeline: TimelineItem[]): Map<number, { beamType: 'begin' | 'continue' | 'end' }> {
  const beamInfo = new Map<number, { beamType: 'begin' | 'continue' | 'end' }>();
  const beamableDurations = [
    'eighth', 'dotted-eighth', 'eighth-dotted',
    'sixteenth', 'dotted-sixteenth', 'sixteenth-dotted',
    'thirty-second', 'sixty-fourth',
    'eighth.', '16th', '16th.', '32nd', '32nd.'
  ];

  // Group items by beat
  const beatGroups = new Map<number, number[]>();

  timeline.forEach((item, index) => {
    const beatNumber = Math.floor(item.startBeat);
    if (!beatGroups.has(beatNumber)) {
      beatGroups.set(beatNumber, []);
    }
    beatGroups.get(beatNumber)!.push(index);
  });

  // For each beat, find notes to beam
  beatGroups.forEach((indices, beatNumber) => {
    // Find all note indices in this beat
    const noteIndices = indices.filter(i => {
      const item = timeline[i];
      return item.type === 'note' && beamableDurations.includes(item.duration);
    });

    // Only beam if we have 2 or more notes
    if (noteIndices.length >= 2) {
      noteIndices.forEach((noteIndex, pos) => {
        const beamType = pos === 0 ? 'begin' : pos === noteIndices.length - 1 ? 'end' : 'continue';
        beamInfo.set(noteIndex, { beamType });
      });
    }
  });

  return beamInfo;
}

/**
 * Generates XML for a measure with manual beam tags
 */
function generateMeasureXML(
  measureNotes: ExerciseNote[],
  measureNumber: number,
  timeSignature: TimeSignature,
  _bpm: number,
  isFirstMeasure: boolean,
  isLastMeasure: boolean,
  maxMeasuresPerSystem: number = 2
): string {
  const timeline = fillMeasureWithRests(measureNotes, timeSignature.numerator);

  let measureXML = `  <measure number="${measureNumber}">`;

  // Add attributes to first measure
  if (isFirstMeasure) {
    measureXML += `
    <attributes>
      <divisions>480</divisions>
      <key>
        <fifths>0</fifths>
        <mode>major</mode>
      </key>
      <time>
        <beats>${timeSignature.numerator}</beats>
        <beat-type>${timeSignature.denominator}</beat-type>
      </time>
      <clef>
        <sign>F</sign>
        <line>4</line>
      </clef>
    </attributes>`;
  }

  // Calculate beam groups manually since OSMD autobeaming doesn't seem to work
  const beamGroups = calculateBeamGroups(timeline);

  // Add notes and rests with beam information
  timeline.forEach((item, index) => {
    const beam = beamGroups.get(index);
    measureXML += generateNoteXML(item, beam);
  });

  // Add final barline (double bar) to last measure
  if (isLastMeasure) {
    measureXML += `
    <barline location="right">
      <bar-style>light-heavy</bar-style>
    </barline>`;
  }

  // No system breaks - all measures stay on one horizontal line for infinite scrolling

  measureXML += `
  </measure>`;

  return measureXML;
}

/**
 * Main conversion function: Exercise data → MusicXML string
 */
export function exerciseToMusicXML(options: ExerciseToMusicXMLOptions): string {
  const { notes, bpm, timeSignature, title = 'Bass Exercise', maxMeasuresPerSystem = 2 } = options;

  // Organize notes into measures
  const measures = organizeNotesIntoMeasures(notes, timeSignature);

  // Generate measures XML
  const measuresXML = measures
    .map((measureNotes, index) =>
      generateMeasureXML(
        measureNotes,
        index + 1,
        timeSignature,
        bpm,
        index === 0, // isFirstMeasure
        index === measures.length - 1, // isLastMeasure
        maxMeasuresPerSystem
      )
    )
    .join('\n');

  // Build complete MusicXML document
  const musicXML = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="3.1">
  <work>
    <work-title>${title}</work-title>
  </work>
  <part-list>
    <score-part id="P1">
      <part-name>Bass</part-name>
      <score-instrument id="P1-I1">
        <instrument-name>Electric Bass</instrument-name>
      </score-instrument>
    </score-part>
  </part-list>
  <part id="P1">
${measuresXML}
  </part>
</score-partwise>`;

  return musicXML;
}
