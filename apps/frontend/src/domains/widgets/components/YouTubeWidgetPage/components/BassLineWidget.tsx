'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { VolumeKnob } from './VolumeKnob';
import { useAudioFretboard } from '../../../hooks/useAudioFretboard';
import { MusicalTimeConverter } from '@bassnotion/contracts/services/MusicalTimeConverter';
// Removed useWidgetSync - part of old pattern registration system
import { useSyncContext } from '../../base/SyncProvider';
import type {
  BassNote,
  MusicalPosition,
  NoteDuration,
} from '@bassnotion/contracts/types/musical-time';
import type { Exercise } from '@bassnotion/contracts';

interface BassLineWidgetProps {
  pattern: string;
  isVisible: boolean;
  exercise?: Exercise;
  onPatternChange: (pattern: string) => void;
  onToggleVisibility: () => void;
  // REMOVED: isPlaying prop - we get it from sync service
  // REMOVED: onTogglePlay - widgets shouldn't control transport
  // REMOVED: tempo - we get it from sync service
}

// Professional bass pattern generation
const generateBassPattern = (
  patternType: string,
  bars = 1,
  timeSignature = { numerator: 4, denominator: 4 },
): BassNote[] => {
  const notes: BassNote[] = [];

  switch (patternType) {
    case 'Modal Walking':
      // Walking bass in D dorian
      const walkingNotes = ['D2', 'F2', 'G2', 'A2', 'C3', 'A2', 'G2', 'F2'];
      walkingNotes.forEach((note, idx) => {
        notes.push({
          measure: Math.floor(idx / 4) + 1,
          beat: (idx % 4) + 1,
          subdivision: 0,
          note,
          duration: 'quarter',
          string: note.includes('2') ? 4 : 3,
          fret: getFretFromNote(note),
          techniques: idx === 3 ? ['slide_up'] : undefined,
        });
      });
      break;

    case 'Chromatic Walk':
      // Chromatic approach tones
      const chromaticNotes = [
        'E2',
        'F2',
        'F#2',
        'G2',
        'G#2',
        'A2',
        'Bb2',
        'B2',
      ];
      chromaticNotes.forEach((note, idx) => {
        notes.push({
          measure: Math.floor(idx / 4) + 1,
          beat: (idx % 4) + 1,
          subdivision: 0,
          note,
          duration: 'quarter',
          string: 4,
          fret: getFretFromNote(note),
          techniques: idx % 2 === 1 ? ['hammer_on'] : undefined,
        });
      });
      break;

    case 'Pentatonic Run':
      // Fast pentatonic runs
      const pentatonicNotes = ['D2', 'F2', 'G2', 'A2', 'C3', 'D3'];
      pentatonicNotes.forEach((note, idx) => {
        const position = idx * 2; // 8th notes
        notes.push({
          measure: Math.floor(position / 8) + 1,
          beat: Math.floor((position % 8) / 2) + 1,
          subdivision: (position % 2) * 2, // 0 or 2 (8th note subdivisions)
          note,
          duration: 'eighth',
          string: note.includes('2') ? 4 : 3,
          fret: getFretFromNote(note),
          techniques: idx === 2 ? ['pull_off'] : undefined,
        });
      });
      break;

    case 'Arpeggiated':
      // Arpeggiated pattern with triplets
      const arpNotes = ['D2', 'F2', 'A2', 'D3', 'A2', 'F2'];
      arpNotes.forEach((note, idx) => {
        // Triplet timing
        const tripletPosition = idx;
        const beat = Math.floor(tripletPosition / 3) + 1;
        const tripletInBeat = tripletPosition % 3;

        notes.push({
          measure: 1,
          beat,
          subdivision: Math.floor(tripletInBeat * 1.33), // Approximate triplet subdivision
          note,
          duration: 'eighth-triplet',
          string: note.includes('2') ? 4 : 3,
          fret: getFretFromNote(note),
        });
      });
      break;

    default:
      // Default root-fifth pattern
      notes.push(
        {
          measure: 1,
          beat: 1,
          subdivision: 0,
          note: 'D2',
          duration: 'quarter',
          string: 4,
          fret: 5,
        },
        {
          measure: 1,
          beat: 2,
          subdivision: 0,
          note: 'A2',
          duration: 'quarter',
          string: 3,
          fret: 2,
        },
        {
          measure: 1,
          beat: 3,
          subdivision: 0,
          note: 'D2',
          duration: 'quarter',
          string: 4,
          fret: 5,
        },
        {
          measure: 1,
          beat: 4,
          subdivision: 0,
          note: 'A2',
          duration: 'quarter',
          string: 3,
          fret: 2,
        },
      );
  }

  return notes;
};

// Helper function to get fret position from note name
const getFretFromNote = (note: string): number => {
  const noteMap: Record<string, number> = {
    E2: 0,
    F2: 1,
    'F#2': 2,
    G2: 3,
    'G#2': 4,
    A2: 0,
    Bb2: 1,
    B2: 2,
    C3: 3,
    'C#3': 4,
    D3: 5,
    'D#3': 6,
    E3: 7,
    F3: 8,
    'F#3': 9,
    G3: 10,
    'G#3': 11,
    A3: 12,
  };
  return noteMap[note] || 0;
};

const availablePatterns = [
  'Modal Walking',
  'Chromatic Walk',
  'Pentatonic Run',
  'Scale Sequence',
  'Arpeggiated',
  'Rhythmic Pattern',
];

export function BassLineWidget({
  pattern,
  isVisible,
  exercise,
  onPatternChange,
  onToggleVisibility,
}: BassLineWidgetProps) {
  // Use sync context instead of the old useWidgetSync
  const { syncState } = useSyncContext();

  // Get transport state from sync context
  const isPlaying = syncState.playback.isPlaying;
  const tempo = syncState.playback.tempo;
  const selectedExercise = syncState.exercise.selectedExercise;
  // Widget state
  const [isExpanded, setIsExpanded] = useState(false);
  const [volume, setVolume] = useState(80);
  const [isMuted, setIsMuted] = useState(false);

  // Use the same audio fretboard hook as the main visualizer
  const audioIntegration = useAudioFretboard({
    stringCount: 4, // 4-string bass
    exercise: exercise || selectedExercise,
  });

  // Get the exact same current note tracking as main fretboard
  const { playbackPosition, isCurrentNote } = audioIntegration;
  const currentNote = playbackPosition.currentNote;
  const syncIsPlaying = playbackPosition.isPlaying || isPlaying;

  // Get selected notes directly from main fretboard via CUSTOM_BASSLINE sync events
  const selectedNotes = useMemo(() => {
    // If we have exercise notes and we're playing, use those
    if (exercise?.notes && exercise.notes.length > 0 && isPlaying) {
      // Convert exercise notes to the format expected by the widget
      return exercise.notes.map(note => ({
        string: note.string,
        stringIndex: note.string, // Use same value for compatibility
        fret: note.fret,
        note: note.note,
        timestamp: note.timestamp,
      }));
    }
    
    // Otherwise use custom bassline from main fretboard
    const exerciseCustomBassline = syncState.exercise?.customBassline;

    // Use the real-time bassline data from main fretboard
    if (exerciseCustomBassline && Array.isArray(exerciseCustomBassline)) {
      return exerciseCustomBassline;
    }

    // If no selection, show empty state
    return [];
  }, [syncState.exercise?.customBassline, exercise, isPlaying]);

  // Calculate the optimal fret window to center the bassline
  const fretWindow = useMemo(() => {
    const windowSize = 8; // Always show 8 fret columns plus open string when applicable

    if (selectedNotes.length === 0) {
      // Default window: open + frets 1-8
      return { start: 1, end: 8, showOpenString: true };
    }

    // Check if we have any open string notes
    const hasOpenStringNotes = selectedNotes.some(
      (note) => note.fret === 0 || note.fret === 'open',
    );

    // Get all fret positions from selected notes (excluding open strings)
    const fretPositions = selectedNotes
      .map((note) => note.fret)
      .filter(
        (fret) => fret !== 0 && fret !== 'open' && typeof fret === 'number',
      )
      .sort((a, b) => a - b);

    if (fretPositions.length === 0) {
      // Only open string notes, show default window with open strings
      return { start: 1, end: 8, showOpenString: true };
    }

    const minFret = fretPositions[0];
    const maxFret = fretPositions[fretPositions.length - 1];
    const basslineSpan = maxFret - minFret + 1;

    // Helper function to check if a window includes the 12th fret
    const includes12thFret = (start: number, end: number) =>
      start <= 12 && end >= 12;

    if (basslineSpan > windowSize) {
      // Bassline spans more than 8 frets
      // Try to show 12th fret if possible, otherwise show from the start
      const window12th = {
        start: Math.max(5, 12 - Math.floor(windowSize / 2)),
        end: 0,
      };
      window12th.end = window12th.start + windowSize - 1;

      // Check if this window would capture most of the bassline
      const capturedNotes = fretPositions.filter(
        (fret) => fret >= window12th.start && fret <= window12th.end,
      );
      const captureRatio = capturedNotes.length / fretPositions.length;

      if (
        captureRatio >= 0.6 &&
        includes12thFret(window12th.start, window12th.end)
      ) {
        // Use 12th fret window if it captures at least 60% of notes
        return {
          start: window12th.start,
          end: window12th.end,
          showOpenString: hasOpenStringNotes,
        };
      } else {
        // Fall back to showing from the start
        return {
          start: minFret,
          end: minFret + windowSize - 1,
          showOpenString: hasOpenStringNotes && minFret === 1,
        };
      }
    } else {
      // Prioritize user-friendliness: always try to show open string or 12th fret reference
      let start, end;

      // Priority 1: If we have open string notes OR bassline starts low, show open string
      if (hasOpenStringNotes || minFret <= 4) {
        start = 1;
        end = windowSize;
      }
      // Priority 2: If bassline can fit with 12th fret visible, show 12th fret
      else if (maxFret <= 12) {
        // Show 12th fret at the end of the window
        start = Math.max(1, 12 - windowSize + 1);
        end = start + windowSize - 1;
      }
      // Priority 3: If bassline starts around 12th fret area, include 12th fret
      else if (minFret >= 8 && minFret <= 12) {
        // Position window to include 12th fret
        start = Math.max(1, 12 - windowSize + 1);
        end = start + windowSize - 1;

        // If bassline doesn't fit, shift to accommodate it
        if (maxFret > end) {
          start = minFret;
          end = start + windowSize - 1;
        }
      }
      // Priority 4: For higher frets, try to include 12th fret if it doesn't compromise bassline visibility
      else if (minFret >= 13 && minFret - 12 <= 3) {
        // If bassline starts close to 12th fret, try to include it
        start = Math.max(1, 12 - 2); // Show 12th fret with some padding
        end = start + windowSize - 1;

        // If bassline doesn't fit, prioritize bassline over 12th fret
        if (maxFret > end) {
          start = minFret;
          end = start + windowSize - 1;
        }
      }
      // Fallback: Show from bassline start (no reference point possible)
      else {
        start = minFret;
        end = start + windowSize - 1;
      }

      // Show open string if window starts from fret 1 or we have open string notes
      const showOpenString = start === 1 || hasOpenStringNotes;

      return { start, end, showOpenString };
    }
  }, [selectedNotes]);

  if (!isVisible) return null;

  // Show connection status
  if (!isConnected) {
    return (
      <div className="relative bg-slate-800 rounded-2xl px-4 py-1 h-24 shadow-[inset_2px_2px_5px_rgba(0,0,0,0.5),inset_-2px_-2px_5px_rgba(255,255,255,0.1)] flex items-center justify-center">
        <p className="text-yellow-400">Connecting to transport...</p>
      </div>
    );
  }

  return (
    <div
      className={`relative bg-slate-800 rounded-2xl px-4 py-1 h-24 shadow-[inset_2px_2px_5px_rgba(0,0,0,0.5),inset_-2px_-2px_5px_rgba(255,255,255,0.1)] transition-all duration-300 select-none ${
        volume === 0 || isMuted ? 'bg-slate-850 grayscale brightness-100' : ''
      }`}
    >
      <div className="flex items-center justify-between h-full">
        {/* Volume Knob */}
        <div className="flex justify-center items-center w-20 h-16">
          <VolumeKnob
            value={volume}
            onChange={(val) => {
              setVolume(val);
              if (val > 0) {
                setIsMuted(false);
              }
            }}
            color="bg-purple-400"
            size={45}
            isMuted={isMuted}
            onMuteToggle={() => {
              setIsMuted(!isMuted);
            }}
          />
        </div>

        {/* Title/Subtitle OR Settings Panel */}
        <div className="flex-1">
          <div className="flex items-center justify-between px-4 py-2">
            {!isExpanded ? (
              <>
                {/* Title and Subtitle */}
                <div className="flex-1">
                  <h3
                    className={`font-semibold text-sm transition-all duration-300 ${
                      volume === 0 ? 'text-slate-600' : 'text-white'
                    }`}
                  >
                    Bass Line
                  </h3>
                  <p
                    className={`text-xs transition-all duration-300 ${
                      volume === 0 ? 'text-slate-600' : 'text-slate-400'
                    }`}
                  >
                    {pattern.length > 15
                      ? pattern.substring(0, 15) + '...'
                      : pattern}
                  </p>
                </div>

                {/* Clickable Indicator */}
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className={`flex items-center gap-1 px-3 py-2 rounded-xl bg-slate-800 shadow-[5px_5px_10px_rgba(0,0,0,0.5),-5px_-5px_10px_rgba(255,255,255,0.1)] hover:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.5),inset_-2px_-2px_5px_rgba(255,255,255,0.1)] transition-all duration-300 cursor-pointer ${
                    volume === 0 ? 'opacity-50' : ''
                  }`}
                >
                  {/* Fretboard visualization - 4 strings × 9 positions (open + 8 frets) */}
                  {/* Using absolute string indexing to match main fretboard: B(0), E(1), A(2), D(3), G(4), C(5) */}
                  <div className="space-y-px">
                    {/* String 4 - G string (highest, index 4) */}
                    <div className="flex gap-px">
                      {/* Open string (square dot) - only show when appropriate */}
                      {fretWindow.showOpenString && (
                        <div
                          key={`s4-fopen`}
                          className={`w-2 h-2 rounded-[2px] transition-all duration-200 ${(() => {
                            const stringIndex = 4;
                            const fret = 'open';
                            const isActive = isCurrentNote(stringIndex, fret);
                            const hasNote = selectedNotes.some((note) => {
                              const noteString =
                                note.stringIndex !== undefined
                                  ? note.stringIndex
                                  : note.string;
                              const noteFret =
                                note.fret === 0 ? 'open' : note.fret;
                              return (
                                noteString === stringIndex && noteFret === fret
                              );
                            });

                            return isActive && syncIsPlaying
                              ? 'bg-purple-400 shadow-lg shadow-purple-400/50'
                              : hasNote
                                ? 'bg-purple-500'
                                : 'bg-slate-500';
                          })()}`}
                        />
                      )}
                      {/* Fretted positions */}
                      {Array.from({ length: 8 }, (_, fretIndex) => {
                        // Use absolute string index 4 for G string (same as main fretboard)
                        const stringIndex = 4;
                        const fret = fretWindow.start + fretIndex; // Dynamic fret window
                        const isActive = isCurrentNote(stringIndex, fret);
                        // Check if this position has a selected note from main fretboard
                        const hasNote = selectedNotes.some((note) => {
                          const noteString =
                            note.stringIndex !== undefined
                              ? note.stringIndex
                              : note.string;
                          const noteFret = note.fret === 0 ? 'open' : note.fret;
                          return (
                            noteString === stringIndex && noteFret === fret
                          );
                        });

                        // Check if this is a fret marker position (3, 5, 7, 9, 12, 15, 17, 19)
                        const isFretMarker = [
                          3, 5, 7, 9, 12, 15, 17, 19,
                        ].includes(fret);

                        return (
                          <div
                            key={`s${stringIndex}-f${fret}`}
                            className={`w-2 h-2 rounded-full transition-all duration-200 ${
                              isActive && syncIsPlaying
                                ? 'bg-purple-400 shadow-lg shadow-purple-400/50'
                                : hasNote
                                  ? 'bg-purple-500'
                                  : isFretMarker
                                    ? 'bg-slate-500'
                                    : 'bg-slate-600'
                            }`}
                          />
                        );
                      })}
                    </div>

                    {/* String 3 - D string (index 3) */}
                    <div className="flex gap-px">
                      {/* Open string (square dot) - only show when appropriate */}
                      {fretWindow.showOpenString && (
                        <div
                          key={`s3-fopen`}
                          className={`w-2 h-2 rounded-[2px] transition-all duration-200 ${(() => {
                            const stringIndex = 3;
                            const fret = 'open';
                            const isActive = isCurrentNote(stringIndex, fret);
                            const hasNote = selectedNotes.some((note) => {
                              const noteString =
                                note.stringIndex !== undefined
                                  ? note.stringIndex
                                  : note.string;
                              const noteFret =
                                note.fret === 0 ? 'open' : note.fret;
                              return (
                                noteString === stringIndex && noteFret === fret
                              );
                            });

                            return isActive && syncIsPlaying
                              ? 'bg-purple-400 shadow-lg shadow-purple-400/50'
                              : hasNote
                                ? 'bg-purple-500'
                                : 'bg-slate-500';
                          })()}`}
                        />
                      )}
                      {/* Fretted positions */}
                      {Array.from({ length: 8 }, (_, fretIndex) => {
                        // Use absolute string index 3 for D string (same as main fretboard)
                        const stringIndex = 3;
                        const fret = fretWindow.start + fretIndex; // Dynamic fret window
                        const isActive = isCurrentNote(stringIndex, fret);
                        // Check if this position has a selected note from main fretboard
                        const hasNote = selectedNotes.some((note) => {
                          const noteString =
                            note.stringIndex !== undefined
                              ? note.stringIndex
                              : note.string;
                          const noteFret = note.fret === 0 ? 'open' : note.fret;
                          return (
                            noteString === stringIndex && noteFret === fret
                          );
                        });

                        // Check if this is a fret marker position (3, 5, 7, 9, 12, 15, 17, 19)
                        const isFretMarker = [
                          3, 5, 7, 9, 12, 15, 17, 19,
                        ].includes(fret);

                        return (
                          <div
                            key={`s${stringIndex}-f${fret}`}
                            className={`w-2 h-2 rounded-full transition-all duration-200 ${
                              isActive && syncIsPlaying
                                ? 'bg-purple-400 shadow-lg shadow-purple-400/50'
                                : hasNote
                                  ? 'bg-purple-500'
                                  : isFretMarker
                                    ? 'bg-slate-500'
                                    : 'bg-slate-600'
                            }`}
                          />
                        );
                      })}
                    </div>

                    {/* String 2 - A string (index 2) */}
                    <div className="flex gap-px">
                      {/* Open string (square dot) - only show when appropriate */}
                      {fretWindow.showOpenString && (
                        <div
                          key={`s2-fopen`}
                          className={`w-2 h-2 rounded-[2px] transition-all duration-200 ${(() => {
                            const stringIndex = 2;
                            const fret = 'open';
                            const isActive = isCurrentNote(stringIndex, fret);
                            const hasNote = selectedNotes.some((note) => {
                              const noteString =
                                note.stringIndex !== undefined
                                  ? note.stringIndex
                                  : note.string;
                              const noteFret =
                                note.fret === 0 ? 'open' : note.fret;
                              return (
                                noteString === stringIndex && noteFret === fret
                              );
                            });

                            return isActive && syncIsPlaying
                              ? 'bg-purple-400 shadow-lg shadow-purple-400/50'
                              : hasNote
                                ? 'bg-purple-500'
                                : 'bg-slate-500';
                          })()}`}
                        />
                      )}
                      {/* Fretted positions */}
                      {Array.from({ length: 8 }, (_, fretIndex) => {
                        // Use absolute string index 2 for A string (same as main fretboard)
                        const stringIndex = 2;
                        const fret = fretWindow.start + fretIndex; // Dynamic fret window
                        const isActive = isCurrentNote(stringIndex, fret);
                        // Check if this position has a selected note from main fretboard
                        const hasNote = selectedNotes.some((note) => {
                          const noteString =
                            note.stringIndex !== undefined
                              ? note.stringIndex
                              : note.string;
                          const noteFret = note.fret === 0 ? 'open' : note.fret;
                          return (
                            noteString === stringIndex && noteFret === fret
                          );
                        });

                        // Check if this is a fret marker position (3, 5, 7, 9, 12, 15, 17, 19)
                        const isFretMarker = [
                          3, 5, 7, 9, 12, 15, 17, 19,
                        ].includes(fret);

                        return (
                          <div
                            key={`s${stringIndex}-f${fret}`}
                            className={`w-2 h-2 rounded-full transition-all duration-200 ${
                              isActive && syncIsPlaying
                                ? 'bg-purple-400 shadow-lg shadow-purple-400/50'
                                : hasNote
                                  ? 'bg-purple-500'
                                  : isFretMarker
                                    ? 'bg-slate-500'
                                    : 'bg-slate-600'
                            }`}
                          />
                        );
                      })}
                    </div>

                    {/* String 1 - E string (lowest, index 1) */}
                    <div className="flex gap-px">
                      {/* Open string (square dot) - only show when appropriate */}
                      {fretWindow.showOpenString && (
                        <div
                          key={`s1-fopen`}
                          className={`w-2 h-2 rounded-[2px] transition-all duration-200 ${(() => {
                            const stringIndex = 1;
                            const fret = 'open';
                            const isActive = isCurrentNote(stringIndex, fret);
                            const hasNote = selectedNotes.some((note) => {
                              const noteString =
                                note.stringIndex !== undefined
                                  ? note.stringIndex
                                  : note.string;
                              const noteFret =
                                note.fret === 0 ? 'open' : note.fret;
                              return (
                                noteString === stringIndex && noteFret === fret
                              );
                            });

                            return isActive && syncIsPlaying
                              ? 'bg-purple-400 shadow-lg shadow-purple-400/50'
                              : hasNote
                                ? 'bg-purple-500'
                                : 'bg-slate-500';
                          })()}`}
                        />
                      )}
                      {/* Fretted positions */}
                      {Array.from({ length: 8 }, (_, fretIndex) => {
                        // Use absolute string index 1 for E string (same as main fretboard)
                        const stringIndex = 1;
                        const fret = fretWindow.start + fretIndex; // Dynamic fret window
                        const isActive = isCurrentNote(stringIndex, fret);
                        // Check if this position has a selected note from main fretboard
                        const hasNote = selectedNotes.some((note) => {
                          const noteString =
                            note.stringIndex !== undefined
                              ? note.stringIndex
                              : note.string;
                          const noteFret = note.fret === 0 ? 'open' : note.fret;
                          return (
                            noteString === stringIndex && noteFret === fret
                          );
                        });

                        // Check if this is a fret marker position (3, 5, 7, 9, 12, 15, 17, 19)
                        const isFretMarker = [
                          3, 5, 7, 9, 12, 15, 17, 19,
                        ].includes(fret);

                        return (
                          <div
                            key={`s${stringIndex}-f${fret}`}
                            className={`w-2 h-2 rounded-full transition-all duration-200 ${
                              isActive && syncIsPlaying
                                ? 'bg-purple-400 shadow-lg shadow-purple-400/50'
                                : hasNote
                                  ? 'bg-purple-500'
                                  : isFretMarker
                                    ? 'bg-slate-500'
                                    : 'bg-slate-600'
                            }`}
                          />
                        );
                      })}
                    </div>
                  </div>
                </button>
              </>
            ) : (
              <>
                {/* Settings content in horizontal layout matching metronome */}
                <div className="flex items-center justify-between flex-1">
                  {/* 1. Pattern Selection */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-purple-400">Pattern:</span>
                    <select
                      value={pattern}
                      onChange={(e) => onPatternChange(e.target.value)}
                      className="bg-slate-700 text-white text-xs rounded px-2 py-1 border border-slate-600"
                    >
                      {availablePatterns.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 2. Center space for balance - matching metronome layout */}
                  <div className="flex items-center justify-center flex-1 px-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-purple-400">
                        {currentNote?.note || 'D2'}
                      </span>
                      <div className="text-xs text-purple-300">
                        String {currentNote?.string || 4}, Fret{' '}
                        {currentNote?.fret || 0}
                      </div>
                    </div>
                  </div>

                  {/* 3. Additional Controls - Placeholder for future features */}
                  <div className="flex items-center gap-2">
                    {/* Future bass controls can go here */}
                  </div>
                </div>

                <button
                  onClick={() => setIsExpanded(false)}
                  className="w-5 h-5 rounded-md bg-slate-800 shadow-[2px_2px_4px_rgba(0,0,0,0.5),-2px_-2px_4px_rgba(255,255,255,0.1)] hover:shadow-[inset_1px_1px_2px_rgba(0,0,0,0.5),inset_-1px_-1px_2px_rgba(255,255,255,0.1)] transition-all duration-200 text-slate-400 text-xs flex items-center justify-center self-start mt-1 ml-4"
                  title="Close settings"
                >
                  ×
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
