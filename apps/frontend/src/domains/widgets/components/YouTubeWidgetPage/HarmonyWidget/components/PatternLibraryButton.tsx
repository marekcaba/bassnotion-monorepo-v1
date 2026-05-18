'use client';

/**
 * PatternLibraryButton Component
 *
 * Button and dropdown for selecting harmony patterns from the pattern library.
 */

import React from 'react';
import { Music2 } from 'lucide-react';
import type { PatternLibraryButtonProps } from '../types.js';

/**
 * Pattern library button and selector
 */
export const PatternLibraryButton: React.FC<PatternLibraryButtonProps> =
  React.memo(
    ({
      isOpen,
      onToggle,
      isLoading,
      patterns,
      selectedPattern,
      onPatternSelect,
    }) => {
      return (
        <>
          {/* Toggle Button */}
          <button
            onClick={onToggle}
            className="p-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded transition-colors"
            title="Browse Pattern Library"
          >
            <Music2 className="w-3 h-3" />
          </button>

          {/* Pattern Library Dropdown */}
          {isOpen && (
            <div className="p-2 bg-slate-800 rounded-lg border border-slate-700 mt-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-300">
                  Harmony Pattern Library
                </span>
                <button
                  onClick={onToggle}
                  className="text-xs text-slate-500 hover:text-slate-400"
                >
                  &times;
                </button>
              </div>

              {isLoading ? (
                <div className="text-xs text-slate-500">
                  Loading patterns...
                </div>
              ) : (
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {patterns.map((pattern) => (
                    <button
                      key={pattern.id}
                      onClick={() => onPatternSelect(pattern)}
                      className={`w-full text-left p-1.5 text-xs rounded hover:bg-slate-700 transition-colors ${
                        selectedPattern?.id === pattern.id
                          ? 'bg-slate-700 text-blue-400'
                          : 'text-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span>{pattern.name}</span>
                        {pattern.genre && (
                          <span className="text-xs text-slate-500">
                            {pattern.genre}
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      );
    },
  );

PatternLibraryButton.displayName = 'PatternLibraryButton';
