'use client';

import React, { useEffect } from 'react';
import { Loader2, Music } from 'lucide-react';

interface SampleLoadingOverlayProps {
  isVisible: boolean;
  progress: number;
  onComplete?: () => void;
}

/**
 * Loading overlay shown when user clicks "I Got It" before samples are ready.
 * Auto-dismisses when progress reaches 100%.
 */
export const SampleLoadingOverlay = React.memo(function SampleLoadingOverlay({
  isVisible,
  progress,
  onComplete,
}: SampleLoadingOverlayProps) {
  // Auto-dismiss when loading completes
  useEffect(() => {
    if (progress >= 100 && onComplete) {
      // Small delay to show 100% before dismissing
      const timer = setTimeout(onComplete, 300);
      return () => clearTimeout(timer);
    }
  }, [progress, onComplete]);

  if (!isVisible) return null;

  const percentComplete = Math.min(100, Math.max(0, Math.round(progress)));

  const getMessage = () => {
    if (percentComplete < 20) return 'Initializing audio...';
    if (percentComplete < 50) return 'Loading instruments...';
    if (percentComplete < 80) return 'Preparing samples...';
    if (percentComplete < 100) return 'Almost ready...';
    return 'Ready!';
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/95 backdrop-blur-sm flex items-center justify-center">
      <div className="text-center space-y-6 max-w-sm px-6">
        {/* Animated Icon */}
        <div className="relative w-20 h-20 mx-auto">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full animate-pulse opacity-50" />
          <div className="absolute inset-2 bg-slate-900 rounded-full flex items-center justify-center">
            {percentComplete < 100 ? (
              <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
            ) : (
              <Music className="w-8 h-8 text-green-400" />
            )}
          </div>
          {/* Progress ring */}
          <svg
            className="absolute inset-0 w-full h-full -rotate-90"
            viewBox="0 0 80 80"
          >
            <circle
              cx="40"
              cy="40"
              r="36"
              fill="none"
              stroke="currentColor"
              strokeWidth="4"
              className="text-slate-700"
            />
            <circle
              cx="40"
              cy="40"
              r="36"
              fill="none"
              stroke="url(#gradient)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={`${percentComplete * 2.26} 226`}
              className="transition-all duration-300"
            />
            <defs>
              <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#3b82f6" />
                <stop offset="100%" stopColor="#8b5cf6" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        {/* Progress Text */}
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-white">{getMessage()}</h3>
          <p className="text-sm text-slate-400">
            Preparing practice mode for you
          </p>
        </div>

        {/* Progress Bar */}
        <div className="w-full">
          <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300 ease-out"
              style={{ width: `${percentComplete}%` }}
            />
          </div>
          <p className="text-xs text-slate-500 mt-2 tabular-nums">
            {percentComplete}%
          </p>
        </div>
      </div>
    </div>
  );
});
