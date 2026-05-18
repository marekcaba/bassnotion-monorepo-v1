'use client';

/**
 * ExpandedPatternEditor Component
 *
 * Renders the expanded drum pattern editor with:
 * - Pattern selector dropdown
 * - Pattern library browser
 * - Interactive drum grid with clickable cells
 * - Test/Close buttons
 */

import React from 'react';
import { Music2 } from 'lucide-react';
import type {
  GridPatternWithSixteenths,
  GridCell,
  PatternLibraryItem,
} from '../types.js';
import { DRUM_PATTERNS } from '../types.js';

/**
 * Props for the ExpandedPatternEditor component
 */
export interface ExpandedPatternEditorProps {
  /** Current pattern name */
  patternName: string;
  /** Current grid pattern */
  currentPattern: GridPatternWithSixteenths;
  /** Current beat index (for highlighting) */
  currentBeat: number;
  /** Whether playback is active */
  isPlaying: boolean;
  /** Tutorial ID (for pattern library) */
  tutorialId?: string;
  /** Whether pattern library is visible */
  showPatternLibrary: boolean;
  /** Pattern library loading state */
  isPatternLibraryLoading: boolean;
  /** Available drum patterns from library */
  availableDrumPatterns: PatternLibraryItem[];
  /** Currently selected pattern from library */
  selectedDrumPattern?: PatternLibraryItem;

  // Handlers
  onPatternChange: (pattern: string) => void;
  onTogglePatternLibrary: () => void;
  onSelectLibraryPattern: (pattern: PatternLibraryItem) => void;
  onToggleDrum: (drum: 'kick' | 'snare' | 'hihat', index: number) => void;
  onTestDrum: (padNum: number) => void;
  onClose: () => void;
  onTestAll: () => void;
  trackIsReady: boolean;
}

/**
 * Expanded pattern editor with full controls
 */
export const ExpandedPatternEditor: React.FC<ExpandedPatternEditorProps> = ({
  patternName,
  currentPattern,
  currentBeat,
  isPlaying,
  tutorialId,
  showPatternLibrary,
  isPatternLibraryLoading,
  availableDrumPatterns,
  selectedDrumPattern,
  onPatternChange,
  onTogglePatternLibrary,
  onSelectLibraryPattern,
  onToggleDrum,
  onTestDrum,
  onClose,
  onTestAll,
  trackIsReady,
}) => {
  return (
    <div className="flex items-center gap-4 w-full">
      <div className="flex-1">
        <div className="flex flex-col gap-2">
          {/* Pattern Selector with Library Button */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 w-16">Pattern:</span>
            <select
              value={patternName}
              onChange={(e) => onPatternChange(e.target.value)}
              className="flex-1 bg-slate-700 text-white text-xs rounded px-2 py-1"
            >
              {Object.keys(DRUM_PATTERNS).map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            {/* Pattern Library Button */}
            {tutorialId && (
              <button
                onClick={onTogglePatternLibrary}
                className="p-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded transition-colors"
                title="Browse Pattern Library"
              >
                <Music2 className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Pattern Library Selector */}
          {showPatternLibrary && tutorialId && (
            <div className="p-2 bg-slate-800 rounded-lg border border-slate-700">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-300">
                  Pattern Library
                </span>
                <button
                  onClick={onTogglePatternLibrary}
                  className="text-xs text-slate-500 hover:text-slate-400"
                >
                  ✕
                </button>
              </div>
              {isPatternLibraryLoading ? (
                <div className="text-xs text-slate-500">
                  Loading patterns...
                </div>
              ) : (
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {availableDrumPatterns.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => onSelectLibraryPattern(p)}
                      className={`w-full text-left p-1.5 text-xs rounded hover:bg-slate-700 transition-colors ${
                        selectedDrumPattern?.id === p.id
                          ? 'bg-slate-700 text-orange-400'
                          : 'text-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span>{p.name}</span>
                        {p.genre && (
                          <span className="text-xs text-slate-500">
                            {p.genre}
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Drum pattern grid */}
          <div className="space-y-1">
            {/* Hi-hat row */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => onTestDrum(5)}
                className="text-xs font-mono text-orange-400 w-6 hover:text-orange-300"
              >
                HH
              </button>
              <div className="grid grid-cols-8 gap-1">
                {currentPattern.hihat.map((beat, i) => (
                  <button
                    key={i}
                    onClick={() => onToggleDrum('hihat', i)}
                    className={`w-4 h-4 rounded-full transition-all duration-200 cursor-pointer hover:scale-110 ${
                      currentBeat === i && isPlaying
                        ? 'bg-orange-300 shadow-lg shadow-orange-300/50'
                        : beat.main
                          ? 'bg-orange-500'
                          : 'bg-slate-700'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Snare row */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => onTestDrum(3)}
                className="text-xs font-mono text-orange-400 w-6 hover:text-orange-300"
              >
                SN
              </button>
              <div className="grid grid-cols-8 gap-1">
                {currentPattern.snare.map((beat, i) => (
                  <button
                    key={i}
                    onClick={() => onToggleDrum('snare', i)}
                    className={`w-4 h-4 rounded-full transition-all duration-200 cursor-pointer hover:scale-110 ${
                      currentBeat === i && isPlaying
                        ? 'bg-orange-300 shadow-lg shadow-orange-300/50'
                        : beat.main
                          ? 'bg-orange-500'
                          : 'bg-slate-700'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Kick row */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => onTestDrum(1)}
                className="text-xs font-mono text-orange-400 w-6 hover:text-orange-300"
              >
                K
              </button>
              <div className="grid grid-cols-8 gap-1">
                {currentPattern.kick.map((beat, i) => (
                  <button
                    key={i}
                    onClick={() => onToggleDrum('kick', i)}
                    className={`w-4 h-4 rounded-full transition-all duration-200 cursor-pointer hover:scale-110 ${
                      currentBeat === i && isPlaying
                        ? 'bg-orange-300 shadow-lg shadow-orange-300/50'
                        : beat.main
                          ? 'bg-orange-500'
                          : 'bg-slate-700'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <button
          onClick={onTestAll}
          className="px-2 py-1 text-xs bg-orange-600 text-white rounded hover:bg-orange-500 transition-colors"
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
