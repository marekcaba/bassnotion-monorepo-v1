'use client';

import React, { useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';

import { FretboardVisualizer } from '@/domains/playback/components/FretboardVisualizer/FretboardVisualizer';
import { UsePlaybackIntegrationReturn } from '../../hooks/usePlaybackIntegration';

// Mock exercise data for testing
const mockNotes = [
  {
    id: '1',
    timestamp: 0,
    string: 1,
    fret: 3,
    duration: 500,
    note: 'G2',
  },
  {
    id: '2',
    timestamp: 1000,
    string: 2,
    fret: 2,
    duration: 500,
    note: 'B2',
  },
  {
    id: '3',
    timestamp: 2000,
    string: 3,
    fret: 0,
    duration: 500,
    note: 'D3',
  },
  {
    id: '4',
    timestamp: 3000,
    string: 4,
    fret: 2,
    duration: 500,
    note: 'E3',
  },
];

interface FretboardVisualizerCardProps {
  exerciseId?: string;
  /** Optional playback integration for audio-visual sync */
  playbackIntegration?: UsePlaybackIntegrationReturn;
}

export function FretboardVisualizerCard({
  exerciseId: _exerciseId,
  playbackIntegration,
}: FretboardVisualizerCardProps) {
  const [selectedStrings, setSelectedStrings] = useState<4 | 5 | 6>(4);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // Use Core Playback Engine state if available
  const engineCurrentTime =
    playbackIntegration?.state.currentTime || currentTime;
  const engineIsPlaying = playbackIntegration?.state.isPlaying || isPlaying;
  const engineTempo = playbackIntegration?.state.tempo || 120;

  // Mock playback for demonstration (only when not using Core Playback Engine)
  React.useEffect(() => {
    if (playbackIntegration || !isPlaying) return;

    const interval = setInterval(() => {
      setCurrentTime((prev) => prev + 100);
    }, 100);

    return () => clearInterval(interval);
  }, [isPlaying, playbackIntegration]);

  const handleCameraReset = () => {
    // Camera reset requested
  };

  const handleSettingsClick = () => {
    // Settings clicked
  };

  const handlePlayToggle = () => {
    if (playbackIntegration) {
      // Use Core Playback Engine controls
      if (engineIsPlaying) {
        playbackIntegration.controls.pause();
      } else {
        playbackIntegration.controls.play();
      }
    } else {
      // Fallback to local state
      setIsPlaying(!isPlaying);
      if (!isPlaying) {
        setCurrentTime(0);
      }
    }
  };

  return (
    <Card className="bg-slate-800/40 backdrop-blur-xl border border-slate-700/50 shadow-2xl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
              <div className="w-6 h-6 bg-white rounded-sm"></div>
            </div>
            <div>
              <CardTitle className="text-xl font-bold text-white">
                🎸 3D Fretboard Visualizer
              </CardTitle>
              <p className="text-slate-400">
                Interactive bass guitar fretboard with Three.js
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 text-slate-300 text-sm">
              <span>Strings:</span>
              <select
                value={selectedStrings}
                onChange={(e) =>
                  setSelectedStrings(Number(e.target.value) as 4 | 5 | 6)
                }
                className="bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer min-w-[100px] appearance-none bg-no-repeat bg-right h-9 leading-5 relative z-10"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                  backgroundPosition: 'right 8px center',
                  backgroundSize: '16px 16px',
                  paddingRight: '32px',
                }}
              >
                <option value={4}>4 strings</option>
                <option value={5}>5 strings</option>
                <option value={6}>6 strings</option>
              </select>

              {/* Demo Play Button */}
              <Button
                size="sm"
                variant="ghost"
                className="text-slate-300 hover:text-white"
                onClick={handlePlayToggle}
              >
                {engineIsPlaying ? '⏸️' : '▶️'}
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-6 pb-6 pt-0">
        {/* 3D Fretboard Visualizer */}
        <div className="h-96 w-full -mt-16">
          <FretboardVisualizer
            notes={mockNotes}
            currentTime={engineCurrentTime}
            bpm={engineTempo}
            isPlaying={engineIsPlaying}
            onCameraReset={handleCameraReset}
            onSettingsClick={handleSettingsClick}
          />
        </div>

        {/* Legend - Updated for Guitar Hero style */}
        <div className="mt-6 flex flex-wrap gap-4 justify-center">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-500 rounded-full border border-red-400 shadow-lg"></div>
            <span className="text-sm text-slate-300">Current Note</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-500 rounded-full border border-green-400"></div>
            <span className="text-sm text-slate-300">Upcoming Notes</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-amber-400 rounded-full border border-amber-300"></div>
            <span className="text-sm text-slate-300">Play Strip</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-slate-500 rounded-full border border-slate-400"></div>
            <span className="text-sm text-slate-300">Played Notes</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
