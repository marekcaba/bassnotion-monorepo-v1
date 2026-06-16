/**
 * groove-card-block.schema — LAUNCH-02.5c tests, updated for 02.5e
 * (single-key-set + PitchShift).
 *
 * Covers the validator's contract:
 *   - Valid config passes
 *   - Non-groove-card blocks pass through untouched
 *   - All 3 stem URLs must match the audio-samples bucket path pattern,
 *     host-agnostic (staging URL and prod URL both pass)
 *   - BPM bounds [50, 180]
 *   - lengthBars must be a positive integer
 */

import { describe, it, expect } from 'vitest';
import {
  grooveCardBlockConfigSchema,
  grooveCardStemUrlSchema,
  validateGrooveCardBlocks,
} from '../groove-card-block.schema.js';
import type { GrooveCardBlockConfig } from '@bassnotion/contracts';

function validConfig(
  overrides: Partial<GrooveCardBlockConfig> = {},
): GrooveCardBlockConfig {
  const stemBase =
    'https://example.supabase.co/storage/v1/object/public/audio-samples';
  return {
    title: 'Greasy Pocket',
    subtitle: 'Funk in E',
    originalBpm: 104,
    originalKey: 'E',
    lengthBars: 4,
    stems: {
      bass: `${stemBase}/funk/bass.ogg`,
      drums: `${stemBase}/funk/drums.ogg`,
      harmony: `${stemBase}/funk/harmony.ogg`,
    },
    previewCaption: '',
    stateCaptions: {},
    allowBookmark: false,
    ...overrides,
  };
}

describe('grooveCardStemUrlSchema — bucket path pattern', () => {
  it('accepts the staging Supabase URL host', () => {
    const url =
      'https://vraxryaaznpkvtkindpn.supabase.co/storage/v1/object/public/audio-samples/funk/bass.ogg';
    expect(grooveCardStemUrlSchema.safeParse(url).success).toBe(true);
  });

  it('accepts the production Supabase URL host', () => {
    const url =
      'https://iuuplfrktnzsbzibpfjm.supabase.co/storage/v1/object/public/audio-samples/funk/bass.ogg';
    expect(grooveCardStemUrlSchema.safeParse(url).success).toBe(true);
  });

  it('accepts a relative path that still matches the bucket pattern', () => {
    const url = '/storage/v1/object/public/audio-samples/funk/bass.ogg';
    expect(grooveCardStemUrlSchema.safeParse(url).success).toBe(true);
  });

  it('rejects a URL pointing at a different bucket', () => {
    const url =
      'https://example.supabase.co/storage/v1/object/public/wrong-bucket/funk/bass.ogg';
    const result = grooveCardStemUrlSchema.safeParse(url);
    expect(result.success).toBe(false);
  });

  it('rejects an arbitrary external URL', () => {
    const result = grooveCardStemUrlSchema.safeParse(
      'https://random.example.com/song.mp3',
    );
    expect(result.success).toBe(false);
  });

  it('accepts an empty string (draft state — admin has not pasted the URL yet)', () => {
    // Stem URLs are filled in over multiple admin edits. An empty
    // string passes the auto-save validator; publish-time "all 20
    // stems required" enforcement belongs to the UI, not this schema.
    const result = grooveCardStemUrlSchema.safeParse('');
    expect(result.success).toBe(true);
  });
});

describe('grooveCardBlockConfigSchema', () => {
  it('accepts a fully-valid config', () => {
    const result = grooveCardBlockConfigSchema.safeParse(validConfig());
    expect(result.success).toBe(true);
  });

  it('rejects BPM below 50', () => {
    const result = grooveCardBlockConfigSchema.safeParse(
      validConfig({ originalBpm: 30 }),
    );
    expect(result.success).toBe(false);
  });

  it('rejects BPM above 180', () => {
    const result = grooveCardBlockConfigSchema.safeParse(
      validConfig({ originalBpm: 300 }),
    );
    expect(result.success).toBe(false);
  });

  it('rejects non-integer BPM', () => {
    const result = grooveCardBlockConfigSchema.safeParse(
      validConfig({ originalBpm: 104.5 }),
    );
    expect(result.success).toBe(false);
  });

  it('rejects zero or negative lengthBars', () => {
    expect(
      grooveCardBlockConfigSchema.safeParse(validConfig({ lengthBars: 0 }))
        .success,
    ).toBe(false);
    expect(
      grooveCardBlockConfigSchema.safeParse(validConfig({ lengthBars: -1 }))
        .success,
    ).toBe(false);
  });

  it('rejects stem URLs from outside the audio-samples bucket', () => {
    const base = validConfig();
    const result = grooveCardBlockConfigSchema.safeParse({
      ...base,
      stems: { ...base.stems, bass: 'https://random.example.com/bass.ogg' },
    });
    expect(result.success).toBe(false);
  });

  it('keeps an admin-authored referenceDrop (not stripped on save)', () => {
    const referenceDrop = {
      enabled: true,
      dropBars: [1, 2, 5, 6],
      dropTargets: ['drums' as const, 'harmony' as const, 'bass' as const],
      fadeMs: 80,
    };
    const result = grooveCardBlockConfigSchema.safeParse(
      validConfig({ referenceDrop }),
    );
    expect(result.success).toBe(true);
    // The whole point: the field SURVIVES validation (non-passthrough schema
    // would otherwise strip an undeclared key) — incl. the per-loop dropBars mask.
    expect(
      result.success && (result.data as { referenceDrop?: unknown }).referenceDrop,
    ).toEqual(referenceDrop);
  });

  it('rejects a referenceDrop with no dropTargets (an enabled drill must fade something)', () => {
    const result = grooveCardBlockConfigSchema.safeParse(
      validConfig({
        referenceDrop: {
          enabled: true,
          dropBars: [1, 2],
          dropTargets: [],
        },
      }),
    );
    expect(result.success).toBe(false);
  });
});

describe('validateGrooveCardBlocks — top-level validator', () => {
  it('passes through non-groove-card blocks untouched', () => {
    const blocks = [
      { id: 'a', type: 'video', title: 'Video', config: {}, order: 0 },
      {
        id: 'b',
        type: 'text',
        title: 'Text',
        config: { content: 'hi' },
        order: 1,
      },
    ];
    expect(validateGrooveCardBlocks(blocks)).toBe(blocks);
  });

  it('accepts a valid groove-card block alongside other types', () => {
    const grooveCard = {
      id: 'gc-1',
      type: 'groove-card',
      title: 'Greasy Pocket',
      config: validConfig(),
      order: 1,
    };
    const blocks = [
      { id: 'v-1', type: 'video', title: 'Video', config: {}, order: 0 },
      grooveCard,
    ];
    expect(() => validateGrooveCardBlocks(blocks)).not.toThrow();
  });

  it('throws with a helpful message on invalid groove-card block', () => {
    const grooveCard = {
      id: 'gc-1',
      type: 'groove-card',
      title: 'Bad',
      config: validConfig({ originalBpm: 9999 }),
      order: 0,
    };
    expect(() => validateGrooveCardBlocks([grooveCard])).toThrow(
      /index 0.*BPM/,
    );
  });

  it('throws when blocks is not an array', () => {
    expect(() => validateGrooveCardBlocks({} as unknown)).toThrow(
      'blocks must be an array',
    );
  });

  it('returns the same array reference when valid', () => {
    const blocks = [
      { id: 'a', type: 'video', title: 'V', config: {}, order: 0 },
    ];
    expect(validateGrooveCardBlocks(blocks)).toBe(blocks);
  });
});
