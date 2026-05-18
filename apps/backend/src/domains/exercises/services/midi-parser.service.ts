import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import ToneMidiPkg from '@tonejs/midi';
import type {
  ParsedMeasure,
  MidiNoteEvent,
  MidiControlChangeEvent,
  ParseMidiResponseDto,
} from '../dto/parse-midi-response.dto.js';
import {
  MusicalTimeConstants,
  absoluteTickToPosition,
  inferNoteDurationFromTicks,
} from '@bassnotion/contracts';

// @tonejs/midi is a CommonJS module - destructure from default export
const { Midi } = ToneMidiPkg;

/**
 * Service for parsing MIDI files into structured note data
 */
@Injectable()
export class MidiParserService {
  private readonly logger = new Logger(MidiParserService.name);

  /**
   * Parse MIDI file from URL and group notes by measure
   *
   * @param midiUrl - URL to the MIDI file (Supabase storage URL)
   * @param bpm - Beats per minute from exercise entity
   * @param timeSignature - Time signature from exercise entity
   * @param totalBars - Total number of bars/measures from exercise entity
   * @returns Parsed measures with note events
   */
  async parseMidiFromUrl(
    midiUrl: string,
    bpm: number,
    timeSignature: { numerator: number; denominator: number },
    totalBars: number,
    correlationId?: string,
  ): Promise<ParseMidiResponseDto> {
    const startTime = Date.now();

    this.logger.log(`Parsing MIDI file: ${midiUrl}`, {
      bpm,
      timeSignature,
      totalBars,
      correlationId,
    });

    try {
      // Fetch MIDI file from URL
      const midiBuffer = await this.fetchMidiFile(midiUrl, correlationId);

      // Parse MIDI file using @tonejs/midi
      const midi = new Midi(midiBuffer);

      // Validate MIDI file
      this.validateMidiFile(midi);

      // Calculate PPQ conversion parameters (needed for both notes and control changes)
      const midiPPQ =
        (midi.header as any).ppq || (midi.header as any).ticksPerQuarter || 480;
      const TARGET_PPQ = MusicalTimeConstants.PPQ; // 480
      const needsConversion = midiPPQ !== TARGET_PPQ;

      this.logger.log('🎵 [PPQ FIX] MIDI file PPQ analysis', {
        filePPQ: midiPPQ,
        targetPPQ: TARGET_PPQ,
        needsConversion,
        conversionFactor: needsConversion ? TARGET_PPQ / midiPPQ : 1,
        FIX: '@tonejs/midi uses file PPQ, not 960! Previous conversion was causing double-speed bug.',
      });

      // Extract note events with musical timing
      const noteEvents = this.extractNoteEvents(
        midi,
        timeSignature,
        midiPPQ,
        needsConversion,
        TARGET_PPQ,
      );

      // Calculate measureOffset from notes (same logic as groupNotesByMeasure)
      let measureOffset = 0;
      if (noteEvents.length > 0) {
        const measureNumbers = noteEvents.map((n) => n.position?.measure || 0);
        measureOffset = Math.min(...measureNumbers);
        this.logger.log('📊 Calculated measureOffset for CC64 normalization', {
          measureOffset,
          totalNotes: noteEvents.length,
        });
      }

      // Extract control change events (sustain pedal, expression, etc.)
      // CRITICAL: Pass measureOffset so CC64 events use the same reference as notes
      const controlChanges = this.extractControlChangeEvents(
        midi,
        timeSignature,
        measureOffset,
        midiPPQ,
        needsConversion,
        TARGET_PPQ,
      );

      // Group notes by measure
      const measures = this.groupNotesByMeasure(
        noteEvents,
        bpm,
        timeSignature,
        totalBars,
      );

      const response: ParseMidiResponseDto = {
        totalMeasures: measures.length,
        totalNotes: noteEvents.length,
        durationSeconds: midi.duration,
        measures,
        controlChanges,
        metadata: {
          bpm,
          timeSignature,
          totalBars,
        },
      };

      this.logger.log('MIDI parsing completed', {
        totalMeasures: response.totalMeasures,
        totalNotes: response.totalNotes,
        durationMs: Date.now() - startTime,
        correlationId,
      });

      return response;
    } catch (error) {
      this.logger.error('Failed to parse MIDI file', error as Error, {
        midiUrl,
        correlationId,
      });

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new InternalServerErrorException('Failed to parse MIDI file');
    }
  }

  /**
   * Fetch MIDI file from URL
   */
  private async fetchMidiFile(
    url: string,
    correlationId?: string,
  ): Promise<ArrayBuffer> {
    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new BadRequestException(
          `Failed to fetch MIDI file: ${response.status} ${response.statusText}`,
        );
      }

      return await response.arrayBuffer();
    } catch (error) {
      this.logger.error('Failed to fetch MIDI file', error as Error, {
        url,
        correlationId,
      });

      throw new BadRequestException('Failed to fetch MIDI file from URL');
    }
  }

  /**
   * Validate MIDI file structure
   */
  private validateMidiFile(midi: any): void {
    if (!midi || !midi.tracks || midi.tracks.length === 0) {
      throw new BadRequestException('MIDI file contains no tracks');
    }

    // Find tracks with notes (ignore empty tracks)
    const tracksWithNotes = midi.tracks.filter(
      (track: any) => track.notes.length > 0,
    );

    if (tracksWithNotes.length === 0) {
      throw new BadRequestException('MIDI file contains no notes');
    }

    if (tracksWithNotes.length > 1) {
      this.logger.warn(
        'MIDI file has multiple tracks with notes, using first track only',
        {
          trackCount: tracksWithNotes.length,
        },
      );
    }
  }

  /**
   * Extract note events from MIDI file with musical timing
   */
  private extractNoteEvents(
    midi: any,
    timeSignature: { numerator: number; denominator: number },
    midiPPQ: number,
    needsConversion: boolean,
    targetPPQ: number,
  ): MidiNoteEvent[] {
    // DIAGNOSTIC: Log all tracks to understand MIDI file structure
    this.logger.log('🔍 MIDI File Structure', {
      totalTracks: midi.tracks?.length || 0,
      tracks:
        midi.tracks?.map((t: any, idx: number) => ({
          trackIndex: idx,
          name: t.name || 'Unnamed',
          instrument: t.instrument?.name || 'Unknown',
          channel: t.channel,
          notesCount: t.notes?.length || 0,
          firstNotes:
            t.notes?.slice(0, 3).map((n: any) => ({
              midi: n.midi,
              name: n.name,
              velocity: n.velocity,
              ticks: n.ticks,
            })) || [],
        })) || [],
    });

    // CHANGE: For harmony/piano MIDI, we need ALL tracks with notes (left hand + right hand)
    // Get all tracks with notes
    const tracksWithNotes = midi.tracks.filter(
      (t: any) => t.notes && t.notes.length > 0,
    );

    if (tracksWithNotes.length === 0) {
      this.logger.warn('⚠️ No tracks with notes found in MIDI file!');
      return [];
    }

    this.logger.log('✅ Found tracks with notes', {
      trackCount: tracksWithNotes.length,
      trackDetails: tracksWithNotes.map((t: any, idx: number) => ({
        name: t.name || 'Unnamed',
        instrument: t.instrument?.name || 'Unknown',
        channel: t.channel,
        noteCount: t.notes?.length || 0,
      })),
      totalNotesAcrossAllTracks: tracksWithNotes.reduce(
        (sum: number, t: any) => sum + (t.notes?.length || 0),
        0,
      ),
    });

    // PPQ parameters passed from parent function

    // Combine notes from ALL tracks (for polyphonic piano MIDI with left/right hand tracks)
    const allNotes: any[] = [];
    for (const track of tracksWithNotes) {
      allNotes.push(...track.notes);
    }

    this.logger.log('📝 Combined notes from all tracks', {
      totalNotes: allNotes.length,
      trackCount: tracksWithNotes.length,
    });

    const noteEvents: MidiNoteEvent[] = allNotes.map(
      (note: any, index: number) => {
        // CRITICAL FIX: Only convert if file PPQ differs from target PPQ
        // If file is already at 480 PPQ, use ticks directly (no conversion)
        const normalizedTicks = needsConversion
          ? Math.round((note.ticks / midiPPQ) * targetPPQ)
          : note.ticks;
        const normalizedDurationTicks = needsConversion
          ? Math.round((note.durationTicks / midiPPQ) * targetPPQ)
          : note.durationTicks;

        // Calculate musical position from ticks
        const position = absoluteTickToPosition(normalizedTicks, timeSignature);

        // Infer note duration from tick count
        const noteDuration = inferNoteDurationFromTicks(
          normalizedDurationTicks,
        );

        // PPQ DIAGNOSTIC: Log first 3 notes to verify fix
        if (index < 3) {
          this.logger.log(`✅ [PPQ FIX VERIFIED] Note ${index + 1}:`, {
            originalTicks: note.ticks,
            originalDurationTicks: note.durationTicks,
            filePPQ: midiPPQ,
            targetPPQ,
            needsConversion,
            normalizedTicks,
            normalizedDurationTicks,
            position,
            FIX: needsConversion
              ? `Converted ${note.ticks} from ${midiPPQ} PPQ to ${normalizedTicks} at ${targetPPQ} PPQ`
              : `No conversion needed - file already at ${targetPPQ} PPQ`,
          });
        }

        return {
          pitch: note.midi,
          velocity: Math.round(note.velocity * 127), // Tone.js uses 0-1, we want 0-127
          name: note.name,

          // Musical timing (tempo-independent, 480 PPQ standard after conversion)
          position,
          noteDuration,
          durationTicks: normalizedDurationTicks,
          ticks: normalizedTicks, // 🚨 CRITICAL FIX: Include absolute ticks for consistent timing with CC64 events
        };
      },
    );

    // Sort by musical position (measure, beat, subdivision, tick precision)
    noteEvents.sort((a, b) => {
      // Both should have position, but handle edge case
      if (!a.position || !b.position) {
        return 0; // Keep original order if position missing
      }

      if (a.position.measure !== b.position.measure) {
        return a.position.measure - b.position.measure;
      }
      if (a.position.beat !== b.position.beat) {
        return a.position.beat - b.position.beat;
      }
      if (a.position.subdivision !== b.position.subdivision) {
        return a.position.subdivision - b.position.subdivision;
      }
      // FIX: Sort by tick precision to preserve timing order
      return (a.position.tick || 0) - (b.position.tick || 0);
    });

    this.logger.debug('Extracted note events with musical timing', {
      noteCount: noteEvents.length,
      firstNote: noteEvents[0]
        ? {
            name: noteEvents[0].name,
            pitch: noteEvents[0].pitch,
            position: noteEvents[0].position,
            duration: noteEvents[0].noteDuration,
            ticks: noteEvents[0].durationTicks,
          }
        : null,
      // DIAGNOSTIC: Show all unique MIDI note numbers found
      uniqueMidiNotes: [...new Set(noteEvents.map((n) => n.pitch))].sort(
        (a, b) => a - b,
      ),
      noteBreakdown: noteEvents.reduce(
        (acc, n) => {
          acc[n.pitch] = (acc[n.pitch] || 0) + 1;
          return acc;
        },
        {} as Record<number, number>,
      ),
    });

    return noteEvents;
  }

  /**
   * Extract control change events from MIDI file (sustain pedal, expression, etc.)
   */
  private extractControlChangeEvents(
    midi: any,
    timeSignature: { numerator: number; denominator: number },
    measureOffset = 0,
    midiPPQ: number,
    needsConversion: boolean,
    targetPPQ: number,
  ): MidiControlChangeEvent[] {
    this.logger.log('🎛️ Extracting control change events from MIDI');

    // Get all tracks with control changes
    const tracksWithCC = midi.tracks.filter(
      (t: any) => t.controlChanges && Object.keys(t.controlChanges).length > 0,
    );

    if (tracksWithCC.length === 0) {
      this.logger.log('ℹ️ No control change events found in MIDI file');
      return [];
    }

    this.logger.log('✅ Found tracks with control changes', {
      trackCount: tracksWithCC.length,
      trackDetails: tracksWithCC.map((t: any) => ({
        name: t.name || 'Unnamed',
        ccTypes: Object.keys(t.controlChanges),
        ccCounts: Object.entries(t.controlChanges).map(
          ([cc, events]: [string, any]) => ({
            cc: cc,
            count: events.length,
          }),
        ),
      })),
    });

    const allControlChanges: MidiControlChangeEvent[] = [];

    // Process each track
    for (const track of tracksWithCC) {
      // controlChanges is an object where keys are CC numbers (as strings)
      // e.g., { "64": [...sustainEvents], "11": [...expressionEvents] }
      for (const [ccNumber, events] of Object.entries(track.controlChanges)) {
        const cc = parseInt(ccNumber, 10);

        // Cast to array of CC events
        const ccEvents = events as Array<{ ticks: number; value: number }>;

        for (const event of ccEvents) {
          // CRITICAL FIX: Only convert if file PPQ differs from target PPQ
          const normalizedTicks = needsConversion
            ? Math.round((event.ticks / midiPPQ) * targetPPQ)
            : event.ticks;

          // Calculate musical position from ticks
          const position = absoluteTickToPosition(
            normalizedTicks,
            timeSignature,
          );

          // CRITICAL FIX: Apply the same measureOffset as notes
          // This ensures CC64 events and notes use the same measure reference
          const normalizedPosition = {
            measure: position.measure - measureOffset,
            beat: position.beat,
            subdivision: position.subdivision,
            tick: position.tick,
          };

          allControlChanges.push({
            cc,
            value: Math.round(event.value * 127), // @tonejs/midi uses 0-1, we want 0-127
            position: normalizedPosition,
            ticks: normalizedTicks,
          });
        }
      }
    }

    // Sort by tick position
    allControlChanges.sort((a, b) => a.ticks - b.ticks);

    this.logger.log('🎛️ Extracted control change events', {
      totalEvents: allControlChanges.length,
      measureOffset,
      byCC: allControlChanges.reduce(
        (acc, event) => {
          const ccName = event.cc === 64 ? 'Sustain' : `CC${event.cc}`;
          acc[ccName] = (acc[ccName] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      ),
      sustainEvents: allControlChanges.filter((e) => e.cc === 64).length,
      // DIAGNOSTIC: Show actual CC64 values to verify conversion
      cc64Values: allControlChanges
        .filter((e) => e.cc === 64)
        .map((e) => ({
          value: e.value,
          state: e.value >= 64 ? 'DOWN' : 'UP',
          measure: e.position.measure,
        }))
        .slice(0, 10), // First 10 sustain events (after offset applied)
    });

    return allControlChanges;
  }

  /**
   * Group notes by measure based on tempo and time signature
   */
  private groupNotesByMeasure(
    noteEvents: MidiNoteEvent[],
    bpm: number,
    timeSignature: { numerator: number; denominator: number },
    totalBars: number,
  ): ParsedMeasure[] {
    // CRITICAL FIX: Always detect measure range from actual notes
    // Don't trust totalBars parameter - the MIDI might start at a later measure
    let actualTotalBars = totalBars;
    let measureOffset = 0; // Offset if MIDI doesn't start at measure 0

    if (noteEvents.length > 0) {
      // Find the actual measure range from notes
      const measureNumbers = noteEvents.map((n) => n.position?.measure || 0);
      const minMeasure = Math.min(...measureNumbers);
      const maxMeasure = Math.max(...measureNumbers);

      measureOffset = minMeasure; // Remember where notes actually start
      actualTotalBars = maxMeasure - minMeasure + 1; // Count of measures with notes

      this.logger.log('📊 Detected measure range from notes', {
        minMeasure,
        maxMeasure,
        measureOffset,
        actualTotalBars,
        requestedBars: totalBars,
        totalNotes: noteEvents.length,
      });
    }

    // Calculate measure duration in seconds
    const beatsPerMeasure = timeSignature.numerator;
    const beatDuration = 60 / bpm; // seconds per beat
    const measureDuration = beatsPerMeasure * beatDuration;

    this.logger.debug('Measure calculation', {
      bpm,
      timeSignature,
      totalBars,
      actualTotalBars,
      measureDuration,
      beatDuration,
    });

    const measures: ParsedMeasure[] = [];

    // Create measures - accounting for offset where MIDI notes actually start
    for (let i = 0; i < actualTotalBars; i++) {
      const measureNumber = i + 1; // 1-based for display
      const actualMeasureIndex = i + measureOffset; // Where notes actually are in MIDI
      const startTime = i * measureDuration;
      const endTime = (i + 1) * measureDuration;

      // Find notes that belong to this measure based on actual MIDI measure position
      const notesInMeasure = noteEvents.filter(
        (note) => note.position?.measure === actualMeasureIndex,
      );

      measures.push({
        measureNumber,
        startTime,
        endTime,
        notes: notesInMeasure,
      });
    }

    // Check for notes that fall outside detected measure range
    const minExpected = measureOffset;
    const maxExpected = measureOffset + actualTotalBars - 1;
    const notesOutsideMeasures = noteEvents.filter(
      (note) =>
        !note.position ||
        note.position.measure < minExpected ||
        note.position.measure > maxExpected,
    );

    if (notesOutsideMeasures.length > 0) {
      this.logger.warn('⚠️ Found notes outside expected measure boundaries', {
        count: notesOutsideMeasures.length,
        totalBars,
        actualTotalBars,
        firstOutsideNote: notesOutsideMeasures[0],
        allOutsideNoteMeasures: notesOutsideMeasures.map(
          (n) => n.position?.measure,
        ),
      });
    }

    // DIAGNOSTIC: Log ALL note positions to understand distribution
    this.logger.log('📊 All note positions', {
      totalNotes: noteEvents.length,
      notePositions: noteEvents
        .map((n, i) => ({
          index: i,
          measure: n.position?.measure,
          beat: n.position?.beat,
          pitch: n.pitch,
          name: n.name,
        }))
        .slice(0, 20), // Show first 20 notes
    });

    this.logger.log('Grouped notes by measure', {
      measureCount: measures.length,
      notesPerMeasure: measures.map((m) => m.notes.length),
      measuresWithNotes: measures.filter((m) => m.notes.length > 0).length,
    });

    return measures;
  }
}
