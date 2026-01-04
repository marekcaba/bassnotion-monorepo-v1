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
  totalBars?: number; // Total number of measures to render (if not provided, inferred from notes)
}

/**
 * A single item in the quantized timeline (note or rest)
 * Used internally for MusicXML generation and exported for fretboard sync
 */
export interface TimelineItem {
  type: 'note' | 'rest';
  note?: ExerciseNote;
  duration: string;
  startBeat: number;
  /** Quantized duration in quarter notes (for sheet music rendering) */
  quantizedDuration?: number;
}

/**
 * A timeline entry with absolute time in seconds
 * Used by useFretboardNoteSync for precise visual synchronization
 */
export interface QuantizedTimelineEntry {
  /** Type of entry - 'note' shows highlight, 'rest' clears highlight */
  type: 'note' | 'rest';
  /** Start time in seconds (includes countdown offset) */
  startTime: number;
  /** End time in seconds (when this entry ends, not when next starts) */
  endTime: number;
  /** Original note data (undefined for rests) */
  note?: ExerciseNote;
  /** Index of the note in the original exercise notes array (-1 for rests) */
  noteIndex: number;
  /** 0-based measure this entry belongs to */
  measure: number;
  /** Duration in quarter notes (quantized to 16th notes) */
  durationBeats: number;
}

/**
 * Maps our note duration format to MusicXML note types and divisions
 */
function getDurationData(duration: string): {
  type: string;
  dots: number;
  divisions: number;
} {
  const map: Record<string, { type: string; dots: number; divisions: number }> =
    {
      // Standard naming (used in contracts)
      whole: { type: 'whole', dots: 0, divisions: 3840 },
      'whole-dotted': { type: 'whole', dots: 1, divisions: 5760 },
      'dotted-half': { type: 'half', dots: 1, divisions: 2880 },
      'half-dotted': { type: 'half', dots: 1, divisions: 2880 },
      half: { type: 'half', dots: 0, divisions: 1920 },
      'dotted-quarter': { type: 'quarter', dots: 1, divisions: 1440 },
      'quarter-dotted': { type: 'quarter', dots: 1, divisions: 1440 },
      quarter: { type: 'quarter', dots: 0, divisions: 480 },
      'dotted-eighth': { type: 'eighth', dots: 1, divisions: 360 },
      'eighth-dotted': { type: 'eighth', dots: 1, divisions: 360 },
      eighth: { type: 'eighth', dots: 0, divisions: 240 },
      'dotted-sixteenth': { type: '16th', dots: 1, divisions: 180 },
      'sixteenth-dotted': { type: '16th', dots: 1, divisions: 180 },
      sixteenth: { type: '16th', dots: 0, divisions: 120 },
      'dotted-thirty-second': { type: '32nd', dots: 1, divisions: 180 },
      'thirty-second': { type: '32nd', dots: 0, divisions: 120 },
      'sixty-fourth': { type: '64th', dots: 0, divisions: 60 },

      // Alternative naming (for backwards compatibility)
      'half.': { type: 'half', dots: 1, divisions: 2880 },
      'quarter.': { type: 'quarter', dots: 1, divisions: 1440 },
      'eighth.': { type: 'eighth', dots: 1, divisions: 360 },
      '16th.': { type: '16th', dots: 1, divisions: 180 },
      '16th': { type: '16th', dots: 0, divisions: 120 },
      '32nd.': { type: '32nd', dots: 1, divisions: 90 },
      '32nd': { type: '32nd', dots: 0, divisions: 60 },
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
  const step = (note[0] ?? 'C').toUpperCase();
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
 * Gets duration in quarter notes for timeline calculation.
 *
 * IMPORTANT: When durationTicks is provided, it takes precedence over the string duration
 * because durationTicks contains the actual MIDI timing (480 PPQ), while the string
 * duration is often quantized/approximate.
 *
 * Example: A note with durationTicks=1200 equals 2.5 quarter notes, but might have
 * duration="half" (2 quarter notes) - a 0.5 beat discrepancy that causes incorrect rests.
 *
 * @param duration - String duration like "quarter", "half", etc. (fallback)
 * @param durationTicks - Actual duration in MIDI ticks (480 ticks = 1 quarter note)
 */
function getDurationInQuarters(
  duration: string,
  durationTicks?: number,
): number {
  // If actual duration in ticks is provided, use it for accuracy
  // 480 PPQ (Pulses Per Quarter note) is the standard MIDI resolution
  if (durationTicks !== undefined && durationTicks > 0) {
    const TICKS_PER_QUARTER = 480;
    return durationTicks / TICKS_PER_QUARTER;
  }

  // Fallback to string duration mapping
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
 * @param notes - Array of exercise notes
 * @param _timeSignature - Time signature (unused but kept for API consistency)
 * @param totalBars - Optional total number of measures to create
 */
function organizeNotesIntoMeasures(
  notes: ExerciseNote[],
  _timeSignature: TimeSignature,
  totalBars?: number,
): ExerciseNote[][] {
  // Detect if notes use 0-indexed or 1-indexed measures
  // If any note has measure: 0, they're 0-indexed
  const isZeroIndexed = notes.some((note) => note.position?.measure === 0);

  // Find the highest measure number from notes
  let maxMeasure = 0;
  notes.forEach((note) => {
    const measureNum = note.position?.measure ?? 0;
    if (measureNum > maxMeasure) {
      maxMeasure = measureNum;
    }
  });

  // Convert to 1-indexed count: 0-indexed max of 7 means 8 measures, 1-indexed max of 8 means 8 measures
  const measuresFromNotes = isZeroIndexed ? maxMeasure + 1 : maxMeasure;

  // Use totalBars if provided and it's greater than what notes require
  const numMeasures =
    totalBars && totalBars > measuresFromNotes ? totalBars : measuresFromNotes;

  // Initialize all measures as empty arrays
  const measures: ExerciseNote[][] = [];
  for (let i = 0; i < numMeasures; i++) {
    measures[i] = [];
  }

  // Group notes by measure
  // For 0-indexed: measure 0 -> index 0, measure 7 -> index 7
  // For 1-indexed: measure 1 -> index 0, measure 8 -> index 7
  notes.forEach((note) => {
    const rawMeasure = note.position?.measure ?? 0;
    const measureIndex = isZeroIndexed ? rawMeasure : rawMeasure - 1;

    if (measureIndex >= 0 && measureIndex < measures.length) {
      measures[measureIndex]!.push(note);
    }
  });

  // Sort notes within each measure by beat position
  // Use tick (not subdivision) for sub-beat positioning - tick is in PPQ (480 ticks per quarter)
  const ticksPerQuarter = 480;
  measures.forEach((measure) => {
    measure.sort((a, b) => {
      // Use tick for sub-beat position (tick is the correct field with actual timing)
      const aTick = a.position?.tick ?? 0;
      const bTick = b.position?.tick ?? 0;
      // Use ?? 0 (not || 1) because beat: 0 is valid
      const aPos = (a.position?.beat ?? 0) + aTick / ticksPerQuarter;
      const bPos = (b.position?.beat ?? 0) + bTick / ticksPerQuarter;
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
  beatsPerMeasure: number,
): TimelineItem[] {
  const timeline: TimelineItem[] = [];
  let currentBeat = 0;

  // Use a tolerance of 0.05 beats (5% of a quarter note) for floating-point comparisons
  const BEAT_TOLERANCE = 0.05;

  // First pass: calculate start positions for all notes
  const notePositions: Array<{ note: ExerciseNote; startBeat: number }> = [];

  measureNotes.forEach((note) => {
    const ticksPerQuarterNote = 480;
    const tickValue = note.position?.tick ?? 0;
    const subdivisionBeats = tickValue / ticksPerQuarterNote;
    const rawBeat = note.position?.beat ?? 0;
    const noteBeat = rawBeat + subdivisionBeats;
    // Quantize start position to 16th notes
    const quantizedStart = Math.round(noteBeat * 4) / 4;
    notePositions.push({ note, startBeat: quantizedStart });
  });

  // Second pass: calculate display duration based on NEXT note's start position
  notePositions.forEach((item, index) => {
    const noteBeat = item.startBeat;

    // Calculate display duration: time until next note OR end of measure
    let displayDuration: number;

    if (index < notePositions.length - 1) {
      // There's a next note - duration is until that note starts
      const nextNoteStart = notePositions[index + 1]?.startBeat ?? beatsPerMeasure;
      displayDuration = nextNoteStart - noteBeat;
    } else {
      // Last note in measure - duration extends to end of measure
      displayDuration = beatsPerMeasure - noteBeat;
    }

    // Quantize to 16th notes and ensure minimum duration
    displayDuration = Math.round(displayDuration * 4) / 4;
    displayDuration = Math.max(displayDuration, 0.25); // Minimum 16th note

    // Cap at measure boundary (just in case)
    const maxDuration = beatsPerMeasure - noteBeat;
    if (displayDuration > maxDuration) {
      displayDuration = Math.round(maxDuration * 4) / 4;
      displayDuration = Math.max(displayDuration, 0.25);
    }

    // Fill gap with rest if needed (only if gap is significant)
    if (noteBeat > currentBeat + BEAT_TOLERANCE) {
      const restDuration = noteBeat - currentBeat;
      const restType = getRestDurationType(restDuration);
      timeline.push({
        type: 'rest',
        duration: restType,
        startBeat: currentBeat,
      });
    }

    // Add note with calculated display duration
    timeline.push({
      type: 'note',
      note: item.note,
      duration: item.note.duration,
      startBeat: noteBeat,
      quantizedDuration: displayDuration,
    });

    // Update currentBeat
    currentBeat = Math.round((noteBeat + displayDuration) * 1000) / 1000;
  });

  // Fill end of measure if needed (only if there's a significant gap)
  // Use larger tolerance here to prevent whole-note rests from appearing
  // when the measure is essentially full
  if (currentBeat < beatsPerMeasure - BEAT_TOLERANCE) {
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
 * Standard note durations in music notation.
 * Each entry represents a valid, single-note duration.
 * Durations not in this list (like 2.5 beats) must be split into tied notes.
 */
const STANDARD_NOTE_DURATIONS = [
  { quarters: 6, type: 'whole', dots: 1 }, // dotted whole
  { quarters: 4, type: 'whole', dots: 0 }, // whole
  { quarters: 3, type: 'half', dots: 1 }, // dotted half
  { quarters: 2, type: 'half', dots: 0 }, // half
  { quarters: 1.5, type: 'quarter', dots: 1 }, // dotted quarter
  { quarters: 1, type: 'quarter', dots: 0 }, // quarter
  { quarters: 0.75, type: 'eighth', dots: 1 }, // dotted eighth
  { quarters: 0.5, type: 'eighth', dots: 0 }, // eighth
  { quarters: 0.375, type: '16th', dots: 1 }, // dotted 16th
  { quarters: 0.25, type: '16th', dots: 0 }, // 16th
  { quarters: 0.1875, type: '32nd', dots: 1 }, // dotted 32nd
  { quarters: 0.125, type: '32nd', dots: 0 }, // 32nd
  { quarters: 0.0625, type: '64th', dots: 0 }, // 64th
];

/**
 * Splits a duration into standard note values that can be tied together.
 * Uses a greedy algorithm: pick the largest fitting note, subtract, repeat.
 * Quantizes to 16th notes to avoid excessive precision (no 32nd/64th notes).
 *
 * @param durationInQuarters - Total duration to split
 * @returns Array of note components to be tied together
 */
function splitDurationIntoTiedNotes(
  durationInQuarters: number,
): Array<{ type: string; dots: number; quarters: number }> {
  const result: Array<{ type: string; dots: number; quarters: number }> = [];

  // Quantize to nearest 16th note (0.25 beats) - we don't need 32nd/64th precision
  let remaining = Math.round(durationInQuarters * 4) / 4;
  const TOLERANCE = 0.01; // Small tolerance for floating point

  // Only use durations down to 16th notes (exclude 32nd and 64th)
  const PRACTICAL_DURATIONS = STANDARD_NOTE_DURATIONS.filter(
    (d) => d.quarters >= 0.25,
  );

  while (remaining > TOLERANCE) {
    // Find the largest standard duration that fits
    let found = false;
    for (const std of PRACTICAL_DURATIONS) {
      if (std.quarters <= remaining + TOLERANCE) {
        result.push({ type: std.type, dots: std.dots, quarters: std.quarters });
        remaining -= std.quarters;
        remaining = Math.round(remaining * 100) / 100; // Fix floating point
        found = true;
        break;
      }
    }
    if (!found) {
      // If remaining is very small, just ignore it (quantization artifact)
      if (remaining < 0.25) {
        break;
      }
      // Otherwise use 16th note
      result.push({ type: '16th', dots: 0, quarters: 0.25 });
      remaining -= 0.25;
    }
  }

  return result;
}

/**
 * Splits a note duration considering the measure boundary (beat 3 in 4/4).
 * Notes should not cross the middle of the measure without being tied.
 *
 * @param startBeat - Starting beat position (0-indexed, so beat 1 = 0)
 * @param durationInQuarters - Total duration in quarter notes
 * @param beatsPerMeasure - Time signature numerator (e.g., 4 for 4/4)
 * @returns Array of note components with their durations, considering boundary splits
 */
function splitNoteAtBoundary(
  startBeat: number,
  durationInQuarters: number,
  beatsPerMeasure: number,
): Array<{ type: string; dots: number; quarters: number }> {
  const TOLERANCE = 0.01;

  // Quantize to nearest 16th note (0.25 beats) to avoid excessive precision
  const quantizedDuration = Math.round(durationInQuarters * 4) / 4;
  const quantizedStart = Math.round(startBeat * 4) / 4;

  // In 4/4 time, the boundary is at beat 2 (0-indexed), which is beat 3 in 1-indexed terms
  // More generally: boundary is at beatsPerMeasure / 2
  const midPoint = beatsPerMeasure / 2; // For 4/4, this is 2.0

  const endBeat = quantizedStart + quantizedDuration;

  // Check if note crosses the mid-measure boundary
  const crossesBoundary =
    quantizedStart < midPoint && endBeat > midPoint + TOLERANCE;

  if (!crossesBoundary) {
    // Doesn't cross boundary - just split for standard durations
    return splitDurationIntoTiedNotes(quantizedDuration);
  }

  // Note crosses boundary - split at the midpoint
  const durationBeforeBoundary = midPoint - quantizedStart;
  const durationAfterBoundary = quantizedDuration - durationBeforeBoundary;

  // Split each part into standard note values
  const beforeParts = splitDurationIntoTiedNotes(durationBeforeBoundary);
  const afterParts = splitDurationIntoTiedNotes(durationAfterBoundary);

  return [...beforeParts, ...afterParts];
}

/**
 * Maps duration in quarter notes to MusicXML note type with dots.
 * For exact matches to standard durations, returns single note.
 * For non-standard durations (like 2.5 beats), returns the FIRST component
 * of what would be a tied note sequence. Use splitDurationIntoTiedNotes
 * for the full breakdown.
 */
function durationToNoteTypeAndDots(durationInQuarters: number): {
  type: string;
  dots: number;
  divisions: number;
} {
  const TICKS_PER_QUARTER = 480;
  const TOLERANCE = 0.01;

  // Check for exact match to standard duration first
  for (const std of STANDARD_NOTE_DURATIONS) {
    if (Math.abs(durationInQuarters - std.quarters) < TOLERANCE) {
      return {
        type: std.type,
        dots: std.dots,
        divisions: Math.round(std.quarters * TICKS_PER_QUARTER),
      };
    }
  }

  // Non-standard duration: split and return first component
  // The caller should use splitDurationIntoTiedNotes for full tied note generation
  const components = splitDurationIntoTiedNotes(durationInQuarters);
  const first = components[0];
  if (first) {
    return {
      type: first.type,
      dots: first.dots,
      divisions: Math.round(first.quarters * TICKS_PER_QUARTER),
    };
  }

  // Fallback
  return { type: '64th', dots: 0, divisions: 30 };
}

/**
 * Generates XML for a single note or rest with optional beam information.
 * For notes with non-standard durations (like 2.5 beats), generates multiple
 * tied notes to accurately represent the duration.
 * Also splits notes that cross the mid-measure boundary (beat 3 in 4/4).
 *
 * @param item - The timeline item (note or rest)
 * @param beatsPerMeasure - Time signature numerator (e.g., 4 for 4/4)
 * @param beamInfo - Optional beam information for eighth notes and shorter
 */
function generateNoteXML(
  item: TimelineItem,
  beatsPerMeasure: number,
  beamInfo?: { beamType: 'begin' | 'continue' | 'end' },
): string {
  const TICKS_PER_QUARTER = 480;

  // Handle rests - always use string duration for rests
  if (item.type === 'rest') {
    const data = getDurationData(item.duration);
    const dotXML = data.dots > 0 ? '<dot/>' : '';
    return `
    <note>
      <rest/>
      <duration>${data.divisions}</duration>
      <type>${data.type}</type>${dotXML}
    </note>`;
  }

  // Handle notes
  if (!item.note) return '';

  const pitchXML = getPitchXML(item.note.note);

  // Use quantized duration if available (already processed in fillMeasureWithRests)
  // Otherwise fall back to calculating from durationTicks or string duration
  let durationInQuarters: number;

  if (item.quantizedDuration !== undefined && item.quantizedDuration > 0) {
    // Prefer pre-computed quantized duration (handles capping at measure boundary)
    durationInQuarters = item.quantizedDuration;
  } else {
    // Fallback: calculate from raw durationTicks or string duration
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const durationTicks = (item.note as any).durationTicks as
      | number
      | undefined;
    if (durationTicks !== undefined && durationTicks > 0) {
      durationInQuarters = durationTicks / TICKS_PER_QUARTER;
    } else {
      durationInQuarters = getDurationInQuarters(item.duration);
    }
    // Apply quantization for fallback case too
    durationInQuarters = Math.round(durationInQuarters * 4) / 4;
  }

  // Split into tied notes considering:
  // 1. Mid-measure boundary (beat 3 in 4/4)
  // 2. Non-standard durations (like 2.5 beats)
  const tiedComponents = splitNoteAtBoundary(
    item.startBeat,
    durationInQuarters,
    beatsPerMeasure,
  );

  // If only one component, it's a standard duration - no ties needed
  if (tiedComponents.length === 1) {
    const comp = tiedComponents[0]!;
    const dotXML = comp.dots > 0 ? '<dot/>' : '';
    const divisions = Math.round(comp.quarters * TICKS_PER_QUARTER);

    // Beaming logic
    const beamableTypes = ['eighth', '16th', '32nd', '64th'];
    let beamXML = '';
    if (beamInfo && beamableTypes.includes(comp.type)) {
      beamXML = `
      <beam number="1">${beamInfo.beamType}</beam>`;
    }

    return `
    <note>${pitchXML}
      <duration>${divisions}</duration>
      <type>${comp.type}</type>${dotXML}${beamXML}
    </note>`;
  }

  // Multiple components - generate tied notes
  // MusicXML ties: first note has <tie type="start"/>, middle notes have both, last has <tie type="stop"/>
  let xml = '';

  tiedComponents.forEach((comp, index) => {
    const dotXML = comp.dots > 0 ? '<dot/>' : '';
    const divisions = Math.round(comp.quarters * TICKS_PER_QUARTER);
    const isFirst = index === 0;
    const isLast = index === tiedComponents.length - 1;

    // Tie notation
    let tieXML = '';
    let notationsXML = '';

    if (isFirst) {
      tieXML = `
      <tie type="start"/>`;
      notationsXML = `
      <notations>
        <tied type="start"/>
      </notations>`;
    } else if (isLast) {
      tieXML = `
      <tie type="stop"/>`;
      notationsXML = `
      <notations>
        <tied type="stop"/>
      </notations>`;
    } else {
      // Middle note - both start and stop
      tieXML = `
      <tie type="stop"/>
      <tie type="start"/>`;
      notationsXML = `
      <notations>
        <tied type="stop"/>
        <tied type="start"/>
      </notations>`;
    }

    // Only apply beaming to first note if applicable
    const beamableTypes = ['eighth', '16th', '32nd', '64th'];
    let beamXML = '';
    if (isFirst && beamInfo && beamableTypes.includes(comp.type)) {
      beamXML = `
      <beam number="1">${beamInfo.beamType}</beam>`;
    }

    xml += `
    <note>${pitchXML}
      <duration>${divisions}</duration>${tieXML}
      <type>${comp.type}</type>${dotXML}${beamXML}${notationsXML}
    </note>`;
  });

  return xml;
}

/**
 * Helper to check if a note is beamable based on its DISPLAY duration
 * (using quantizedDuration which represents what's actually shown on sheet music)
 */
function isNoteBeamable(item: TimelineItem): boolean {
  // Beamable note types (eighth and shorter)
  const beamableTypes = ['eighth', '16th', '32nd', '64th'];

  if (item.type !== 'note' || !item.note) return false;

  // Use quantizedDuration (display duration) - this is what's shown on sheet music
  // A note is beamable if its display duration is eighth or shorter (≤ 0.5 beats)
  if (item.quantizedDuration !== undefined && item.quantizedDuration > 0) {
    const derived = durationToNoteTypeAndDots(item.quantizedDuration);
    return beamableTypes.includes(derived.type);
  }

  // Fallback: check raw durationTicks
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const durationTicks = (item.note as any).durationTicks as number | undefined;

  if (durationTicks !== undefined && durationTicks > 0) {
    const durationInQuarters = durationTicks / 480;
    const derived = durationToNoteTypeAndDots(durationInQuarters);
    return beamableTypes.includes(derived.type);
  }

  // Final fallback to string duration
  const beamableDurations = [
    'eighth',
    'dotted-eighth',
    'eighth-dotted',
    'sixteenth',
    'dotted-sixteenth',
    'sixteenth-dotted',
    'thirty-second',
    'sixty-fourth',
    'eighth.',
    '16th',
    '16th.',
    '32nd',
    '32nd.',
  ];
  return beamableDurations.includes(item.duration);
}

/**
 * Calculate beam groups for a measure following professional notation rules:
 * 1. Beams only connect NOTES (not rests)
 * 2. Notes must be within the same beat
 * 3. Minimum 2 notes required to form a beam
 * 4. Rests at the beginning or end of a beat don't participate in beams
 * 5. Only notes shorter than a quarter note can be beamed
 */
function calculateBeamGroups(
  timeline: TimelineItem[],
): Map<number, { beamType: 'begin' | 'continue' | 'end' }> {
  const beamInfo = new Map<
    number,
    { beamType: 'begin' | 'continue' | 'end' }
  >();

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
  beatGroups.forEach((indices, _beatNumber) => {
    // Find all beamable note indices in this beat
    // Uses isNoteBeamable which considers quantizedDuration for accurate beaming
    const noteIndices = indices.filter((i) => {
      const item = timeline[i];
      return item && isNoteBeamable(item);
    });

    // Only beam if we have 2 or more notes
    if (noteIndices.length >= 2) {
      noteIndices.forEach((noteIndex, pos) => {
        const beamType =
          pos === 0
            ? 'begin'
            : pos === noteIndices.length - 1
              ? 'end'
              : 'continue';
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
  _maxMeasuresPerSystem: number = 2,
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
  // Pass beatsPerMeasure so notes can be split at mid-measure boundary
  timeline.forEach((item, index) => {
    const beam = beamGroups.get(index);
    measureXML += generateNoteXML(item, timeSignature.numerator, beam);
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
  const {
    notes,
    bpm,
    timeSignature,
    title = 'Bass Exercise',
    maxMeasuresPerSystem = 2,
    totalBars,
  } = options;

  // Organize notes into measures (with totalBars to ensure correct number of measures)
  const measures = organizeNotesIntoMeasures(notes, timeSignature, totalBars);

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
        maxMeasuresPerSystem,
      ),
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

// ============================================================================
// QUANTIZED TIMELINE FOR FRETBOARD NOTE SYNC
// ============================================================================

/**
 * Options for building a quantized timeline
 */
export interface BuildQuantizedTimelineOptions {
  /** Exercise notes array */
  notes: ExerciseNote[];
  /** Tempo in BPM */
  bpm: number;
  /** Time signature (defaults to 4/4) */
  timeSignature?: TimeSignature;
  /** Number of countdown beats before exercise starts (defaults to 4) */
  countdownBeats?: number;
  /** Total number of measures (optional, inferred from notes if not provided) */
  totalBars?: number;
}

/**
 * Builds a flat quantized timeline with absolute times in seconds.
 *
 * This function creates a timeline where:
 * 1. All notes are quantized to 16th note grid (0.25 beats)
 * 2. Gaps between notes become explicit rest entries
 * 3. Each entry has absolute start/end times in seconds
 * 4. No entries overlap - they form a continuous sequence
 *
 * The timeline is used by useFretboardNoteSync for jitter-free visual sync:
 * - During 'note' entries: the corresponding note is highlighted
 * - During 'rest' entries: no note is highlighted
 *
 * @param options - Configuration including notes, tempo, time signature
 * @returns Array of QuantizedTimelineEntry sorted by startTime
 *
 * @example
 * ```ts
 * const timeline = buildQuantizedTimeline({
 *   notes: exercise.notes,
 *   bpm: 120,
 *   timeSignature: { numerator: 4, denominator: 4 },
 *   countdownBeats: 4,
 * });
 *
 * // Result: [
 * //   { type: 'note', startTime: 2.0, endTime: 2.5, noteIndex: 0, ... },
 * //   { type: 'rest', startTime: 2.5, endTime: 3.0, noteIndex: -1, ... },
 * //   { type: 'note', startTime: 3.0, endTime: 3.5, noteIndex: 1, ... },
 * //   ...
 * // ]
 * ```
 */
export function buildQuantizedTimeline(
  options: BuildQuantizedTimelineOptions,
): QuantizedTimelineEntry[] {
  const {
    notes,
    bpm,
    timeSignature = { numerator: 4, denominator: 4 },
    countdownBeats = 4,
    totalBars,
  } = options;

  if (notes.length === 0) return [];

  // Calculate timing constants
  const secondsPerBeat = 60 / bpm;
  const beatsPerMeasure = timeSignature.numerator;
  const secondsPerMeasure = secondsPerBeat * beatsPerMeasure;

  // Countdown offset (notes are scheduled AFTER countdown)
  const countdownOffsetSeconds = countdownBeats * secondsPerBeat;

  // Step 1: Organize notes into measures using existing function
  const measures = organizeNotesIntoMeasures(notes, timeSignature, totalBars);

  // Step 2: Process each measure to create timeline with rests
  const timeline: QuantizedTimelineEntry[] = [];

  // Build a map from note object to original index for lookup
  const noteToIndexMap = new Map<ExerciseNote, number>();
  notes.forEach((note, index) => {
    noteToIndexMap.set(note, index);
  });

  measures.forEach((measureNotes, measureIndex) => {
    // Use fillMeasureWithRests to get quantized timeline items
    const measureTimeline = fillMeasureWithRests(measureNotes, beatsPerMeasure);

    // Convert measure-relative items to absolute time entries
    measureTimeline.forEach((item) => {
      // Calculate absolute time
      const measureStartTime =
        countdownOffsetSeconds + measureIndex * secondsPerMeasure;
      const startTime = measureStartTime + item.startBeat * secondsPerBeat;

      // Use quantizedDuration for accurate duration (already in quarter notes)
      const durationBeats = item.quantizedDuration ?? 1;
      const endTime = startTime + durationBeats * secondsPerBeat;

      // Find original note index (-1 for rests)
      let noteIndex = -1;
      if (item.type === 'note' && item.note) {
        noteIndex = noteToIndexMap.get(item.note) ?? -1;
      }

      timeline.push({
        type: item.type,
        startTime,
        endTime,
        note: item.note,
        noteIndex,
        measure: measureIndex,
        durationBeats,
      });
    });
  });

  // Sort by start time (should already be sorted, but ensure it)
  timeline.sort((a, b) => a.startTime - b.startTime);

  return timeline;
}

// Export helper functions for external use
export { organizeNotesIntoMeasures, fillMeasureWithRests };
