'use client';

import React, { useCallback, useEffect, useState } from 'react';
import type { TutorialBlock } from '@bassnotion/contracts';
import { Sparkles, ChevronRight } from 'lucide-react';
import { useViewTransitionRouter } from '@/lib/hooks/use-view-transition-router';

interface CelebrationBlockViewProps {
  block: TutorialBlock<'celebration'>;
  isActive: boolean;
  isCompleted: boolean;
  onComplete: () => void;
  onNext: () => void;
}

export const CelebrationBlockView = React.memo(function CelebrationBlockView({
  block,
  isActive,
  onComplete,
  onNext,
}: CelebrationBlockViewProps) {
  const { title, subtitle, ctaText, ctaAction = 'next', ctaUrl, nextTutorialSlug } = block.config;
  const [showContent, setShowContent] = useState(false);
  const { navigateWithTransition } = useViewTransitionRouter();

  useEffect(() => {
    if (isActive) {
      const timer = setTimeout(() => setShowContent(true), 300);
      return () => clearTimeout(timer);
    }
    setShowContent(false);
  }, [isActive]);

  const handleCta = useCallback(() => {
    onComplete();
    switch (ctaAction) {
      case 'next':
        onNext();
        break;
      case 'dashboard':
        navigateWithTransition('/app/bassment');
        break;
      case 'url':
        if (ctaUrl) {
          window.location.href = ctaUrl;
        }
        break;
      case 'next-tutorial':
        if (nextTutorialSlug) {
          navigateWithTransition(`/app/tutorials/${nextTutorialSlug}`);
        }
        break;
    }
  }, [onComplete, onNext, ctaAction, ctaUrl, nextTutorialSlug, navigateWithTransition]);

  return (
    <div className="h-full flex flex-col items-center justify-center px-6">
      <div
        className={`text-center space-y-8 transition-all duration-700 ${
          showContent ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
        }`}
      >
        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-500/30 to-blue-500/30 border-2 border-purple-400/40 flex items-center justify-center mx-auto animate-pulse">
          <Sparkles className="w-12 h-12 text-purple-300" />
        </div>

        <div className="space-y-3">
          <h2 className="text-3xl font-bold text-white">{title}</h2>
          {subtitle && (
            <p className="text-lg text-white/60 max-w-md mx-auto">{subtitle}</p>
          )}
        </div>

        <button
          onClick={handleCta}
          className="px-10 py-4 rounded-2xl bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-semibold text-lg tracking-wide shadow-lg shadow-purple-500/20 hover:shadow-purple-500/30 transition-all duration-200 inline-flex items-center gap-2"
        >
          {ctaText || 'Continue'}
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
});
