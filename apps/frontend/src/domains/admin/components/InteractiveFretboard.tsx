'use client';

import React, { useMemo } from 'react';
import { validatePlacement, findAllPositions } from '../utils/fretboardCalculations';

interface InteractiveFretboardProps {
  /** Current note to place (MIDI pitch) */
  currentNotePitch?: number;
  /** Current note name for display */
  currentNoteName?: string;
  /** Already placed notes in this measure */
  placedNotes: Array<{ noteIndex: number; string: number; fret: number }>;
  /** Callback when user clicks a valid position */
  onPositionSelect: (string: number, fret: number) => void;
  /** Bass type */
  bassType?: '4' | '5' | '6';
  /** Number of strings (derived from bassType) */
  strings?: number;
  /** Number of frets to display */
  frets?: number;
  /** Whether fretboard is disabled (measure complete) */
  disabled?: boolean;
}

/**
 * Interactive fretboard for manual note placement
 *
 * Features:
 * - Shows valid positions for current note (highlighted)
 * - Shows already placed notes (green dots)
 * - Validates clicks against current note's pitch
 * - Prevents invalid placements
 */
export function InteractiveFretboard({
  currentNotePitch,
  currentNoteName,
  placedNotes = [],
  onPositionSelect,
  bassType = '4',
  strings,
  frets = 12,
  disabled = false,
}: InteractiveFretboardProps) {
  // Calculate valid positions for current note
  const validPositions = useMemo(() => {
    if (!currentNotePitch) return [];
    return findAllPositions(currentNotePitch, bassType);
  }, [currentNotePitch, bassType]);

  // Check if a position is valid for current note
  const isValidPosition = (string: number, fret: number): boolean => {
    if (!currentNotePitch) return false;
    return validatePlacement(currentNotePitch, string, fret, bassType);
  };

  // Handle position click
  const handlePositionClick = (string: number, fret: number) => {
    if (disabled) return;

    // NOTE: We intentionally ALLOW placing multiple notes at the same position
    // because musical lines can have repeated notes (e.g., C1, C1, C1 in a groove)
    // The placed dots are just visual feedback, not a limitation

    // Check if position is valid (matches current note's pitch)
    const isValid = currentNotePitch && isValidPosition(string, fret);

    if (!isValid && currentNotePitch) {
      // Calculate what note is actually at this position for the error message
      const BASS_TUNINGS = {
        '4': [43, 38, 33, 28],
        '5': [43, 38, 33, 28, 23],
        '6': [48, 43, 38, 33, 28, 23],
      };
      const tuning = BASS_TUNINGS[bassType];
      const actualPitch = (tuning[string - 1] ?? 0) + fret;
      const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
      const octave = Math.floor(actualPitch / 12) - 1;
      const noteIndex = actualPitch % 12;
      const actualNoteName = `${notes[noteIndex]}${octave}`;

      console.warn('[InteractiveFretboard] Wrong note at this position', {
        clickedPosition: { string, fret },
        expectedNote: currentNoteName,
        expectedPitch: currentNotePitch,
        actualNote: actualNoteName,
        actualPitch,
      });

      // Show user-friendly error
      if (confirm(
        `This position produces ${actualNoteName}, but you need to place ${currentNoteName}.\n\n` +
        `Click OK to see valid positions highlighted in amber, or Cancel to place it anyway.`
      )) {
        return; // User wants to see highlights, cancel the invalid placement
      }
      // User clicked Cancel = "place it anyway", so fall through to placement
    }

    // Allow placement (either valid OR user confirmed they want it anyway)
    onPositionSelect(string, fret);
  };

  return (
    <div className="relative">
      {/* Instruction banner */}
      {currentNotePitch && !disabled && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-900">
            <span className="font-semibold">Place note: {currentNoteName}</span>
            {validPositions.length > 0 && (
              <span className="ml-2 text-blue-700">
                ({validPositions.length} standard position{validPositions.length > 1 ? 's' : ''} highlighted)
              </span>
            )}
          </p>
          {validPositions.length > 0 && (
            <p className="text-xs text-blue-600 mt-1">
              💡 Amber dots show standard positions for this note. You can click anywhere - you have full control!
            </p>
          )}
          {validPositions.length === 0 && (
            <p className="text-xs text-amber-700 mt-1">
              ⚠️ This note is outside standard range, but you can still place it anywhere you want.
            </p>
          )}
        </div>
      )}

      {/* Measure complete message */}
      {disabled && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm text-green-900 font-semibold">
            ✓ Measure complete! All notes placed.
          </p>
        </div>
      )}

      {/* Custom fretboard with click handlers */}
      <div className="relative">
        <InteractiveFretboardGrid
          bassType={bassType}
          strings={strings || parseInt(bassType)}
          frets={frets}
          validPositions={validPositions}
          placedNotes={placedNotes}
          onPositionClick={handlePositionClick}
          disabled={disabled}
        />
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center justify-center gap-4 text-xs text-gray-600">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-green-500 rounded-full" />
          <span>Placed</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-amber-400 rounded-full" />
          <span>Valid position</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-gray-400 rounded-full" />
          <span>Unavailable</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Custom fretboard grid with interactive click handling
 * (We can't use MiniFretboard directly because it doesn't support our complex highlighting logic)
 */
function InteractiveFretboardGrid({
  strings,
  frets,
  validPositions,
  placedNotes,
  onPositionClick,
  disabled,
}: {
  bassType: '4' | '5' | '6';
  strings: number;
  frets: number;
  validPositions: Array<{ string: number; fret: number }>;
  placedNotes: Array<{ noteIndex: number; string: number; fret: number }>;
  onPositionClick: (string: number, fret: number) => void;
  disabled: boolean;
}) {
  const getStringNames = (numStrings: number): string[] => {
    if (numStrings === 6) {
      return ['C', 'G', 'D', 'A', 'E', 'B'];
    } else if (numStrings === 5) {
      return ['G', 'D', 'A', 'E', 'B'];
    }
    return ['G', 'D', 'A', 'E'];
  };

  const stringNames = getStringNames(strings);
  const fretMarkers = [3, 5, 7, 9, 12];

  const getNoteName = (stringIndex: number, fret: number): string => {
    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const openStringNote = stringNames[stringIndex];
    const openStringIndex = notes.indexOf(openStringNote);
    const noteIndex = (openStringIndex + fret) % 12;
    return notes[noteIndex] ?? '';
  };

  const isPositionValid = (string: number, fret: number): boolean => {
    return validPositions.some((pos) => pos.string === string && pos.fret === fret);
  };

  const getPlacedNotesAt = (string: number, fret: number): number => {
    // Count how many notes are placed at this position (can be multiple for repeated notes)
    return placedNotes.filter((note) => note.string === string && note.fret === fret).length;
  };

  return (
    <div className="inline-block">
      <div className="relative bg-gradient-to-r from-amber-800 to-amber-700 rounded p-4 shadow-lg">
        {/* Fret numbers */}
        <div className="flex mb-2">
          <div className="w-8" />
          {Array.from({ length: frets + 1 }, (_, i) => (
            <div
              key={i}
              className="flex-1 text-center text-[10px] text-amber-200 font-semibold"
              style={{ minWidth: '32px' }}
            >
              {i}
            </div>
          ))}
        </div>

        {/* Strings and frets */}
        <div className="space-y-3">
          {Array.from({ length: strings }, (_, stringIndex) => {
            // stringIndex 0 = top row = String 1 (G string, highest pitch)
            // stringIndex N-1 = bottom row = String N (E/B string, lowest pitch)
            const stringNum = stringIndex + 1;

            return (
              <div key={stringNum} className="flex items-center gap-1">
                <div className="w-6" />

                <div className="flex items-center flex-1">
                  {Array.from({ length: frets + 1 }, (_, fretIndex) => {
                    const isMarker = fretMarkers.includes(fretIndex);
                    const isOpenString = fretIndex === 0;
                    const isValid = isPositionValid(stringNum, fretIndex);
                    const placedCount = getPlacedNotesAt(stringNum, fretIndex);

                    return (
                      <div
                        key={fretIndex}
                        className="relative flex-1 flex items-center justify-center"
                        style={{ minWidth: '32px', minHeight: '24px' }}
                      >
                        {/* String line */}
                        <div
                          className="absolute left-0 right-0 bg-gray-400/50"
                          style={{
                            height: `${1.5 + stringIndex * 0.4}px`,
                          }}
                        />

                        {/* Clickable dot */}
                        <button
                          type="button"
                          onClick={() => onPositionClick(stringNum, fretIndex)}
                          disabled={disabled}
                          className={`
                            relative z-10 w-5 h-5 rounded-full transition-all flex items-center justify-center
                            ${
                              placedCount > 0
                                ? 'bg-green-500 ring-2 ring-green-300 scale-110 hover:scale-125'
                                : isOpenString
                                  ? 'bg-amber-600 hover:bg-amber-700 hover:scale-110'
                                  : isValid
                                    ? 'bg-amber-400/60 hover:bg-amber-400 hover:scale-125 ring-2 ring-amber-300'
                                    : isMarker
                                      ? 'bg-amber-400/40 hover:bg-amber-400/60 hover:scale-110'
                                      : 'bg-gray-700/40 hover:bg-gray-600 hover:scale-110'
                            }
                            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                          `}
                          aria-label={`String ${stringNum}, Fret ${fretIndex}${placedCount > 0 ? ` (${placedCount} placed)` : ''}`}
                        >
                          {/* Open string label */}
                          {isOpenString && placedCount === 0 && (
                            <span className="text-[8px] font-bold text-white leading-none">
                              {stringNames[stringIndex]}
                            </span>
                          )}
                          {/* Fret marker label */}
                          {isMarker && !isOpenString && !isValid && placedCount === 0 && (
                            <span className="text-[7px] font-semibold text-amber-900/60 leading-none">
                              {getNoteName(stringIndex, fretIndex)}
                            </span>
                          )}
                          {/* Placed note indicator - show count if multiple */}
                          {placedCount > 0 && (
                            <span className="text-[10px] font-bold text-white leading-none">
                              {placedCount > 1 ? placedCount : '✓'}
                            </span>
                          )}
                        </button>

                        {/* Fret wire */}
                        {fretIndex > 0 && (
                          <div className="absolute right-0 top-0 bottom-0 w-px bg-gray-500/60" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
