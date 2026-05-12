'use client';

/**
 * AssessmentError
 *
 * Shows an error state with retry option.
 * Styled to match V1 assessment warm theme.
 */

import { AlertCircle, RefreshCw } from 'lucide-react';

export interface AssessmentErrorProps {
  error: string;
  onRetry: () => void;
}

export function AssessmentError({ error, onRetry }: AssessmentErrorProps) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center max-w-md mx-auto">
        {/* Warning icon with warm styling */}
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
          <AlertCircle className="w-8 h-8 text-amber-400" />
        </div>
        <h2
          className="text-3xl font-medium text-white mb-3 tracking-tight"
          style={{ fontFamily: 'var(--font-cormorant), serif' }}
        >
          Something Went Wrong
        </h2>
        <p
          className="text-neutral-400 mb-8 leading-relaxed"
          style={{ fontFamily: 'var(--font-dm-sans), sans-serif' }}
        >
          {error}
        </p>
        <button
          onClick={onRetry}
          className="group relative px-8 py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-medium transition-all duration-300 hover:shadow-lg hover:shadow-amber-500/25 hover:-translate-y-0.5 inline-flex items-center gap-2"
          style={{ fontFamily: 'var(--font-dm-sans), sans-serif' }}
        >
          <RefreshCw className="w-5 h-5" />
          <span className="relative z-10">Try Again</span>
          <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-amber-400 to-orange-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        </button>
      </div>
    </div>
  );
}
