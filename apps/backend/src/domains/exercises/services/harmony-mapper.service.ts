import { Injectable, Logger } from '@nestjs/common';
import {
  GeneratedHarmonyNote,
  HarmonyAnalysis,
  ConvertHarmonyResponseDto,
  HarmonyControlChange,
} from '../dto/convert-harmony-response.dto.js';
import {
  HarmonyInstrumentType,
  ParsedMeasure,
} from '../dto/convert-harmony-midi.dto.js';

/**
 * Service for converting parsed MIDI measures to harmony note data
 * Similar to FretboardMapperService but simpler (no fretboard constraints)
 */
@Injectable()
export class HarmonyMapperService {
  private readonly logger = new Logger(HarmonyMapperService.name);

  /**
   * Instrument velocity layer configurations
   * Based on actual sample libraries in /public/samples/
   */
  private readonly VELOCITY_LAYER_CONFIG = {
    [HarmonyInstrumentType.GRANDPIANO]: {
      totalLayers: 7,
      ranges: [
        { min: 0, max: 18, layer: 'v1' },
        { min: 19, max: 36, layer: 'v2' },
        { min: 37, max: 54, layer: 'v3' },
        { min: 55, max: 72, layer: 'v4' },
        { min: 73, max: 90, layer: 'v5' },
        { min: 91, max: 108, layer: 'v6' },
        { min: 109, max: 127, layer: 'v7' },
      ],
    },
    [HarmonyInstrumentType.RHODES]: {
      totalLayers: 4,
      ranges: [
        { min: 0, max: 31, layer: 'v1' },
        { min: 32, max: 63, layer: 'v2' },
        { min: 64, max: 95, layer: 'v3' },
        { min: 96, max: 127, layer: 'v4' },
      ],
    },
    [HarmonyInstrumentType.WURLITZER]: {
      totalLayers: 5,
      ranges: [
        { min: 0, max: 25, layer: 'v1' },
        { min: 26, max: 51, layer: 'v2' },
        { min: 52, max: 76, layer: 'v3' },
        { min: 77, max: 102, layer: 'v4' },
        { min: 103, max: 127, layer: 'v5' },
      ],
    },
    [HarmonyInstrumentType.PAD]: {
      totalLayers: 4,
      ranges: [
        { min: 0, max: 31, layer: 'v1' },
        { min: 32, max: 63, layer: 'v2' },
        { min: 64, max: 95, layer: 'v3' },
        { min: 96, max: 127, layer: 'v4' },
      ],
    },
  };

  /**
   * Convert parsed MIDI measures to harmony note data
   * @param measures - Parsed MIDI measures from MidiParserService
   * @param instrumentType - Instrument type for velocity layer calculation
   * @param correlationId - Optional correlation ID for logging
   * @param controlChanges - Optional MIDI control change events (sustain, expression, etc.)
   * @returns Converted harmony notes with analysis metadata
   */
  async convertMidiToHarmony(
    measures: ParsedMeasure[],
    instrumentType: HarmonyInstrumentType,
    correlationId?: string,
    controlChanges?: Array<any>,
  ): Promise<ConvertHarmonyResponseDto> {
    const startTime = Date.now();

    this.logger.log(
      `Converting ${measures.length} measures to harmony notes for instrument: ${instrumentType}`,
      { correlationId },
    );

    // DIAGNOSTIC: Log what we received
    this.logger.debug('📊 Measures received for harmony conversion', {
      measureCount: measures.length,
      measuresWithNotes: measures.filter(m => m.notes && m.notes.length > 0).length,
      allMeasureNoteCounts: measures.map((m, i) => ({
        measure: i + 1,
        noteCount: m.notes?.length || 0,
        hasNotes: !!m.notes && m.notes.length > 0,
      })),
      firstMeasure: measures[0] ? {
        measureNumber: measures[0].measureNumber,
        noteCount: measures[0].notes?.length || 0,
        firstNote: measures[0].notes?.[0],
      } : null,
    });

    // 1. Extract all notes from all measures (polyphonic support)
    const allNotes: GeneratedHarmonyNote[] = [];
    let noteIdCounter = 1;

    for (const measure of measures) {
      // Group notes by time to detect polyphony
      const notesGroupedByTime = this.groupNotesByTime(measure.notes);

      for (const timeGroup of notesGroupedByTime) {
        const simultaneousNotes = timeGroup.notes;

        // Assign voice indices for simultaneous notes (0 = lowest pitch)
        const sortedByPitch = [...simultaneousNotes].sort(
          (a, b) => a.pitch - b.pitch,
        );

        sortedByPitch.forEach((note, voiceIndex) => {
          // DIAGNOSTIC: Log first 3 notes to verify tick precision
          if (noteIdCounter <= 3) {
            this.logger.log(`[TICK DIAGNOSTIC] Note ${noteIdCounter} position:`, {
              noteName: note.name,
              position: note.position,
              tick: note.position?.tick,
              durationTicks: note.durationTicks,
            });
          }

          allNotes.push({
            id: `harmony-note-${noteIdCounter++}`,
            pitch: note.pitch,
            velocity: note.velocity,
            noteName: note.name,
            position: note.position,
            noteDuration: note.noteDuration as any, // Cast from string to NoteDuration
            durationTicks: note.durationTicks,
            ticks: (note as any).ticks, // 🚨 CRITICAL FIX: Include absolute ticks for consistent timing with CC64
            measureNumber: measure.measureNumber,
            voiceIndex:
              simultaneousNotes.length > 1 ? voiceIndex : undefined,
          });
        });
      }
    }

    // 2. Process control changes - add measure numbers
    const processedControlChanges: HarmonyControlChange[] = (controlChanges || []).map(cc => {
      // Find which measure this CC event belongs to based on its position
      const measureNumber = cc.position?.measure || 1;

      return {
        cc: cc.cc,
        value: cc.value,
        position: cc.position,
        ticks: cc.ticks,
        measureNumber,
      };
    });

    // 3. Perform analysis
    const analysis = this.analyzeHarmonyData(allNotes, instrumentType);

    const processingTimeMs = Date.now() - startTime;

    this.logger.log(
      `Harmony conversion complete: ${allNotes.length} notes, ${analysis.uniquePitches.length} unique pitches, ${analysis.requiredVelocityLayers.length} velocity layers, ${processedControlChanges.length} control changes`,
      { correlationId, processingTimeMs },
    );

    return {
      notes: allNotes,
      controlChanges: processedControlChanges,
      analysis,
      processingTimeMs,
    };
  }

  /**
   * Group notes by time to detect simultaneous notes (chords)
   * Notes within 50ms are considered simultaneous
   */
  private groupNotesByTime(
    notes: ParsedMeasure['notes'],
  ): Array<{ time: number; notes: ParsedMeasure['notes'] }> {
    const TIME_THRESHOLD_MS = 50; // 50ms tolerance for simultaneity
    const groups: Array<{ time: number; notes: ParsedMeasure['notes'] }> = [];

    const sortedNotes = [...notes].sort((a, b) => a.time - b.time);

    for (const note of sortedNotes) {
      // Find existing group within threshold
      const existingGroup = groups.find(
        (g) => Math.abs(g.time - note.time) <= TIME_THRESHOLD_MS / 1000,
      );

      if (existingGroup) {
        existingGroup.notes.push(note);
      } else {
        groups.push({
          time: note.time,
          notes: [note],
        });
      }
    }

    return groups;
  }

  /**
   * Analyze harmony data for optimization metadata
   */
  private analyzeHarmonyData(
    notes: GeneratedHarmonyNote[],
    instrumentType: HarmonyInstrumentType,
  ): HarmonyAnalysis {
    if (notes.length === 0) {
      return {
        minVelocity: 0,
        maxVelocity: 0,
        requiredVelocityLayers: [],
        uniquePitches: [],
        noteCount: 0,
        octaveRange: { min: 0, max: 0 },
        averageVelocity: 0,
        isPolyphonic: false,
        maxVoiceCount: 0,
      };
    }

    // Extract velocities
    const velocities = notes.map((n) => n.velocity);
    const minVelocity = Math.min(...velocities);
    const maxVelocity = Math.max(...velocities);
    const averageVelocity = Math.round(
      velocities.reduce((sum, v) => sum + v, 0) / velocities.length,
    );

    // Extract unique pitches
    const uniquePitches = [...new Set(notes.map((n) => n.pitch))].sort(
      (a, b) => a - b,
    );

    // Calculate octave range (MIDI note 60 = C4, octave = Math.floor(pitch / 12))
    const octaves = uniquePitches.map((p) => Math.floor(p / 12));
    const octaveRange = {
      min: Math.min(...octaves),
      max: Math.max(...octaves),
    };

    // Determine required velocity layers
    const requiredVelocityLayers = this.determineRequiredVelocityLayers(
      minVelocity,
      maxVelocity,
      instrumentType,
    );

    // Detect polyphony
    const notesWithVoices = notes.filter(
      (n) => n.voiceIndex !== undefined,
    );
    const isPolyphonic = notesWithVoices.length > 0;
    const maxVoiceCount = isPolyphonic
      ? Math.max(...notesWithVoices.map((n) => (n.voiceIndex ?? 0) + 1))
      : 1;

    return {
      minVelocity,
      maxVelocity,
      requiredVelocityLayers,
      uniquePitches,
      noteCount: notes.length,
      octaveRange,
      averageVelocity,
      isPolyphonic,
      maxVoiceCount,
    };
  }

  /**
   * Determine which velocity layers are required based on min/max velocity
   * This enables loading only necessary sample layers (major optimization)
   */
  private determineRequiredVelocityLayers(
    minVelocity: number,
    maxVelocity: number,
    instrumentType: HarmonyInstrumentType,
  ): string[] {
    const config = this.VELOCITY_LAYER_CONFIG[instrumentType];
    if (!config) {
      this.logger.warn(
        `Unknown instrument type: ${instrumentType}, defaulting to all layers`,
      );
      return [];
    }

    const requiredLayers: string[] = [];

    for (const range of config.ranges) {
      // Check if this velocity range overlaps with [minVelocity, maxVelocity]
      const overlaps =
        range.min <= maxVelocity && range.max >= minVelocity;

      if (overlaps) {
        requiredLayers.push(range.layer);
      }
    }

    this.logger.debug(
      `Velocity range ${minVelocity}-${maxVelocity} requires ${requiredLayers.length}/${config.totalLayers} layers: ${requiredLayers.join(', ')}`,
    );

    return requiredLayers;
  }

  /**
   * Get all velocity layer names for an instrument (for preloading all layers)
   */
  getAllVelocityLayersForInstrument(
    instrumentType: HarmonyInstrumentType,
  ): string[] {
    const config = this.VELOCITY_LAYER_CONFIG[instrumentType];
    if (!config) {
      return [];
    }
    return config.ranges.map((r) => r.layer);
  }
}
