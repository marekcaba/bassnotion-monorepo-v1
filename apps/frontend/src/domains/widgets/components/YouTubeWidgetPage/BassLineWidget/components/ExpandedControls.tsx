'use client';

/**
 * ExpandedControls Component
 *
 * Displays expanded controls for the bass widget including:
 * - Pattern selector
 * - Articulation selector
 * - Sampler status
 * - Test and close buttons
 *
 * @example
 * <ExpandedControls
 *   pattern={pattern}
 *   currentArticulation={currentArticulation}
 *   samplerReady={samplerReady}
 *   samplesLoaded={samplesLoaded}
 *   totalSamples={totalSamples}
 *   availablePatterns={Object.keys(BASS_PATTERNS)}
 *   onPatternChange={onPatternChange}
 *   onArticulationChange={handleArticulationChange}
 *   onTestNote={testNote}
 *   onClose={() => setIsExpanded(false)}
 * />
 */

import React, { memo } from 'react';
import { BassArticulation } from '../types.js';
import type { ExpandedControlsProps, BassArticulationType } from '../types.js';

/**
 * Expanded controls component for bass widget
 */
const ExpandedControlsComponent = ({
  pattern,
  currentArticulation,
  samplerReady,
  samplesLoaded,
  totalSamples,
  availablePatterns,
  onPatternChange,
  onArticulationChange,
  onTestNote,
  onClose,
}: ExpandedControlsProps) => {
  return (
    <div className="flex items-center gap-4 w-full">
      <div className="flex-1">
        <div className="flex flex-col gap-2">
          {/* Pattern Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 w-16">Pattern:</span>
            <select
              value={pattern}
              onChange={(e) => onPatternChange(e.target.value)}
              className="flex-1 bg-slate-700 text-white text-xs rounded px-2 py-1"
            >
              {availablePatterns.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          {/* Articulation Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 w-16">Style:</span>
            <div className="flex gap-1">
              {Object.entries(BassArticulation).map(([key, value]) => (
                <button
                  key={value}
                  onClick={() => onArticulationChange(value as BassArticulationType)}
                  className={`px-2 py-1 text-xs rounded ${
                    currentArticulation === value
                      ? 'bg-purple-600 text-white'
                      : 'bg-slate-700 text-slate-400'
                  }`}
                >
                  {key.charAt(0) + key.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Status */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 w-16">Status:</span>
            {samplerReady ? (
              samplesLoaded > 0 ? (
                <span className="text-xs text-green-500">
                  {samplesLoaded} samples loaded
                </span>
              ) : totalSamples > 0 ? (
                <span className="text-xs text-blue-400">
                  Ready ({totalSamples} notes)
                </span>
              ) : (
                <span className="text-xs text-blue-400">
                  Ready (on-demand loading)
                </span>
              )
            ) : (
              <span className="text-xs text-yellow-500">
                Initializing sampler...
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <button
          onClick={onTestNote}
          className="px-2 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={!samplerReady}
        >
          Test
        </button>
        <button
          onClick={onClose}
          className="px-2 py-1 text-xs bg-slate-700 text-slate-300 rounded hover:bg-slate-600 transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
};

export const ExpandedControls = memo(ExpandedControlsComponent);
