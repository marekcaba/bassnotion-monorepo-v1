'use client';

/**
 * CountdownIndicator Component
 *
 * Displays countdown dots above the play button to indicate
 * the remaining beats before playback starts.
 */

import React, { useRef, useLayoutEffect, useState } from 'react';
import type { CountdownIndicatorProps } from '../types.js';

/**
 * Renders countdown beat indicators as dots
 */
export function CountdownIndicator({
  totalBeats,
  currentBeat,
  isCountingDown,
}: CountdownIndicatorProps) {
  // Track previous state to detect transitions
  const prevIsCountingDownRef = useRef(isCountingDown);
  const prevCurrentBeatRef = useRef(currentBeat);

  // Fade-out state
  const [fadeOutState, setFadeOutState] = useState<{
    active: boolean;
    lastBeat: number;
  }>({ active: false, lastBeat: 0 });

  // Use useLayoutEffect to set fade-out state synchronously before paint
  // This prevents the flash where dots briefly show inactive state
  useLayoutEffect(() => {
    const wasCountingDown = prevIsCountingDownRef.current;
    const prevBeat = prevCurrentBeatRef.current;

    // Update refs for next render
    prevIsCountingDownRef.current = isCountingDown;
    prevCurrentBeatRef.current = currentBeat;

    // Detect countdown end: was counting, now stopped
    if (wasCountingDown && !isCountingDown) {
      // Use the previous beat as the last current beat
      setFadeOutState({ active: true, lastBeat: prevBeat });

      // Reset after animation completes
      const timer = setTimeout(() => {
        setFadeOutState({ active: false, lastBeat: 0 });
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [isCountingDown, currentBeat]);

  if (totalBeats === 0) {
    return null;
  }

  return (
    <>
      {/* Global keyframe animations for countdown beats */}
      <style jsx global>{`
        @keyframes currentBeatPulse {
          0% {
            opacity: 0.1;
            transform: scale(1);
          }
          100% {
            opacity: 1;
            transform: scale(1.25);
          }
        }
        @keyframes pastBeatTransition {
          0% {
            opacity: 1;
            transform: scale(1.25);
          }
          100% {
            opacity: 0.6;
            transform: scale(1);
          }
        }
        @keyframes fadeOutFromPast {
          0% {
            opacity: 0.6;
            transform: scale(1);
          }
          100% {
            opacity: 0.1;
            transform: scale(1);
          }
        }
        @keyframes fadeOutFromCurrent {
          0% {
            opacity: 1;
            transform: scale(1.25);
          }
          50% {
            opacity: 0.6;
            transform: scale(1);
          }
          100% {
            opacity: 0.1;
            transform: scale(1);
          }
        }
      `}</style>
      <div className="flex items-center justify-center gap-2 mb-1">
        {Array.from({ length: totalBeats }).map((_, index) => {
          const beatNumber = index + 1; // Convert 0-based index to 1-based beat number

          // Determine dot state and styling
          const isCurrentBeat = isCountingDown && beatNumber === currentBeat;
          const isPastBeat = isCountingDown && beatNumber < currentBeat;

          // Build inline style for animations
          let dotStyle: React.CSSProperties = {};
          if (isCurrentBeat) {
            dotStyle = { animation: 'currentBeatPulse 0.15s ease-out forwards' };
          } else if (isPastBeat) {
            dotStyle = { animation: 'pastBeatTransition 0.3s ease-out forwards' };
          } else if (fadeOutState.active) {
            // Use different animation for the last current beat vs past beats
            if (beatNumber === fadeOutState.lastBeat) {
              // Last beat was current - animate from 100%/1.25x → 60%/1x → 10%/1x
              dotStyle = { animation: 'fadeOutFromCurrent 0.45s ease-out forwards' };
            } else {
              // Other beats were past - animate from 60%/1x → 10%/1x
              dotStyle = { animation: 'fadeOutFromPast 0.3s ease-out forwards' };
            }
          }

          let dotClass = 'w-3 h-3 rounded-full ';

          if (isCurrentBeat) {
            // Current countdown beat - animated pulse with glow
            dotClass += 'bg-blue-500 shadow-lg shadow-blue-400/50';
          } else if (isPastBeat) {
            // Past countdown beats - animate opacity 100%→60%, scale 125%→100%
            dotClass += 'bg-blue-500';
          } else if (fadeOutState.active) {
            // Fading out - use full opacity bg, animation handles the fade
            dotClass += 'bg-blue-500';
          } else {
            // Inactive/waiting beats - dim blue
            dotClass += 'bg-blue-500/10';
          }

          return (
            <div
              key={index}
              className={dotClass}
              style={dotStyle}
              aria-label={`Beat ${beatNumber}${isCurrentBeat ? ' (current)' : ''}`}
            />
          );
        })}
      </div>
    </>
  );
}
