'use client';

/**
 * ChordProgressionView Component
 *
 * Displays the full chord progression with selection and visual indicators.
 * Used in the expanded widget view.
 */

import React from 'react';
import type { ChordProgressionViewProps } from '../types.js';

/**
 * Full chord progression view with selector
 */
export const ChordProgressionView: React.FC<ChordProgressionViewProps> = React.memo(
  ({
    progression,
    selectedProgression,
    availableProgressions,
    onProgressionChange,
    registerChordIndicator,
  }) => {
    return (
      <>
        {/* Progression Selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 w-16">Pattern:</span>
          <select
            value={selectedProgression}
            onChange={(e) => onProgressionChange(e.target.value)}
            className="flex-1 bg-slate-700 text-white text-xs rounded px-2 py-1"
          >
            {availableProgressions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>

        {/* Chord Display */}
        <div className="flex items-center gap-1">
          <span className="text-xs text-slate-400 w-16">Chords:</span>
          <div className="flex gap-1">
            {progression.map((chord, idx) => (
              <div
                key={idx}
                ref={(el) => registerChordIndicator(idx, el)}
                className="w-8 h-6 rounded text-xs flex items-center justify-center font-medium transition-all duration-200 cursor-default bg-slate-700 text-slate-400"
              >
                {chord?.split('/')[0] || 'C'}
              </div>
            ))}
          </div>
        </div>
      </>
    );
  }
);

ChordProgressionView.displayName = 'ChordProgressionView';
