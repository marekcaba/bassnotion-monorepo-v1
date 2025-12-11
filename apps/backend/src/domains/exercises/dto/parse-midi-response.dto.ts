import { z } from 'zod';
import {
  MusicalPositionSchema,
  NoteDurationSchema,
} from '@bassnotion/contracts';

/**
 * Represents a single MIDI note event with musical timing
 */
export const MidiNoteEventSchema = z.object({
  /** MIDI note number (0-127, where 60 = middle C) */
  pitch: z.number().int().min(0).max(127),
  /** Note velocity (0-127, where 0 = silent, 127 = loudest) */
  velocity: z.number().int().min(0).max(127),
  /** Note name (e.g., "A1", "D2") */
  name: z.string(),

  // MUSICAL TIMING (Primary - optional for test compatibility)
  /** Musical position (measure, beat, tick) */
  position: MusicalPositionSchema.optional(),
  /** Note duration as musical value */
  noteDuration: NoteDurationSchema.optional(),
  /** Duration in ticks (at 480 PPQ) */
  durationTicks: z.number().int().min(0).optional(),
  /** Absolute ticks from file start (at 480 PPQ) - critical for consistent timing with CC64 */
  ticks: z.number().int().min(0).optional(),
});

export type MidiNoteEvent = z.infer<typeof MidiNoteEventSchema>;

/**
 * Represents a MIDI control change event (e.g., sustain pedal, expression)
 */
export const MidiControlChangeEventSchema = z.object({
  /** Control change number (64 = sustain, 11 = expression, etc.) */
  cc: z.number().int().min(0).max(127),
  /** Control value (0-127) */
  value: z.number().int().min(0).max(127),
  /** Musical position */
  position: MusicalPositionSchema,
  /** Absolute tick position (at 480 PPQ) */
  ticks: z.number().int().min(0),
});

export type MidiControlChangeEvent = z.infer<
  typeof MidiControlChangeEventSchema
>;

/**
 * Represents all notes within a single measure
 */
export const ParsedMeasureSchema = z.object({
  /** 1-based measure number */
  measureNumber: z.number().int().min(1),
  /** Start time of measure in seconds */
  startTime: z.number().min(0),
  /** End time of measure in seconds */
  endTime: z.number().min(0),
  /** All MIDI notes that occur in this measure */
  notes: z.array(MidiNoteEventSchema),
});

export type ParsedMeasure = z.infer<typeof ParsedMeasureSchema>;

/**
 * Response DTO for MIDI parsing
 */
export const ParseMidiResponseSchema = z.object({
  /** Total number of measures found */
  totalMeasures: z.number().int().min(0),
  /** Total number of notes found */
  totalNotes: z.number().int().min(0),
  /** Duration of the MIDI file in seconds */
  durationSeconds: z.number().min(0),
  /** Parsed measures with their notes */
  measures: z.array(ParsedMeasureSchema),
  /** MIDI control change events (sustain pedal, expression, etc.) */
  controlChanges: z.array(MidiControlChangeEventSchema).optional(),
  /** Original MIDI file metadata */
  metadata: z.object({
    bpm: z.number(),
    timeSignature: z.object({
      numerator: z.number().int(),
      denominator: z.number().int(),
    }),
    totalBars: z.number().int(),
  }),
});

export type ParseMidiResponseDto = z.infer<typeof ParseMidiResponseSchema>;
