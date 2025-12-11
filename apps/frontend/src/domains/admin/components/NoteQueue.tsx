'use client';

import React from 'react';
import type { MidiNoteEvent } from '../hooks/useMidiParsing';
import {
  type AccidentalPreference,
  convertToPreference,
} from '../utils/fretboardCalculations';

interface NoteQueueProps {
  /** All notes in the current measure */
  notes: MidiNoteEvent[];
  /** Map of note index -> placement {string, fret} */
  placements: Map<number, { string: number; fret: number }>;
  /** Index of current note being placed */
  currentNoteIndex: number;
  /** Callback when user clicks a placed note (to review/edit) */
  onNoteClick?: (noteIndex: number) => void;
  /** Display preference for accidentals (sharps or flats) */
  accidentalPreference?: AccidentalPreference;
}

/**
 * Note queue component - shows list of notes with placement status
 *
 * Visual indicators:
 * - ✅ Green = Placed
 * - 👉 Blue = Current (being placed now)
 * - ⏳ Gray = Pending
 */
export function NoteQueue({
  notes,
  placements,
  currentNoteIndex,
  onNoteClick,
  accidentalPreference = 'sharps',
}: NoteQueueProps) {
  if (notes.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500">
        <p>No notes in this measure</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">
        Notes to Place ({placements.size}/{notes.length})
      </h3>

      <div className="space-y-2">
        {notes.map((note, index) => {
          const placement = placements.get(index);
          const isPlaced = placement !== undefined;
          const isCurrent = index === currentNoteIndex;
          const isPending = !isPlaced && !isCurrent;

          return (
            <button
              key={index}
              type="button"
              onClick={() => isPlaced && onNoteClick?.(index)}
              disabled={!isPlaced}
              className={`
                w-full p-3 rounded-md text-left transition-all
                ${
                  isPlaced
                    ? 'bg-green-50 border-green-200 hover:bg-green-100 cursor-pointer'
                    : isCurrent
                      ? 'bg-blue-50 border-blue-300 border-2'
                      : 'bg-gray-50 border-gray-200'
                }
                border
              `}
            >
              <div className="flex items-center justify-between">
                {/* Left: Status icon + note name */}
                <div className="flex items-center gap-2">
                  {/* Status icon */}
                  <div className="flex-shrink-0">
                    {isPlaced && (
                      <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                        ✓
                      </div>
                    )}
                    {isCurrent && (
                      <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                        👉
                      </div>
                    )}
                    {isPending && (
                      <div className="w-6 h-6 bg-gray-300 rounded-full flex items-center justify-center text-gray-500 text-xs">
                        {index + 1}
                      </div>
                    )}
                  </div>

                  {/* Note info */}
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`font-semibold ${
                          isPlaced
                            ? 'text-green-900'
                            : isCurrent
                              ? 'text-blue-900'
                              : 'text-gray-500'
                        }`}
                      >
                        Note {index + 1}:
                      </span>
                      <span
                        className={`font-mono text-sm ${
                          isPlaced
                            ? 'text-green-800'
                            : isCurrent
                              ? 'text-blue-800'
                              : 'text-gray-600'
                        }`}
                      >
                        {convertToPreference(note.name, accidentalPreference)}
                      </span>
                    </div>

                    {/* Show placement position if placed */}
                    {isPlaced && placement && (
                      <div className="text-xs text-green-700 mt-1">
                        String {placement.string}, Fret {placement.fret}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Helper text */}
                <div className="text-xs text-gray-500">
                  {isPlaced && 'Click to review'}
                  {isCurrent && 'Click fretboard →'}
                  {isPending && 'Waiting...'}
                </div>
              </div>

              {/* Current note indicator */}
              {isCurrent && (
                <div className="mt-2 pt-2 border-t border-blue-200">
                  <p className="text-xs text-blue-700 font-medium">
                    ▶ Click on the fretboard to place this note
                  </p>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Progress bar */}
      <div className="mt-4">
        <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
          <span>Progress</span>
          <span className="font-semibold">
            {Math.round((placements.size / notes.length) * 100)}%
          </span>
        </div>
        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-green-500 transition-all duration-300"
            style={{ width: `${(placements.size / notes.length) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}
