'use client';

/**
 * TextBlockForm - Configuration form for Text blocks.
 *
 * Provides a heading input, markdown content textarea, and a
 * variant selector (default, callout, tip, warning).
 */

import React, { useCallback } from 'react';
import type { TextBlockConfig } from '@bassnotion/contracts';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

type TextVariant = NonNullable<TextBlockConfig['variant']>;

interface VariantOption {
  value: TextVariant;
  label: string;
}

const VARIANT_OPTIONS: VariantOption[] = [
  { value: 'default', label: 'Default' },
  { value: 'callout', label: 'Callout' },
  { value: 'tip', label: 'Tip' },
  { value: 'warning', label: 'Warning' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface TextBlockFormProps {
  config: TextBlockConfig;
  onChange: (config: TextBlockConfig) => void;
}

export const TextBlockForm = React.memo(function TextBlockForm({
  config,
  onChange,
}: TextBlockFormProps) {
  const handleHeadingChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange({ ...config, heading: e.target.value });
    },
    [config, onChange],
  );

  const handleContentChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange({ ...config, content: e.target.value });
    },
    [config, onChange],
  );

  const handleVariantChange = useCallback(
    (variant: TextVariant) => {
      onChange({ ...config, variant });
    },
    [config, onChange],
  );

  return (
    <div className="space-y-4">
      {/* Heading */}
      <div>
        <label className="block text-xs text-white/40 mb-1">Heading</label>
        <input
          type="text"
          value={config.heading ?? ''}
          onChange={handleHeadingChange}
          placeholder="Optional section heading"
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/20"
        />
      </div>

      {/* Content */}
      <div>
        <label className="block text-xs text-white/40 mb-1">
          Content (Markdown)
        </label>
        <textarea
          value={config.content}
          onChange={handleContentChange}
          placeholder="Write your explanation, tips, or notes here..."
          rows={6}
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/20 resize-y"
        />
      </div>

      {/* Variant selector */}
      <div>
        <label className="block text-xs text-white/40 mb-2">Variant</label>
        <div className="flex flex-wrap gap-2">
          {VARIANT_OPTIONS.map(({ value, label }) => (
            <VariantToggle
              key={value}
              value={value}
              label={label}
              isSelected={(config.variant ?? 'default') === value}
              onSelect={handleVariantChange}
            />
          ))}
        </div>
      </div>
    </div>
  );
});

// ---------------------------------------------------------------------------
// Variant toggle pill (memoized)
// ---------------------------------------------------------------------------

interface VariantToggleProps {
  value: TextVariant;
  label: string;
  isSelected: boolean;
  onSelect: (variant: TextVariant) => void;
}

const VariantToggle = React.memo(function VariantToggle({
  value,
  label,
  isSelected,
  onSelect,
}: VariantToggleProps) {
  const handleClick = useCallback(() => {
    onSelect(value);
  }, [onSelect, value]);

  return (
    <button
      onClick={handleClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
        isSelected
          ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
          : 'bg-white/5 text-white/40 border border-white/10 hover:border-white/20'
      }`}
    >
      {label}
    </button>
  );
});
