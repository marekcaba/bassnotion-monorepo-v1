'use client';

import React from 'react';
import type { MidiNoteEvent } from '../hooks/useMidiParsing';
import type { FingerIndex } from '../hooks/useManualPlacement';
import {
  type AccidentalPreference,
  convertToPreference,
} from '../utils/fretboardCalculations';

interface NoteQueueProps {
  /** All notes in the current measure */
  notes: MidiNoteEvent[];
  /** Map of note index -> placement {string, fret, finger_index?} */
  placements: Map<
    number,
    { string: number; fret: number; finger_index?: FingerIndex }
  >;
  /** Index of current note being placed */
  currentNoteIndex: number;
  /** Currently selected finger for next placement */
  selectedFinger?: FingerIndex;
  /** Callback when finger selection changes */
  onFingerSelect?: (finger: FingerIndex | undefined) => void;
  /** Callback when user clicks a placed note (to review/edit) */
  onNoteClick?: (noteIndex: number) => void;
  /** Display preference for accidentals (sharps or flats) */
  accidentalPreference?: AccidentalPreference;
  /** Bass type for string name display */
  bassType?: '4' | '5' | '6';
}

/**
 * Get string name from string number based on bass type
 */
function getStringName(
  stringNumber: number,
  bassType: '4' | '5' | '6',
): string {
  const stringNames = {
    '4': ['G', 'D', 'A', 'E'],
    '5': ['G', 'D', 'A', 'E', 'B'],
    '6': ['C', 'G', 'D', 'A', 'E', 'B'],
  };
  const names = stringNames[bassType];
  return names[stringNumber - 1] || `#${stringNumber}`;
}

// Get color for finger button
function getFingerColor(finger: FingerIndex, isSelected: boolean): string {
  const colors: Record<FingerIndex, { base: string; selected: string }> = {
    1: {
      base: 'bg-blue-100 text-blue-700 hover:bg-blue-200',
      selected: 'bg-blue-500 text-white ring-2 ring-blue-300',
    },
    2: {
      base: 'bg-green-100 text-green-700 hover:bg-green-200',
      selected: 'bg-green-500 text-white ring-2 ring-green-300',
    },
    3: {
      base: 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200',
      selected: 'bg-yellow-500 text-white ring-2 ring-yellow-300',
    },
    4: {
      base: 'bg-red-100 text-red-700 hover:bg-red-200',
      selected: 'bg-red-500 text-white ring-2 ring-red-300',
    },
    O: {
      base: 'bg-purple-100 text-purple-700 hover:bg-purple-200',
      selected: 'bg-purple-500 text-white ring-2 ring-purple-300',
    },
  };
  return isSelected ? colors[finger].selected : colors[finger].base;
}

// Get display label for finger
function getFingerLabel(finger: FingerIndex): string {
  const labels: Record<FingerIndex, string> = {
    1: '1',
    2: '2',
    3: '3',
    4: '4',
    O: 'O',
  };
  return labels[finger];
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
  selectedFinger,
  onFingerSelect,
  onNoteClick,
  accidentalPreference = 'sharps',
  bassType = '4',
}: NoteQueueProps) {
  if (notes.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500">
        <p>No notes in this measure</p>
      </div>
    );
  }

  // Only show finger buttons 1-4, 'O' (Open) is auto-assigned for fret 0
  const fingers: FingerIndex[] = [1, 2, 3, 4];

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">
        Notes to Place ({placements.size}/{notes.length})
      </h3>

      {/* Finger selector - always visible */}
      <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-gray-600">Finger:</span>
          <span className="text-xs text-gray-400">
            {selectedFinger
              ? `${selectedFinger === 'O' ? 'Open' : ['Index', 'Middle', 'Ring', 'Pinky'][Number(selectedFinger) - 1]}`
              : 'None'}
          </span>
        </div>
        <div className="flex gap-1.5">
          {fingers.map((finger) => (
            <button
              key={finger}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onFingerSelect?.(
                  selectedFinger === finger ? undefined : finger,
                );
              }}
              className={`
                w-9 h-9 rounded-full flex items-center justify-center
                text-sm font-bold transition-all
                ${getFingerColor(finger, selectedFinger === finger)}
              `}
              title={
                finger === 'O'
                  ? 'Open'
                  : ['Index', 'Middle', 'Ring', 'Pinky'][Number(finger) - 1]
              }
            >
              {getFingerLabel(finger)}
            </button>
          ))}
          {selectedFinger && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onFingerSelect?.(undefined);
              }}
              className="ml-2 px-2 h-9 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
              title="Clear finger selection"
            >
              ✕
            </button>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Select a finger, then click the fretboard (open strings auto-detect)
        </p>
      </div>

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
                  {/* Status icon - shows finger number for fretted notes, string name for open strings */}
                  <div className="flex-shrink-0">
                    {/* Open string (fret 0): show string name in black circle */}
                    {isPlaced && placement?.fret === 0 && (
                      <div className="w-6 h-6 bg-gray-900 rounded-full flex items-center justify-center text-white text-xs font-bold">
                        {getStringName(placement.string, bassType)}
                      </div>
                    )}
                    {/* Fretted note with finger: show finger number in colored circle */}
                    {isPlaced &&
                      placement?.fret !== 0 &&
                      placement?.finger_index &&
                      placement.finger_index !== 'O' && (
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold ${
                            placement.finger_index === 1
                              ? 'bg-blue-500'
                              : placement.finger_index === 2
                                ? 'bg-green-500'
                                : placement.finger_index === 3
                                  ? 'bg-yellow-500'
                                  : 'bg-red-500'
                          }`}
                        >
                          {placement.finger_index}
                        </div>
                      )}
                    {/* Fretted note without finger: show checkmark */}
                    {isPlaced &&
                      placement?.fret !== 0 &&
                      !placement?.finger_index && (
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
                        {placement.fret === 0 ? (
                          <span className="font-medium text-gray-900">
                            Open {getStringName(placement.string, bassType)}{' '}
                            string
                          </span>
                        ) : (
                          <>
                            String {getStringName(placement.string, bassType)},
                            Fret {placement.fret}
                            {placement.finger_index &&
                              placement.finger_index !== 'O' && (
                                <span className="ml-2 font-medium">
                                  • Finger {placement.finger_index}
                                </span>
                              )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Helper text */}
                <div className="text-xs text-gray-500">
                  {isPlaced && 'Click to review'}
                  {isCurrent &&
                    (selectedFinger
                      ? `F${selectedFinger} →`
                      : 'Click fretboard →')}
                  {isPending && 'Waiting...'}
                </div>
              </div>

              {/* Current note indicator */}
              {isCurrent && (
                <div className="mt-2 pt-2 border-t border-blue-200">
                  <p className="text-xs text-blue-700 font-medium">
                    ▶{' '}
                    {selectedFinger
                      ? `Finger ${selectedFinger} selected - `
                      : ''}
                    Click on the fretboard to place this note
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
