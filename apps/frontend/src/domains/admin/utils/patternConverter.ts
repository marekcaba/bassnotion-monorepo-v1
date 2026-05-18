/**
 * Pattern Converter Utility
 * Converts patterns from library format to DrumHit[] format for the drum pattern editor
 */

import type {
  PatternLibraryItem,
  PatternMidiData,
  PatternEvent,
  DrumHit,
  MidiDrumType,
} from '@bassnotion/contracts';
import { GENERAL_MIDI_DRUM_MAP } from '@bassnotion/contracts';

/**
 * Generate a unique ID for a drum hit
 */
function generateHitId(): string {
  return `hit-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Convert MIDI note to drum type using General MIDI drum map
 */
function midiNoteToDrumType(midiNote: number): MidiDrumType {
  return GENERAL_MIDI_DRUM_MAP[midiNote] || 'unknown';
}

/**
 * Convert tick position to musical position (measure, beat, subdivision)
 *
 * @param tick - Tick position (0-indexed)
 * @param ppq - Pulses per quarter note (typically 480)
 * @param timeSignatureNumerator - Time signature numerator (e.g., 4 for 4/4)
 * @param timeSignatureDenominator - Time signature denominator (e.g., 4 for 4/4)
 */
function tickToMusicalPosition(
  tick: number,
  ppq: number,
  timeSignatureNumerator: number,
  timeSignatureDenominator: number,
): { measure: number; beat: number; subdivision: number; tick?: number } {
  // Calculate ticks per beat based on time signature denominator
  // In 4/4, a beat is a quarter note = ppq ticks
  // In 6/8, a beat is an eighth note = ppq/2 ticks
  const quarterNoteRatio = 4 / timeSignatureDenominator;
  const ticksPerBeat = ppq * quarterNoteRatio;
  const ticksPerMeasure = ticksPerBeat * timeSignatureNumerator;

  // Calculate measure (1-indexed)
  const measure = Math.floor(tick / ticksPerMeasure) + 1;

  // Calculate beat within measure (1-indexed)
  const tickInMeasure = tick % ticksPerMeasure;
  const beat = Math.floor(tickInMeasure / ticksPerBeat) + 1;

  // Calculate subdivision within beat (0-indexed, 4 subdivisions per beat = 16th notes)
  const tickInBeat = tickInMeasure % ticksPerBeat;
  const ticksPerSubdivision = ticksPerBeat / 4; // 4 sixteenth notes per beat
  const subdivision = Math.floor(tickInBeat / ticksPerSubdivision);

  // Preserve sub-subdivision timing as tick
  const remainingTick = Math.round(tickInBeat % ticksPerSubdivision);

  return {
    measure,
    beat,
    subdivision,
    tick: remainingTick > 0 ? remainingTick : undefined,
  };
}

/**
 * Convert PatternEvent array to DrumHit array
 */
function convertEventsToDrumHits(
  events: PatternEvent[],
  ppq: number,
  timeSignature: { numerator: number; denominator: number },
): DrumHit[] {
  return events.map((event) => {
    const position = tickToMusicalPosition(
      event.tick,
      ppq,
      timeSignature.numerator,
      timeSignature.denominator,
    );

    return {
      id: generateHitId(),
      drum: midiNoteToDrumType(event.midiNote),
      velocity: event.velocity,
      position,
      durationTicks: event.durationTicks,
      midiNote: event.midiNote,
    };
  });
}

/**
 * Extend pattern to fill specified number of bars
 *
 * If the pattern is shorter than the target bars, it will be looped.
 * If it's longer, it will be truncated.
 */
function extendPatternToBars(
  drumHits: DrumHit[],
  patternBars: number,
  targetBars: number,
): DrumHit[] {
  if (patternBars === targetBars) {
    return drumHits;
  }

  if (patternBars > targetBars) {
    // Truncate pattern
    return drumHits.filter((hit) => hit.position.measure <= targetBars);
  }

  // Loop pattern to fill target bars
  const result: DrumHit[] = [...drumHits];
  const loopCount = Math.ceil(targetBars / patternBars);

  for (let loop = 1; loop < loopCount; loop++) {
    const measureOffset = loop * patternBars;

    drumHits.forEach((hit) => {
      const newMeasure = hit.position.measure + measureOffset;
      if (newMeasure <= targetBars) {
        result.push({
          ...hit,
          id: generateHitId(),
          position: {
            ...hit.position,
            measure: newMeasure,
          },
        });
      }
    });
  }

  return result;
}

/**
 * Adjust pattern tempo by scaling velocities (optional for BPM adaptation)
 * Note: Actual tempo is controlled by the exercise BPM, not the pattern
 */
function adjustVelocitiesForTempo(
  drumHits: DrumHit[],
  sourceBpmRange: { min: number; max: number },
  targetBpm: number,
): DrumHit[] {
  // If target BPM is outside the pattern's suggested range, we might want to
  // adjust velocities slightly (faster = softer, slower = harder)
  // For now, we just return the original hits
  // This can be enhanced later for more sophisticated tempo adaptation
  return drumHits;
}

/**
 * Convert a pattern library item to DrumHit array
 *
 * @param pattern - The pattern from the library
 * @param options - Conversion options
 * @returns Array of DrumHit objects ready for the drum pattern editor
 */
export function convertLibraryPatternToDrumHits(
  pattern: PatternLibraryItem,
  options: {
    /** Target number of bars (if different from pattern) */
    targetBars?: number;
    /** Target BPM for velocity adjustment */
    targetBpm?: number;
    /** Whether to regenerate IDs (default: true) */
    regenerateIds?: boolean;
  } = {},
): DrumHit[] {
  const { targetBars, targetBpm, regenerateIds = true } = options;

  let drumHits: DrumHit[];

  // Option 1: Use pre-converted drum hits if available
  if (pattern.drumHits && pattern.drumHits.length > 0) {
    drumHits = regenerateIds
      ? pattern.drumHits.map((hit) => ({
          ...hit,
          id: generateHitId(),
        }))
      : [...pattern.drumHits];
  }
  // Option 2: Convert from MIDI data
  else if (pattern.midiData) {
    drumHits = convertEventsToDrumHits(
      pattern.midiData.events,
      pattern.midiData.ppq,
      pattern.midiData.timeSignature,
    );
  }
  // No data available
  else {
    console.warn(
      `Pattern ${pattern.id} has no drum hits or MIDI data to convert`,
    );
    return [];
  }

  // Extend/truncate to target bars if specified
  if (targetBars && targetBars !== pattern.bars) {
    drumHits = extendPatternToBars(drumHits, pattern.bars, targetBars);
  }

  // Adjust velocities for tempo if specified
  if (targetBpm) {
    drumHits = adjustVelocitiesForTempo(drumHits, pattern.bpmRange, targetBpm);
  }

  return drumHits;
}

/**
 * Get pattern statistics summary
 */
export function getPatternSummary(pattern: PatternLibraryItem): {
  hitCount: number;
  uniqueDrums: string[];
  hasKick: boolean;
  hasSnare: boolean;
  hasHihat: boolean;
} {
  const drumHits = pattern.drumHits || [];
  const uniqueDrums = [...new Set(drumHits.map((h) => h.drum))];

  return {
    hitCount: drumHits.length,
    uniqueDrums,
    hasKick: uniqueDrums.includes('kick'),
    hasSnare: uniqueDrums.includes('snare'),
    hasHihat:
      uniqueDrums.includes('hihat') ||
      uniqueDrums.includes('hihat_closed') ||
      uniqueDrums.includes('hihat_open'),
  };
}
