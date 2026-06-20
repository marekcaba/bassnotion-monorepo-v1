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

// A base stem may live in the PUBLIC audio-samples bucket (free grooves) OR the
// PRIVATE groove-stems bucket (member/product grooves — signed-URL gated,
// `object/sign/…`). Both shapes are valid; the access tier (not the URL) decides
// gating, and the signer resolves the private ref at read time.
const STEM_PATH_REGEX =
  /\/storage\/v1\/object\/(public|sign)\/(audio-samples|groove-stems)\/[A-Za-z0-9_./-]+/;

/**
 * Stem URL is optional during draft auto-save (admin fills the 3 cells
 * over multiple keystrokes; each keystroke triggers a save). An empty
 * string passes; any non-empty string MUST match the audio-samples (public,
 * free) or groove-stems (private, premium) bucket path pattern (host-agnostic
 * across staging / production per CLAUDE.md). Publish-time enforcement (all 3
 * stems required) belongs to the UI, not this auto-save validator.
 */
export const grooveCardStemUrlSchema = z.union([
  z.literal(''),
  z
    .string()
    .refine(
      (url) => STEM_PATH_REGEX.test(url),
      'stem URL must point at the audio-samples or groove-stems bucket',
    ),
]);

/**
 * A premium bassline variant URL may live in the PUBLIC audio-samples bucket OR
 * the PRIVATE premium-basslines bucket (signed-URL gated, `object/sign/…`). So
 * its accepted path pattern is wider than the free-stem one.
 */
const BASSLINE_VARIANT_PATH_REGEX =
  /\/storage\/v1\/object\/(public|sign)\/(audio-samples|premium-basslines)\/[A-Za-z0-9_./-]+/;

/**
 * A pre-parsed ExerciseNote (from an admin-imported MusicXML). We validate the
 * CORE musical fields and pass the rest through (.passthrough) so the full
 * ExerciseNote shape survives the save without re-deriving its 20+ optional
 * properties. Shared by both the per-variant `notes` and `bassNotation.notes`.
 */
const exerciseNoteSchema = z
  .object({
    id: z.string(),
    string: z.number().int().min(1).max(6),
    fret: z.number().int().min(0).max(24),
    note: z.string(),
    duration: z.string(),
    // MusicalPosition: { measure, beat, subdivision, tick? } — the shape the
    // MusicXML parser emits and exerciseToMusicXML/SheetMusicDisplay consume.
    position: z
      .object({
        measure: z.number().int().nonnegative(),
        beat: z.number().int().nonnegative(),
        subdivision: z.number().int().nonnegative(),
        tick: z.number().int().nonnegative().optional(),
      })
      .passthrough(),
  })
  .passthrough();

const basslineVariantSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  url: z
    .string()
    .refine(
      (url) => BASSLINE_VARIANT_PATH_REGEX.test(url),
      'variant URL must point at the audio-samples or premium-basslines bucket',
    ),
  feature: z.string().optional(),
  // Lines & Fills combo tags (which bassline + which fill this take is).
  lineId: z.string().optional(),
  fillId: z.string().optional(),
  // Where a fill happens in the loop (1-indexed bar + beat), for the waveform
  // highlight. Only meaningful on a fill take.
  fillRegion: z
    .object({
      startBar: z.number().int().positive(),
      startBeat: z.number().int().min(1).max(4),
      endBar: z.number().int().positive(),
      endBeat: z.number().int().min(1).max(4),
    })
    .optional(),
  // This take's bass-line sheet notation (pre-parsed ExerciseNote[]). Shown in
  // the card's sheet view when this variant is the active selection.
  notes: z.array(exerciseNoteSchema).optional(),
});

export const grooveCardStemSetSchema = z.object({
  bass: grooveCardStemUrlSchema,
  drums: grooveCardStemUrlSchema,
  harmony: grooveCardStemUrlSchema,
  bassVariants: z.array(basslineVariantSchema).optional(),
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
    // Chord chart — sparse harmony changes { bar (1-based), slot (0..15
    // sixteenth-note), symbol } shown to the player. Resolved from the library
    // when grooveId is set; an inline block carries its own here. (Without
    // this field the non-passthrough object schema would STRIP it on save.)
    chordChart: z
      .array(
        z.object({
          bar: z.number().int().positive(),
          slot: z.number().int().min(0).max(15),
          symbol: z.string(),
        }),
      )
      .optional(),
    // Bass-line sheet notation for the BUILT-IN bass ("Bass A"). The card's
    // window can switch to this bass-clef score. Each alternate line / fill
    // carries its OWN notation on its bassVariant (above). Pre-parsed from an
    // admin-imported MusicXML (shared exerciseNoteSchema).
    bassNotation: z
      .object({
        notes: z.array(exerciseNoteSchema),
        timeSignature: z
          .object({
            numerator: z.number().int().positive(),
            denominator: z.number().int().positive(),
          })
          .passthrough()
          .optional(),
      })
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
    // DRILL: Reference-Drop pulse-steadiness drill (Lock The Pocket). All
    // behaviour admin-authored; must be declared here or the non-passthrough
    // schema STRIPS it on save (same trap noted on chordChart above). dropTargets
    // is non-empty so an enabled drill always fades something.
    referenceDrop: z
      .object({
        enabled: z.boolean(),
        // 1-based bar numbers within the loop that drop. Bound to the loop, so
        // the pattern can't desync (replaced the rolling every-N/drop-M rate).
        dropBars: z.array(z.number().int().positive()),
        dropTargets: z
          .array(z.enum(['drums', 'harmony', 'bass', 'click']))
          .min(1),
        fadeMs: z.number().int().nonnegative().optional(),
      })
      .optional(),
    // BASS COACH: how a player's take is graded. OPTIONAL on the wire (defaults to
    // 'grid' on read in the frontend) so legacy blocks without it aren't rejected;
    // the mandatory CHOICE is enforced in the admin form at publish, not here. Must
    // be declared or the non-passthrough schema STRIPS it on save (chordChart trap).
    gradingMode: z.enum(['grid', 'reference']).optional(),
    // BASS COACH (reference mode): admin-tuned onset preset for this card's stem.
    referenceOnset: z
      .object({
        sensitivity: z.number().positive().optional(),
        minOnsetGapSeconds: z.number().nonnegative().optional(),
        minRelativeStrength: z.number().min(0).max(1).optional(),
      })
      .optional(),
    // BASS COACH (reference mode): the admin-APPROVED reference analysis (ground
    // truth). onsetsSec are the human-verified transient times in the stem buffer's
    // own seconds. Must be declared or the non-passthrough schema strips it on save.
    referenceAnalysis: z
      .object({
        onsetsSec: z.array(z.number().nonnegative()),
        lengthsSec: z.array(z.number().nonnegative()).optional(),
        dynamics: z.array(z.number().min(0).max(1)).optional(),
        originalBpm: z.number().positive().optional(),
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
