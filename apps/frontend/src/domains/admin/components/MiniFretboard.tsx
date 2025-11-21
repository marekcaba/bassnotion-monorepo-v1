'use client';

import React from 'react';

interface MiniFretboardProps {
  /** Currently selected string (1-4) */
  selectedString?: number;
  /** Currently selected fret (0-12) */
  selectedFret?: number;
  /** Callback when a position is clicked */
  onPositionSelect?: (string: number, fret: number) => void;
  /** Number of strings to display (default: 4) */
  strings?: number;
  /** Number of frets to display (default: 12) */
  frets?: number;
  /** Display note name at selected position */
  showNoteName?: boolean;
  /** Note name to display */
  noteName?: string;
  /** Disabled state */
  disabled?: boolean;
}

/**
 * Mini fretboard widget for selecting a single note position
 * Used in measure anchor selector for setting the first note of each measure
 */
export function MiniFretboard({
  selectedString,
  selectedFret,
  onPositionSelect,
  strings = 4,
  frets = 12,
  showNoteName = false,
  noteName,
  disabled = false,
}: MiniFretboardProps) {
  // String names for different bass types (top to bottom, visual order)
  // 4-string: G, D, A, E
  // 5-string: G, D, A, E, B (low B string)
  // 6-string: C, G, D, A, E, B (high C and low B strings)
  const getStringNames = (numStrings: number): string[] => {
    if (numStrings === 6) {
      return ['C', 'G', 'D', 'A', 'E', 'B'];
    } else if (numStrings === 5) {
      return ['G', 'D', 'A', 'E', 'B'];
    }
    return ['G', 'D', 'A', 'E']; // Default 4-string
  };

  const stringNames = getStringNames(strings);
  const fretMarkers = [3, 5, 7, 9, 12]; // Frets with position markers

  // Calculate note name for a given string and fret
  const getNoteName = (stringIndex: number, fret: number): string => {
    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const openStringNote = stringNames[stringIndex];
    const openStringIndex = notes.indexOf(openStringNote);
    const noteIndex = (openStringIndex + fret) % 12;
    return notes[noteIndex];
  };

  const handleClick = (string: number, fret: number) => {
    if (disabled) return;
    onPositionSelect?.(string, fret);
  };

  return (
    <div className="inline-block">
      {/* Fretboard container */}
      <div className="relative bg-gradient-to-r from-amber-800 to-amber-700 rounded p-2 shadow-sm">
        {/* Fret numbers */}
        <div className="flex mb-1">
          <div className="w-8" /> {/* String labels space */}
          {Array.from({ length: frets + 1 }, (_, i) => (
            <div
              key={i}
              className="flex-1 text-center text-[10px] text-amber-200"
              style={{ minWidth: '24px' }}
            >
              {i}
            </div>
          ))}
        </div>

        {/* Strings and frets */}
        <div className="space-y-2">
          {Array.from({ length: strings }, (_, stringIndex) => {
            const stringNum = strings - stringIndex; // Visual string 1 = bass string 4 (G)

            return (
              <div key={stringNum} className="flex items-center gap-1">
                {/* Empty space where string label used to be */}
                <div className="w-6" />

                {/* Frets */}
                <div className="flex items-center flex-1">
                  {Array.from({ length: frets + 1 }, (_, fretIndex) => {
                    const isSelected =
                      selectedString === stringNum && selectedFret === fretIndex;
                    const isMarker = fretMarkers.includes(fretIndex);
                    const isOpenString = fretIndex === 0;

                    return (
                      <div
                        key={fretIndex}
                        className="relative flex-1 flex items-center justify-center"
                        style={{ minWidth: '24px', minHeight: '20px' }}
                      >
                        {/* String line */}
                        <div
                          className="absolute left-0 right-0 bg-gray-400/50"
                          style={{
                            height: `${1 + stringIndex * 0.3}px`,
                          }}
                        />

                        {/* Clickable area with note labels */}
                        <button
                          type="button"
                          onClick={() => handleClick(stringNum, fretIndex)}
                          disabled={disabled}
                          className={`
                            relative z-10 w-4 h-4 rounded-full transition-all flex items-center justify-center
                            ${
                              isSelected
                                ? 'bg-blue-500 ring-2 ring-blue-300 scale-125'
                                : isOpenString
                                  ? 'bg-amber-600 hover:bg-amber-700 hover:scale-110'
                                  : isMarker
                                    ? 'bg-amber-400/40 hover:bg-amber-400/60 hover:scale-110'
                                    : 'bg-gray-700/40 hover:bg-gray-600 hover:scale-110'
                            }
                            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                          `}
                          aria-label={`String ${stringNum}, Fret ${fretIndex}`}
                        >
                          {/* String letter inside open string dot (bright) */}
                          {isOpenString && (
                            <span className="text-[8px] font-bold text-white leading-none">
                              {stringNames[stringIndex]}
                            </span>
                          )}
                          {/* Note name inside fret marker dots (subtle) */}
                          {isMarker && !isSelected && (
                            <span className="text-[7px] font-semibold text-amber-900/60 leading-none">
                              {getNoteName(stringIndex, fretIndex)}
                            </span>
                          )}
                        </button>

                        {/* Fret wire (vertical line) */}
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

        {/* Note name display */}
        {showNoteName && noteName && (
          <div className="mt-2 text-center text-sm font-semibold text-amber-100">
            {noteName}
          </div>
        )}
      </div>

      {/* Selected position info */}
      {selectedString !== undefined && selectedFret !== undefined && (
        <div className="mt-1 text-xs text-gray-600 text-center">
          String {selectedString}, Fret {selectedFret}
        </div>
      )}
    </div>
  );
}
