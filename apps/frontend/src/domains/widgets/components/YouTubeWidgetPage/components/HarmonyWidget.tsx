'use client';

import React, { useEffect } from 'react';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Volume2, SkipForward, Play, Pause } from 'lucide-react';

interface HarmonyWidgetProps {
  progression: string[];
  currentChord: number;
  isPlaying: boolean;
  isVisible: boolean;
  onNextChord: () => void;
  onProgressionChange: (progression: string[]) => void;
  onToggleVisibility: () => void;
  onTogglePlay?: () => void;
}

const chordProgressions = {
  'Jazz Standard': ['Dm7', 'G7', 'CMaj7', 'Am7'],
  'Blues in C': ['C7', 'F7', 'C7', 'G7'],
  'Pop Progression': ['C', 'G', 'Am', 'F'],
  'Modal Jazz': ['Dm7', 'Em7', 'FMaj7', 'G7'],
  'Bossa Nova': ['CMaj7', 'Dm7', 'G7', 'Em7'],
  'Funk Groove': ['Dm7', 'Dm7', 'G7', 'G7'],
};

export function HarmonyWidget({
  progression,
  currentChord,
  isPlaying,
  isVisible,
  onNextChord,
  onProgressionChange,
  onToggleVisibility,
  onTogglePlay,
}: HarmonyWidgetProps) {
  const currentProgressionName =
    Object.keys(chordProgressions).find(
      (key) =>
        JSON.stringify(
          chordProgressions[key as keyof typeof chordProgressions],
        ) === JSON.stringify(progression),
    ) || 'Custom';

  // Auto-advance chords when playing
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      onNextChord();
    }, 2000); // Change chord every 2 seconds

    return () => clearInterval(interval);
  }, [isPlaying, onNextChord]);

  const handleProgressionChange = (progressionName: string) => {
    if (progressionName in chordProgressions) {
      onProgressionChange(
        chordProgressions[progressionName as keyof typeof chordProgressions],
      );
    }
  };

  if (!isVisible) return null;

  return (
    <Card className="bg-purple-900/30 backdrop-blur-xl border border-purple-700/50 shadow-lg hover:shadow-purple-500/10 transition-all duration-300">
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center">
              <Volume2 className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-white">🎼 Harmony</h3>
              <p className="text-xs text-purple-200">
                {currentProgressionName}
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={onToggleVisibility}
            className="text-purple-300 hover:text-white"
          >
            ×
          </Button>
        </div>

        {/* Progression Selection */}
        <div className="mb-4">
          <label className="text-xs text-purple-200 block mb-2">
            Progression:
          </label>
          <select
            value={currentProgressionName}
            onChange={(e) => handleProgressionChange(e.target.value)}
            className="w-full px-2 py-1 text-xs bg-purple-800 border border-purple-600 rounded text-white"
          >
            {Object.keys(chordProgressions).map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>

        {/* Chord Progression Text Display (for tests) */}
        <div className="mb-4 text-center">
          <span className="text-sm text-purple-200">
            {progression.join(' - ')}
          </span>
        </div>

        {/* Play/Pause Controls */}
        <div className="flex items-center gap-3 mb-4">
          <Button
            size="sm"
            onClick={onTogglePlay}
            className="bg-purple-600 hover:bg-purple-500 text-white"
          >
            {isPlaying ? (
              <Pause className="w-4 h-4" />
            ) : (
              <Play className="w-4 h-4" />
            )}
          </Button>
          <span className="text-xs text-purple-200">
            {isPlaying ? 'Playing' : 'Stopped'}
          </span>
        </div>

        {/* Chord Progression Display */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          {progression.map((chord, index) => (
            <div
              key={index}
              className={`
                h-12 rounded-lg flex items-center justify-center text-sm font-bold
                transition-all duration-300
                ${
                  index === currentChord
                    ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/30 scale-105'
                    : 'bg-purple-800/40 text-purple-200 hover:bg-purple-700/60'
                }
              `}
            >
              {chord}
            </div>
          ))}
        </div>

        {/* Manual Navigation */}
        <div className="flex items-center justify-between">
          <Button
            size="sm"
            onClick={onNextChord}
            className="bg-purple-600 hover:bg-purple-500 text-white"
          >
            <SkipForward className="w-4 h-4 mr-1" />
            Next
          </Button>
          <span className="text-xs text-purple-200">
            {currentChord + 1} / {progression.length}
          </span>
        </div>

        {/* Status */}
        <div className="mt-3 text-center">
          <span className="text-xs text-purple-200">
            {isPlaying ? 'Auto-advancing chords' : 'Manual mode'}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
