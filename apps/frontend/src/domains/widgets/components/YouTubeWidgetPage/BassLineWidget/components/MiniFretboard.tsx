'use client';

/**
 * MiniFretboard Component
 *
 * A compact fretboard visualization for the bass widget.
 * Shows 4 strings and 8 frets with note highlighting.
 *
 * @example
 * <MiniFretboard
 *   selectedNotes={selectedNotes}
 *   currentlyPlayingNote={currentlyPlayingNote}
 *   fretWindow={fretWindow}
 *   volume={volume}
 *   onClick={() => setIsExpanded(true)}
 * />
 */

import React, { memo } from 'react';
import { FRET_MARKERS } from '../types.js';
import type { MiniFretboardProps } from '../types.js';

/**
 * Mini fretboard visualization component
 */
const MiniFretboardComponent = ({
  selectedNotes,
  currentlyPlayingNote,
  fretWindow,
  volume,
  onClick,
}: MiniFretboardProps) => {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 px-3 py-2 rounded-xl bg-slate-800 shadow-[5px_5px_10px_rgba(0,0,0,0.5),-5px_-5px_10px_rgba(255,255,255,0.1)] hover:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.5),inset_-2px_-2px_5px_rgba(255,255,255,0.1)] transition-all duration-300 cursor-pointer ${
        volume === 0 ? 'opacity-50' : ''
      }`}
    >
      {/* Mini fretboard visualization - 4 strings */}
      <div className="space-y-px">
        {[4, 3, 2, 1].map((string) => (
          <div key={`string-${string}`} className="flex gap-px">
            {Array.from({ length: 8 }, (_, fretIndex) => {
              const fret = fretWindow.start + fretIndex;
              const hasNote = selectedNotes.some(
                (note) => note.string === string && note.fret === fret
              );
              const isPlaying =
                currentlyPlayingNote?.string === string &&
                currentlyPlayingNote?.fret === fret;
              const isFretMarker = FRET_MARKERS.includes(fret);

              return (
                <div
                  key={`s${string}-f${fret}`}
                  className={`w-2 h-2 rounded-full transition-all duration-200 ${
                    isPlaying
                      ? 'bg-purple-400 animate-pulse scale-125'
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
        ))}
      </div>
    </button>
  );
};

export const MiniFretboard = memo(MiniFretboardComponent);
