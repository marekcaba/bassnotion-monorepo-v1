'use client';

/**
 * GrooveCardBlockForm — LAUNCH-02.5c admin form.
 *
 * Five key-set rows × four stem URL inputs each (20 total) plus title /
 * subtitle / BPM / original-key / length-bars / captions. Follows the
 * ExplainBlockForm convention: vanilla React (no react-hook-form), raw
 * text inputs for URLs. Admin paste-uploads URLs they've already pushed
 * to the `audio-samples` Supabase bucket — the BassEditor doesn't ship a
 * file picker for block stems (matches every other block form here).
 *
 * Server-side Zod validation at save time enforces the 5-key-set
 * structure, the bucket path pattern, and BPM/length bounds — see
 * apps/backend/src/domains/tutorials/admin-tutorials.service.ts.
 */

import { useCallback } from 'react';
import type {
  GrooveCardBlockConfig,
  GrooveCardKeySet,
} from '@bassnotion/contracts';

interface GrooveCardBlockFormProps {
  config: GrooveCardBlockConfig;
  onChange: (config: GrooveCardBlockConfig) => void;
}

const STEM_SLOTS = ['bass', 'drums', 'harmony', 'click'] as const;

export function GrooveCardBlockForm({
  config,
  onChange,
}: GrooveCardBlockFormProps) {
  const updateField = useCallback(
    <K extends keyof GrooveCardBlockConfig>(
      field: K,
      value: GrooveCardBlockConfig[K],
    ) => {
      onChange({ ...config, [field]: value });
    },
    [config, onChange],
  );

  const updateKeySet = useCallback(
    (index: number, partial: Partial<GrooveCardKeySet>) => {
      const nextKeys = config.keys.map((k, i) =>
        i === index ? { ...k, ...partial } : k,
      ) as GrooveCardBlockConfig['keys'];
      onChange({ ...config, keys: nextKeys });
    },
    [config, onChange],
  );

  const updateStem = useCallback(
    (keyIndex: number, stem: (typeof STEM_SLOTS)[number], url: string) => {
      const nextStems = {
        ...config.keys[keyIndex]!.stems,
        [stem]: url,
      };
      updateKeySet(keyIndex, { stems: nextStems });
    },
    [config.keys, updateKeySet],
  );

  const setDefaultKey = useCallback(
    (keyIndex: number) => {
      const nextKeys = config.keys.map((k, i) => ({
        ...k,
        isDefault: i === keyIndex,
      })) as GrooveCardBlockConfig['keys'];
      onChange({ ...config, keys: nextKeys });
    },
    [config, onChange],
  );

  return (
    <div className="space-y-4 text-sm">
      {/* Basics */}
      <fieldset className="space-y-2">
        <legend className="text-xs uppercase tracking-wider text-white/40 mb-1">
          Basics
        </legend>
        <input
          type="text"
          value={config.title}
          onChange={(e) => updateField('title', e.target.value)}
          placeholder="Title (e.g. Greasy Pocket)"
          className="w-full px-3 py-2 rounded-md bg-white/5 border border-white/10 text-white placeholder:text-white/30"
        />
        <input
          type="text"
          value={config.subtitle}
          onChange={(e) => updateField('subtitle', e.target.value)}
          placeholder="Subtitle (e.g. Funk in E)"
          className="w-full px-3 py-2 rounded-md bg-white/5 border border-white/10 text-white placeholder:text-white/30"
        />
        <div className="grid grid-cols-3 gap-2">
          <label className="space-y-1">
            <span className="text-xs text-white/50">Original BPM</span>
            <input
              type="number"
              min={50}
              max={180}
              value={config.originalBpm}
              onChange={(e) =>
                updateField('originalBpm', Number(e.target.value))
              }
              className="w-full px-3 py-2 rounded-md bg-white/5 border border-white/10 text-white"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-white/50">Original Key</span>
            <input
              type="text"
              value={config.originalKey}
              onChange={(e) => updateField('originalKey', e.target.value)}
              placeholder="E"
              className="w-full px-3 py-2 rounded-md bg-white/5 border border-white/10 text-white"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-white/50">Length (bars)</span>
            <input
              type="number"
              min={1}
              value={config.lengthBars}
              onChange={(e) =>
                updateField('lengthBars', Number(e.target.value))
              }
              className="w-full px-3 py-2 rounded-md bg-white/5 border border-white/10 text-white"
            />
          </label>
        </div>
      </fieldset>

      {/* Key sets */}
      <fieldset className="space-y-2">
        <legend className="text-xs uppercase tracking-wider text-white/40 mb-1">
          Key sets — 5 required at offsets −8, −4, 0, +4, +8
        </legend>
        <p className="text-xs text-white/40">
          Stems write to the <code>audio-samples</code> Supabase bucket. Paste a
          public path or full URL into each field — the path pattern{' '}
          <code>/storage/v1/object/public/audio-samples/…</code> is enforced at
          save.
        </p>
        {config.keys.map((keySet, keyIndex) => (
          <div
            key={keyIndex}
            className="rounded-lg border border-white/10 p-3 space-y-2"
          >
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/50 w-12">
                {keySet.semitoneOffset > 0
                  ? `+${keySet.semitoneOffset}`
                  : keySet.semitoneOffset}
              </span>
              <input
                type="text"
                value={keySet.label}
                onChange={(e) =>
                  updateKeySet(keyIndex, { label: e.target.value })
                }
                placeholder="Label (e.g. E)"
                className="flex-1 px-2 py-1.5 rounded-md bg-white/5 border border-white/10 text-white text-xs"
              />
              <label className="flex items-center gap-1.5 text-xs text-white/60">
                <input
                  type="radio"
                  name="defaultKey"
                  checked={keySet.isDefault}
                  onChange={() => setDefaultKey(keyIndex)}
                />
                Default
              </label>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {STEM_SLOTS.map((stem) => (
                <input
                  key={stem}
                  type="text"
                  value={keySet.stems[stem]}
                  onChange={(e) => updateStem(keyIndex, stem, e.target.value)}
                  placeholder={`${stem} URL`}
                  className="px-2 py-1.5 rounded-md bg-white/5 border border-white/10 text-white text-xs"
                />
              ))}
            </div>
          </div>
        ))}
      </fieldset>

      {/* Captions: card-wide UX copy lives in
          apps/frontend/src/domains/widgets/components/YouTubeWidgetPage/blocks/groove-card/captions.ts
          (DEFAULT_PREVIEW_CAPTION + DEFAULT_STATE_CAPTIONS). Edit that
          file to change the copy site-wide — no admin form needed.

          Allow bookmark: contract-only field, no UI surface in v1.
          When the bookmark feature lands, re-expose here. */}
    </div>
  );
}
