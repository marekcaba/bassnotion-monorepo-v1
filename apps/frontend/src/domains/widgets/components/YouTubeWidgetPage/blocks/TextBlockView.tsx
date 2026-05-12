'use client';

import React, { useCallback } from 'react';
import type { TutorialBlock } from '@bassnotion/contracts';
import { ChevronRight } from 'lucide-react';

interface TextBlockViewProps {
  block: TutorialBlock<'text'>;
  isActive: boolean;
  isCompleted: boolean;
  onComplete: () => void;
  onNext: () => void;
}

const VARIANT_STYLES = {
  default: 'bg-transparent',
  callout: 'bg-blue-500/10 border border-blue-500/20 rounded-2xl p-6',
  tip: 'bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-6',
  warning: 'bg-amber-500/10 border border-amber-500/20 rounded-2xl p-6',
} as const;

export const TextBlockView = React.memo(function TextBlockView({
  block,
  onComplete,
  onNext,
}: TextBlockViewProps) {
  const { content, heading, variant = 'default' } = block.config;

  const handleContinue = useCallback(() => {
    onComplete();
    onNext();
  }, [onComplete, onNext]);

  return (
    <div className="h-full overflow-y-auto flex items-center justify-center">
      <div className="mx-auto px-4 py-8 w-full max-w-2xl">
        <div className={VARIANT_STYLES[variant]}>
          {heading && (
            <h2 className="text-2xl font-bold text-white mb-4">{heading}</h2>
          )}
          <div className="prose prose-invert prose-sm max-w-none text-white/80 whitespace-pre-wrap">
            {content}
          </div>
        </div>

        <div className="mt-8 text-center">
          <button
            onClick={handleContinue}
            className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold text-base tracking-wide shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 transition-all duration-200 inline-flex items-center gap-2"
          >
            Continue
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
});
