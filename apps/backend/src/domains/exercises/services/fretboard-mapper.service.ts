import { Injectable, Logger } from '@nestjs/common';
import type {
  GeneratedExerciseNote,
  AlternativePosition,
  PositionWarning,
  ConfidenceLevel,
  PlayabilityMetrics,
} from '../dto/convert-midi-response.dto.js';
import type {
  MidiNoteEvent,
  ParsedMeasure,
} from '../dto/parse-midi-response.dto.js';
import type { MeasureAnchor } from '../dto/convert-midi-request.dto.js';

/**
 * Fretboard position (string + fret)
 */
interface FretboardPosition {
  string: number; // 1-6
  fret: number; // 0-24
  score: number; // Position score (0-100)
}

/**
 * Bass tuning configuration
 */
interface BassTuning {
  stringCount: number;
  openStringPitches: number[]; // MIDI note numbers for open strings
}

/**
 * Service for mapping MIDI notes to fretboard positions using dynamic programming
 */
@Injectable()
export class FretboardMapperService {
  private readonly logger = new Logger(FretboardMapperService.name);

  // Standard 4-string bass tuning (EADG)
  private readonly STANDARD_4_STRING: BassTuning = {
    stringCount: 4,
    openStringPitches: [28, 33, 38, 43], // E1, A1, D2, G2
  };

  // 5-string bass tuning (BEADG)
  private readonly STANDARD_5_STRING: BassTuning = {
    stringCount: 5,
    openStringPitches: [23, 28, 33, 38, 43], // B0, E1, A1, D2, G2
  };

  // 6-string bass tuning (BEADGC)
  private readonly STANDARD_6_STRING: BassTuning = {
    stringCount: 6,
    openStringPitches: [23, 28, 33, 38, 43, 48], // B0, E1, A1, D2, G2, C3
  };

  // Algorithm constants
  private readonly MAX_FRET = 24;
  private readonly HAND_POSITION_RANGE = 5; // 4-5 fret hand span
  private readonly LARGE_STRETCH_THRESHOLD = 5;

  /**
   * Convert MIDI notes to fretboard positions using anchors and dynamic programming
   */
  async convertMidiToFretboard(
    measures: ParsedMeasure[],
    anchors: MeasureAnchor[],
    bassType: '4' | '5' | '6' = '4',
    correlationId?: string,
  ): Promise<{
    notes: GeneratedExerciseNote[];
    playability: PlayabilityMetrics;
  }> {
    const startTime = Date.now();

    this.logger.log('Converting MIDI to fretboard', {
      measureCount: measures.length,
      anchorCount: anchors.length,
      bassType,
      correlationId,
    });

    // Get bass tuning
    const tuning = this.getBasstuning(bassType);

    // Validate anchors
    this.validateAnchors(anchors, measures, correlationId);

    // Convert each measure
    const allNotes: GeneratedExerciseNote[] = [];
    let noteIdCounter = 1;

    for (const measure of measures) {
      if (measure.notes.length === 0) {
        this.logger.debug('Skipping empty measure', {
          measureNumber: measure.measureNumber,
          correlationId,
        });
        continue;
      }

      // Find anchor for this measure
      const anchor = anchors.find(
        (a) => a.measureNumber === measure.measureNumber,
      );

      if (!anchor) {
        this.logger.warn('No anchor found for measure, skipping', {
          measureNumber: measure.measureNumber,
          correlationId,
        });
        continue;
      }

      // Convert notes in this measure
      const measureNotes = this.convertMeasureNotes(
        measure,
        anchor,
        tuning,
        noteIdCounter,
      );

      allNotes.push(...measureNotes);
      noteIdCounter += measureNotes.length;
    }

    // Calculate playability metrics
    const playability = this.calculatePlayabilityMetrics(allNotes);

    const processingTime = Date.now() - startTime;

    this.logger.log('MIDI to fretboard conversion completed', {
      totalNotes: allNotes.length,
      playabilityScore: playability.overallScore,
      processingTimeMs: processingTime,
      correlationId,
    });

    return { notes: allNotes, playability };
  }

  /**
   * Convert MIDI pitch to note name (e.g., 28 -> "E1", 69 -> "A4")
   */
  private midiPitchToNoteName(pitch: number): string {
    const noteNames = [
      'C',
      'C#',
      'D',
      'D#',
      'E',
      'F',
      'F#',
      'G',
      'G#',
      'A',
      'A#',
      'B',
    ];
    const octave = Math.floor(pitch / 12) - 1;
    const noteIndex = pitch % 12;
    return `${noteNames[noteIndex]}${octave}`;
  }

  /**
   * Get bass tuning configuration
   */
  private getBasstuning(bassType: '4' | '5' | '6'): BassTuning {
    switch (bassType) {
      case '4':
        return this.STANDARD_4_STRING;
      case '5':
        return this.STANDARD_5_STRING;
      case '6':
        return this.STANDARD_6_STRING;
      default:
        return this.STANDARD_4_STRING;
    }
  }

  /**
   * Validate that all measures have anchors
   */
  private validateAnchors(
    anchors: MeasureAnchor[],
    measures: ParsedMeasure[],
    correlationId?: string,
  ): void {
    const measuresWithNotes = measures.filter((m) => m.notes.length > 0);

    for (const measure of measuresWithNotes) {
      const anchor = anchors.find(
        (a) => a.measureNumber === measure.measureNumber,
      );

      if (!anchor) {
        this.logger.warn('Missing anchor for measure with notes', {
          measureNumber: measure.measureNumber,
          noteCount: measure.notes.length,
          correlationId,
        });
      }
    }
  }

  /**
   * Convert notes within a single measure using dynamic programming
   */
  private convertMeasureNotes(
    measure: ParsedMeasure,
    anchor: MeasureAnchor,
    tuning: BassTuning,
    startNoteId: number,
  ): GeneratedExerciseNote[] {
    const notes = measure.notes;

    if (notes.length === 0) {
      return [];
    }

    // Get all possible positions for each note
    const allPositionsPerNote = notes.map((note) =>
      this.getAllPositionsForPitch(note.pitch, tuning),
    );

    // Check for unplayable notes (outside bass range)
    const unplayableNotes = allPositionsPerNote
      .map((positions, index) => ({ positions, index, note: notes[index] }))
      .filter((item) => item.positions.length === 0);

    if (unplayableNotes.length > 0) {
      const noteDetails = unplayableNotes.map((item) => ({
        index: item.index,
        pitch: item.note.pitch,
        name: item.note.name,
      }));

      this.logger.error('MIDI contains notes outside bass guitar range', {
        measureNumber: measure.measureNumber,
        unplayableCount: unplayableNotes.length,
        notes: noteDetails,
      });

      // Calculate the playable range for this bass type
      const lowestPitch = Math.min(...tuning.openStringPitches);
      const highestPitch =
        Math.max(...tuning.openStringPitches) + this.MAX_FRET;
      const lowestNote = this.midiPitchToNoteName(lowestPitch);
      const highestNote = this.midiPitchToNoteName(highestPitch);

      throw new Error(
        `MIDI contains ${unplayableNotes.length} notes outside bass guitar range in measure ${measure.measureNumber}. ` +
          `For ${tuning.stringCount}-string bass, notes must be between ${lowestNote} (MIDI ${lowestPitch}) and ${highestNote} (MIDI ${highestPitch}).`,
      );
    }

    // Build DP table to find optimal path
    const dpResult = this.findOptimalPath(allPositionsPerNote, anchor, notes);

    // Generate exercise notes from optimal path
    const exerciseNotes: GeneratedExerciseNote[] = [];

    for (let i = 0; i < notes.length; i++) {
      const midiNote = notes[i];
      const position = dpResult.path[i];
      const alternatives = this.getAlternatives(
        allPositionsPerNote[i],
        position,
      );
      const confidence = this.calculateConfidence(alternatives);
      const warnings = this.generateWarnings(
        position,
        i > 0 ? dpResult.path[i - 1] : null,
      );

      exerciseNotes.push({
        id: `note-${startNoteId + i}`,

        // FRETBOARD POSITION
        string: position.string,
        fret: position.fret,
        note: midiNote.name,

        // MUSICAL TIMING (from parsed MIDI)
        position: midiNote.position,
        noteDuration: midiNote.noteDuration,
        durationTicks: midiNote.durationTicks,

        // PERFORMANCE DATA
        pitch: midiNote.pitch,
        velocity: midiNote.velocity,

        // FRETBOARD ANALYSIS METADATA
        measureNumber: measure.measureNumber,
        confidence,
        alternatives,
        warnings,
        score: position.score,
      });
    }

    return exerciseNotes;
  }

  /**
   * Get all valid fretboard positions for a MIDI pitch
   */
  private getAllPositionsForPitch(
    pitch: number,
    tuning: BassTuning,
  ): FretboardPosition[] {
    const positions: FretboardPosition[] = [];

    for (let stringNum = 1; stringNum <= tuning.stringCount; stringNum++) {
      const openPitch = tuning.openStringPitches[stringNum - 1];
      const fret = pitch - openPitch;

      // Check if this note is playable on this string
      if (fret >= 0 && fret <= this.MAX_FRET) {
        const score = this.scorePosition(stringNum, fret, tuning.stringCount);
        positions.push({
          string: stringNum,
          fret,
          score,
        });
      }
    }

    return positions;
  }

  /**
   * Score a single position based on ergonomic factors
   */
  private scorePosition(
    string: number,
    fret: number,
    totalStrings: number,
  ): number {
    let score = 50; // Base score

    // Prefer middle strings (easier to access)
    const middleString = Math.ceil(totalStrings / 2);
    const stringDistance = Math.abs(string - middleString);
    score += (4 - stringDistance) * 5;

    // Prefer lower frets (easier to play)
    if (fret <= 5) {
      score += 20;
    } else if (fret <= 12) {
      score += 10;
    } else if (fret <= 17) {
      score += 5;
    }

    // Bonus for open strings (0 fret)
    if (fret === 0) {
      score += 10;
    }

    // Penalty for very high frets
    if (fret > 17) {
      score -= 10;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Find optimal path through notes using dynamic programming
   */
  private findOptimalPath(
    allPositionsPerNote: FretboardPosition[][],
    anchor: MeasureAnchor,
    midiNotes: MidiNoteEvent[],
  ): { path: FretboardPosition[]; totalCost: number } {
    const n = allPositionsPerNote.length;

    if (n === 0) {
      return { path: [], totalCost: 0 };
    }

    // DP table: dp[i] = best cost to reach position i
    const dp: number[] = new Array(n).fill(Infinity);
    const parent: number[] = new Array(n).fill(-1);
    const chosenPosition: FretboardPosition[] = new Array(n);

    // Initialize first note with anchor position
    const firstNotePositions = allPositionsPerNote[0];
    let bestFirstPosition: FretboardPosition | null = null;
    let bestFirstCost = Infinity;

    for (const pos of firstNotePositions) {
      // Cost is distance from anchor
      const cost = this.calculateTransitionCost(
        { string: anchor.string, fret: anchor.fret, score: 100 },
        pos,
      );

      if (cost < bestFirstCost) {
        bestFirstCost = cost;
        bestFirstPosition = pos;
      }
    }

    if (bestFirstPosition) {
      dp[0] = bestFirstCost;
      chosenPosition[0] = bestFirstPosition;
    } else {
      // Fallback: use anchor position if possible, otherwise use best scored position
      const anchorPosition = firstNotePositions.find(
        (p) => p.string === anchor.string && p.fret === anchor.fret,
      );

      if (anchorPosition) {
        dp[0] = 0;
        chosenPosition[0] = anchorPosition;
      } else {
        // Use highest scored position
        const bestScored = firstNotePositions.reduce((best, pos) =>
          pos.score > best.score ? pos : best,
        );
        dp[0] = 10; // Small penalty for not matching anchor
        chosenPosition[0] = bestScored;
      }
    }

    // Fill DP table
    for (let i = 1; i < n; i++) {
      const positions = allPositionsPerNote[i];

      for (const currentPos of positions) {
        const prevPos = chosenPosition[i - 1];

        // Safety check: skip if previous position is undefined
        if (!prevPos) {
          this.logger.warn('Skipping note due to missing previous position', {
            noteIndex: i,
          });
          continue;
        }

        const transitionCost = this.calculateTransitionCost(
          prevPos,
          currentPos,
        );
        const positionCost = 100 - currentPos.score; // Lower score = higher cost
        const totalCost = dp[i - 1] + transitionCost + positionCost * 0.3;

        if (totalCost < dp[i]) {
          dp[i] = totalCost;
          chosenPosition[i] = currentPos;
          parent[i] = i - 1;
        }
      }

      // Additional safety: if no position was chosen for this note, use best scored position
      if (!chosenPosition[i]) {
        this.logger.warn(
          'No optimal position found, using best scored position',
          {
            noteIndex: i,
            positionsAvailable: positions.length,
          },
        );

        // At this point, positions array should never be empty (checked earlier in convertMeasureNotes)
        // But add safety check just in case
        if (positions.length === 0) {
          throw new Error(
            `Internal error: No positions available for note ${i}. This should have been caught earlier.`,
          );
        }

        const bestScored = positions.reduce(
          (best, pos) => (pos.score > best.score ? pos : best),
          positions[0], // Use first position as initial value for safety
        );
        chosenPosition[i] = bestScored;
        dp[i] = Infinity; // Mark as fallback
      }
    }

    return {
      path: chosenPosition,
      totalCost: dp[n - 1],
    };
  }

  /**
   * Calculate cost of transitioning from one position to another
   */
  private calculateTransitionCost(
    from: FretboardPosition,
    to: FretboardPosition,
  ): number {
    let cost = 0;

    // Fret distance (hand movement)
    const fretDistance = Math.abs(to.fret - from.fret);
    cost += fretDistance * 2;

    // String crossing
    const stringDistance = Math.abs(to.string - from.string);
    cost += stringDistance * 3;

    // Penalty for large stretches
    if (fretDistance > this.HAND_POSITION_RANGE) {
      cost += (fretDistance - this.HAND_POSITION_RANGE) * 10;
    }

    // Penalty for difficult position shifts
    if (fretDistance > this.LARGE_STRETCH_THRESHOLD && stringDistance > 1) {
      cost += 20; // Combined shift + string crossing
    }

    return cost;
  }

  /**
   * Get alternative positions for a note
   */
  private getAlternatives(
    allPositions: FretboardPosition[],
    chosenPosition: FretboardPosition,
  ): AlternativePosition[] {
    const alternatives = allPositions
      .filter(
        (pos) =>
          pos.string !== chosenPosition.string ||
          pos.fret !== chosenPosition.fret,
      )
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((pos) => ({
        string: pos.string,
        fret: pos.fret,
        score: pos.score,
        reason: this.getAlternativeReason(pos, chosenPosition),
      }));

    return alternatives;
  }

  /**
   * Generate reason for alternative position
   */
  private getAlternativeReason(
    alternative: FretboardPosition,
    chosen: FretboardPosition,
  ): string {
    if (alternative.fret === 0) {
      return 'Open string - easier to play';
    }

    if (alternative.fret < chosen.fret) {
      return 'Lower fret - more accessible';
    }

    if (Math.abs(alternative.string - 2) < Math.abs(chosen.string - 2)) {
      return 'Middle string - better ergonomics';
    }

    return 'Alternative fingering';
  }

  /**
   * Calculate confidence level based on alternatives
   */
  private calculateConfidence(
    alternatives: AlternativePosition[],
  ): ConfidenceLevel {
    if (alternatives.length === 0) {
      return 'high'; // Only one option
    }

    if (alternatives.length === 1) {
      return 'medium'; // 2 options
    }

    return 'low'; // 3+ options
  }

  /**
   * Generate warnings for a position
   */
  private generateWarnings(
    current: FretboardPosition,
    previous: FretboardPosition | null | undefined,
  ): PositionWarning[] {
    const warnings: PositionWarning[] = [];

    // Safety check: return empty warnings if no previous note
    if (!previous || !previous.fret || !previous.string) {
      return warnings;
    }

    // Large stretch
    const fretDistance = Math.abs(current.fret - previous.fret);
    if (fretDistance > this.LARGE_STRETCH_THRESHOLD) {
      warnings.push({
        type: 'large_stretch',
        message: `Large stretch: ${fretDistance} frets`,
        severity: fretDistance > 7 ? 'error' : 'warning',
      });
    }

    // Difficult shift
    const stringDistance = Math.abs(current.string - previous.string);
    if (fretDistance > 4 && stringDistance > 1) {
      warnings.push({
        type: 'difficult_shift',
        message: 'Difficult position shift with string crossing',
        severity: 'warning',
      });
    }

    // String crossing
    if (stringDistance > 2) {
      warnings.push({
        type: 'string_crossing',
        message: `Large string crossing: ${stringDistance} strings`,
        severity: 'info',
      });
    }

    // Awkward position (very high fret)
    if (current.fret > 19) {
      warnings.push({
        type: 'awkward_position',
        message: 'Very high fret position',
        severity: 'warning',
      });
    }

    return warnings;
  }

  /**
   * Calculate overall playability metrics
   */
  private calculatePlayabilityMetrics(
    notes: GeneratedExerciseNote[],
  ): PlayabilityMetrics {
    if (notes.length === 0) {
      return {
        overallScore: 0,
        largeStretches: 0,
        difficultShifts: 0,
        stringCrossings: 0,
        handStability: 0,
        highConfidencePercentage: 0,
      };
    }

    let largeStretches = 0;
    let difficultShifts = 0;
    let stringCrossings = 0;
    let totalFretMovement = 0;

    for (let i = 1; i < notes.length; i++) {
      const prev = notes[i - 1];
      const curr = notes[i];

      const fretDistance = Math.abs(curr.fret - prev.fret);
      const stringDistance = Math.abs(curr.string - prev.string);

      totalFretMovement += fretDistance;

      if (fretDistance > this.LARGE_STRETCH_THRESHOLD) {
        largeStretches++;
      }

      if (fretDistance > 4 && stringDistance > 1) {
        difficultShifts++;
      }

      if (stringDistance > 0) {
        stringCrossings++;
      }
    }

    // Hand stability: lower average movement = higher stability
    const avgFretMovement = totalFretMovement / (notes.length - 1);
    const handStability = Math.max(0, 100 - avgFretMovement * 10);

    // High confidence percentage
    const highConfidenceCount = notes.filter(
      (n) => n.confidence === 'high',
    ).length;
    const highConfidencePercentage = (highConfidenceCount / notes.length) * 100;

    // Overall score
    let overallScore = 100;
    overallScore -= largeStretches * 5;
    overallScore -= difficultShifts * 10;
    overallScore -= stringCrossings * 0.5;
    overallScore =
      (overallScore + handStability + highConfidencePercentage) / 3;
    overallScore = Math.max(0, Math.min(100, overallScore));

    return {
      overallScore: Math.round(overallScore),
      largeStretches,
      difficultShifts,
      stringCrossings,
      handStability: Math.round(handStability),
      highConfidencePercentage: Math.round(highConfidencePercentage),
    };
  }
}
