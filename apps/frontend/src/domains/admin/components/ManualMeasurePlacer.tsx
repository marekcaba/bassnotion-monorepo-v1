'use client';

import React, { useState } from 'react';
import type { ParsedMeasure } from '../hooks/useMidiParsing';
import { useManualPlacement, type FingerIndex } from '../hooks/useManualPlacement';
import type { GeneratedExerciseNote } from '../hooks/useMidiConversion';
import { NoteQueue } from './NoteQueue';
import { InteractiveFretboard } from './InteractiveFretboard';
import { type AccidentalPreference } from '../utils/fretboardCalculations';

interface ManualMeasurePlacerProps {
  /** Parsed measures from MIDI file */
  measures: ParsedMeasure[];
  /** Bass type for fretboard calculations */
  bassType?: '4' | '5' | '6';
  /** Callback when all measures are complete */
  onComplete: (notes: GeneratedExerciseNote[]) => void;
  /** Existing notes to pre-populate (for editing mode) */
  existingNotes?: GeneratedExerciseNote[];
  /** Display preference for accidentals (sharps or flats) */
  accidentalPreference?: AccidentalPreference;
}

/**
 * Manual measure placer - main component for manual MIDI-to-fretboard conversion
 *
 * Workflow:
 * 1. Admin sees first measure with note list
 * 2. Admin clicks fretboard dots to place notes sequentially
 * 3. When measure complete, move to next measure
 * 4. When all measures complete, generate final exercise notes
 */
export function ManualMeasurePlacer({
  measures,
  bassType = '4',
  onComplete,
  existingNotes,
  accidentalPreference = 'sharps',
}: ManualMeasurePlacerProps) {
  const {
    currentMeasureNumber,
    currentMeasure,
    currentNoteIndex,
    currentNote,
    currentMeasurePlacements,
    isCurrentMeasureComplete,
    areAllMeasuresComplete,
    stats,
    placeNote,
    undoLastPlacement,
    clearCurrentMeasure,
    goToNextMeasure,
    goToPreviousMeasure,
    goToMeasure,
    generateExerciseNotes,
  } = useManualPlacement(measures, bassType, existingNotes);

  // State for currently selected finger
  const [selectedFinger, setSelectedFinger] = useState<FingerIndex | undefined>(undefined);

  // Handle position selection from fretboard
  const handlePositionSelect = (string: number, fret: number) => {
    // Always allow placement - admin has full control
    // Auto-determine finger based on fret:
    // - Fret 0 (open string) = 'O' (no finger needed)
    // - Fret > 0 = use selected finger, or undefined if 'O' was selected
    const fingerToUse = fret === 0
      ? 'O' as FingerIndex
      : (selectedFinger === 'O' ? undefined : selectedFinger);

    placeNote(string, fret, fingerToUse);
  };

  // Handle navigation to next measure
  const handleNextMeasure = () => {
    if (!isCurrentMeasureComplete) {
      alert('Please complete all notes in this measure before continuing.');
      return;
    }
    goToNextMeasure();
  };

  // Handle completion
  const handleComplete = () => {
    if (!areAllMeasuresComplete) {
      alert(
        `Please complete all measures first. ${stats.completedMeasures}/${stats.totalMeasures} measures complete.`,
      );
      return;
    }

    const exerciseNotes = generateExerciseNotes();
    onComplete(exerciseNotes);
  };

  // Convert placements to array for fretboard display
  const placedNotes = Array.from(currentMeasurePlacements.entries()).map(
    ([noteIndex, placement]) => ({
      noteIndex,
      ...placement,
    }),
  );

  if (!currentMeasure) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-600">No measures to place</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header - Measure navigation */}
      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-900">
            Measure {currentMeasureNumber} of {measures.length}
          </h2>

          {/* Measure navigation buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={goToPreviousMeasure}
              disabled={currentMeasureNumber === 1}
              className="px-3 py-1 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ← Previous
            </button>

            {/* Measure selector dropdown */}
            <select
              value={currentMeasureNumber}
              onChange={(e) => goToMeasure(parseInt(e.target.value))}
              className="px-3 py-1 text-sm bg-white border border-gray-300 rounded-md"
            >
              {measures.map((m) => (
                <option key={m.measureNumber} value={m.measureNumber}>
                  Measure {m.measureNumber}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={handleNextMeasure}
              disabled={currentMeasureNumber === measures.length}
              className="px-3 py-1 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next →
            </button>
          </div>
        </div>

        {/* Overall progress */}
        <div className="flex items-center justify-between text-sm">
          <div className="text-gray-600">
            <span className="font-semibold">{stats.placedNotes}</span> of{' '}
            <span className="font-semibold">{stats.totalNotes}</span> notes
            placed
          </div>
          <div className="text-gray-600">
            <span className="font-semibold">{stats.completedMeasures}</span> of{' '}
            <span className="font-semibold">{stats.totalMeasures}</span>{' '}
            measures complete
          </div>
          <div className="text-lg font-bold text-blue-600">
            {stats.percentComplete}%
          </div>
        </div>

        {/* Overall progress bar */}
        <div className="mt-2 w-full h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              areAllMeasuresComplete
                ? 'bg-green-500'
                : 'bg-gradient-to-r from-blue-500 to-purple-500'
            }`}
            style={{ width: `${stats.percentComplete}%` }}
          />
        </div>
      </div>

      {/* Main content - Two columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Note Queue */}
        <div>
          <NoteQueue
            notes={currentMeasure.notes}
            placements={currentMeasurePlacements}
            currentNoteIndex={currentNoteIndex}
            selectedFinger={selectedFinger}
            onFingerSelect={setSelectedFinger}
            accidentalPreference={accidentalPreference}
            bassType={bassType}
            onNoteClick={(noteIndex) => {
              console.log(
                '[ManualMeasurePlacer] Clicked placed note:',
                noteIndex,
              );
              // TODO: Highlight note on fretboard (future enhancement)
            }}
          />

          {/* Action buttons */}
          <div className="mt-4 space-y-2">
            {/* Undo button */}
            <button
              type="button"
              onClick={undoLastPlacement}
              disabled={currentMeasurePlacements.size === 0}
              className="w-full px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ↶ Undo Last Placement
            </button>

            {/* Clear measure button */}
            <button
              type="button"
              onClick={() => {
                if (
                  confirm(
                    'Clear all placements in this measure? This cannot be undone.',
                  )
                ) {
                  clearCurrentMeasure();
                }
              }}
              disabled={currentMeasurePlacements.size === 0}
              className="w-full px-4 py-2 bg-white border border-red-300 text-red-600 rounded-md text-sm font-medium hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ✕ Clear Measure
            </button>
          </div>
        </div>

        {/* Right: Interactive Fretboard */}
        <div>
          <InteractiveFretboard
            currentNotePitch={currentNote?.pitch}
            currentNoteName={currentNote?.name}
            placedNotes={placedNotes}
            onPositionSelect={handlePositionSelect}
            bassType={bassType}
            strings={parseInt(bassType)}
            disabled={isCurrentMeasureComplete}
            accidentalPreference={accidentalPreference}
          />
        </div>
      </div>

      {/* Footer - Complete button */}
      {areAllMeasuresComplete && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-green-900">
                ✓ All measures complete!
              </p>
              <p className="text-sm text-green-700">
                {stats.totalNotes} notes placed across {stats.totalMeasures}{' '}
                measures
              </p>
            </div>
            <button
              type="button"
              onClick={handleComplete}
              className="px-6 py-3 bg-green-600 text-white rounded-md font-semibold hover:bg-green-700 transition-colors"
            >
              Continue to Review →
            </button>
          </div>
        </div>
      )}

      {/* Current measure complete but not all measures */}
      {isCurrentMeasureComplete && !areAllMeasuresComplete && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-blue-900">
                ✓ Measure {currentMeasureNumber} complete!
              </p>
              <p className="text-sm text-blue-700">
                {currentMeasure.notes.length} notes placed
              </p>
            </div>
            <button
              type="button"
              onClick={handleNextMeasure}
              disabled={currentMeasureNumber === measures.length}
              className="px-6 py-3 bg-blue-600 text-white rounded-md font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              Next Measure →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
