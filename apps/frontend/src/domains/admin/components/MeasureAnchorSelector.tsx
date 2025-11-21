'use client';

import React from 'react';
import { MiniFretboard } from './MiniFretboard';
import { useAnchorSelection } from '../hooks/useAnchorSelection';
import type { ParsedMeasure } from '../hooks/useMidiParsing';

interface MeasureAnchorSelectorProps {
  /** Parsed measures from MIDI file */
  measures: ParsedMeasure[];
  /** Callback when anchors change */
  onAnchorsChange?: (anchors: { measureNumber: number; string: number; fret: number }[]) => void;
  /** Initial anchors (for editing) */
  initialAnchors?: { measureNumber: number; string: number; fret: number }[];
  /** Bass type (4, 5, or 6 string) */
  bassType?: '4' | '5' | '6';
}

/**
 * Component for selecting anchor positions for each measure
 * Displays a grid of mini-fretboards, one per measure
 */
export function MeasureAnchorSelector({
  measures,
  onAnchorsChange,
  initialAnchors = [],
  bassType = '4',
}: MeasureAnchorSelectorProps) {
  const {
    setAnchor,
    getAnchor,
    clearAll,
    isComplete,
    getCompletionPercentage,
    getAnchorsArray,
    getMissingMeasures,
    anchorCount,
    totalMeasures,
  } = useAnchorSelection(measures.length);

  // Initialize anchors from props
  React.useEffect(() => {
    initialAnchors.forEach((anchor) => {
      setAnchor(anchor.measureNumber, anchor.string, anchor.fret);
    });
  }, [initialAnchors, setAnchor]);

  // Notify parent when anchors change
  React.useEffect(() => {
    onAnchorsChange?.(getAnchorsArray());
  }, [anchorCount, getAnchorsArray, onAnchorsChange]);

  const handlePositionSelect = (measureNumber: number, string: number, fret: number) => {
    setAnchor(measureNumber, string, fret);
  };

  const completionPercentage = getCompletionPercentage();
  const missingMeasures = getMissingMeasures();

  return (
    <div className="space-y-4">
      {/* Progress header */}
      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-700">Anchor Selection Progress</h3>
          <button
            type="button"
            onClick={clearAll}
            className="text-xs text-blue-600 hover:text-blue-700 font-medium"
          >
            Clear All
          </button>
        </div>

        {/* Progress bar */}
        <div className="mb-3">
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-gray-600">
              {anchorCount} of {totalMeasures} measures anchored
            </span>
            <span className="font-semibold text-gray-700">{completionPercentage}%</span>
          </div>
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                isComplete() ? 'bg-green-500' : 'bg-blue-500'
              }`}
              style={{ width: `${completionPercentage}%` }}
            />
          </div>
        </div>

        {/* Status message */}
        {isComplete() ? (
          <div className="flex items-center gap-2 text-sm text-green-700">
            <svg
              className="w-4 h-4"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <span className="font-medium">All measures have anchors! Ready to convert.</span>
          </div>
        ) : (
          <div className="text-sm text-amber-700">
            <span className="font-medium">Missing anchors for measures:</span>{' '}
            {missingMeasures.join(', ')}
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <p className="text-sm text-blue-800">
          <span className="font-semibold">Instructions:</span> Click on the fretboard to select
          the first note position for each measure. This helps the algorithm determine optimal
          fingering for the rest of the notes in that measure.
        </p>
      </div>

      {/* Measure grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {measures.map((measure) => {
          const anchor = getAnchor(measure.measureNumber);
          const hasAnchor = anchor !== undefined;
          const firstNote = measure.notes[0];

          return (
            <div
              key={measure.measureNumber}
              className={`
                rounded-lg border-2 p-4 transition-all
                ${
                  hasAnchor
                    ? 'border-green-400 bg-green-50'
                    : 'border-gray-300 bg-white hover:border-blue-400'
                }
              `}
            >
              {/* Measure header */}
              <div className="mb-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-gray-700">
                    Measure {measure.measureNumber}
                  </h4>
                  {hasAnchor && (
                    <svg
                      className="w-5 h-5 text-green-600"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {measure.notes.length} note{measure.notes.length !== 1 ? 's' : ''}
                  {firstNote && <span className="ml-2">• First: {firstNote.name}</span>}
                </p>
              </div>

              {/* Mini fretboard */}
              <div className="flex justify-center">
                <MiniFretboard
                  selectedString={anchor?.string}
                  selectedFret={anchor?.fret}
                  onPositionSelect={(string, fret) =>
                    handlePositionSelect(measure.measureNumber, string, fret)
                  }
                  showNoteName={hasAnchor}
                  noteName={firstNote?.name}
                  strings={parseInt(bassType)}
                  frets={12}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
