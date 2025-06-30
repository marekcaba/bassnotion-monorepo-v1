'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Volume2, Play, Pause } from 'lucide-react';

interface DrummerWidgetProps {
  pattern: string;
  isPlaying: boolean;
  isVisible: boolean;
  onPatternChange: (pattern: string) => void;
  onToggleVisibility: () => void;
  onTogglePlay?: () => void;
}

const drummerPatterns = [
  { beat: 1, intensity: 'high', color: 'bg-orange-500', isActive: false },
  { beat: 2, intensity: 'medium', color: 'bg-orange-400', isActive: false },
  { beat: 3, intensity: 'low', color: 'bg-orange-300', isActive: false },
  { beat: 4, intensity: 'high', color: 'bg-orange-500', isActive: false },
  { beat: 5, intensity: 'medium', color: 'bg-orange-400', isActive: false },
  { beat: 6, intensity: 'medium', color: 'bg-orange-400', isActive: false },
  { beat: 7, intensity: 'low', color: 'bg-orange-300', isActive: false },
  { beat: 8, intensity: 'high', color: 'bg-orange-500', isActive: false },
];

const availablePatterns = [
  'Jazz Swing',
  'Rock Steady',
  'Bossa Nova',
  'Funk Groove',
  'Latin',
  'Shuffle',
];

export function DrummerWidget({
  pattern,
  isPlaying,
  isVisible,
  onPatternChange,
  onToggleVisibility,
  onTogglePlay,
}: DrummerWidgetProps) {
  const [currentBeat, setCurrentBeat] = useState(0);
  const [patterns, setPatterns] = useState(drummerPatterns);

  // Animate drum pattern based on playback
  useEffect(() => {
    if (!isPlaying) {
      setPatterns(drummerPatterns);
      return;
    }

    const interval = setInterval(() => {
      setCurrentBeat((prev) => (prev + 1) % 8);
    }, 500); // Sync with metronome timing

    return () => clearInterval(interval);
  }, [isPlaying]);

  // Update pattern visualization based on current beat
  useEffect(() => {
    setPatterns((prev) =>
      prev.map((p, index) => ({
        ...p,
        isActive: index === currentBeat,
      })),
    );
  }, [currentBeat]);

  if (!isVisible) return null;

  return (
    <Card className="bg-orange-900/30 backdrop-blur-xl border border-orange-700/50 shadow-lg hover:shadow-orange-500/10 transition-all duration-300">
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
              <Volume2 className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-white">🥁 Drummer</h3>
              <p className="text-xs text-orange-200">{pattern}</p>
            </div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={onToggleVisibility}
            className="text-orange-300 hover:text-white"
          >
            ×
          </Button>
        </div>

        {/* Pattern Selection */}
        <div className="mb-4">
          <label className="text-xs text-orange-200 block mb-2">Pattern:</label>
          <select
            value={pattern}
            onChange={(e) => onPatternChange(e.target.value)}
            className="w-full px-2 py-1 text-xs bg-orange-800 border border-orange-600 rounded text-white"
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
            className="bg-orange-600 hover:bg-orange-500 text-white"
          >
            {isPlaying ? (
              <Pause className="w-4 h-4" />
            ) : (
              <Play className="w-4 h-4" />
            )}
          </Button>
          <span className="text-xs text-orange-200">
            {isPlaying ? 'Playing' : 'Stopped'}
          </span>
        </div>

        {/* Visual Beat Indicators with Dots */}
        <div className="grid grid-cols-4 gap-1">
          {patterns.map((drumPattern, index) => (
            <div key={index} className="flex flex-col gap-1">
              {/* Main beat indicator */}
              <div
                className={`
                  w-full h-3 rounded-sm transition-all duration-200
                  ${drumPattern.color}
                  ${
                    drumPattern.intensity === 'high'
                      ? 'opacity-100'
                      : drumPattern.intensity === 'medium'
                        ? 'opacity-70'
                        : 'opacity-40'
                  }
                  ${drumPattern.isActive ? 'scale-110 shadow-lg' : ''}
                `}
              />
              {/* Secondary beat line */}
              <div
                className={`
                  w-full h-1 rounded-sm
                  ${drumPattern.color}
                  ${
                    drumPattern.intensity === 'high'
                      ? 'opacity-80'
                      : drumPattern.intensity === 'medium'
                        ? 'opacity-50'
                        : 'opacity-20'
                  }
                  ${drumPattern.isActive ? 'scale-105' : ''}
                `}
              />
              {/* Accent line */}
              <div
                className={`
                  w-full h-1 rounded-sm
                  ${drumPattern.color}
                  ${drumPattern.intensity === 'high' ? 'opacity-60' : 'opacity-10'}
                  ${drumPattern.isActive ? 'scale-105' : ''}
                `}
              />
              {/* Beat number */}
              <div className="text-center">
                <span
                  className={`
                    text-xs font-mono
                    ${drumPattern.isActive ? 'text-orange-200' : 'text-orange-500'}
                  `}
                >
                  {drumPattern.beat}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Pattern Status */}
        <div className="mt-4 text-center">
          <span className="text-xs text-orange-200">
            {isPlaying ? `Playing ${pattern}` : 'Pattern Ready'}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
