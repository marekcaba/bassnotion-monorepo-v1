import { z } from 'zod';

/**
 * Represents an anchor point set by the admin for a measure
 */
export const MeasureAnchorSchema = z.object({
  /** 1-based measure number */
  measureNumber: z.number().int().min(1),
  /** String number (1-6, where 1 = E string, thickest) */
  string: z.number().int().min(1).max(6),
  /** Fret number (0-24, where 0 = open string) */
  fret: z.number().int().min(0).max(24),
});

export type MeasureAnchor = z.infer<typeof MeasureAnchorSchema>;

/**
 * Request DTO for converting MIDI to fretboard positions
 */
export const ConvertMidiRequestSchema = z.object({
  /** Anchor positions for first note of each measure */
  anchors: z.array(MeasureAnchorSchema).min(1),
  /** Bass type: 4, 5, or 6 string (default: 4) */
  bassType: z.enum(['4', '5', '6']).optional().default('4'),
});

export type ConvertMidiRequestDto = z.infer<typeof ConvertMidiRequestSchema>;
