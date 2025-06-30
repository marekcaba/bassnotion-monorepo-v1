'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Volume2, Play, Pause } from 'lucide-react';

interface BassLineWidgetProps {
  pattern: string;
  isPlaying: boolean;
  isVisible: boolean;
  onPatternChange: (pattern: string) => void;
  onToggleVisibility: () => void;
  onTogglePlay?: () => void;
}

const basslineNotes = [
  {
    position: 1,
    note: 'D',
    fret: 5,
    string: 4,
    isActive: false,
    color: 'bg-blue-500',
  },
  {
    position: 2,
    note: 'E',
    fret: 7,
    string: 4,
    isActive: false,
    color: 'bg-blue-400',
  },
  {
    position: 3,
    note: 'F',
    fret: 8,
    string: 4,
    isActive: false,
    color: 'bg-blue-500',
  },
  {
    position: 4,
    note: 'G',
    fret: 10,
    string: 4,
    isActive: false,
    color: 'bg-blue-400',
  },
  {
    position: 5,
    note: 'A',
    fret: 12,
    string: 4,
    isActive: false,
    color: 'bg-blue-500',
  },
  {
    position: 6,
    note: 'B',
    fret: 14,
    string: 4,
    isActive: false,
    color: 'bg-blue-400',
  },
  {
    position: 7,
    note: 'C',
    fret: 15,
    string: 4,
    isActive: false,
    color: 'bg-blue-500',
  },
  {
    position: 8,
    note: 'D',
    fret: 17,
    string: 4,
    isActive: false,
    color: 'bg-blue-400',
  },
];

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
  isPlaying,
  isVisible,
  onPatternChange,
  onToggleVisibility,
  onTogglePlay,
}: BassLineWidgetProps) {
  const [currentNote, setCurrentNote] = useState(0);
  const [notes, setNotes] = useState(basslineNotes);

  // Animate bassline pattern based on playback
  useEffect(() => {
    if (!isPlaying) {
      setNotes(basslineNotes);
      return;
    }

    const interval = setInterval(() => {
      setCurrentNote((prev) => (prev + 1) % basslineNotes.length);
    }, 500); // Sync with metronome timing

    return () => clearInterval(interval);
  }, [isPlaying]);

  // Update note visualization based on current note
  useEffect(() => {
    setNotes((prev) =>
      prev.map((note, index) => ({
        ...note,
        isActive: index === currentNote,
      })),
    );
  }, [currentNote]);

  if (!isVisible) return null;

  return (
    <Card className="bg-blue-900/30 backdrop-blur-xl border border-blue-700/50 shadow-lg hover:shadow-blue-500/10 transition-all duration-300">
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
              <Volume2 className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-white">🎸 Bass Line</h3>
              <p className="text-xs text-blue-200">{pattern}</p>
            </div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={onToggleVisibility}
            className="text-blue-300 hover:text-white"
          >
            ×
          </Button>
        </div>

        {/* Pattern Selection */}
        <div className="mb-4">
          <label className="text-xs text-blue-200 block mb-2">Pattern:</label>
          <select
            value={pattern}
            onChange={(e) => onPatternChange(e.target.value)}
            className="w-full px-2 py-1 text-xs bg-blue-800 border border-blue-600 rounded text-white"
          >
            {availablePatterns.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        {/* Play/Pause Controls */}
        <div className="flex items-center gap-3 mb-4">
          <Button
            size="sm"
            onClick={onTogglePlay}
            className="bg-blue-600 hover:bg-blue-500 text-white"
          >
            {isPlaying ? (
              <Pause className="w-4 h-4" />
            ) : (
              <Play className="w-4 h-4" />
            )}
          </Button>
          <span className="text-xs text-blue-200">
            {isPlaying ? 'Playing' : 'Stopped'}
          </span>
        </div>

        {/* Note Sequence Visualization */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {notes.slice(0, 8).map((note, index) => (
            <div key={index} className="flex flex-col items-center gap-1">
              {/* Note indicator */}
              <div
                className={`
                  w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white
                  transition-all duration-200
                  ${note.color}
                  ${note.isActive ? 'shadow-lg scale-125 ring-2 ring-blue-300' : 'opacity-70'}
                `}
              >
                {note.note}
              </div>
              {/* Fret position */}
              <div
                className={`
                  text-xs font-mono
                  ${note.isActive ? 'text-blue-200' : 'text-blue-500'}
                `}
              >
                {note.fret}
              </div>
              {/* Connection line */}
              <div
                className={`
                  w-1 h-3 rounded-full
                  ${note.color}
                  ${note.isActive ? 'opacity-100' : 'opacity-30'}
                `}
              />
            </div>
          ))}
        </div>

        {/* Pattern Progression Indicators */}
        <div className="flex justify-center gap-2 mb-4">
          {notes.map((_, index) => (
            <div
              key={index}
              className={`
                w-2 h-2 rounded-full transition-all duration-200
                ${
                  index === currentNote
                    ? 'bg-blue-400 scale-125'
                    : index < currentNote
                      ? 'bg-blue-600'
                      : 'bg-blue-800/50'
                }
              `}
            />
          ))}
        </div>

        {/* Current Note Info */}
        <div className="text-center">
          <span className="text-xs text-blue-200">
            {isPlaying
              ? `Playing: ${notes[currentNote]?.note} (Fret ${notes[currentNote]?.fret})`
              : 'Pattern Ready'}
          </span>
        </div>

        {/* Pattern Status */}
        <div className="mt-2 text-center">
          <span className="text-xs text-blue-300">
            {pattern} • String {notes[0]?.string}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
