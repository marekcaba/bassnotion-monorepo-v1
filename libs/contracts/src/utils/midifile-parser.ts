/**
 * MIDI File Parser
 * Bridges MIDI file parsing with existing MidiParserProcessor infrastructure
 */

import pkg from '@tonejs/midi';
const Midi = (pkg as any).Midi || (pkg as any).default || pkg;
import type {
  MIDIFileParsingConfig,
  MIDIFileMetadata,
  MIDIFileParsingResult,
  MIDITrackData,
  MIDIFileNote,
  MIDIControlChange,
  TempoEvent,
  TimeSignatureEvent,
  KeySignatureEvent,
  BassMIDIConversionConfig,
  ParsedMidiData,
  ParsedTrack,
  ArticulationType,
} from '../types/midifile.js';
import { TrackType } from '../types/midifile.js';
import {
  DEFAULT_MIDI_FILE_CONFIG,
  DEFAULT_BASS_CONVERSION_CONFIG,
} from '../types/midifile.js';
import type {
  Exercise,
  ExerciseNote,
  NoteDuration,
  TechniqueType,
} from '../types/exercise.js';

/**
 * MIDI File Parser Class
 * Handles MIDI file parsing and conversion to Exercise format
 */
export class MIDIFileParser {
  private config: MIDIFileParsingConfig;
  private bassConfig: BassMIDIConversionConfig;

  constructor(
    config: MIDIFileParsingConfig = DEFAULT_MIDI_FILE_CONFIG,
    bassConfig: BassMIDIConversionConfig = DEFAULT_BASS_CONVERSION_CONFIG,
  ) {
    this.config = config;
    this.bassConfig = bassConfig;
  }

  /**
   * Parse MIDI file from ArrayBuffer
   */
  public async parseFile(
    fileBuffer: ArrayBuffer,
    filename: string,
  ): Promise<MIDIFileParsingResult> {
    const startTime = performance.now();
    const result: MIDIFileParsingResult = {
      success: false,
      metadata: this.createEmptyMetadata(filename),
      errors: [],
      warnings: [],
      conversionStats: {
        originalNotes: 0,
        convertedNotes: 0,
        droppedNotes: 0,
        quantizedNotes: 0,
        durationMs: 0,
      },
    };

    try {
      // Parse MIDI file directly with @tonejs/midi (no need for Uint8Array conversion)

      // Parse MIDI file with @tonejs/midi
      let parsedMidi: any;
      try {
        // Debug logging to understand the import structure
        console.log('Midi:', Midi);
        console.log('typeof Midi:', typeof Midi);
        console.log('Midi.constructor:', Midi.constructor);

        parsedMidi = new Midi(fileBuffer);
      } catch (parseError) {
        console.error('MIDI parsing error details:', {
          error: parseError,
          Midi,
          typeofMidi: typeof Midi,
          isFunction: typeof Midi === 'function',
        });
        result.errors.push(
          `MIDI parsing failed: ${parseError instanceof Error ? parseError.message : 'Unknown parsing error'}`,
        );
        return result;
      }

      if (!parsedMidi) {
        result.errors.push(
          'Failed to parse MIDI file - invalid format or corrupted file',
        );
        return result;
      }

      // Debug: Log the parsed MIDI structure
      console.log('Parsed MIDI structure:', {
        hasData: !!parsedMidi,
        hasTracks: !!parsedMidi.tracks,
        tracksLength: parsedMidi.tracks?.length,
        format: parsedMidi.header?.format,
        ticksPerQuarter: parsedMidi.header?.ticksPerQuarter,
        duration: parsedMidi.duration,
      });

      // Validate the parsed MIDI structure
      if (!parsedMidi.tracks) {
        result.errors.push('Invalid MIDI file - no tracks found');
        return result;
      }

      if (!Array.isArray(parsedMidi.tracks)) {
        result.errors.push(
          `Invalid MIDI file - tracks property is not an array (type: ${typeof parsedMidi.tracks})`,
        );
        return result;
      }

      if (parsedMidi.tracks.length === 0) {
        result.errors.push('Invalid MIDI file - no tracks in file');
        return result;
      }

      // Extract metadata
      result.metadata = this.extractMetadata(
        parsedMidi,
        filename,
        fileBuffer.byteLength,
      );

      // Process tracks
      const processedTracks = this.processTracks(parsedMidi);
      result.conversionStats.originalNotes =
        this.countTotalNotes(processedTracks);

      // Find bass track if requested
      if (this.config.bassDetection.enabled) {
        const bassTrack = this.findBassTrack(processedTracks);
        if (bassTrack) {
          result.bassTrack = bassTrack;

          // Convert to exercise if requested
          if (this.config.targetFormat === 'exercise') {
            result.exercise = this.convertToExercise(
              bassTrack,
              result.metadata,
            );
            result.conversionStats.convertedNotes =
              result.exercise.notes.length;
          }
        } else {
          result.warnings.push(
            'No bass track found - using track with lowest average pitch',
          );
          // Fallback: use track with lowest average pitch
          const fallbackTrack = this.findLowestPitchTrack(processedTracks);
          if (fallbackTrack) {
            result.bassTrack = fallbackTrack;
            if (this.config.targetFormat === 'exercise') {
              result.exercise = this.convertToExercise(
                fallbackTrack,
                result.metadata,
              );
              result.conversionStats.convertedNotes =
                result.exercise.notes.length;
            }
          }
        }
      }

      // Create full parsed data if requested
      if (this.config.targetFormat === 'full_analysis') {
        result.parsedData = this.createParsedMidiData(
          processedTracks,
          result.metadata,
        );
      }

      result.conversionStats.durationMs = performance.now() - startTime;
      result.success = true;
    } catch (error) {
      result.errors.push(
        `MIDI parsing failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    return result;
  }

  /**
   * Extract metadata from parsed MIDI
   */
  private extractMetadata(
    parsedMidi: any,
    filename: string,
    fileSize: number,
  ): MIDIFileMetadata {
    const metadata: MIDIFileMetadata = {
      filename,
      fileSize,
      format: `type${parsedMidi.header?.format || 0}` as
        | 'type0'
        | 'type1'
        | 'type2',
      trackCount: parsedMidi.tracks?.length || 0,
      division: parsedMidi.header?.ticksPerQuarter || 480,
      durationSeconds: parsedMidi.duration || 0,
      tempoMap: [],
      timeSignatureMap: [],
      keySignatureMap: [],
      originalChannels: [],
      instrumentMap: {},
    };

    // Extract tempo events from @tonejs/midi format
    metadata.tempoMap =
      parsedMidi.tempos?.map((tempo: any) => ({
        tick: tempo.ticks,
        time: tempo.time,
        bpm: tempo.bpm,
        microsecondsPerQuarter: Math.round(60000000 / tempo.bpm),
      })) || [];

    // Extract time signature events
    metadata.timeSignatureMap =
      parsedMidi.timeSignatures?.map((ts: any) => ({
        tick: ts.ticks,
        time: ts.time,
        numerator: ts.numerator,
        denominator: ts.denominator,
        clocksPerClick: 24,
        notated32ndsPerQuarter: 8,
      })) || [];

    // Extract key signature events
    metadata.keySignatureMap =
      parsedMidi.keySignatures?.map((ks: any) => ({
        tick: ks.ticks,
        time: ks.time,
        key: ks.key,
        mode: ks.scale === 'minor' ? 'minor' : 'major',
        sharpsFlats: this.getSharpsFlatFromKey(ks.key, ks.scale === 'major'),
      })) || [];

    // Extract channels and instruments
    metadata.originalChannels = this.extractUsedChannels(parsedMidi);
    metadata.instrumentMap = this.extractInstrumentMap(parsedMidi);

    return metadata;
  }

  /**
   * Process all tracks from parsed MIDI
   */
  private processTracks(parsedMidi: any): MIDITrackData[] {
    const tracks: MIDITrackData[] = [];

    if (!parsedMidi.tracks || !Array.isArray(parsedMidi.tracks)) {
      console.warn('processTracks: Invalid tracks structure', {
        hasTracks: !!parsedMidi.tracks,
        isArray: Array.isArray(parsedMidi.tracks),
        type: typeof parsedMidi.tracks,
      });
      return tracks;
    }

    try {
      parsedMidi.tracks.forEach((track: any, index: number) => {
        try {
          const trackData = this.processTonejsTrack(track, index);
          if (trackData && trackData.notes.length > 0) {
            tracks.push(trackData);
          }
        } catch (trackError) {
          console.warn(`Error processing track ${index}:`, trackError);
          // Continue processing other tracks
        }
      });
    } catch (error) {
      console.error('Error in processTracks forEach:', error);
      throw new Error(
        `Error processing MIDI tracks: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }

    return tracks;
  }

  /**
   * Process individual track from @tonejs/midi
   */
  private processTonejsTrack(
    track: any,
    trackIndex: number,
  ): MIDITrackData | null {
    const notes: MIDIFileNote[] = [];
    const controlChanges: MIDIControlChange[] = [];
    const trackName = track.name || `Track ${trackIndex + 1}`;
    const mainChannel = track.channel || 0;

    // Convert @tonejs/midi notes to our format
    track.notes?.forEach((note: any) => {
      const midiNote: MIDIFileNote = {
        pitch: note.midi,
        velocity: Math.round(note.velocity * 127), // @tonejs/midi uses 0-1, we use 0-127
        startTick: note.ticks,
        endTick: note.ticks + note.durationTicks,
        startTime: note.time,
        duration: note.duration,
        channel: track.channel || 0,
      };

      // Add bass-specific calculations
      this.calculateBassPosition(midiNote);
      notes.push(midiNote);
    });

    // Convert control changes
    Object.entries(track.controlChanges || {}).forEach(
      ([controllerNumber, changes]) => {
        if (Array.isArray(changes)) {
          changes.forEach((change: any) => {
            controlChanges.push({
              tick: change.ticks,
              time: change.time,
              channel: track.channel || 0,
              controller: parseInt(controllerNumber),
              value: Math.round(change.value * 127), // @tonejs/midi uses 0-1, we use 0-127
              controllerName: this.getControllerName(
                parseInt(controllerNumber),
              ),
            });
          });
        }
      },
    );

    if (notes.length === 0) {
      return null;
    }

    // Calculate characteristics
    const characteristics = this.calculateTrackCharacteristics(notes);

    return {
      trackIndex,
      channel: mainChannel,
      name: trackName,
      instrument:
        track.instrument?.name ||
        this.getInstrumentName(track.instrument?.number || 0),
      notes: notes.sort((a, b) => a.startTick - b.startTick),
      controlChanges: controlChanges.sort((a, b) => a.tick - b.tick),
      confidence: this.calculateBassConfidence(notes, characteristics),
      characteristics,
    };
  }

  /**
   * Process individual track (legacy - keeping for compatibility)
   */
  private processTrack(track: any, trackIndex: number): MIDITrackData | null {
    if (!track.events || !Array.isArray(track.events)) {
      return null;
    }

    const notes: MIDIFileNote[] = [];
    const controlChanges: MIDIControlChange[] = [];
    let trackName = `Track ${trackIndex + 1}`;
    let mainChannel = 0;
    const channels = new Set<number>();

    // Track note-on events to match with note-off
    const activeNotes = new Map<
      string,
      { note: MIDIFileNote; startTick: number }
    >();

    let currentTick = 0;

    // Process events with error handling
    try {
      if (!track.events || !Array.isArray(track.events)) {
        console.warn(`Track ${trackIndex} has invalid events structure`);
        return null;
      }

      track.events.forEach((event: any) => {
        try {
          currentTick += event.deltaTime || 0;

          switch (event.type) {
            case 'noteOn':
              if (event.velocity > 0) {
                const noteKey = `${event.noteNumber}_${event.channel}`;
                const note: MIDIFileNote = {
                  pitch: event.noteNumber,
                  velocity: event.velocity,
                  startTick: currentTick,
                  endTick: currentTick, // Will be updated on noteOff
                  startTime: this.ticksToSeconds(currentTick),
                  duration: 0, // Will be calculated on noteOff
                  channel: event.channel || 0,
                };
                activeNotes.set(noteKey, { note, startTick: currentTick });
                channels.add(event.channel || 0);
              }
              break;

            case 'noteOff': {
              const noteOffKey = `${event.noteNumber}_${event.channel}`;
              const activeNote = activeNotes.get(noteOffKey);
              if (activeNote) {
                activeNote.note.endTick = currentTick;
                activeNote.note.duration = this.ticksToSeconds(
                  currentTick - activeNote.startTick,
                );

                // Add bass-specific calculations
                this.calculateBassPosition(activeNote.note);

                notes.push(activeNote.note);
                activeNotes.delete(noteOffKey);
              }
              break;
            }

            case 'controlChange':
              controlChanges.push({
                tick: currentTick,
                time: this.ticksToSeconds(currentTick),
                channel: event.channel || 0,
                controller: event.controllerType || 0,
                value: event.value || 0,
                controllerName: this.getControllerName(event.controllerType),
              });
              channels.add(event.channel || 0);
              break;

            case 'trackName':
              if (event.text) {
                trackName = event.text;
              }
              break;

            case 'instrumentName':
              if (event.text) {
                trackName = `${trackName} (${event.text})`;
              }
              break;
          }
        } catch (eventError) {
          console.warn(
            `Error processing event in track ${trackIndex}:`,
            eventError,
          );
          // Continue processing other events
        }
      });
    } catch (trackProcessingError) {
      console.error(
        `Error processing track ${trackIndex}:`,
        trackProcessingError,
      );
      return null;
    }

    // Close any remaining active notes
    activeNotes.forEach(({ note }) => {
      note.endTick = currentTick;
      note.duration = this.ticksToSeconds(currentTick - note.startTick);
      this.calculateBassPosition(note);
      notes.push(note);
    });

    if (notes.length === 0) {
      return null;
    }

    // Determine main channel (most used)
    const channelCounts = new Map<number, number>();
    notes.forEach((note) => {
      channelCounts.set(
        note.channel,
        (channelCounts.get(note.channel) || 0) + 1,
      );
    });
    mainChannel = Array.from(channelCounts.entries()).reduce((a, b) =>
      a[1] > b[1] ? a : b,
    )[0];

    // Calculate characteristics
    const characteristics = this.calculateTrackCharacteristics(notes);

    return {
      trackIndex,
      channel: mainChannel,
      name: trackName,
      instrument: this.getInstrumentName(mainChannel),
      notes: notes.sort((a, b) => a.startTick - b.startTick),
      controlChanges: controlChanges.sort((a, b) => a.tick - b.tick),
      confidence: this.calculateBassConfidence(notes, characteristics),
      characteristics,
    };
  }

  /**
   * Calculate bass fret/string position for a note
   */
  private calculateBassPosition(note: MIDIFileNote): void {
    // Find the best string/fret combination for this note
    let bestString = 1;
    let bestFret = 99;

    for (const string of this.bassConfig.tuning) {
      const fret = note.pitch - string.openPitch;
      if (fret >= 0 && fret <= this.bassConfig.maxFret && fret < bestFret) {
        bestString = string.stringNumber;
        bestFret = fret;
      }
    }

    if (bestFret <= this.bassConfig.maxFret) {
      note.bassString = bestString;
      note.bassFret = bestFret;
    }
  }

  /**
   * Find the most likely bass track
   */
  private findBassTrack(tracks: MIDITrackData[]): MIDITrackData | null {
    if (tracks.length === 0) return null;

    // Score each track for "bassiness"
    const scoredTracks = tracks.map((track) => ({
      track,
      score: this.scoreBassTrack(track),
    }));

    // Sort by score (highest first)
    scoredTracks.sort((a, b) => b.score - a.score);

    const bestTrack = scoredTracks[0];
    return bestTrack && bestTrack.score > 0.3 ? bestTrack.track : null;
  }

  /**
   * Score a track for how likely it is to be a bass track
   */
  private scoreBassTrack(track: MIDITrackData): number {
    let score = 0;

    // Channel 2 is often bass in MIDI files
    if (track.channel === 1) score += 0.3;

    // Name contains "bass"
    if (track.name.toLowerCase().includes('bass')) score += 0.4;

    // Pitch range
    const avgPitch = track.characteristics.averagePitch;
    if (avgPitch >= 23 && avgPitch <= 67) score += 0.4; // Bass range

    // Lower pitches get higher score
    const pitchScore = Math.max(0, (67 - avgPitch) / 44); // Normalize to 0-1
    score += pitchScore * 0.3;

    // Mostly single notes (not chords)
    const simultaneousThreshold = 50; // ms
    let singleNoteCount = 0;
    track.notes.forEach((note) => {
      const simultaneousNotes = track.notes.filter(
        (n) =>
          Math.abs(n.startTime - note.startTime) < simultaneousThreshold / 1000,
      ).length;
      if (simultaneousNotes === 1) singleNoteCount++;
    });
    const singleNoteRatio = singleNoteCount / track.notes.length;
    score += singleNoteRatio * 0.2;

    return Math.min(1, score);
  }

  /**
   * Convert MIDI track to Exercise format
   */
  private convertToExercise(
    track: MIDITrackData,
    metadata: MIDIFileMetadata,
  ): Exercise {
    // Get tempo from first tempo event or default
    const initialTempo =
      metadata.tempoMap.length > 0 ? metadata.tempoMap[0].bpm : 120;

    const notes: ExerciseNote[] = track.notes.map((midiNote, index) => {
      // Convert MIDI note to note name
      const noteName = this.midiNoteToNoteName(midiNote.pitch);

      // Calculate timing in BassNotion format
      const position = this.calculateMusicalTiming(
        midiNote.startTick,
        metadata.division,
      );

      // Calculate note duration from ticks for more precision
      const durationInTicks = midiNote.endTick - midiNote.startTick;
      const duration = this.ticksToNoteDuration(
        durationInTicks,
        metadata.division,
      );

      const exerciseNote: ExerciseNote = {
        id: `note-${index}`,
        note: noteName,
        fret: midiNote.bassFret || 0,
        string: (midiNote.bassString || 1) as 1 | 2 | 3 | 4 | 5 | 6,
        color: 'blue', // Default color
        duration,
        position,
        techniques: midiNote.articulation
          ? [this.articulationToTechnique(midiNote.articulation)]
          : undefined,
      };

      return exerciseNote;
    });

    // Get time signature from first event or default
    const timeSignature =
      metadata.timeSignatureMap.length > 0
        ? {
            numerator: metadata.timeSignatureMap[0].numerator,
            denominator: metadata.timeSignatureMap[0].denominator,
          }
        : { numerator: 4, denominator: 4 };

    return {
      id: `exercise-${Date.now()}`,
      title: `Bass Exercise from ${metadata.filename}`,
      description: `Converted from MIDI file: ${track.name}`,
      notes,
      duration: Math.round(metadata.durationSeconds * 1000), // Convert to milliseconds
      bpm: Math.round(initialTempo),
      timeSignature,
      key:
        metadata.keySignatureMap.length > 0
          ? metadata.keySignatureMap[0].key
          : 'C',
      difficulty: this.calculateDifficulty(notes),
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  // Helper methods

  private createEmptyMetadata(filename: string): MIDIFileMetadata {
    return {
      filename,
      fileSize: 0,
      format: 'type1',
      trackCount: 0,
      division: 480,
      durationSeconds: 0,
      tempoMap: [],
      timeSignatureMap: [],
      keySignatureMap: [],
      originalChannels: [],
      instrumentMap: {},
    };
  }

  private extractTempoEvents(parsedMidi: any): TempoEvent[] {
    return (
      parsedMidi.tempos?.map((tempo: any) => ({
        tick: tempo.ticks,
        time: tempo.time,
        bpm: tempo.bpm,
        microsecondsPerQuarter: Math.round(60000000 / tempo.bpm),
      })) || []
    );
  }

  private extractTimeSignatureEvents(parsedMidi: any): TimeSignatureEvent[] {
    return (
      parsedMidi.timeSignatures?.map((ts: any) => ({
        tick: ts.ticks,
        time: ts.time,
        numerator: ts.numerator,
        denominator: ts.denominator,
        clocksPerClick: 24,
        notated32ndsPerQuarter: 8,
      })) || []
    );
  }

  private extractKeySignatureEvents(parsedMidi: any): KeySignatureEvent[] {
    return (
      parsedMidi.keySignatures?.map((ks: any) => ({
        tick: ks.ticks,
        time: ks.time,
        key: ks.key,
        mode: ks.scale === 'minor' ? 'minor' : 'major',
        sharpsFlats: this.getSharpsFlatFromKey(ks.key, ks.scale === 'major'),
      })) || []
    );
  }

  private calculateDuration(parsedMidi: any): number {
    return parsedMidi.duration || 0;
  }

  private extractUsedChannels(parsedMidi: any): number[] {
    const channels = new Set<number>();

    parsedMidi.tracks?.forEach((track: any) => {
      if (track.channel !== undefined) {
        channels.add(track.channel);
      }
    });

    return Array.from(channels).sort();
  }

  private extractInstrumentMap(parsedMidi: any): Record<number, string> {
    const instrumentMap: Record<number, string> = {};

    parsedMidi.tracks?.forEach((track: any) => {
      if (track.channel !== undefined && track.instrument) {
        instrumentMap[track.channel] =
          track.instrument.name ||
          this.getInstrumentName(track.instrument.number || 0);
      }
    });

    return instrumentMap;
  }

  private ticksToSeconds(ticks: number, bpm = 120, division = 480): number {
    const microsecondsPerBeat = 60000000 / bpm;
    const microsecondsPerTick = microsecondsPerBeat / division;
    return (ticks * microsecondsPerTick) / 1000000;
  }

  private calculateTrackCharacteristics(notes: MIDIFileNote[]) {
    if (notes.length === 0) {
      return {
        averagePitch: 0,
        pitchRange: { min: 0, max: 0 },
        noteCount: 0,
        rhythmComplexity: 0,
        playingStyle: 'unknown' as const,
      };
    }

    const pitches = notes.map((n) => n.pitch);
    const averagePitch =
      pitches.reduce((sum, p) => sum + p, 0) / pitches.length;
    const pitchRange = { min: Math.min(...pitches), max: Math.max(...pitches) };

    // Simple rhythm complexity based on timing variations
    const timings = notes.map((n) => n.startTime);
    const intervals = timings.slice(1).map((t, i) => t - timings[i]);
    const rhythmComplexity =
      intervals.length > 0
        ? Math.min(1, this.calculateVariance(intervals) / 0.5)
        : 0;

    // Detect playing style based on note characteristics
    const averageVelocity =
      notes.reduce((sum, n) => sum + n.velocity, 0) / notes.length;
    let playingStyle: 'fingerstyle' | 'pick' | 'slap' | 'unknown' = 'unknown';

    if (averageVelocity > 100) {
      playingStyle = 'slap';
    } else if (rhythmComplexity > 0.7) {
      playingStyle = 'fingerstyle';
    } else if (averageVelocity > 70) {
      playingStyle = 'pick';
    } else {
      playingStyle = 'fingerstyle';
    }

    return {
      averagePitch,
      pitchRange,
      noteCount: notes.length,
      rhythmComplexity,
      playingStyle,
    };
  }

  private calculateBassConfidence(
    notes: MIDIFileNote[],
    characteristics: any,
  ): number {
    let confidence = 0;

    // Pitch range scoring
    if (
      characteristics.averagePitch >= 23 &&
      characteristics.averagePitch <= 67
    ) {
      confidence += 0.4;
    }

    // Note count (bass lines usually have moderate note density)
    if (characteristics.noteCount > 10 && characteristics.noteCount < 500) {
      confidence += 0.2;
    }

    // Single notes vs chords
    const simultaneousThreshold = 0.05; // 50ms
    let singleNoteCount = 0;
    notes.forEach((note) => {
      const simultaneous = notes.filter(
        (n) => Math.abs(n.startTime - note.startTime) < simultaneousThreshold,
      ).length;
      if (simultaneous === 1) singleNoteCount++;
    });

    const singleNoteRatio = singleNoteCount / notes.length;
    confidence += singleNoteRatio * 0.4;

    return Math.min(1, confidence);
  }

  private countTotalNotes(tracks: MIDITrackData[]): number {
    return tracks.reduce((total, track) => total + track.notes.length, 0);
  }

  private findLowestPitchTrack(tracks: MIDITrackData[]): MIDITrackData | null {
    if (tracks.length === 0) return null;

    return tracks.reduce((lowest, track) =>
      track.characteristics.averagePitch < lowest.characteristics.averagePitch
        ? track
        : lowest,
    );
  }

  private convertToParseTrack(track: MIDITrackData): ParsedTrack {
    return {
      id: `track-${track.trackIndex}`,
      name: track.name,
      channel: track.channel,
      type: track.confidence > 0.5 ? TrackType.BASS : TrackType.OTHER,
      notes: track.notes.map((note) => ({
        note: this.midiNoteToNoteName(note.pitch),
        octave: Math.floor(note.pitch / 12) - 1,
        velocity: note.velocity,
        duration: note.duration,
        startTime: note.startTime,
        endTime: note.startTime + note.duration,
        articulation: note.articulation,
      })),
      controllers: [],
      articulations: [],
      confidence: {
        overall: track.confidence,
        byFeature: {
          channelAnalysis: track.confidence,
          nameAnalysis: track.confidence,
          noteRangeAnalysis: track.confidence,
          patternAnalysis: track.confidence,
        },
      },
    };
  }

  private createParsedMidiData(
    tracks: MIDITrackData[],
    metadata: MIDIFileMetadata,
  ): ParsedMidiData {
    // Convert MIDITrackData to ParsedTrack
    const parsedTracks = tracks.map((track) => this.convertToParseTrack(track));

    return {
      tracks: {
        bass: parsedTracks.filter((t) => t.confidence.overall > 0.5),
        drums: [],
        chords: [],
        melody: parsedTracks.filter((t) => t.confidence.overall <= 0.5),
        other: [],
      },
      metadata: {
        trackCount: metadata.trackCount,
        totalNotes: this.countTotalNotes(tracks),
        duration: metadata.durationSeconds,
        timeSignature: metadata.timeSignatureMap[0]
          ? {
              numerator: metadata.timeSignatureMap[0].numerator,
              denominator: metadata.timeSignatureMap[0].denominator,
            }
          : { numerator: 4, denominator: 4 },
        tempo: metadata.tempoMap[0]?.bpm || 120,
        key: metadata.keySignatureMap[0]?.key || 'C',
      },
      expression: { vibrato: 0, tremolo: 0, bend: 0, trill: 0 },
      performance: {
        timing: { accuracy: 0.8, consistency: 0.8 },
        dynamics: { range: 0.6, consistency: 0.7 },
        articulation: { variety: 0.5, consistency: 0.8 },
      },
      musicTheory: {
        keySignature: {
          key: metadata.keySignatureMap[0]?.key || 'C',
          mode: metadata.keySignatureMap[0]?.mode || 'major',
          confidence: 0.8,
          sharpsFlats: metadata.keySignatureMap[0]?.sharpsFlats || 0,
        },
        detectedChords: [],
        scaleAnalysis: {
          primaryScale: 'C major',
          alternativeScales: [],
          modeUsage: {},
          chromaticUsage: 0,
        },
        harmonicProgression: {
          romanNumerals: [],
          functionalAnalysis: [],
          cadences: [],
          modulations: [],
        },
        musicalContext: {
          genre: 'unknown',
          style: 'unknown',
          complexity: 0.5,
          jazzContent: 0,
          classicalContent: 0,
        },
      },
    };
  }

  // Utility methods

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
    const octave = Math.floor(midiNote / 12) - 1;
    const noteName = noteNames[midiNote % 12];
    return `${noteName}${octave}`;
  }

  private midiDurationToNoteDuration(
    durationSeconds: number,
    bpm = 120,
  ): NoteDuration {
    // Calculate duration relative to a quarter note at the given BPM
    const quarterNoteDuration = 60 / bpm; // Duration of a quarter note in seconds
    const relativeLength = durationSeconds / quarterNoteDuration;

    // Map relative lengths to note durations with some tolerance
    if (relativeLength >= 3.5) return 'whole';
    if (relativeLength >= 1.75) return 'half';
    if (relativeLength >= 0.875) return 'quarter';
    if (relativeLength >= 0.375) return 'eighth';
    if (relativeLength >= 0.1875) return 'sixteenth';
    return 'thirty-second';
  }

  private ticksToNoteDuration(
    durationTicks: number,
    division: number,
  ): NoteDuration {
    // Calculate duration as a fraction of a quarter note
    // division = ticks per quarter note (from MIDI header)
    const relativeLength = durationTicks / division;

    // Map to note durations with tolerance for quantization errors
    if (relativeLength >= 3.75) return 'whole'; // 4 quarter notes
    if (relativeLength >= 1.875) return 'half'; // 2 quarter notes
    if (relativeLength >= 0.9375) return 'quarter'; // 1 quarter note
    if (relativeLength >= 0.46875) return 'eighth'; // 0.5 quarter note
    if (relativeLength >= 0.234375) return 'sixteenth'; // 0.25 quarter note
    return 'thirty-second'; // 0.125 quarter note or less
  }

  private calculateMusicalTiming(startTick: number, division: number) {
    // Convert to quarter note positions
    const quarterNotes = startTick / division;
    const measure = Math.floor(quarterNotes / 4) + 1;
    const beat = Math.floor(quarterNotes % 4) + 1;
    const subdivision = Math.round((quarterNotes % 1) * 16); // 16th note subdivisions

    return {
      measure,
      beat,
      subdivision,
      ticks: startTick,
    };
  }

  private articulationToTechnique(
    articulation: ArticulationType,
  ): TechniqueType {
    switch (articulation) {
      case 'HAMMER_ON':
        return 'hammer_on';
      case 'PULL_OFF':
        return 'pull_off';
      case 'SLIDE':
        return 'slide_up';
      default:
        return 'slap'; // Default fallback
    }
  }

  private calculateDifficulty(
    notes: ExerciseNote[],
  ): 'beginner' | 'intermediate' | 'advanced' {
    if (notes.length === 0) return 'beginner';

    let difficultyScore = 0;

    // Note density
    difficultyScore += Math.min(1, notes.length / 100) * 0.3;

    // Fret spread
    const frets = notes.map((n) => n.fret).filter((f) => f > 0);
    if (frets.length > 0) {
      const fretSpread = Math.max(...frets) - Math.min(...frets);
      difficultyScore += Math.min(1, fretSpread / 12) * 0.3;
    }

    // String jumps
    let stringJumps = 0;
    for (let i = 1; i < notes.length; i++) {
      stringJumps += Math.abs(notes[i].string - notes[i - 1].string);
    }
    difficultyScore += Math.min(1, stringJumps / notes.length / 2) * 0.2;

    // Techniques
    const techniquesUsed = new Set(notes.flatMap((n) => n.techniques || []));
    difficultyScore += Math.min(1, techniquesUsed.size / 5) * 0.2;

    if (difficultyScore < 0.3) return 'beginner';
    if (difficultyScore < 0.6) return 'intermediate';
    if (difficultyScore < 0.8) return 'advanced';
    return 'advanced';
  }

  private getControllerName(controllerNumber: number): string {
    const controllers: Record<number, string> = {
      1: 'Modulation',
      7: 'Volume',
      10: 'Pan',
      11: 'Expression',
      64: 'Sustain',
      65: 'Portamento',
      91: 'Reverb',
      93: 'Chorus',
    };
    return controllers[controllerNumber] || `Controller ${controllerNumber}`;
  }

  private getInstrumentName(programNumber: number): string {
    // Simplified GM instrument names (just for bass-related ones)
    const instruments: Record<number, string> = {
      32: 'Acoustic Bass',
      33: 'Electric Bass (finger)',
      34: 'Electric Bass (pick)',
      35: 'Fretless Bass',
      36: 'Slap Bass 1',
      37: 'Slap Bass 2',
      38: 'Synth Bass 1',
      39: 'Synth Bass 2',
    };
    return instruments[programNumber] || `Program ${programNumber}`;
  }

  private getKeyFromSignature(sharpsFlats: number, isMajor: boolean): string {
    const majorKeys = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#'];
    const minorKeys = ['A', 'E', 'B', 'F#', 'C#', 'G#', 'D#', 'A#'];
    const flatMajorKeys = ['C', 'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb'];
    const flatMinorKeys = ['A', 'D', 'G', 'C', 'F', 'Bb', 'Eb', 'Ab'];

    if (sharpsFlats >= 0) {
      const index = Math.min(sharpsFlats, majorKeys.length - 1);
      return isMajor ? majorKeys[index] : minorKeys[index];
    } else {
      const flats = Math.abs(sharpsFlats);
      const index = Math.min(flats, flatMajorKeys.length - 1);
      return isMajor ? flatMajorKeys[index] : flatMinorKeys[index];
    }
  }

  private getSharpsFlatFromKey(key: string, isMajor: boolean): number {
    const majorKeys = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#'];
    const minorKeys = ['A', 'E', 'B', 'F#', 'C#', 'G#', 'D#', 'A#'];
    const flatMajorKeys = ['C', 'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb'];
    const flatMinorKeys = ['A', 'D', 'G', 'C', 'F', 'Bb', 'Eb', 'Ab'];

    // Check sharp keys
    const sharpIndex = (isMajor ? majorKeys : minorKeys).indexOf(key);
    if (sharpIndex !== -1) {
      return sharpIndex;
    }

    // Check flat keys
    const flatIndex = (isMajor ? flatMajorKeys : flatMinorKeys).indexOf(key);
    if (flatIndex !== -1) {
      return -flatIndex;
    }

    return 0; // Default to C major/A minor
  }

  private calculateVariance(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    const mean = numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
    const variance =
      numbers.reduce((sum, n) => sum + Math.pow(n - mean, 2), 0) /
      numbers.length;
    return Math.sqrt(variance);
  }
}
