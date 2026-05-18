'use client';

/**
 * ExpandedControls Component
 *
 * Renders the expanded view of the metronome widget with:
 * - Sound preset selector
 * - Subdivision buttons (quarter, eighth, triplet)
 * - Test button
 * - Close button
 *
 * @example
 * <ExpandedControls
 *   currentSound={currentSound}
 *   subdivisions={subdivisions}
 *   trackIsReady={trackIsReady}
 *   onSoundChange={handleSoundChange}
 *   onSubdivisionChange={handleSubdivisionChange}
 *   onTestClick={testClick}
 *   onClose={() => setIsExpanded(false)}
 * />
 */

import React, { memo, useCallback } from 'react';
import {
  MetronomeSound,
  type MetronomeSoundType,
  type ExpandedControlsProps,
} from '../types.js';

/**
 * Expanded controls component for metronome settings
 */
const ExpandedControlsComponent = ({
  currentSound,
  subdivisions,
  trackIsReady,
  onSoundChange,
  onSubdivisionChange,
  onTestClick,
  onClose,
}: ExpandedControlsProps) => {
  // Memoize handlers
  const handleSoundSelect = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      onSoundChange(e.target.value as MetronomeSoundType);
    },
    [onSoundChange],
  );

  const handleSubdivQuarter = useCallback(() => {
    onSubdivisionChange(1);
  }, [onSubdivisionChange]);

  const handleSubdivEighth = useCallback(() => {
    onSubdivisionChange(2);
  }, [onSubdivisionChange]);

  const handleSubdivTriplet = useCallback(() => {
    onSubdivisionChange(3);
  }, [onSubdivisionChange]);

  return (
    <div className="flex items-center gap-4 w-full">
      <div className="flex-1">
        <div className="flex flex-col gap-2">
          {/* BPM Slider removed - tempo control is in TransportClock only */}

          {/* Sound Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 w-16">Sound:</span>
            <select
              value={currentSound}
              onChange={handleSoundSelect}
              className="flex-1 bg-slate-700 text-white text-xs rounded px-2 py-1"
            >
              {Object.entries(MetronomeSound).map(([key, value]) => (
                <option key={value} value={value}>
                  {key.charAt(0) + key.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
          </div>

          {/* Subdivision Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 w-16">Subdiv:</span>
            <div className="flex gap-1">
              <button
                onClick={handleSubdivQuarter}
                className={`px-2 py-1 text-xs rounded ${
                  subdivisions === 1
                    ? 'bg-green-600 text-white'
                    : 'bg-slate-700 text-slate-400'
                }`}
              >
                &#9833;
              </button>
              <button
                onClick={handleSubdivEighth}
                className={`px-2 py-1 text-xs rounded ${
                  subdivisions === 2
                    ? 'bg-green-600 text-white'
                    : 'bg-slate-700 text-slate-400'
                }`}
              >
                &#9835;
              </button>
              <button
                onClick={handleSubdivTriplet}
                className={`px-2 py-1 text-xs rounded ${
                  subdivisions === 3
                    ? 'bg-green-600 text-white'
                    : 'bg-slate-700 text-slate-400'
                }`}
              >
                &#9834;&#179;
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <button
          onClick={onTestClick}
          className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-500 transition-colors"
          disabled={!trackIsReady}
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

// Memoize to prevent unnecessary re-renders
export const ExpandedControls = memo(ExpandedControlsComponent);
