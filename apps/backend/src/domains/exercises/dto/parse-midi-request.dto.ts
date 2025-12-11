import { z } from 'zod';

/**
 * Request DTO for parsing MIDI files (legacy - uses exercise ID)
 * Exercise ID is passed in URL params, this DTO validates query/body params if needed
 * @deprecated Use StatelessParseMidiRequestSchema instead
 */
export const ParseMidiRequestSchema = z.object({
  // No additional params needed - we get everything from the exercise entity
});

export type ParseMidiRequestDto = z.infer<typeof ParseMidiRequestSchema>;

/**
 * Request DTO for stateless MIDI parsing (Story 4.4 - Task 1)
 * Accepts MIDI URL directly without requiring exercise to exist in database
 */
export const StatelessParseMidiRequestSchema = z.object({
  /**
   * URL to the MIDI file (must be HTTPS Supabase storage URL)
   * Can include query parameters (e.g., signed URL tokens)
   * @example "https://xyz.supabase.co/storage/v1/object/sign/exercise-midi-temp/abc123.mid?token=xyz"
   */
  midiUrl: z
    .string()
    .url('Must be a valid URL')
    .regex(/^https:\/\//, 'Must use HTTPS protocol')
    .regex(/\.midi?(\?|$)/i, 'Must be a .mid or .midi file'),

  /**
   * Beats per minute
   * @example 120
   */
  bpm: z
    .number()
    .int('BPM must be an integer')
    .min(40, 'BPM must be at least 40')
    .max(300, 'BPM must not exceed 300'),

  /**
   * Time signature
   * @example { "numerator": 4, "denominator": 4 }
   */
  timeSignature: z.object({
    numerator: z
      .number()
      .int('Time signature numerator must be an integer')
      .min(1, 'Time signature numerator must be at least 1')
      .max(16, 'Time signature numerator must not exceed 16'),
    denominator: z
      .number()
      .int('Time signature denominator must be an integer')
      .refine((val) => [2, 4, 8, 16].includes(val), {
        message: 'Time signature denominator must be 2, 4, 8, or 16',
      }),
  }),

  /**
   * Total number of bars/measures in the exercise
   * @example 4
   */
  totalBars: z
    .number()
    .int('Total bars must be an integer')
    .min(1, 'Total bars must be at least 1')
    .max(32, 'Total bars must not exceed 32'),
});

export type StatelessParseMidiRequestDto = z.infer<
  typeof StatelessParseMidiRequestSchema
>;
