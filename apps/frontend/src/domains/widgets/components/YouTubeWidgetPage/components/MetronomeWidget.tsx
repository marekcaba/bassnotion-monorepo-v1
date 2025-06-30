'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '../../../../../shared/components/ui/card';
import { Button } from '../../../../../shared/components/ui/button';
import { Play, Pause, Volume2 } from 'lucide-react';
import { UsePlaybackIntegrationReturn } from '../../../hooks/usePlaybackIntegration';

interface MetronomeWidgetProps {
  bpm: number;
  isPlaying: boolean;
  isVisible: boolean;
  onTogglePlay: () => void;
  onBpmChange: (bpm: number) => void;
  onToggleVisibility: () => void;

  /** Optional playback integration for sync with Core Playback Engine */
  playbackIntegration?: UsePlaybackIntegrationReturn;
}

interface MetronomeDot {
  id: number;
  isActive: boolean;
  isCurrent: boolean;
}

const initialDots: MetronomeDot[] = Array.from({ length: 8 }, (_, i) => ({
  id: i + 1,
  isActive: i < 6, // First 6 dots are active
  isCurrent: i === 0, // First dot is current
}));

export function MetronomeWidget({
  bpm,
  isPlaying,
  isVisible,
  onTogglePlay,
  onBpmChange,
  onToggleVisibility,
  playbackIntegration,
}: MetronomeWidgetProps) {
  const [metronomeDots, setMetronomeDots] = useState(initialDots);

  // Use Core Playback Engine tempo if available, otherwise fall back to props
  const currentTempo = playbackIntegration?.state.tempo || bpm;
  const isEnginePlay = playbackIntegration?.state.isPlaying || isPlaying;

  // Calculate interval based on BPM
  const beatInterval = 60000 / currentTempo; // milliseconds per beat

  // Simulate metronome animation
  useEffect(() => {
    if (!isEnginePlay) return;

    const interval = setInterval(() => {
      setMetronomeDots((prev) => {
        const currentIndex = prev.findIndex((dot) => dot.isCurrent);
        const activeDots = prev.filter((dot) => dot.isActive);
        const nextIndex = (currentIndex + 1) % activeDots.length;

        return prev.map((dot, index) => ({
          ...dot,
          isCurrent: dot.isActive && index === nextIndex,
        }));
      });
    }, beatInterval);

    return () => clearInterval(interval);
  }, [isEnginePlay, beatInterval]);

  const handleBpmChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newBpm = parseInt(event.target.value, 10);
    if (newBpm >= 60 && newBpm <= 200) {
      onBpmChange(newBpm);
      // Sync with Core Playback Engine if available
      if (playbackIntegration) {
        playbackIntegration.controls.setTempo(newBpm);
      }
    }
  };

  if (!isVisible) return null;

  return (
    <Card className="bg-emerald-900/30 backdrop-blur-xl border border-emerald-700/50 shadow-lg hover:shadow-emerald-500/10 transition-all duration-300">
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
              <Volume2 className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-white">🎵 Metronome</h3>
              <p className="text-xs text-emerald-200">{currentTempo} BPM</p>
            </div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={onToggleVisibility}
            className="text-emerald-300 hover:text-white"
          >
            ×
          </Button>
        </div>

        {/* BPM Controls */}
        <div className="flex items-center gap-2 mb-4">
          <label className="text-xs text-emerald-200 min-w-fit">BPM:</label>
          <input
            type="range"
            min="60"
            max="200"
            value={currentTempo}
            onChange={handleBpmChange}
            className="flex-1 h-2 bg-emerald-800 rounded-lg appearance-none cursor-pointer"
          />
          <input
            type="number"
            min="60"
            max="200"
            value={currentTempo}
            onChange={handleBpmChange}
            className="w-16 px-2 py-1 text-xs bg-emerald-800 border border-emerald-600 rounded text-white"
          />
        </div>

        {/* Play/Pause Controls */}
        <div className="flex items-center gap-3 mb-4">
          <Button
            size="sm"
            onClick={onTogglePlay}
            className="bg-emerald-600 hover:bg-emerald-500 text-white"
          >
            {isEnginePlay ? (
              <Pause className="w-4 h-4" />
            ) : (
              <Play className="w-4 h-4" />
            )}
          </Button>
          <span className="text-xs text-emerald-200">
            {isEnginePlay ? 'Playing' : 'Stopped'}
          </span>
        </div>

        {/* Visual Metronome Indicator */}
        <div className="grid grid-cols-4 gap-2">
          {metronomeDots.map((dot) => (
            <div
              key={dot.id}
              className={`
                w-4 h-4 rounded-full transition-all duration-200
                ${
                  dot.isActive
                    ? dot.isCurrent
                      ? 'bg-emerald-400 shadow-lg shadow-emerald-400/50 scale-125'
                      : 'bg-emerald-600/70'
                    : 'bg-slate-700/50'
                }
              `}
            />
          ))}
        </div>

        {/* Tempo Adjustment Controls */}
        <div className="flex justify-between items-center mt-4">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onBpmChange(Math.max(60, currentTempo - 5))}
            className="text-emerald-300 hover:text-white text-xs"
          >
            -5
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onBpmChange(Math.min(200, currentTempo + 5))}
            className="text-emerald-300 hover:text-white text-xs"
          >
            +5
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
