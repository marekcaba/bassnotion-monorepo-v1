'use client';

/**
 * CelebrationBlockForm - Configuration form for Celebration blocks.
 *
 * Allows editing the celebration title, subtitle, animation type,
 * sound effect, and CTA (call-to-action) button configuration.
 */

import React, { useCallback } from 'react';
import type { CelebrationBlockConfig } from '@bassnotion/contracts';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

type AnimationType = NonNullable<CelebrationBlockConfig['animationType']>;
type SoundEffect = NonNullable<CelebrationBlockConfig['soundEffect']>;
type CtaAction = NonNullable<CelebrationBlockConfig['ctaAction']>;

interface SelectOption<T extends string> {
  value: T;
  label: string;
}

const ANIMATION_OPTIONS: SelectOption<AnimationType>[] = [
  { value: 'confetti', label: 'Confetti' },
  { value: 'glow', label: 'Glow' },
  { value: 'fireworks', label: 'Fireworks' },
];

const SOUND_OPTIONS: SelectOption<SoundEffect>[] = [
  { value: 'success', label: 'Success' },
  { value: 'unlock', label: 'Unlock' },
  { value: 'fanfare', label: 'Fanfare' },
];

const CTA_ACTION_OPTIONS: SelectOption<CtaAction>[] = [
  { value: 'next', label: 'Next block' },
  { value: 'next-tutorial', label: 'Next tutorial' },
  { value: 'dashboard', label: 'Back to Bassment' },
  { value: 'url', label: 'Custom URL' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface CelebrationBlockFormProps {
  config: CelebrationBlockConfig;
  onChange: (config: CelebrationBlockConfig) => void;
  /** Available tutorials for "Next tutorial" CTA action */
  tutorials?: Array<{ slug: string; title: string }>;
}

export const CelebrationBlockForm = React.memo(function CelebrationBlockForm({
  config,
  onChange,
  tutorials = [],
}: CelebrationBlockFormProps) {
  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange({ ...config, title: e.target.value });
    },
    [config, onChange],
  );

  const handleSubtitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange({ ...config, subtitle: e.target.value });
    },
    [config, onChange],
  );

  const handleAnimationChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      onChange({
        ...config,
        animationType: (e.target.value || undefined) as
          | AnimationType
          | undefined,
      });
    },
    [config, onChange],
  );

  const handleSoundChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      onChange({
        ...config,
        soundEffect: (e.target.value || undefined) as SoundEffect | undefined,
      });
    },
    [config, onChange],
  );

  const handleCtaTextChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange({ ...config, ctaText: e.target.value });
    },
    [config, onChange],
  );

  const handleCtaActionChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      onChange({
        ...config,
        ctaAction: (e.target.value || undefined) as CtaAction | undefined,
      });
    },
    [config, onChange],
  );

  const handleCtaUrlChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange({ ...config, ctaUrl: e.target.value });
    },
    [config, onChange],
  );

  const handleNextTutorialSlugChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      onChange({ ...config, nextTutorialSlug: e.target.value || undefined });
    },
    [config, onChange],
  );

  return (
    <div className="space-y-4">
      {/* Celebration title */}
      <div>
        <label className="block text-xs text-white/40 mb-1">
          Celebration Title
        </label>
        <input
          type="text"
          value={config.title}
          onChange={handleTitleChange}
          placeholder="e.g., Great job!"
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/20"
        />
      </div>

      {/* Subtitle */}
      <div>
        <label className="block text-xs text-white/40 mb-1">Subtitle</label>
        <input
          type="text"
          value={config.subtitle ?? ''}
          onChange={handleSubtitleChange}
          placeholder="Optional subtitle text"
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/20"
        />
      </div>

      {/* Animation type + Sound effect (side by side) */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-white/40 mb-1">Animation</label>
          <select
            value={config.animationType ?? ''}
            onChange={handleAnimationChange}
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
          >
            <option value="">None</option>
            {ANIMATION_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-white/40 mb-1">
            Sound Effect
          </label>
          <select
            value={config.soundEffect ?? ''}
            onChange={handleSoundChange}
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
          >
            <option value="">None</option>
            {SOUND_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* CTA configuration */}
      <div>
        <label className="block text-xs text-white/40 mb-1">
          CTA Button Text
        </label>
        <input
          type="text"
          value={config.ctaText ?? ''}
          onChange={handleCtaTextChange}
          placeholder="e.g., Continue"
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/20"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-white/40 mb-1">CTA Action</label>
          <select
            value={config.ctaAction ?? ''}
            onChange={handleCtaActionChange}
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
          >
            <option value="">None</option>
            {CTA_ACTION_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {config.ctaAction === 'url' && (
          <div>
            <label className="block text-xs text-white/40 mb-1">CTA URL</label>
            <input
              type="text"
              value={config.ctaUrl ?? ''}
              onChange={handleCtaUrlChange}
              placeholder="https://..."
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/20"
            />
          </div>
        )}

        {config.ctaAction === 'next-tutorial' && (
          <div>
            <label className="block text-xs text-white/40 mb-1">
              Next Tutorial
            </label>
            <select
              value={config.nextTutorialSlug ?? ''}
              onChange={handleNextTutorialSlugChange}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
            >
              <option value="">Select a tutorial...</option>
              {tutorials.map(({ slug, title }) => (
                <option key={slug} value={slug}>
                  {title}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  );
});
