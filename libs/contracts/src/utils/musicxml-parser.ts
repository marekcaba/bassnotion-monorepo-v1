/**
 * MusicXML Parser and Converter for BassNotion
 *
 * Parses MusicXML files and converts them to BassNotion's Exercise format.
 * Handles bass-specific notation, timing, and tablature conversion.
 */

import { XMLParser } from 'fast-xml-parser';
import {
  MusicXMLDocument,
  MusicXMLMetadata,
  MusicXMLConversionResult,
  MusicXMLConversionConfig,
  DEFAULT_CONVERSION_CONFIG,
  Note,
  Part,
  Pitch,
} from '../types/musicxml.js';
import {
  ExerciseNote,
  Exercise,
  TechniqueType,
  ExerciseDifficulty,
} from '../types/exercise.js';
import {
  NoteDuration,
  MusicalPosition,
  TimeSignature,
} from '../types/musical-timing.js';
import { MusicalTimeConverter } from './musical-time-converter.js';

/**
 * Main MusicXML parser class
 */
export class MusicXMLParser {
  private parser: XMLParser;
  private config: MusicXMLConversionConfig;

  constructor(config: Partial<MusicXMLConversionConfig> = {}) {
    this.config = { ...DEFAULT_CONVERSION_CONFIG, ...config };

    // Configure XML parser for MusicXML format
    this.parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      textNodeName: '#text',
      parseAttributeValue: true,
      parseTagValue: true,
      trimValues: true,
      stopNodes: ['*.text', '*.lyrics'],
      processEntities: true,
      htmlEntities: true,
    });
  }

  /**
   * Parse MusicXML file content and convert to Exercise format
   */
  async parseFile(xmlContent: string): Promise<MusicXMLConversionResult> {
    try {
      // Parse XML content
      const parsedXML = this.parser.parse(xmlContent);
      const musicXML = this.normalizeMusicXML(parsedXML);

      // Extract metadata
      const metadata = this.extractMetadata(musicXML);

      // Find bass part
      const bassPart = this.findBassPart(musicXML);
      if (!bassPart) {
        return {
          success: false,
          metadata,
          notes: [],
          errors: ['No bass part found in MusicXML file'],
          warnings: [],
        };
      }

      // Convert notes
      const { notes, errors, warnings } = await this.convertNotes(
        bassPart,
        metadata,
      );

      return {
        success: errors.length === 0,
        metadata,
        notes,
        errors,
        warnings,
      };
    } catch (error) {
      return {
        success: false,
        metadata: this.createEmptyMetadata(),
        notes: [],
        errors: [
          `Failed to parse MusicXML: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ],
        warnings: [],
      };
    }
  }

  /**
   * Convert parsed MusicXML to Exercise format
   */
  convertToExercise(
    conversionResult: MusicXMLConversionResult,
  ): Exercise | null {
    if (!conversionResult.success || conversionResult.notes.length === 0) {
      return null;
    }

    const { metadata, notes } = conversionResult;

    return {
      id: this.generateExerciseId(),
      title: metadata.title || 'Imported MusicXML',
      difficulty: this.determineDifficulty(notes),
      bpm: metadata.tempo || 120,
      key: metadata.key || 'C',
      timeSignature: metadata.timeSignature || { numerator: 4, denominator: 4 },
      notes,
      duration: metadata.totalDuration,
      description: `Imported from MusicXML${metadata.composer ? ` by ${metadata.composer}` : ''}`,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by: 'system',
    };
  }

  /**
   * Normalize parsed XML structure for consistent processing
   */
  private normalizeMusicXML(parsedXML: any): MusicXMLDocument {
    // Handle both score-partwise and score-timewise formats
    if (parsedXML['score-partwise']) {
      return { scorePartwise: parsedXML['score-partwise'] };
    } else if (parsedXML['score-timewise']) {
      return { scoreTimewise: parsedXML['score-timewise'] };
    } else {
      throw new Error(
        'Invalid MusicXML format: Missing score-partwise or score-timewise root element',
      );
    }
  }

  /**
   * Extract metadata from MusicXML document
   */
  private extractMetadata(musicXML: MusicXMLDocument): MusicXMLMetadata {
    const score = musicXML.scorePartwise || musicXML.scoreTimewise;
    if (!score) {
      return this.createEmptyMetadata();
    }

    const work = score.work;
    const identification = score.identification;
    const partList = score.partList;

    // Extract basic metadata
    const title = work?.workTitle || 'Untitled';
    const composer = identification?.creator?.find(
      (c) => c.type === 'composer',
    )?.text;
    const arranger = identification?.creator?.find(
      (c) => c.type === 'arranger',
    )?.text;

    // Get first part to extract musical properties
    const firstPart = musicXML.scorePartwise?.part?.[0];
    const firstMeasure = firstPart?.measure?.[0];
    const attributes = firstMeasure?.attributes?.[0];

    // Extract key signature
    const keySignature = attributes?.key?.[0];
    const key = this.convertKeySignature(keySignature);

    // Extract time signature
    const timeSignature = this.convertTimeSignature(attributes?.time?.[0]);

    // Extract tempo from first sound element or direction
    const tempo = this.extractTempo(firstMeasure);

    // Count measures and calculate duration
    const totalMeasures = this.countMeasures(musicXML);
    const totalDuration = this.estimateDuration(
      totalMeasures,
      timeSignature || { numerator: 4, denominator: 4 },
      tempo,
    );

    // Get instrument list
    const instruments = partList?.scorePart?.map((part) => part.partName) || [];

    // Find bass part ID
    const bassPartId = this.findBassPartId(partList);

    return {
      title,
      composer,
      arranger,
      key,
      timeSignature,
      tempo,
      totalMeasures,
      totalDuration,
      instruments,
      bassPartId,
    };
  }

  /**
   * Find the bass part in the MusicXML document
   */
  private findBassPart(musicXML: MusicXMLDocument): Part | null {
    const score = musicXML.scorePartwise;
    if (!score?.part) return null;

    // First, try to find part by ID if we detected a bass part
    const metadata = this.extractMetadata(musicXML);
    if (metadata.bassPartId) {
      const bassPart = score.part.find(
        (part) => part.id === metadata.bassPartId,
      );
      if (bassPart) return bassPart;
    }

    // Fallback: use the first part (assume it's bass for now)
    return score.part[0] || null;
  }

  /**
   * Convert MusicXML notes to ExerciseNote format
   */
  private async convertNotes(
    part: Part,
    metadata: MusicXMLMetadata,
  ): Promise<{
    notes: ExerciseNote[];
    errors: string[];
    warnings: string[];
  }> {
    const notes: ExerciseNote[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];

    let currentDivisions = 1;
    let currentKey = metadata.key || 'C';
    let currentTimeSignature = metadata.timeSignature || {
      numerator: 4,
      denominator: 4,
    };

    // Process each measure
    for (
      let measureIndex = 0;
      measureIndex < part.measure.length;
      measureIndex++
    ) {
      const measure = part.measure[measureIndex];
      const measureNumber = parseInt(measure.number) || measureIndex + 1;

      // Update musical context from attributes
      const attributes = measure.attributes?.[0];
      if (attributes) {
        if (attributes.divisions) {
          currentDivisions = attributes.divisions;
        }
        if (attributes.key?.[0]) {
          currentKey =
            this.convertKeySignature(attributes.key[0]) || currentKey;
        }
        if (attributes.time?.[0]) {
          currentTimeSignature =
            this.convertTimeSignature(attributes.time[0]) ||
            currentTimeSignature;
        }
      }

      // Process notes in measure
      if (measure.note) {
        let currentBeat = 1;
        const currentSubdivision = 0;

        for (const note of measure.note) {
          try {
            // Skip grace notes and other special cases for now
            if (note.grace || note.cue) {
              warnings.push(
                `Skipping grace/cue note in measure ${measureNumber}`,
              );
              continue;
            }

            // Convert note
            const exerciseNote = this.convertNote(
              note,
              measureNumber,
              currentBeat,
              currentSubdivision,
              currentDivisions,
              currentTimeSignature,
              notes.length,
            );

            if (exerciseNote) {
              notes.push(exerciseNote);

              // Update position for next note (simplified - just increment beat)
              const noteDurationInBeats = this.calculateNoteDurationInBeats(
                note.duration,
                currentDivisions,
                currentTimeSignature,
              );
              currentBeat += noteDurationInBeats;
              if (currentBeat > currentTimeSignature.numerator) {
                currentBeat = 1;
                // Note: This is a simplified approach, real implementation would handle measure overflow
              }
            }
          } catch (error) {
            errors.push(
              `Error processing note in measure ${measureNumber}: ${error instanceof Error ? error.message : 'Unknown error'}`,
            );
          }
        }
      }
    }

    return { notes, errors, warnings };
  }

  /**
   * Convert a single MusicXML note to ExerciseNote
   */
  private convertNote(
    note: Note,
    measure: number,
    beat: number,
    subdivision: number,
    divisions: number,
    timeSignature: TimeSignature,
    noteIndex: number,
  ): ExerciseNote | null {
    // Skip rests
    if (note.rest) {
      return null;
    }

    // Calculate position
    const position: MusicalPosition = { measure, beat, subdivision };

    // Convert duration
    const duration = this.convertNoteDuration(note.type, note.dot?.length || 0);

    // Determine fret and string
    let fret: number;
    let string: 1 | 2 | 3 | 4 | 5 | 6;
    let noteName: string;

    if (note.fret !== undefined && note.string !== undefined) {
      // Use tablature if available
      fret = note.fret;
      string = this.validateStringNumber(note.string);
      noteName = this.calculateNoteFromTab(string, fret);
    } else if (note.pitch) {
      // Calculate from pitch
      const result = this.calculateTabFromPitch(note.pitch);
      if (!result) {
        throw new Error(
          `Cannot map pitch ${note.pitch.step}${note.pitch.octave} to bass tablature`,
        );
      }
      fret = result.fret;
      string = result.string;
      noteName = this.formatNoteName(note.pitch);
    } else {
      throw new Error('Note has neither pitch nor tablature information');
    }

    // Extract techniques
    const techniques = this.extractTechniques(note);

    // Generate note
    return {
      id: `imported-${noteIndex}`,
      string,
      fret,
      note: noteName,
      color: this.config.defaultColor,
      duration,
      position,
      techniques: techniques.length > 0 ? techniques : undefined,
      // Convert timestamp for backward compatibility
      timestamp: MusicalTimeConverter.positionToMs(
        position,
        timeSignature,
        120,
      ), // Use default BPM for now
      duration_ms: MusicalTimeConverter.durationToMs(duration, 120), // Use default BPM for now
    };
  }

  /**
   * Calculate fret and string from pitch
   */
  private calculateTabFromPitch(
    pitch: Pitch,
  ): { fret: number; string: 1 | 2 | 3 | 4 | 5 | 6 } | null {
    const targetMidiNote = this.pitchToMidiNote(pitch);

    // Try each string to find the best fit
    for (const bassString of this.config.tuning) {
      const openMidiNote = this.pitchToMidiNote(bassString.openPitch);
      const fret = targetMidiNote - openMidiNote;

      // Check if fret is within playable range
      if (fret >= 0 && fret <= this.config.maxFret) {
        return { fret, string: bassString.stringNumber };
      }
    }

    return null; // Cannot be played on this bass tuning
  }

  /**
   * Calculate note name from tablature
   */
  private calculateNoteFromTab(
    string: 1 | 2 | 3 | 4 | 5 | 6,
    fret: number,
  ): string {
    const bassString = this.config.tuning.find(
      (s) => s.stringNumber === string,
    );
    if (!bassString) {
      throw new Error(`Invalid string number: ${string}`);
    }

    const openMidiNote = this.pitchToMidiNote(bassString.openPitch);
    const targetMidiNote = openMidiNote + fret;

    return this.midiNoteToNoteName(targetMidiNote);
  }

  /**
   * Convert pitch to MIDI note number
   */
  private pitchToMidiNote(pitch: Pitch): number {
    const noteNumbers: Record<string, number> = {
      C: 0,
      D: 2,
      E: 4,
      F: 5,
      G: 7,
      A: 9,
      B: 11,
    };

    const baseNote = noteNumbers[pitch.step];
    const octave = pitch.octave;
    const alter = pitch.alter || 0;

    return (octave + 1) * 12 + baseNote + alter;
  }

  /**
   * Convert MIDI note number to note name
   */
  private midiNoteToNoteName(midiNote: number): string {
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
    const noteIndex = midiNote % 12;
    return noteNames[noteIndex];
  }

  /**
   * Format pitch as note name
   */
  private formatNoteName(pitch: Pitch): string {
    let noteName = pitch.step;

    if (pitch.alter) {
      if (pitch.alter > 0) {
        noteName += '#'.repeat(pitch.alter);
      } else {
        noteName += 'b'.repeat(Math.abs(pitch.alter));
      }
    }

    return noteName;
  }

  /**
   * Extract techniques from MusicXML note
   */
  private extractTechniques(note: Note): TechniqueType[] {
    const techniques: TechniqueType[] = [];

    // Technical elements
    if (note.technical) {
      for (const tech of note.technical) {
        if (tech.hammerOn) techniques.push('hammer_on');
        if (tech.pullOff) techniques.push('pull_off');
        if (tech.bend) techniques.push('bend');
        if (tech.snapPizzicato) techniques.push('slap');
        if (tech.harmonic) techniques.push('harmonic');
        if (tech.tap) techniques.push('tap');
      }
    }

    // Articulations
    if (note.articulations && this.config.convertArticulations) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for (const _art of note.articulations) {
        // Note: Articulations like accent, staccato, tenuto are not in current TechniqueType
        // These would need to be added to the TechniqueType enum if needed
      }
    }

    return techniques;
  }

  /**
   * Convert MusicXML note type to NoteDuration
   */
  private convertNoteDuration(noteType?: string, dotCount = 0): NoteDuration {
    const baseDurations: Record<string, NoteDuration> = {
      whole: 'whole',
      half: 'half',
      quarter: 'quarter',
      eighth: 'eighth',
      '16th': 'sixteenth',
      '32nd': 'thirty-second',
      '64th': 'sixty-fourth',
    };

    const baseDuration = baseDurations[noteType || 'quarter'] || 'quarter';

    // Handle dots
    if (dotCount === 1) {
      const dottedDurations: Record<NoteDuration, NoteDuration> = {
        whole: 'dotted-whole',
        half: 'dotted-half',
        quarter: 'dotted-quarter',
        eighth: 'dotted-eighth',
        sixteenth: 'dotted-sixteenth',
        'thirty-second': 'thirty-second', // No dotted version
        'sixty-fourth': 'sixty-fourth', // No dotted version
        // Add other mappings as needed
        'dotted-whole': 'dotted-whole',
        'dotted-half': 'dotted-half',
        'dotted-quarter': 'dotted-quarter',
        'dotted-eighth': 'dotted-eighth',
        'dotted-sixteenth': 'dotted-sixteenth',
        'triplet-whole': 'triplet-whole',
        'triplet-half': 'triplet-half',
        'triplet-quarter': 'triplet-quarter',
        'triplet-eighth': 'triplet-eighth',
        'triplet-sixteenth': 'triplet-sixteenth',
        tied: 'tied',
      };
      return dottedDurations[baseDuration] || baseDuration;
    }

    return baseDuration;
  }

  /**
   * Calculate note duration in beats
   */
  private calculateNoteDurationInBeats(
    xmlDuration: number,
    divisions: number,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _timeSignature: TimeSignature,
  ): number {
    return xmlDuration / divisions;
  }

  /**
   * Validate and convert string number
   */
  private validateStringNumber(stringNum: number): 1 | 2 | 3 | 4 | 5 | 6 {
    if (stringNum >= 1 && stringNum <= 6) {
      return stringNum as 1 | 2 | 3 | 4 | 5 | 6;
    }
    throw new Error(`Invalid string number: ${stringNum}. Must be 1-6.`);
  }

  /**
   * Convert key signature from MusicXML
   */
  private convertKeySignature(key?: any): string | undefined {
    if (!key || key.fifths === undefined) return undefined;

    const keyMap: Record<number, string> = {
      0: 'C',
      1: 'G',
      2: 'D',
      3: 'A',
      4: 'E',
      5: 'B',
      6: 'F#',
      7: 'C#',
      [-1]: 'F',
      [-2]: 'Bb',
      [-3]: 'Eb',
      [-4]: 'Ab',
      [-5]: 'Db',
      [-6]: 'Gb',
      [-7]: 'Cb',
    };

    return keyMap[key.fifths] || 'C';
  }

  /**
   * Convert time signature from MusicXML
   */
  private convertTimeSignature(time?: any): TimeSignature | undefined {
    if (!time || !time.beats || !time.beatType) return undefined;

    return {
      numerator: parseInt(time.beats) || 4,
      denominator: parseInt(time.beatType) || 4,
    };
  }

  /**
   * Extract tempo from measure
   */
  private extractTempo(measure?: any): number | undefined {
    // Look for tempo in sound elements
    if (measure?.sound?.tempo) {
      return measure.sound.tempo;
    }

    // Look for metronome markings in directions
    if (measure?.direction) {
      for (const direction of measure.direction) {
        if (direction.directionType) {
          for (const dirType of direction.directionType) {
            if (dirType.metronome?.perMinute) {
              return dirType.metronome.perMinute;
            }
          }
        }
      }
    }

    return undefined;
  }

  /**
   * Count total measures in the document
   */
  private countMeasures(musicXML: MusicXMLDocument): number {
    const score = musicXML.scorePartwise;
    if (!score?.part?.[0]?.measure) return 0;
    return score.part[0].measure.length;
  }

  /**
   * Estimate total duration in milliseconds
   */
  private estimateDuration(
    measures: number,
    timeSignature: TimeSignature,
    tempo?: number,
  ): number {
    const bpm = tempo || 120;
    const beatsPerMeasure = timeSignature.numerator;
    const totalBeats = measures * beatsPerMeasure;
    return (totalBeats / bpm) * 60000; // Convert to milliseconds
  }

  /**
   * Find bass part ID from part list
   */
  private findBassPartId(partList?: any): string | undefined {
    if (!partList?.scorePart) return undefined;

    // Look for bass-related instrument names
    const bassKeywords = [
      'bass',
      'electric bass',
      'acoustic bass',
      'upright bass',
      'contrabass',
    ];

    for (const part of partList.scorePart) {
      const partName = part.partName?.toLowerCase() || '';
      const instrumentName =
        part.scoreInstrument?.[0]?.instrumentName?.toLowerCase() || '';

      if (
        bassKeywords.some(
          (keyword) =>
            partName.includes(keyword) || instrumentName.includes(keyword),
        )
      ) {
        return part.id;
      }
    }

    return undefined;
  }

  /**
   * Create empty metadata structure
   */
  private createEmptyMetadata(): MusicXMLMetadata {
    return {
      totalMeasures: 0,
      totalDuration: 0,
      instruments: [],
    };
  }

  /**
   * Generate unique exercise ID
   */
  private generateExerciseId(): string {
    return `musicxml-import-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Determine exercise difficulty based on notes
   */
  private determineDifficulty(notes: ExerciseNote[]): ExerciseDifficulty {
    // Simple heuristic based on fret range and techniques
    const maxFret = Math.max(...notes.map((n) => n.fret));
    const hasTechniques = notes.some(
      (n) => n.techniques && n.techniques.length > 0,
    );
    const noteCount = notes.length;

    if (maxFret <= 5 && !hasTechniques && noteCount <= 20) {
      return 'beginner';
    } else if (maxFret <= 12 && noteCount <= 50) {
      return 'intermediate';
    } else {
      return 'advanced';
    }
  }

  /**
   * Extract techniques focus from notes
   */
  private extractTechniquesFocus(notes: ExerciseNote[]): TechniqueType[] {
    const techniques = new Set<TechniqueType>();
    notes.forEach((note) => {
      note.techniques?.forEach((tech) => techniques.add(tech));
    });
    return Array.from(techniques);
  }

  /**
   * Generate practice points
   */
  private generatePracticePoints(notes: ExerciseNote[]): string[] {
    const points: string[] = [];

    const techniques = this.extractTechniquesFocus(notes);
    if (techniques.length > 0) {
      points.push(`Focus on techniques: ${techniques.join(', ')}`);
    }

    const maxFret = Math.max(...notes.map((n) => n.fret));
    if (maxFret > 12) {
      points.push('Practice upper fret positions');
    }

    const strings = new Set(notes.map((n) => n.string));
    if (strings.size > 2) {
      points.push('Work on string crossing');
    }

    return points.length > 0
      ? points
      : ['Practice slowly and focus on clean note transitions'];
  }

  /**
   * Map difficulty to skill level
   */
  private mapDifficultyToSkillLevel(difficulty: ExerciseDifficulty): number {
    const mapping: Record<ExerciseDifficulty, number> = {
      beginner: 1,
      intermediate: 2,
      advanced: 3,
      expert: 4,
    };
    return mapping[difficulty];
  }
}
