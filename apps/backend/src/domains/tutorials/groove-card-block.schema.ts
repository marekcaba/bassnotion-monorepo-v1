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
 * Stem URL is optional during draft auto-save (admin fills the 20 cells
 * over multiple keystrokes; each keystroke triggers a save). An empty
 * string passes; any non-empty string MUST match the audio-samples
 * bucket path pattern (host-agnostic across staging / production per
 * CLAUDE.md). Publish-time enforcement (all 20 stems required) belongs
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

export const grooveCardKeySetSchema = z.object({
  // Label is admin-visible display copy (e.g. "E", "G♯"). Empty during
  // initial creation; the admin form's placeholder shows the offset hint.
  // Publish-time enforcement lives in the UI.
  label: z.string(),
  semitoneOffset: z.union([
    z.literal(-8),
    z.literal(-4),
    z.literal(0),
    z.literal(4),
    z.literal(8),
  ]),
  isDefault: z.boolean(),
  stems: grooveCardStemSetSchema,
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
    title: z.string().min(1, 'title is required'),
    subtitle: z.string(),
    originalBpm: z
      .number()
      .int('BPM must be an integer')
      .min(50, 'BPM must be at least 50')
      .max(180, 'BPM must be at most 180'),
    originalKey: z.string().min(1, 'originalKey is required'),
    lengthBars: z
      .number()
      .int('lengthBars must be an integer')
      .positive('lengthBars must be positive'),
    keys: z
      .array(grooveCardKeySetSchema)
      .length(5, 'exactly 5 key sets are required'),
    previewCaption: z.string().optional(),
    stateCaptions: grooveCardStateCaptionsSchema.optional(),
    allowBookmark: z.boolean().optional(),
    youtubeUrl: z.string().optional(),
  })
  .superRefine((cfg, ctx) => {
    // Each offset must appear exactly once.
    const expected = [-8, -4, 0, 4, 8] as const;
    const actual = cfg.keys.map((k) => k.semitoneOffset).sort((a, b) => a - b);
    const expectedSorted = [...expected].sort((a, b) => a - b);
    if (
      actual.length !== expectedSorted.length ||
      actual.some((v, i) => v !== expectedSorted[i])
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['keys'],
        message: 'key sets must cover offsets -8, -4, 0, +4, +8 exactly once',
      });
    }

    // Exactly one key set must be marked isDefault.
    const defaults = cfg.keys.filter((k) => k.isDefault).length;
    if (defaults !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['keys'],
        message: 'exactly one key set must have isDefault: true',
      });
    }
  });

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
