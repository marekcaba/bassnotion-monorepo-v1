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
  totalBars?: number; // Total number of bars from exercise metadata
}

interface TimelineItem {
  type: 'note' | 'rest';
  note?: ExerciseNote;
  duration: string;
  startBeat: number;
  tieStart?: boolean; // This note starts a tie
  tieEnd?: boolean;   // This note ends a tie (continuation of previous)
}

/**
 * Maps our note duration format to MusicXML note types and divisions
 */
function getDurationData(duration: string): {
  type: string;
  dots: number;
  divisions: number;
} {
  // MusicXML divisions: with <divisions>480</divisions>, each quarter note = 480 divisions
  // So: whole = 4*480=1920, half = 2*480=960, quarter = 480, eighth = 240, etc.
  const map: Record<string, { type: string; dots: number; divisions: number }> = {
    // Standard naming (used in contracts)
    whole: { type: 'whole', dots: 0, divisions: 1920 },           // 4 beats = 4*480
    'whole-dotted': { type: 'whole', dots: 1, divisions: 2880 },  // 6 beats = 6*480
    'dotted-half': { type: 'half', dots: 1, divisions: 1440 },    // 3 beats = 3*480
    'half-dotted': { type: 'half', dots: 1, divisions: 1440 },    // 3 beats = 3*480
    half: { type: 'half', dots: 0, divisions: 960 },              // 2 beats = 2*480
    'dotted-quarter': { type: 'quarter', dots: 1, divisions: 720 }, // 1.5 beats = 1.5*480
    'quarter-dotted': { type: 'quarter', dots: 1, divisions: 720 }, // 1.5 beats = 1.5*480
    quarter: { type: 'quarter', dots: 0, divisions: 480 },        // 1 beat = 480
    'dotted-eighth': { type: 'eighth', dots: 1, divisions: 360 }, // 0.75 beats = 0.75*480
    'eighth-dotted': { type: 'eighth', dots: 1, divisions: 360 }, // 0.75 beats = 0.75*480
    eighth: { type: 'eighth', dots: 0, divisions: 240 },          // 0.5 beats = 0.5*480
    'dotted-sixteenth': { type: '16th', dots: 1, divisions: 180 }, // 0.375 beats
    'sixteenth-dotted': { type: '16th', dots: 1, divisions: 180 }, // 0.375 beats
    sixteenth: { type: '16th', dots: 0, divisions: 120 },         // 0.25 beats = 0.25*480
    'dotted-thirty-second': { type: '32nd', dots: 1, divisions: 90 }, // 0.1875 beats
    'thirty-second': { type: '32nd', dots: 0, divisions: 60 },    // 0.125 beats
    'sixty-fourth': { type: '64th', dots: 0, divisions: 30 },     // 0.0625 beats

    // Alternative naming (for backwards compatibility)
    'half.': { type: 'half', dots: 1, divisions: 1440 },          // 3 beats
    'quarter.': { type: 'quarter', dots: 1, divisions: 720 },     // 1.5 beats
    'eighth.': { type: 'eighth', dots: 1, divisions: 360 },       // 0.75 beats
    '16th.': { type: '16th', dots: 1, divisions: 180 },           // 0.375 beats
    '16th': { type: '16th', dots: 0, divisions: 120 },            // 0.25 beats
    '32nd.': { type: '32nd', dots: 1, divisions: 90 },            // 0.1875 beats
    '32nd': { type: '32nd', dots: 0, divisions: 60 },             // 0.125 beats
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

  const result = map[duration];
  if (result === undefined) {
    console.warn('[getDurationInQuarters] Unknown duration:', duration, '- defaulting to quarter note (1)');
    return 1;
  }
  return result;
}

/**
 * Merges consecutive notes at the same pitch that should be tied together.
 * This handles MIDI files where tied notes are represented as separate note events.
 *
 * Two notes are merged if:
 * 1. They have the same pitch (note name)
 * 2. The second note starts exactly where the first note ends
 *
 * Returns merged notes with duration_ms updated to reflect combined duration.
 */
function mergeConsecutiveSamePitchNotes(measureNotes: ExerciseNote[], beatsPerMeasure: number): ExerciseNote[] {
  if (measureNotes.length <= 1) return measureNotes;

  const merged: ExerciseNote[] = [];
  let i = 0;

  const ticksPerQuarterNote = 480;

  while (i < measureNotes.length) {
    const current = measureNotes[i];

    // Get duration in quarters - use durationTicks if available
    let combinedDurationQuarters: number;
    if (current.durationTicks && current.durationTicks > 0) {
      combinedDurationQuarters = current.durationTicks / ticksPerQuarterNote;
    } else {
      combinedDurationQuarters = getDurationInQuarters(current.duration);
    }

    // Calculate start beat of current note
    // NOTE: position.beat is stored as 0-based by absoluteTickToPosition() despite type definition saying 1-based
    //
    // SUBDIVISION HANDLING:
    // - New format (after fix): subdivision is 16th note index (0-3), divide by 4 to get beat fraction
    // - Old format (before fix): subdivision was in ticks (0-479), divide by 480 to get beat fraction
    // - Detect: if subdivision >= 4, it's old format (ticks); values 0-3 are new format (16th index)
    const currentRawSub = current.position?.subdivision || 0;
    const subdivisionBeats = currentRawSub >= 4
      ? currentRawSub / 480  // Old format: convert ticks to beat fraction (values 4-479)
      : currentRawSub / 4;   // New format: convert 16th note index to beat fraction (values 0-3)
    const currentStartBeat = (current.position?.beat ?? 0) + subdivisionBeats;
    let currentEndBeat = quantizeBeatPosition(currentStartBeat + combinedDurationQuarters);

    // Look ahead for notes to merge
    let j = i + 1;
    while (j < measureNotes.length) {
      const next = measureNotes[j];

      // Check if same pitch (normalize note names for comparison)
      const currentPitch = current.note.replace(/\d+$/, '').toLowerCase();
      const nextPitch = next.note.replace(/\d+$/, '').toLowerCase();

      if (currentPitch !== nextPitch) break;

      // Calculate start beat of next note (beat is 0-based in stored data)
      // Use same subdivision format detection as above (>= 4 means old format)
      const nextRawSub = next.position?.subdivision || 0;
      const nextSubdivisionBeats = nextRawSub >= 4
        ? nextRawSub / 480  // Old format: convert ticks to beat fraction (values 4-479)
        : nextRawSub / 4;   // New format: convert 16th note index to beat fraction (values 0-3)
      const nextStartBeat = (next.position?.beat ?? 0) + nextSubdivisionBeats;
      const quantizedNextStart = quantizeBeatPosition(nextStartBeat);

      // Check if notes are adjacent (next starts where current ends)
      // Use small tolerance for floating point comparison
      if (Math.abs(quantizedNextStart - currentEndBeat) > 0.001) break;

      // Get next note's duration - use durationTicks if available
      let nextDuration: number;
      if (next.durationTicks && next.durationTicks > 0) {
        nextDuration = next.durationTicks / ticksPerQuarterNote;
      } else {
        nextDuration = getDurationInQuarters(next.duration);
      }

      // Merge the notes
      combinedDurationQuarters += nextDuration;
      currentEndBeat = quantizeBeatPosition(currentStartBeat + combinedDurationQuarters);

      console.log(`[mergeConsecutiveSamePitchNotes] Merging notes at pitch ${current.note}: ${current.duration} + ${next.duration} = ${combinedDurationQuarters.toFixed(3)} quarters`);

      j++;
    }

    // Create merged note with combined durationTicks for precise duration
    const combinedDurationTicks = Math.round(combinedDurationQuarters * ticksPerQuarterNote);

    const mergedNote: ExerciseNote = {
      ...current,
      durationTicks: combinedDurationTicks,
    };

    merged.push(mergedNote);
    i = j; // Skip to the next unmerged note
  }

  return merged;
}

/**
 * Standard note duration values in quarter notes for splitting tied notes
 */
const STANDARD_DURATIONS: { duration: string; quarters: number }[] = [
  { duration: 'whole', quarters: 4 },
  { duration: 'dotted-half', quarters: 3 },
  { duration: 'half', quarters: 2 },
  { duration: 'dotted-quarter', quarters: 1.5 },
  { duration: 'quarter', quarters: 1 },
  { duration: 'dotted-eighth', quarters: 0.75 },
  { duration: 'eighth', quarters: 0.5 },
  { duration: 'dotted-sixteenth', quarters: 0.375 },
  { duration: 'sixteenth', quarters: 0.25 },
  { duration: 'thirty-second', quarters: 0.125 },
  { duration: 'sixty-fourth', quarters: 0.0625 },
];

/**
 * Splits a duration in quarter notes into standard note values for tied notes
 * Returns array of durations that add up to the total
 */
function splitIntoStandardDurations(totalQuarters: number): string[] {
  const result: string[] = [];
  let remaining = totalQuarters;
  const tolerance = 0.001;

  while (remaining > tolerance) {
    // Find the largest standard duration that fits
    let found = false;
    for (const { duration, quarters } of STANDARD_DURATIONS) {
      // IMPORTANT: Strict comparison - no tolerance here to prevent selecting oversized durations
      if (quarters <= remaining) {
        result.push(duration);
        remaining -= quarters;
        found = true;
        break;
      }
    }
    if (!found) {
      // Fallback: use smallest duration for any tiny remainder
      result.push('sixty-fourth');
      break;
    }
  }

  return result;
}

/**
 * Quantize a beat position to the nearest 16th note grid
 * This helps clean up MIDI data that has slightly off timing
 */
function quantizeBeatPosition(beat: number): number {
  // 16th note grid = 0.25 quarter notes
  const gridSize = 0.25;
  return Math.round(beat / gridSize) * gridSize;
}

/**
 * Build a strict timeline that never exceeds beatsPerMeasure
 * This is a safety fallback when the normal processing creates overflow
 */
function buildStrictTimeline(timeline: TimelineItem[], beatsPerMeasure: number): TimelineItem[] {
  const result: TimelineItem[] = [];
  let usedBeats = 0;

  for (const item of timeline) {
    const itemDuration = getDurationInQuarters(item.duration);
    const remainingBeats = beatsPerMeasure - usedBeats;

    if (remainingBeats <= 0.001) {
      // No more room in measure, drop remaining items
      console.log(`  [STRICT] Dropping item at beat ${item.startBeat.toFixed(3)} - measure full`);
      break;
    }

    if (itemDuration <= remainingBeats + 0.001) {
      // Item fits, add it
      result.push({
        ...item,
        startBeat: usedBeats, // Use calculated position instead of original
      });
      usedBeats += itemDuration;
    } else {
      // Item too long, find a shorter duration that fits
      const fittingDuration = findFittingDuration(remainingBeats);
      if (fittingDuration) {
        console.log(`  [STRICT] Shortening ${item.duration} (${itemDuration} beats) to ${fittingDuration} to fit remaining ${remainingBeats.toFixed(3)} beats`);
        result.push({
          ...item,
          duration: fittingDuration,
          startBeat: usedBeats,
          tieStart: item.type === 'note', // Mark as tied if it's a note that got cut
        });
        usedBeats += getDurationInQuarters(fittingDuration);
      }
      break; // Stop processing after truncation
    }
  }

  // Fill any remaining space with rests
  if (usedBeats < beatsPerMeasure - 0.001) {
    const restDuration = beatsPerMeasure - usedBeats;
    const restDurations = splitIntoStandardDurations(restDuration);
    let restBeat = usedBeats;
    for (const restType of restDurations) {
      result.push({
        type: 'rest',
        duration: restType,
        startBeat: restBeat,
      });
      restBeat += getDurationInQuarters(restType);
    }
  }

  console.log(`  [STRICT] Final timeline: ${result.length} items, ${result.reduce((sum, item) => sum + getDurationInQuarters(item.duration), 0).toFixed(3)} beats`);
  return result;
}

/**
 * Find the largest standard duration that fits within the given beats
 */
function findFittingDuration(maxBeats: number): string | null {
  for (const { duration, quarters } of STANDARD_DURATIONS) {
    // IMPORTANT: Strict comparison - no tolerance to prevent selecting oversized durations
    if (quarters <= maxBeats) {
      return duration;
    }
  }
  return null;
}

/**
 * Splits a note at the measure boundary (beat 2 in 4/4 time)
 * Notes crossing this boundary must be tied for proper notation.
 *
 * In 4/4 time:
 * - Beats 0-2 = first half of measure
 * - Beats 2-4 = second half of measure
 * - Any note crossing beat 2 must be split and tied
 */
function splitAtMeasureBoundary(
  startBeat: number,
  duration: number,
  beatsPerMeasure: number
): { startBeat: number; duration: number }[] {
  const boundary = beatsPerMeasure / 2; // Beat 2 in 4/4
  const endBeat = startBeat + duration;

  // If note doesn't cross boundary, return as-is
  // Note: startBeat >= boundary means note is entirely in second half (OK)
  // Note: endBeat <= boundary means note is entirely in first half (OK)
  if (startBeat >= boundary || endBeat <= boundary + 0.001) {
    return [{ startBeat, duration }];
  }

  // Split at boundary
  const firstHalfDuration = boundary - startBeat;
  const secondHalfDuration = endBeat - boundary;

  console.log(`  [BOUNDARY SPLIT] Note at beat ${startBeat.toFixed(2)} duration ${duration.toFixed(2)} crosses beat ${boundary}`);
  console.log(`    -> First half: beat ${startBeat.toFixed(2)}, duration ${firstHalfDuration.toFixed(2)}`);
  console.log(`    -> Second half: beat ${boundary.toFixed(2)}, duration ${secondHalfDuration.toFixed(2)}`);

  return [
    { startBeat, duration: firstHalfDuration },
    { startBeat: boundary, duration: secondHalfDuration }
  ];
}

/**
 * Organizes notes into measures based on their position
 * If totalBars is provided, pre-creates that many measures (empty ones will render as rests)
 */
function organizeNotesIntoMeasures(
  notes: ExerciseNote[],
  _timeSignature: TimeSignature,
  totalBars?: number
): ExerciseNote[][] {
  // Determine total number of measures
  const maxMeasureFromNotes = notes.length === 0
    ? 1
    : Math.max(...notes.map(n => n.position?.measure || 1));

  const totalMeasures = totalBars || maxMeasureFromNotes;

  // [DIAGNOSTIC] Log input data
  console.log('[MusicXML] Organizing notes into measures');
  console.log('[MusicXML] Total notes:', notes.length);
  console.log('[MusicXML] total_bars from exercise:', totalBars);
  console.log('[MusicXML] maxMeasureFromNotes:', maxMeasureFromNotes);
  console.log('[MusicXML] Using totalMeasures:', totalMeasures);
  console.log('[MusicXML] Measure numbers in notes:',
    Array.from(new Set(notes.map(n => n.position?.measure))).sort((a, b) => (a || 0) - (b || 0))
  );
  // [DIAGNOSTIC] Log first 5 notes with full position data
  console.log('[MusicXML] First 5 notes raw data:');
  notes.slice(0, 5).forEach((n, i) => {
    console.log(`  Note ${i}: note=${n.note}, measure=${n.position?.measure}, beat=${n.position?.beat}, subdivision=${n.position?.subdivision}, tick=${n.position?.tick}, duration=${n.duration}, durationTicks=${n.durationTicks}`);
  });

  // Pre-create array of N measures (all initially empty)
  const measures: ExerciseNote[][] = Array.from(
    { length: totalMeasures },
    () => []
  );

  // Fill measures with notes
  notes.forEach((note) => {
    const noteMeasure = note.position?.measure;

    // Handle both 0-based (MIDI parser: 0,1,2...) and 1-based (MusicXML: 1,2,3...) measure numbering
    let measureIndex: number;

    if (noteMeasure === undefined || noteMeasure === null) {
      // No measure specified, default to first measure
      measureIndex = 0;
    } else if (noteMeasure === 0 || maxMeasureFromNotes <= totalMeasures - 1) {
      // MIDI parser uses 0-based indexing (0,1,2... for measures 1,2,3...)
      // Use the value directly as index
      measureIndex = noteMeasure;
    } else {
      // 1-based indexing (1,2,3... for measures 1,2,3...)
      measureIndex = noteMeasure - 1;
    }

    // Only add note if it's within the valid range
    if (measureIndex >= 0 && measureIndex < totalMeasures) {
      measures[measureIndex].push(note);
    } else {
      console.warn('[MusicXML] Note with invalid measure position:', note.position?.measure, 'converted to index:', measureIndex, 'totalMeasures:', totalMeasures);
    }
  });

  // Sort notes within each measure by beat position
  measures.forEach((measure) => {
    measure.sort((a, b) => {
      // Use same subdivision format detection as fillMeasureWithRests
      const aRawSub = a.position?.subdivision || 0;
      const aSubBeats = aRawSub >= 4 ? aRawSub / 480 : aRawSub / 4;
      const aPos = (a.position?.beat ?? 0) + aSubBeats;

      const bRawSub = b.position?.subdivision || 0;
      const bSubBeats = bRawSub >= 4 ? bRawSub / 480 : bRawSub / 4;
      const bPos = (b.position?.beat ?? 0) + bSubBeats;

      return aPos - bPos;
    });
  });

  // [DIAGNOSTIC] Log output data
  console.log('[MusicXML] Organized into', measures.length, 'measures');
  console.log('[MusicXML] Notes per measure:', measures.map(m => m.length));
  console.log('[MusicXML] Measures with notes:', measures.filter(m => m.length > 0).length);
  console.log('[MusicXML] Empty measures:', measures.filter(m => m.length === 0).length);

  return measures;
}

/**
 * Fills gaps in a measure with rests and splits non-standard durations into tied notes
 */
function fillMeasureWithRests(
  measureNotes: ExerciseNote[],
  beatsPerMeasure: number
): TimelineItem[] {
  const timeline: TimelineItem[] = [];
  let currentBeat = 0;

  console.log('[fillMeasureWithRests] Processing measure with', measureNotes.length, 'notes, beatsPerMeasure:', beatsPerMeasure);

  // [DIAGNOSTIC] Log all notes before processing - with explicit JSON for each note
  console.log('[fillMeasureWithRests] Notes in measure (raw data):');
  for (let i = 0; i < measureNotes.length; i++) {
    const n = measureNotes[i];
    const rawSub = n.position?.subdivision || 0;
    const isOldFormat = rawSub >= 4; // >= 4 means old tick format (4-479), 0-3 is new 16th index
    const subBeats = isOldFormat ? rawSub / 480 : rawSub / 4;
    const calcBeat = (n.position?.beat ?? 0) + subBeats;
    const durationQuarters = n.durationTicks ? n.durationTicks / 480 : getDurationInQuarters(n.duration);
    console.log(`  RAW NOTE[${i}]: note=${n.note}, pos.beat=${n.position?.beat}, pos.sub=${rawSub} (${isOldFormat ? 'OLD/ticks' : 'NEW/16th'}), calcBeat=${calcBeat.toFixed(3)}, duration=${n.duration}, durationTicks=${n.durationTicks}, durationQuarters=${durationQuarters.toFixed(3)}`);
  }

  // First, merge consecutive same-pitch notes that should be tied
  const mergedNotes = mergeConsecutiveSamePitchNotes(measureNotes, beatsPerMeasure);

  console.log('[fillMeasureWithRests] After merge:', mergedNotes.length, 'notes');

  mergedNotes.forEach((note, index) => {
    const ticksPerQuarterNote = 480;

    // Calculate beat position from position fields
    // NOTE: position.beat is stored as 0-based by absoluteTickToPosition() despite type definition saying 1-based
    //
    // SUBDIVISION HANDLING:
    // - New format (after fix): subdivision is 16th note index (0-3), divide by 4 to get beat fraction
    // - Old format (before fix): subdivision was in ticks (0-479), divide by 480 to get beat fraction
    // - Detect: if subdivision >= 4, it's old format (ticks); values 0-3 are new format (16th index)
    // - NOTE: Using >= 4 instead of > 3 to handle edge case where subdivision=4 exists
    const rawSubdivision = note.position?.subdivision || 0;
    const subdivisionBeats = rawSubdivision >= 4
      ? rawSubdivision / 480  // Old format: convert ticks to beat fraction (values 4-479)
      : rawSubdivision / 4;   // New format: convert 16th note index to beat fraction (values 0-3)
    const rawNoteBeat = (note.position?.beat ?? 0) + subdivisionBeats;
    // Quantize beat position to 16th note grid
    const noteBeat = quantizeBeatPosition(rawNoteBeat);

    // Get the duration in quarter notes
    // Priority: 1) durationTicks (exact MIDI duration), 2) duration_ms, 3) duration name
    let noteDuration: number;
    if (note.durationTicks && note.durationTicks > 0) {
      // Use exact tick duration if available (480 PPQ = 480 ticks per quarter note)
      noteDuration = note.durationTicks / ticksPerQuarterNote;
    } else if (note.duration_ms && note.duration_ms > 0) {
      // Use duration_ms if available (requires BPM to convert, assume 120 BPM standard)
      const assumedBpm = 120;
      noteDuration = (note.duration_ms / 1000) * (assumedBpm / 60);
    } else {
      // Fall back to duration name (quantized, loses precision)
      noteDuration = getDurationInQuarters(note.duration);
    }

    // Quantize duration to 16th note grid (0.25 quarter notes)
    // Also ensure minimum duration of 16th note (0.25) to prevent 0-duration notes
    // IMPORTANT: Use Math.floor() to always round DOWN - prevents beat overflow
    noteDuration = Math.max(0.25, Math.floor(noteDuration * 4) / 4);

    // SMART SNAP: If note end is VERY CLOSE to measure end (within a 16th note),
    // snap it to the measure end to avoid messy small tied notes at the end
    const maxDurationInMeasure = beatsPerMeasure - noteBeat;
    const noteEndBeat = noteBeat + noteDuration;
    const distanceToMeasureEnd = beatsPerMeasure - noteEndBeat;

    // If note ends within 0.25 beats (1 sixteenth note) of measure end, AND
    // extending wouldn't exceed the measure, snap to measure end
    if (distanceToMeasureEnd > 0 && distanceToMeasureEnd <= 0.25) {
      console.log(`  [SNAP] Note ends at beat ${noteEndBeat.toFixed(3)}, only ${distanceToMeasureEnd.toFixed(3)} from measure end. Snapping to measure end.`);
      noteDuration = maxDurationInMeasure;
    }

    // CRITICAL FIX: Clamp note duration to measure boundary
    // Notes MUST NOT extend past the end of their measure
    // This prevents "beat overflow" where a measure has > 4 beats
    if (maxDurationInMeasure < 0.125) {
      // Note starts too close to or past measure end - skip this note entirely
      console.log(`  [SKIP] Note at beat ${noteBeat.toFixed(3)} has no room in measure (max ${maxDurationInMeasure.toFixed(3)} beats). Skipping.`);
      return; // Skip this note - it belongs in the next measure or is an error
    }
    if (noteDuration > maxDurationInMeasure + 0.001) {
      console.log(`  [CLAMP] Note at beat ${noteBeat.toFixed(3)} has duration ${noteDuration.toFixed(3)} which exceeds measure end. Clamping to ${maxDurationInMeasure.toFixed(3)}`);
      // Quantize clamped duration to 16th note grid
      // IMPORTANT: Use Math.floor() to guarantee we never exceed maxDurationInMeasure
      noteDuration = Math.floor(maxDurationInMeasure * 4) / 4;
      // But ensure it's at least a 32nd note if there's any room at all
      if (noteDuration < 0.125) noteDuration = 0.125;
    }

    console.log(`  Note ${index}: beat=${note.position?.beat}, subdivision=${note.position?.subdivision}, (tick=${note.position?.tick} ignored), rawBeat=${rawNoteBeat.toFixed(3)}, quantizedBeat=${noteBeat.toFixed(3)}, duration=${noteDuration.toFixed(3)}, currentBeat=${currentBeat.toFixed(3)}`);

    // Fill gap with rest if needed (but don't exceed measure boundary)
    if (noteBeat > currentBeat + 0.001) {
      // Clamp rest duration to not exceed measure end
      const rawRestDuration = noteBeat - currentBeat;
      const maxRestDuration = beatsPerMeasure - currentBeat;
      const restDuration = Math.min(rawRestDuration, maxRestDuration);

      if (restDuration > 0.001) {
        // Split rest into standard durations if needed
        const restDurations = splitIntoStandardDurations(restDuration);
        let restBeat = currentBeat;
        restDurations.forEach((restType) => {
          // Double-check we're not exceeding measure
          if (restBeat < beatsPerMeasure - 0.001) {
            console.log(`  Adding gap rest: duration=${restType}, startBeat=${restBeat.toFixed(3)}`);
            timeline.push({
              type: 'rest',
              duration: restType,
              startBeat: restBeat,
            });
            restBeat += getDurationInQuarters(restType);
          }
        });
      }
    }

    // STEP 1: Split at measure boundary (beat 2 in 4/4) if note crosses it
    const boundarySegments = splitAtMeasureBoundary(noteBeat, noteDuration, beatsPerMeasure);

    // STEP 2: For each segment, split into standard durations and add ties
    boundarySegments.forEach((segment, segIndex) => {
      const splitDurations = splitIntoStandardDurations(segment.duration);
      let tiedBeat = segment.startBeat;

      splitDurations.forEach((dur, durIndex) => {
        const isFirstOfSegment = durIndex === 0;
        const isLastOfSegment = durIndex === splitDurations.length - 1;
        const isFirstSegment = segIndex === 0;
        const isLastSegment = segIndex === boundarySegments.length - 1;

        // Tie logic:
        // - tieStart: true if there's another note after this one (within segment or across segments)
        // - tieEnd: true if there was a note before this one (within segment or across segments)
        const needsTieStart = !isLastOfSegment || !isLastSegment;
        const needsTieEnd = !isFirstOfSegment || !isFirstSegment;

        timeline.push({
          type: 'note',
          note: note,
          duration: dur,
          startBeat: tiedBeat,
          tieStart: needsTieStart,
          tieEnd: needsTieEnd,
        });
        tiedBeat += getDurationInQuarters(dur);
      });
    });

    currentBeat = noteBeat + noteDuration;
  });

  // Fill end of measure if needed
  if (currentBeat < beatsPerMeasure - 0.001) {
    const restDuration = beatsPerMeasure - currentBeat;
    console.log(`  [END-OF-MEASURE] currentBeat=${currentBeat.toFixed(3)}, beatsPerMeasure=${beatsPerMeasure}, gap=${restDuration.toFixed(3)}`);
    // Split rest into standard durations if needed
    const restDurations = splitIntoStandardDurations(restDuration);
    let restBeat = currentBeat;
    restDurations.forEach((restType) => {
      const restTypeDuration = getDurationInQuarters(restType);
      // Guard: Don't add rest if it would exceed measure end
      // IMPORTANT: Strict comparison - no tolerance to prevent overflow
      if (restBeat + restTypeDuration <= beatsPerMeasure) {
        console.log(`  Adding end-of-measure rest: duration=${restType}, startBeat=${restBeat.toFixed(3)}`);
        timeline.push({
          type: 'rest',
          duration: restType,
          startBeat: restBeat,
        });
        restBeat += restTypeDuration;
      } else {
        console.log(`  [SKIP] End-of-measure rest ${restType} would exceed measure (${restBeat.toFixed(3)} + ${restTypeDuration} > ${beatsPerMeasure})`);
      }
    });
  }

  // [DIAGNOSTIC] Final timeline summary
  console.log(`[fillMeasureWithRests] FINAL TIMELINE (${timeline.length} items):`);
  let totalBeats = 0;
  timeline.forEach((item, i) => {
    const dur = getDurationInQuarters(item.duration);
    totalBeats += dur;
    const noteInfo = item.type === 'note' && item.note ? ` (${item.note.note})` : '';
    const tieInfo = item.tieStart || item.tieEnd ? ` [tie:${item.tieEnd ? 'end' : ''}${item.tieStart ? 'start' : ''}]` : '';
    console.log(`  [${i}] ${item.type}${noteInfo}: ${item.duration} (${dur} beats) at beat ${item.startBeat.toFixed(3)}${tieInfo}`);
  });
  console.log(`  TOTAL BEATS: ${totalBeats.toFixed(3)} (expected: ${beatsPerMeasure})`);

  // SAFETY CHECK: If total beats exceeds expected, truncate timeline
  if (totalBeats > beatsPerMeasure + 0.001) {
    console.error(`  [ERROR] Timeline overflow! ${totalBeats.toFixed(3)} beats > ${beatsPerMeasure} expected. Truncating...`);
    // Rebuild timeline from scratch with strict beat accounting
    return buildStrictTimeline(timeline, beatsPerMeasure);
  }

  return timeline;
}

/**
 * Generates XML for a single note or rest with optional beam and tie information
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

  // Generate tie elements (goes before </note>)
  // <tie> is for playback (in the note element)
  // <tied> is for notation (in the notations element)
  let tieXML = '';
  let notationsXML = '';

  if (item.type === 'note') {
    const tieElements: string[] = [];
    const tiedElements: string[] = [];

    if (item.tieEnd) {
      tieElements.push('<tie type="stop"/>');
      tiedElements.push('<tied type="stop"/>');
    }
    if (item.tieStart) {
      tieElements.push('<tie type="start"/>');
      tiedElements.push('<tied type="start"/>');
    }

    if (tieElements.length > 0) {
      tieXML = '\n      ' + tieElements.join('\n      ');
    }
    if (tiedElements.length > 0) {
      notationsXML = `
      <notations>
        ${tiedElements.join('\n        ')}
      </notations>`;
    }
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
      <duration>${divisions}</duration>${tieXML}
      <type>${noteType}</type>${dotXML}${beamXML}${notationsXML}
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
  maxMeasuresPerSystem?: number // Optional - not used (no system breaks)
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
  const { notes, bpm, timeSignature, title = 'Bass Exercise', maxMeasuresPerSystem = undefined, totalBars } = options;

  // Organize notes into measures (respects totalBars if provided)
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
