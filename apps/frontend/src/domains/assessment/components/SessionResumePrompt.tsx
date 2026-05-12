'use client';

/**
 * SessionResumePrompt
 *
 * Shown when a user has a saved assessment session.
 * Allows them to resume or start fresh.
 * Styled to match V1 assessment warm theme.
 */

import { PlayCircle, RefreshCw } from 'lucide-react';

export interface SessionResumePromptProps {
  onResume: () => void;
  onStartFresh: () => void;
}

export function SessionResumePrompt({
  onResume,
  onStartFresh,
}: SessionResumePromptProps) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Card with warm glow */}
        <div className="relative">
          <div className="absolute -inset-1 bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-amber-500/10 rounded-2xl blur-xl opacity-50" />

          <div className="relative bg-neutral-900/80 backdrop-blur-sm rounded-xl p-8 ring-1 ring-white/10 text-center">
            {/* Icon with warm styling */}
            <div className="mb-6">
              <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-amber-500/30 to-orange-600/20 flex items-center justify-center border border-amber-500/20">
                <PlayCircle className="w-10 h-10 text-amber-400" />
              </div>
            </div>

            {/* Title */}
            <h2
              className="text-2xl font-semibold text-white mb-2 tracking-tight"
              style={{ fontFamily: 'var(--font-inter), sans-serif' }}
            >
              Welcome Back!
            </h2>

            {/* Description */}
            <p
              className="text-neutral-400 mb-8 leading-relaxed"
              style={{ fontFamily: 'var(--font-inter), sans-serif' }}
            >
              We found a saved assessment session. Would you like to continue
              where you left off?
            </p>

            {/* Buttons */}
            <div className="space-y-4">
              <button
                onClick={onResume}
                className="group relative w-full py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-medium transition-all duration-300 hover:shadow-lg hover:shadow-amber-500/25 hover:-translate-y-0.5 flex items-center justify-center gap-2"
                style={{ fontFamily: 'var(--font-inter), sans-serif' }}
              >
                <PlayCircle className="w-5 h-5" />
                <span className="relative z-10">Continue Assessment</span>
                <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-amber-400 to-orange-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </button>

              <button
                onClick={onStartFresh}
                className="w-full py-4 border-2 border-neutral-700 text-neutral-300 hover:border-neutral-600 hover:bg-neutral-800/50 rounded-xl transition-all duration-200 flex items-center justify-center gap-2"
                style={{ fontFamily: 'var(--font-inter), sans-serif' }}
              >
                <RefreshCw className="w-5 h-5" />
                Start Fresh
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
