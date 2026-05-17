'use client';

/**
 * HarmonyDisplay Component
 *
 * Displays the current chord progression with visual indicators.
 * Uses direct DOM updates via ref registration for jitter-free animations.
 */

import React from 'react';
import type { HarmonyDisplayProps } from '../types.js';

/**
 * Compact chord indicator display for the collapsed widget view
 */
export const HarmonyDisplay: React.FC<HarmonyDisplayProps> = React.memo(
  ({
    progression,
    currentChordIndex,
    isMuted,
    volume,
    registerChordIndicator,
  }) => {
    const isMutedOrZero = volume === 0 || isMuted;

    return (
      <div className="flex gap-1">
        {progression.slice(0, 4).map((chord, idx) => (
          <div
            key={idx}
            ref={(el) => registerChordIndicator(idx, el)}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-medium transition-all duration-200 bg-slate-700 text-slate-400"
          >
            {chord?.split('/')[0] || 'C'}
          </div>
        ))}
        <span
          className={`text-sm font-medium ${
            isMutedOrZero ? 'text-slate-600' : 'text-blue-400'
          }`}
        >
          {progression[currentChordIndex] || 'C'}
        </span>
      </div>
    );
  },
);

HarmonyDisplay.displayName = 'HarmonyDisplay';
