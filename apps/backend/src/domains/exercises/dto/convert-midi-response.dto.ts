import { z } from 'zod';
import {
  MusicalPositionSchema,
  NoteDurationSchema,
} from '@bassnotion/contracts';

/**
 * Confidence level for a generated note position
 */
export const ConfidenceLevelSchema = z.enum(['high', 'medium', 'low']);
export type ConfidenceLevel = z.infer<typeof ConfidenceLevelSchema>;

/**
 * Alternative position for a note
 */
export const AlternativePositionSchema = z.object({
  /** String number (1-6) */
  string: z.number().int().min(1).max(6),
  /** Fret number (0-24) */
  fret: z.number().int().min(0).max(24),
  /** Score for this position (higher is better) */
  score: z.number().min(0).max(100),
  /** Human-readable reason for this alternative */
  reason: z.string().optional(),
});

export type AlternativePosition = z.infer<typeof AlternativePositionSchema>;

/**
 * Warning about a difficult or unusual fingering
 */
export const PositionWarningSchema = z.object({
  /** Warning type */
  type: z.enum([
    'large_stretch',
    'difficult_shift',
    'string_crossing',
    'awkward_position',
  ]),
  /** Human-readable warning message */
  message: z.string(),
  /** Severity: info, warning, error */
  severity: z.enum(['info', 'warning', 'error']),
});

export type PositionWarning = z.infer<typeof PositionWarningSchema>;

/**
 * Generated exercise note with fretboard position and musical timing
 */
export const GeneratedExerciseNoteSchema = z.object({
  /** Unique ID for this note */
  id: z.string(),

  // FRETBOARD POSITION
  /** String number (1-6, where 1 = E string) */
  string: z.number().int().min(1).max(6),
  /** Fret number (0-24, where 0 = open string) */
  fret: z.number().int().min(0).max(24),
  /** Note name (e.g., "A1", "D2") */
  note: z.string(),

  // MUSICAL TIMING (Primary - optional for test compatibility)
  /** Musical position (measure, beat, tick) */
  position: MusicalPositionSchema.optional(),
  /** Note duration as musical value */
  noteDuration: NoteDurationSchema.optional(),
  /** Duration in ticks (at 480 PPQ) */
  durationTicks: z.number().int().min(0).optional(),

  // PERFORMANCE DATA
  /** MIDI pitch (0-127) */
  pitch: z.number().int().min(0).max(127),
  /** MIDI velocity (0-127) */
  velocity: z.number().int().min(0).max(127),

  // FRETBOARD ANALYSIS METADATA
  /** Measure number (1-based) - for UI convenience */
  measureNumber: z.number().int().min(1),
  /** Confidence level for this position */
  confidence: ConfidenceLevelSchema,
  /** Alternative positions (top 3 alternatives) */
  alternatives: z.array(AlternativePositionSchema),
  /** Warnings about this position */
  warnings: z.array(PositionWarningSchema).optional(),
  /** Position score (0-100, higher is better) */
  score: z.number().min(0).max(100),
});

export type GeneratedExerciseNote = z.infer<typeof GeneratedExerciseNoteSchema>;

/**
 * Playability metrics for the entire conversion
 */
export const PlayabilityMetricsSchema = z.object({
  /** Overall playability score (0-100) */
  overallScore: z.number().min(0).max(100),
  /** Number of large stretches (>5 frets) */
  largeStretches: z.number().int().min(0),
  /** Number of difficult position shifts */
  difficultShifts: z.number().int().min(0),
  /** Number of string crossings */
  stringCrossings: z.number().int().min(0),
  /** Average hand position stability (0-100) */
  handStability: z.number().min(0).max(100),
  /** Percentage of notes with high confidence */
  highConfidencePercentage: z.number().min(0).max(100),
});

export type PlayabilityMetrics = z.infer<typeof PlayabilityMetricsSchema>;

/**
 * Response DTO for MIDI to fretboard conversion
 */
export const ConvertMidiResponseSchema = z.object({
  /** Generated notes with fretboard positions */
  notes: z.array(GeneratedExerciseNoteSchema),
  /** Total number of notes generated */
  totalNotes: z.number().int().min(0),
  /** Playability metrics for the entire exercise */
  playability: PlayabilityMetricsSchema,
  /** Processing time in milliseconds */
  processingTimeMs: z.number().min(0),
});

export type ConvertMidiResponseDto = z.infer<typeof ConvertMidiResponseSchema>;
