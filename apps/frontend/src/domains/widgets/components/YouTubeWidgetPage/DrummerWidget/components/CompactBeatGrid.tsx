'use client';

/**
 * CompactBeatGrid Component
 *
 * Renders a compact 3x8 grid of beat indicators with:
 * - Hi-hat, Snare, Kick rows
 * - Main 8th note dots
 * - 16th note subdivision ticks
 * - Direct DOM beat highlighting (jitter-free)
 */

import React from 'react';
import type { GridPatternWithSixteenths } from '../types.js';

/**
 * Props for the CompactBeatGrid component
 */
export interface CompactBeatGridProps {
  /** Current grid pattern to display */
  pattern: GridPatternWithSixteenths;
  /** Register indicator ref for direct DOM updates */
  registerIndicator: (row: number, col: number, el: HTMLDivElement | null) => void;
  /** Get eighth note duration for CSS transitions */
  getEighthNoteDurationMs: () => number;
}

/**
 * Compact 3x8 beat grid with direct DOM highlighting
 */
export const CompactBeatGrid: React.FC<CompactBeatGridProps> = ({
  pattern,
  registerIndicator,
  getEighthNoteDurationMs,
}) => {
  return (
    <div
      className="grid grid-rows-3 grid-cols-8 gap-1"
      style={
        {
          '--beat-fade-duration': `${Math.min(getEighthNoteDurationMs() * 0.4, 200)}ms`,
        } as React.CSSProperties
      }
    >
      {/* Hi-hat row (row index 0) */}
      {pattern.hihat.map((cell, idx) => (
        <div key={`hh-${idx}`} className="relative flex items-center justify-center">
          {/* Main 8th note dot */}
          <div
            className={`w-2 h-2 rounded-full ${
              cell.main ? 'bg-orange-500' : 'bg-slate-700'
            }`}
          />
          {/* Highlight overlay - DIRECT DOM via ref, bypasses React state */}
          <div
            ref={(el) => registerIndicator(0, idx, el)}
            style={{
              transition: 'opacity var(--beat-fade-duration, 174ms) ease-out',
              willChange: 'opacity',
              transform: 'translateZ(0)',
            }}
            className="absolute inset-0 w-2 h-2 rounded-full bg-green-400 shadow-lg shadow-green-400/50 opacity-0"
          />
          {/* 16th note subdivision tick - ONLY show if there's a hit */}
          {cell.sixteenth === 1 && idx < 7 && (
            <div className="absolute -right-1 w-1 h-1 rounded-full bg-orange-400" />
          )}
        </div>
      ))}

      {/* Snare row (row index 1) */}
      {pattern.snare.map((cell, idx) => (
        <div key={`sn-${idx}`} className="relative flex items-center justify-center">
          {/* Main 8th note dot */}
          <div
            className={`w-2 h-2 rounded-full ${
              cell.main ? 'bg-orange-500' : 'bg-slate-700'
            }`}
          />
          {/* Highlight overlay - DIRECT DOM via ref, bypasses React state */}
          <div
            ref={(el) => registerIndicator(1, idx, el)}
            style={{
              transition: 'opacity var(--beat-fade-duration, 174ms) ease-out',
              willChange: 'opacity',
              transform: 'translateZ(0)',
            }}
            className="absolute inset-0 w-2 h-2 rounded-full bg-green-400 shadow-lg shadow-green-400/50 opacity-0"
          />
          {/* 16th note subdivision tick - ONLY show if there's a hit */}
          {cell.sixteenth === 1 && idx < 7 && (
            <div className="absolute -right-1 w-1 h-1 rounded-full bg-orange-400" />
          )}
        </div>
      ))}

      {/* Kick row (row index 2) */}
      {pattern.kick.map((cell, idx) => (
        <div key={`k-${idx}`} className="relative flex items-center justify-center">
          {/* Main 8th note dot */}
          <div
            className={`w-2 h-2 rounded-full ${
              cell.main ? 'bg-orange-500' : 'bg-slate-700'
            }`}
          />
          {/* Highlight overlay - DIRECT DOM via ref, bypasses React state */}
          <div
            ref={(el) => registerIndicator(2, idx, el)}
            style={{
              transition: 'opacity var(--beat-fade-duration, 174ms) ease-out',
              willChange: 'opacity',
              transform: 'translateZ(0)',
            }}
            className="absolute inset-0 w-2 h-2 rounded-full bg-green-400 shadow-lg shadow-green-400/50 opacity-0"
          />
          {/* 16th note subdivision tick - ONLY show if there's a hit */}
          {cell.sixteenth === 1 && idx < 7 && (
            <div className="absolute -right-1 w-1 h-1 rounded-full bg-orange-400" />
          )}
        </div>
      ))}
    </div>
  );
};
