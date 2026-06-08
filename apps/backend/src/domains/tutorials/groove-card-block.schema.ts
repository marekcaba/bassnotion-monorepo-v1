/**
 * Zod schema for the groove-card block, applied at the
 * admin-tutorials.service.ts insert + update boundary so a malformed
 * Groove Card never lands in the JSONB `blocks` column.
 *
 * Scope: ONLY groove-card. Other block types still pass through
 * unvalidated (pre-existing `blocks: any[]` shape); extending Zod
 * coverage to every block type is a future story.
 *
 * The bucket-URL rule deserves a note. Staging and production Supabase
 * projects have DIFFERENT refs (per CLAUDE.md), so the bucket host is
 * env-dependent. Validating against a hard-coded host would reject
 * legitimate staging URLs in production deployments and vice versa.
 * Instead we validate the PATH PATTERN:
 *
 *   /storage/v1/object/public/audio-samples/...
 *
 * which is identical across environments because Supabase generates the
 * same path regardless of project ref.
 */

import { z } from 'zod';

const STEM_PATH_REGEX =
  /\/storage\/v1\/object\/public\/audio-samples\/[A-Za-z0-9_./-]+/;

/**
 * Stem URL is optional during draft auto-save (admin fills the 3 cells
 * over multiple keystrokes; each keystroke triggers a save). An empty
 * string passes; any non-empty string MUST match the audio-samples
 * bucket path pattern (host-agnostic across staging / production per
 * CLAUDE.md). Publish-time enforcement (all 3 stems required) belongs
 * to the UI, not this auto-save validator.
 */
export const grooveCardStemUrlSchema = z.union([
  z.literal(''),
  z
    .string()
    .refine(
      (url) => STEM_PATH_REGEX.test(url),
      'stem URL must point at /storage/v1/object/public/audio-samples/…',
    ),
]);

export const grooveCardStemSetSchema = z.object({
  bass: grooveCardStemUrlSchema,
  drums: grooveCardStemUrlSchema,
  harmony: grooveCardStemUrlSchema,
});

export const grooveCardStateCaptionsSchema = z
  .object({
    'mute-bass': z.string().optional(),
    'solo-drums': z.string().optional(),
    'key-change': z.string().optional(),
    'tempo-change': z.string().optional(),
  })
  .partial();

export const grooveCardBlockConfigSchema = z
  .object({
    // LIBRARY REFERENCE: when present, the intrinsic fields below are resolved
    // from the groove_library entity at render time and are NOT required here.
    grooveId: z.string().optional(),
    keyOverride: z.number().int().optional(),
    tempoOverride: z.number().int().min(50).max(180).optional(),
    // Intrinsic fields — required for INLINE blocks, optional for references
    // (enforced by the refinement below).
    title: z.string().optional(),
    subtitle: z.string().optional(),
    originalBpm: z
      .number()
      .int('BPM must be an integer')
      .min(50, 'BPM must be at least 50')
      .max(180, 'BPM must be at most 180')
      .optional(),
    originalKey: z.string().optional(),
    lengthBars: z
      .number()
      .int('lengthBars must be an integer')
      .positive('lengthBars must be positive')
      .optional(),
    // Single-key-set + PitchShift (LAUNCH-02.5e): one stem set delivered
    // at originalKey; the runtime renders ±6 semitones via the pitch-shift
    // engine. The legacy 5-key-set tuple was retired.
    stems: grooveCardStemSetSchema.optional(),
    // Chord chart — sparse harmony changes { bar (1-based), slot (0..7
    // eighth-note), symbol } shown to the player. Resolved from the library
    // when grooveId is set; an inline block carries its own here. (Without
    // this field the non-passthrough object schema would STRIP it on save.)
    chordChart: z
      .array(
        z.object({
          bar: z.number().int().positive(),
          slot: z.number().int().min(0).max(7),
          symbol: z.string(),
        }),
      )
      .optional(),
    previewCaption: z.string().optional(),
    stateCaptions: grooveCardStateCaptionsSchema.optional(),
    allowBookmark: z.boolean().optional(),
    youtubeUrl: z.string().optional(),
    // DRILL fields: presence of `role` makes the card a drill brick (caps
    // enforced + conquering advances the session). `timeboxMinutes` drives the
    // per-brick session clock. Both optional — absent on ordinary cards.
    role: z.enum(['groove', 'connecting', 'review']).optional(),
    timeboxMinutes: z
      .number()
      .int('timeboxMinutes must be an integer')
      .positive('timeboxMinutes must be positive')
      .optional(),
    // DRILL: per-brick completion criterion (time/loops/conquer/manual).
    completionCriterion: z
      .object({
        type: z.enum(['time', 'loops', 'conquer', 'manual']),
        target: z.number().positive().optional(),
        targetTier: z.enum(['bronze', 'silver', 'gold']).optional(),
      })
      .optional(),
  })
  .refine(
    (c) =>
      // A reference block (grooveId) needs no inline intrinsics; an inline
      // block must carry title + originalKey + stems + bpm + length.
      !!c.grooveId ||
      (!!c.title &&
        !!c.originalKey &&
        !!c.stems &&
        c.originalBpm != null &&
        c.lengthBars != null),
    {
      message:
        'inline groove-card needs title, originalKey, originalBpm, lengthBars and stems (or set grooveId to reference a library groove)',
    },
  );

/**
 * Block-level schema. Discriminates on `type` so a `'groove-card'` block
 * passes through the strict shape while every other block type is
 * accepted unchanged (preserves the existing untyped-block behaviour
 * for non-groove-card blocks).
 */
export const grooveCardBlockSchema = z.object({
  id: z.string(),
  type: z.literal('groove-card'),
  title: z.string(),
  config: grooveCardBlockConfigSchema,
  order: z.number().int().nonnegative(),
  showInIsland: z.boolean().optional(),
});

export type GrooveCardBlockSchema = z.infer<typeof grooveCardBlockSchema>;

/**
 * Validates an array of blocks where ONLY `'groove-card'` entries are
 * type-checked. Non-groove-card entries pass through verbatim. Throws
 * on validation failure with the first Zod issue's message + path.
 *
 * Returns the (validated) blocks array so callers can chain `dto.blocks
 * = validateBlocks(dto.blocks)` if they want immutable confidence.
 */
export function validateGrooveCardBlocks(blocks: unknown): unknown[] {
  if (!Array.isArray(blocks)) {
    throw new Error('blocks must be an array');
  }
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i] as Record<string, unknown> | null;
    if (!block || typeof block !== 'object') continue;
    if (block.type !== 'groove-card') continue;

    const result = grooveCardBlockSchema.safeParse(block);
    if (!result.success) {
      const issue = result.error.issues[0];
      const path = issue?.path?.join('.') ?? '(root)';
      throw new Error(
        `Invalid groove-card block at index ${i} (${path}): ${
          issue?.message ?? 'unknown validation error'
        }`,
      );
    }
  }
  return blocks;
}
