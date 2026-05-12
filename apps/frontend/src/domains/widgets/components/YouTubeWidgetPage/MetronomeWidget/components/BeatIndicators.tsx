'use client';

/**
 * BeatIndicators Component
 *
 * Renders the beat indicator dots for the metronome widget.
 * Uses direct DOM manipulation via useQuarterNoteBeatSync for jitter-free updates.
 *
 * @example
 * <BeatIndicators
 *   beats={4}
 *   isPlaying={isPlaying}
 *   isVisible={isVisible}
 *   isMutedOrZero={isMutedOrZero}
 *   onClick={() => setIsExpanded(true)}
 * />
 */

import React, { memo } from 'react';
import { useQuarterNoteBeatSync } from '@/domains/widgets/hooks/useBeatGridSync';
import type { BeatIndicatorsProps } from '../types.js';

/**
 * Beat indicator dots component
 */
const BeatIndicatorsComponent = ({
  beats,
  isPlaying,
  isVisible,
  isMutedOrZero,
  onClick,
}: BeatIndicatorsProps) => {
  // Direct DOM beat synchronization (bypasses React state for jitter-free updates)
  // This hook subscribes directly to AtomicPlaybackClock and uses beatIndex (quarter notes)
  // updating DOM via classList.toggle() to eliminate jitter.
  // Debug with: window.__DEBUG_DOM_TIMING = true
  const { registerIndicator: registerBeatIndicator } = useQuarterNoteBeatSync({
    beats, // Use quarter-note beats count (4 for 4/4 time)
    isPlaying,
    activeClass: 'bg-green-400 shadow-lg shadow-green-400/50', // Brighter green for active beat
    inactiveClass: 'bg-green-600', // Darker green for inactive beats
    isVisible,
  });

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 px-3 py-2 rounded-xl bg-slate-800 shadow-[5px_5px_10px_rgba(0,0,0,0.5),-5px_-5px_10px_rgba(255,255,255,0.1)] hover:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.5),inset_-2px_-2px_5px_rgba(255,255,255,0.1)] transition-all duration-300 cursor-pointer ${
        isMutedOrZero ? 'opacity-50' : ''
      }`}
    >
      {/* Direct DOM beat indicators via ref registration */}
      {/* The hook's classList.toggle() updates these divs directly, bypassing React */}
      <div className="flex gap-1">
        {Array.from({ length: beats }, (_, idx) => (
          <div
            key={idx}
            ref={(el) => registerBeatIndicator(0, idx, el)}
            className="w-3 h-3 rounded-full transition-all duration-200 bg-green-600"
          />
        ))}
      </div>
    </button>
  );
};

// Memoize to prevent unnecessary re-renders
export const BeatIndicators = memo(BeatIndicatorsComponent);
