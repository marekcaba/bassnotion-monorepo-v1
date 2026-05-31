'use client';

/**
 * GrooveCardBlockForm — LAUNCH-02.5e admin form (single-key-set + PitchShift).
 *
 * Three stem URL inputs (bass / drums / harmony) plus title / subtitle /
 * BPM / original-key / length-bars. Stems are delivered at originalKey;
 * the runtime renders ±6 semitones via SoundTouchJS WSOLA on bass +
 * harmony (drums stay un-shifted by design).
 *
 * Follows the ExplainBlockForm convention: vanilla React (no react-hook-
 * form), raw text inputs for URLs. Admin paste-uploads URLs they've
 * already pushed to the `audio-samples` Supabase bucket.
 *
 * Server-side Zod validation at save time enforces the stem shape, the
 * bucket path pattern, and BPM/length bounds — see
 * apps/backend/src/domains/tutorials/admin-tutorials.service.ts.
 */

import { useCallback } from 'react';
import type {
  GrooveCardBlockConfig,
  GrooveCardStemSet,
} from '@bassnotion/contracts';
import { StemUploadButton } from './groove-card/StemUploadButton';

interface GrooveCardBlockFormProps {
  config: GrooveCardBlockConfig;
  onChange: (config: GrooveCardBlockConfig) => void;
  /** Current tutorial's slug; used to build storage paths for stem
   * uploads (`audio-samples/grooves/{tutorialSlug}/{keyFolder}/{stem}.ogg`).
   * If absent (e.g. on a brand-new unsaved tutorial that hasn't
   * received its slug yet), the upload button degrades to a `disabled`
   * state with a hint. */
  tutorialSlug?: string;
}

// Musical stems the admin uploads. The metronome click is NOT here —
// it's a fixed shared metronome (MIDI in /app, one bundled sample on
// the waitlist), never uploaded per groove.
const STEM_SLOTS = ['bass', 'drums', 'harmony'] as const;

export function GrooveCardBlockForm({
  config,
  onChange,
  tutorialSlug,
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

  const updateStem = useCallback(
    (stem: keyof GrooveCardStemSet, url: string) => {
      onChange({
        ...config,
        stems: { ...config.stems, [stem]: url },
      });
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
        <label className="space-y-1 block">
          <span className="text-xs text-white/50">YouTube URL (optional)</span>
          <input
            type="text"
            value={config.youtubeUrl ?? ''}
            onChange={(e) =>
              updateField('youtubeUrl', e.target.value || undefined)
            }
            placeholder="YouTube video URL or 11-char ID — shown above the card"
            className="w-full px-3 py-2 rounded-md bg-white/5 border border-white/10 text-white placeholder:text-white/30"
          />
        </label>
      </fieldset>

      {/* Stems */}
      <fieldset className="space-y-2">
        <legend className="text-xs uppercase tracking-wider text-white/40 mb-1">
          Stems — delivered at original key; runtime pitch-shifts ±6 semitones
        </legend>
        <p className="text-xs text-white/40">
          Stems write to the <code>audio-samples</code> Supabase bucket. Paste a
          public path or full URL into each field — the path pattern{' '}
          <code>/storage/v1/object/public/audio-samples/…</code> is enforced at
          save.
        </p>
        <div className="rounded-lg border border-white/10 p-3 space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {STEM_SLOTS.map((stem) => (
              <StemUploadButton
                key={stem}
                value={config.stems[stem]}
                onChange={(url) => updateStem(stem, url)}
                stemLabel={stem}
                uploadContext={{
                  tutorialSlug: tutorialSlug ?? 'unsaved',
                  keyFolder:
                    config.originalKey.trim().length > 0
                      ? config.originalKey
                      : 'default',
                  stem,
                }}
              />
            ))}
          </div>
        </div>
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
