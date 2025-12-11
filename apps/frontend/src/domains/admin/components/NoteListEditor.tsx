'use client';

import React, { useState, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';
import type {
  GeneratedExerciseNote,
  ConfidenceLevel,
} from '../hooks/useMidiConversion';
import {
  type AccidentalPreference,
  convertToPreference,
  getEnharmonicEquivalent,
  hasEnharmonic,
} from '../utils/fretboardCalculations';

interface NoteListEditorProps {
  /** Generated notes from MIDI conversion */
  notes: GeneratedExerciseNote[];
  /** Callback when a note is updated */
  onNoteUpdate?: (noteId: string, string: number, fret: number) => void;
  /** Callback when notes change */
  onNotesChange?: (notes: GeneratedExerciseNote[]) => void;
  /** Bass type for string name display */
  bassType?: '4' | '5' | '6';
  /** Display preference for accidentals (sharps or flats) */
  accidentalPreference?: AccidentalPreference;
  /** Callback when accidental preference changes */
  onAccidentalPreferenceChange?: (preference: AccidentalPreference) => void;
}

type FilterMode = 'all' | 'low-confidence' | 'warnings';

/**
 * Get string name from string number based on bass type
 */
function getStringName(
  stringNumber: number,
  bassType: '4' | '5' | '6',
): string {
  // String numbering: 1 = highest pitch (thinnest string, top of fretboard visually)
  // Matches BASS_TUNINGS in fretboardCalculations.ts
  const stringNames = {
    '4': ['G', 'D', 'A', 'E'], // String 1-4: G D A E (high to low)
    '5': ['G', 'D', 'A', 'E', 'B'], // String 1-5: G D A E B (high to low)
    '6': ['C', 'G', 'D', 'A', 'E', 'B'], // String 1-6: C G D A E B (high to low)
  };

  const names = stringNames[bassType];
  return names[stringNumber - 1] || `#${stringNumber}`;
}

/**
 * Component for reviewing and editing generated fretboard positions
 */
export function NoteListEditor({
  notes,
  onNoteUpdate,
  onNotesChange,
  bassType = '4',
  accidentalPreference = 'sharps',
  onAccidentalPreferenceChange,
}: NoteListEditorProps) {
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [searchMeasure, setSearchMeasure] = useState('');
  const [editedNotes, setEditedNotes] = useState<
    Map<string, GeneratedExerciseNote>
  >(new Map());
  // Track individual note display overrides (for toggling individual notes between sharp/flat)
  const [noteDisplayOverrides, setNoteDisplayOverrides] = useState<
    Map<string, string>
  >(new Map());

  // Filter notes based on mode and search
  const filteredNotes = useMemo(() => {
    let filtered = notes;

    // Apply filter mode
    if (filterMode === 'low-confidence') {
      filtered = filtered.filter((note) => note.confidence === 'low');
    } else if (filterMode === 'warnings') {
      filtered = filtered.filter(
        (note) => note.warnings && note.warnings.length > 0,
      );
    }

    // Apply measure search
    if (searchMeasure) {
      const measureNum = parseInt(searchMeasure, 10);
      if (!isNaN(measureNum)) {
        filtered = filtered.filter((note) => note.measureNumber === measureNum);
      }
    }

    return filtered;
  }, [notes, filterMode, searchMeasure]);

  const handleAlternativeSelect = (
    note: GeneratedExerciseNote,
    string: number,
    fret: number,
  ) => {
    const updatedNote: GeneratedExerciseNote = {
      ...note,
      string,
      fret,
    };

    setEditedNotes((prev) => {
      const next = new Map(prev);
      next.set(note.id, updatedNote);
      return next;
    });

    onNoteUpdate?.(note.id, string, fret);

    // Update notes array
    const updatedNotes = notes.map((n) => (n.id === note.id ? updatedNote : n));
    onNotesChange?.(updatedNotes);
  };

  const getDisplayNote = (
    note: GeneratedExerciseNote,
  ): GeneratedExerciseNote => {
    return editedNotes.get(note.id) || note;
  };

  /**
   * Get display name for a note, considering:
   * 1. Individual note overrides
   * 2. Global accidental preference
   */
  const getDisplayNoteName = (note: GeneratedExerciseNote): string => {
    // Check for individual override first
    const override = noteDisplayOverrides.get(note.id);
    if (override) {
      return override;
    }
    // Otherwise use global preference
    return convertToPreference(note.note, accidentalPreference);
  };

  /**
   * Toggle a note's enharmonic spelling (sharp ↔ flat)
   */
  const toggleNoteEnharmonic = (note: GeneratedExerciseNote) => {
    const currentDisplay = getDisplayNoteName(note);
    const enharmonic = getEnharmonicEquivalent(currentDisplay);

    setNoteDisplayOverrides((prev) => {
      const next = new Map(prev);
      if (enharmonic !== currentDisplay) {
        next.set(note.id, enharmonic);
      } else {
        // If no change, remove the override
        next.delete(note.id);
      }
      return next;
    });
  };

  // Statistics
  const stats = useMemo(() => {
    const highConfidence = notes.filter((n) => n.confidence === 'high').length;
    const mediumConfidence = notes.filter(
      (n) => n.confidence === 'medium',
    ).length;
    const lowConfidence = notes.filter((n) => n.confidence === 'low').length;
    const withWarnings = notes.filter(
      (n) => n.warnings && n.warnings.length > 0,
    ).length;

    return { highConfidence, mediumConfidence, lowConfidence, withWarnings };
  }, [notes]);

  return (
    <div className="space-y-4">
      {/* Statistics header */}
      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">
          Conversion Summary
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="text-2xl font-bold text-gray-900">
              {notes.length}
            </div>
            <div className="text-xs text-gray-600">Total Notes</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-600">
              {stats.highConfidence}
            </div>
            <div className="text-xs text-gray-600">High Confidence</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-yellow-600">
              {stats.mediumConfidence}
            </div>
            <div className="text-xs text-gray-600">Medium Confidence</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-red-600">
              {stats.lowConfidence}
            </div>
            <div className="text-xs text-gray-600">Low Confidence</div>
          </div>
        </div>
        {stats.withWarnings > 0 && (
          <div className="mt-3 text-sm text-amber-700">
            ⚠️ {stats.withWarnings} note{stats.withWarnings !== 1 ? 's' : ''}{' '}
            with warnings
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setFilterMode('all')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md ${
              filterMode === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            All Notes
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('low-confidence')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md ${
              filterMode === 'low-confidence'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Low Confidence ({stats.lowConfidence})
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('warnings')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md ${
              filterMode === 'warnings'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Warnings ({stats.withWarnings})
          </button>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="measure-search" className="text-sm text-gray-600">
            Measure:
          </label>
          <input
            id="measure-search"
            type="number"
            min="1"
            value={searchMeasure}
            onChange={(e) => setSearchMeasure(e.target.value)}
            placeholder="Filter by measure"
            className="w-24 px-2 py-1.5 text-sm border border-gray-300 rounded-md"
          />
        </div>

        <div className="ml-auto text-sm text-gray-600">
          Showing {filteredNotes.length} of {notes.length} notes
        </div>
      </div>

      {/* Notes table */}
      <div className="border rounded-lg overflow-hidden">
        <div
          className="max-h-[500px] overflow-y-auto overflow-x-hidden"
          style={{ overflowY: 'auto' }}
        >
          <Table>
            <TableHeader className="sticky top-0 bg-gray-50 z-10">
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Note</TableHead>
                <TableHead>Measure</TableHead>
                <TableHead>String</TableHead>
                <TableHead>Fret</TableHead>
                <TableHead>Confidence</TableHead>
                <TableHead>Alternatives</TableHead>
                <TableHead>Warnings</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredNotes.map((note, index) => {
                const displayNote = getDisplayNote(note);
                const wasEdited = editedNotes.has(note.id);

                return (
                  <TableRow
                    key={note.id}
                    className={wasEdited ? 'bg-blue-50' : ''}
                  >
                    {/* Index */}
                    <TableCell className="font-mono text-sm">
                      {index + 1}
                    </TableCell>

                    {/* Note name with enharmonic toggle */}
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <span className="font-semibold font-mono">
                          {getDisplayNoteName(note)}
                        </span>
                        {hasEnharmonic(note.note) && (
                          <button
                            type="button"
                            onClick={() => toggleNoteEnharmonic(note)}
                            className="ml-1 px-1.5 py-0.5 text-xs bg-gray-100 hover:bg-gray-200 rounded border border-gray-300 text-gray-600 hover:text-gray-800 transition-colors"
                            title={`Switch to ${getEnharmonicEquivalent(getDisplayNoteName(note))}`}
                          >
                            ♯↔♭
                          </button>
                        )}
                        {noteDisplayOverrides.has(note.id) && (
                          <span
                            className="text-xs text-blue-600"
                            title="Custom spelling"
                          >
                            *
                          </span>
                        )}
                      </div>
                    </TableCell>

                    {/* Measure */}
                    <TableCell>{note.measureNumber}</TableCell>

                    {/* String - Editable dropdown */}
                    <TableCell>
                      <select
                        className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm font-bold border border-blue-300 cursor-pointer hover:bg-blue-200"
                        value={displayNote.string}
                        onChange={(e) => {
                          const newString = parseInt(e.target.value);
                          handleAlternativeSelect(
                            note,
                            newString,
                            displayNote.fret,
                          );
                        }}
                      >
                        {Array.from(
                          { length: parseInt(bassType) },
                          (_, i) => i + 1,
                        ).map((stringNum) => (
                          <option key={stringNum} value={stringNum}>
                            {getStringName(stringNum, bassType)}
                          </option>
                        ))}
                      </select>
                    </TableCell>

                    {/* Fret - Editable input */}
                    <TableCell>
                      <input
                        type="number"
                        min="0"
                        max="24"
                        className="w-16 px-2 py-1 bg-purple-100 text-purple-800 rounded text-sm font-bold border border-purple-300 text-center"
                        value={displayNote.fret}
                        onChange={(e) => {
                          const newFret = parseInt(e.target.value) || 0;
                          if (newFret >= 0 && newFret <= 24) {
                            handleAlternativeSelect(
                              note,
                              displayNote.string,
                              newFret,
                            );
                          }
                        }}
                      />
                    </TableCell>

                    {/* Confidence badge */}
                    <TableCell>
                      <ConfidenceBadge level={note.confidence} />
                    </TableCell>

                    {/* Alternatives dropdown */}
                    <TableCell>
                      {note.alternatives.length > 0 ? (
                        <select
                          className="text-sm border border-gray-300 rounded px-2 py-1 font-medium"
                          onChange={(e) => {
                            const [string, fret] = e.target.value
                              .split('-')
                              .map(Number);
                            handleAlternativeSelect(note, string, fret);
                          }}
                          value={`${displayNote.string}-${displayNote.fret}`}
                        >
                          <option value={`${note.string}-${note.fret}`}>
                            ✓ Current: {getStringName(note.string, bassType)}{' '}
                            Fret {note.fret}
                          </option>
                          {note.alternatives.map((alt, i) => (
                            <option key={i} value={`${alt.string}-${alt.fret}`}>
                              {getStringName(alt.string, bassType)} Fret{' '}
                              {alt.fret} -{' '}
                              {alt.reason || `Alternative ${i + 1}`}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-sm text-gray-400">None</span>
                      )}
                    </TableCell>

                    {/* Warnings */}
                    <TableCell>
                      {note.warnings && note.warnings.length > 0 ? (
                        <div className="space-y-1">
                          {note.warnings.map((warning, i) => (
                            <WarningBadge key={i} warning={warning} />
                          ))}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      {filteredNotes.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No notes match the current filters
        </div>
      )}
    </div>
  );
}

/**
 * Confidence badge component
 */
function ConfidenceBadge({ level }: { level: ConfidenceLevel }) {
  const colors = {
    high: 'bg-green-100 text-green-800',
    medium: 'bg-yellow-100 text-yellow-800',
    low: 'bg-red-100 text-red-800',
  };

  return (
    <span
      className={`inline-block px-2 py-0.5 text-xs font-medium rounded ${colors[level]}`}
    >
      {level}
    </span>
  );
}

/**
 * Warning badge component
 */
function WarningBadge({
  warning,
}: {
  warning: { type: string; message: string; severity: string };
}) {
  const colors = {
    info: 'bg-blue-100 text-blue-800',
    warning: 'bg-amber-100 text-amber-800',
    error: 'bg-red-100 text-red-800',
  };

  return (
    <div
      className={`text-xs px-2 py-0.5 rounded ${colors[warning.severity as keyof typeof colors]}`}
      title={warning.message}
    >
      {warning.message}
    </div>
  );
}
