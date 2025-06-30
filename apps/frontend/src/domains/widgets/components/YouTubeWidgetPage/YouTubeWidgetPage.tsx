'use client';

import React, { useState } from 'react';
import { MainCard } from './MainCard';
import { ExerciseSelectorCard } from './ExerciseSelectorCard';
import { FretboardVisualizerCard } from './FretboardVisualizerCard';
import { FourWidgetsCard } from './components/FourWidgetsCard';
import { SheetPlayerVisualizerCard } from './SheetPlayerVisualizerCard';
import { TeachingTakeawayCard } from './TeachingTakeawayCard';
import { useWidgetPageState } from '@/domains/widgets/hooks/useWidgetPageState';
import { Button } from '@/shared/components/ui/button';
import { Play, Pause, Volume2, Settings } from 'lucide-react';

interface TutorialData {
  id: string;
  title: string;
  artist: string;
  difficulty: string;
  duration: string;
  videoUrl: string;
  concepts: string[];
}

interface YouTubeWidgetPageProps {
  tutorialData?: TutorialData;
}

export function YouTubeWidgetPage({ tutorialData }: YouTubeWidgetPageProps) {
  const [selectedExerciseId, setSelectedExerciseId] = useState<string>('');
  const widgetState = useWidgetPageState();

  const handleExerciseSelect = (exerciseId: string) => {
    setSelectedExerciseId(exerciseId);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Instagram-style scrollable container */}
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <div className="space-y-6">
          {/* 1. Main Card - YouTube video and tutorial info */}
          <MainCard tutorialData={tutorialData} />

          {/* 2. Exercise Selector Card - Clickable exercise list */}
          <ExerciseSelectorCard
            tutorialData={tutorialData}
            onExerciseSelect={handleExerciseSelect}
          />

          {/* 3. Fretboard Visualizer Card - Guitar Hero-style container */}
          <FretboardVisualizerCard exerciseId={selectedExerciseId} />

          {/* 4. Four Widgets Card - 4 essential widgets */}
          <FourWidgetsCard widgetState={widgetState} />

          {/* 5. Sheet Player Visualizer Card - Music notation */}
          <SheetPlayerVisualizerCard />

          {/* 6. Teaching Takeaway Card - Lesson summaries */}
          <TeachingTakeawayCard tutorialData={tutorialData} />

          {/* Global Controls & Synchronization */}
          <div className="bg-slate-800/60 backdrop-blur-xl border border-slate-700/50 rounded-lg p-4 shadow-lg">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Settings className="w-5 h-5" />
              🎛️ Global Controls
            </h3>

            {/* Master Play/Pause Button */}
            <div className="mb-4">
              <label className="text-sm text-slate-300 block mb-2">
                Master Playback
              </label>
              <div className="flex items-center gap-3">
                <Button
                  onClick={widgetState.togglePlayback}
                  className={`${
                    widgetState.isPlaying
                      ? 'bg-red-600 hover:bg-red-500'
                      : 'bg-green-600 hover:bg-green-500'
                  } text-white`}
                >
                  {widgetState.isPlaying ? (
                    <Pause className="w-4 h-4 mr-2" />
                  ) : (
                    <Play className="w-4 h-4 mr-2" />
                  )}
                  {widgetState.isPlaying ? 'Pause All' : 'Play All'}
                </Button>
                <span className="text-sm text-slate-300">
                  Master control affects all widgets and fretboard animation
                </span>
              </div>
            </div>

            {/* Timeline Scrubber */}
            <div className="mb-4">
              <label className="text-sm text-slate-300 block mb-2">
                Timeline
              </label>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400">0:00</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={widgetState.currentTime}
                  onChange={(e) =>
                    widgetState.setCurrentTime(Number(e.target.value))
                  }
                  className="flex-1 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                />
                <span className="text-xs text-slate-400">4:32</span>
              </div>
            </div>

            {/* Tempo Controls */}
            <div className="mb-4">
              <label className="text-sm text-slate-300 block mb-2">
                Tempo Controls
              </label>
              <div className="flex items-center gap-3">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    widgetState.setTempo(Math.max(60, widgetState.tempo - 5))
                  }
                  className="text-slate-300 border-slate-600"
                >
                  -5
                </Button>
                <span className="text-lg font-bold text-white min-w-[80px] text-center">
                  {widgetState.tempo} BPM
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    widgetState.setTempo(Math.min(200, widgetState.tempo + 5))
                  }
                  className="text-slate-300 border-slate-600"
                >
                  +5
                </Button>
              </div>
            </div>

            {/* Volume Controls */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-slate-300 flex items-center gap-1 mb-1">
                  <Volume2 className="w-3 h-3" />
                  Master Volume
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={widgetState.state.volume.master}
                  onChange={(e) =>
                    widgetState.setVolume('master', Number(e.target.value))
                  }
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                />
                <span className="text-xs text-slate-400">
                  {widgetState.state.volume.master}%
                </span>
              </div>
              <div>
                <label className="text-xs text-slate-300 flex items-center gap-1 mb-1">
                  <Volume2 className="w-3 h-3" />
                  Metronome
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={widgetState.state.volume.metronome}
                  onChange={(e) =>
                    widgetState.setVolume('metronome', Number(e.target.value))
                  }
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                />
                <span className="text-xs text-slate-400">
                  {widgetState.state.volume.metronome}%
                </span>
              </div>
            </div>

            {/* Synchronization Status */}
            <div className="mt-4 pt-4 border-t border-slate-700">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-300">
                  Synchronization Status
                </span>
                <div className="flex items-center gap-2">
                  <div
                    className={`w-2 h-2 rounded-full ${widgetState.syncEnabled ? 'bg-green-400' : 'bg-red-400'}`}
                  />
                  <span className="text-xs text-slate-400">
                    {widgetState.syncEnabled
                      ? 'All widgets synchronized'
                      : 'Sync disabled'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
