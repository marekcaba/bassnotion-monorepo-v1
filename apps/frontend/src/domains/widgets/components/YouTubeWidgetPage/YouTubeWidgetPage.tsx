'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
// Import our new components
import { YouTubeVideoSection } from './YouTubeVideoSection';
import { TutorialInfoCard } from './TutorialInfoCard';
import { ExerciseSelectorCard } from './ExerciseSelectorCard';
import { FretboardVisualizerCard } from './FretboardVisualizerCard';
import { FourWidgetsCard } from './components/FourWidgetsCard';
import { SheetPlayerVisualizerCard } from './SheetPlayerVisualizerCard';
import { TeachingTakeawayCard } from './TeachingTakeawayCard';
import { useWidgetPageState } from '@/domains/widgets/hooks/useWidgetPageState';
import { Button } from '@/shared/components/ui/button';
import { Play, Pause, Volume2, Settings } from 'lucide-react';
import { SyncProvider, useSyncContext } from '../base/SyncProvider';
import type { Tutorial } from '@bassnotion/contracts';

interface YouTubeWidgetPageProps {
  tutorialData?: Tutorial;
  tutorialSlug?: string;
  exercises?: any[]; // Exercise data from tutorial API
}

// Inner component that has access to sync context
function YouTubeWidgetPageContent({
  tutorialData,
  tutorialSlug,
  exercises,
}: YouTubeWidgetPageProps) {
  // Debug: Log component render for debugging re-render issues
  // console.log('🔄 YouTubeWidgetPageContent RENDER:', {
  //   tutorialData: tutorialData?.title,
  //   tutorialSlug,
  //   exercisesCount: exercises?.length || 0,
  //   timestamp: new Date().toISOString(),
  // });

  const [selectedExerciseId, setSelectedExerciseId] = useState<string>('');
  const widgetState = useWidgetPageState();
  const { emitGlobalEvent, syncState } = useSyncContext();

  // Use refs to track previous values and prevent infinite loops
  const prevSelectedExerciseRef = useRef<any>(null);
  const prevTempoRef = useRef<number>(120);
  const prevVolumeRef = useRef<number>(80);

  const handleExerciseSelect = useCallback((exerciseId: string) => {
    setSelectedExerciseId(exerciseId);
  }, []);

  // Enhanced tempo control that emits sync events
  const handleTempoChange = useCallback(
    (newTempo: number) => {
      widgetState.setTempo(newTempo);

      // Emit sync event for all widgets to receive
      emitGlobalEvent('TEMPO_CHANGE', {
        tempo: newTempo,
        source: 'global-controls',
      });
    },
    [widgetState, emitGlobalEvent],
  );

  // Extract specific values from syncState to prevent excessive re-renders
  const selectedExercise = syncState.exercise.selectedExercise;
  const syncTempo = syncState.playback.tempo;
  const syncMasterVolume = syncState.ui.masterVolume;

  // Listen for exercise changes in sync state
  useEffect(() => {
    if (
      selectedExercise &&
      selectedExercise !== prevSelectedExerciseRef.current
    ) {
      // Debug log (disabled to reduce console noise)
      // console.log(
      //   '🎛️ Global Controls: Exercise changed in sync state:',
      //   selectedExercise,
      // );

      prevSelectedExerciseRef.current = selectedExercise;

      // Update global tempo if exercise has BPM
      if (
        selectedExercise.bpm &&
        selectedExercise.bpm > 0 &&
        selectedExercise.bpm !== prevTempoRef.current
      ) {
        // Debug log (disabled to reduce console noise)
        // console.log(
        //   '🎛️ Global Controls: Updating tempo to:',
        //   selectedExercise.bpm,
        // );
        widgetState.setTempo(selectedExercise.bpm);
        prevTempoRef.current = selectedExercise.bpm;
      }

      // Update selected exercise in widget state
      widgetState.setSelectedExercise(selectedExercise);
    }
  }, [selectedExercise, widgetState]);

  // Listen for tempo changes in sync state
  useEffect(() => {
    if (
      syncTempo &&
      syncTempo !== prevTempoRef.current &&
      syncTempo !== widgetState.tempo
    ) {
      widgetState.setTempo(syncTempo);
      prevTempoRef.current = syncTempo;
    }
  }, [syncTempo, widgetState.tempo, widgetState]);

  // Listen for volume changes in sync state
  useEffect(() => {
    const currentVolume = widgetState.state.volume.master / 100;
    if (
      syncMasterVolume &&
      syncMasterVolume !== prevVolumeRef.current &&
      syncMasterVolume !== currentVolume
    ) {
      // Debug log (disabled to reduce console noise)
      // console.log(
      //   '🎛️ Global Controls: Master volume changed in sync state:',
      //   syncMasterVolume,
      // );
      widgetState.setVolume('master', Math.round(syncMasterVolume * 100));
      prevVolumeRef.current = syncMasterVolume;
    }
  }, [syncMasterVolume, widgetState]);

  React.useEffect(() => {
    // Debug: Log mount/unmount
    // console.log('🟢 YouTubeWidgetPageContent MOUNTED');
    return () => {
      // console.log('🔴 YouTubeWidgetPageContent UNMOUNTED');
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Mobile-first central container */}
      <div className="mx-auto px-4 py-6 max-w-[600px]">
        <div className="space-y-4">
          {/* YouTube Video Section - Standalone at the top */}
          <YouTubeVideoSection tutorialData={tutorialData} />

          {/* Tutorial Info Card - Separate card with tutorial details */}
          <TutorialInfoCard tutorialData={tutorialData} />

          {/* 2. Exercise Selector Card - Clickable exercise list */}
          <ExerciseSelectorCard
            tutorialData={tutorialData}
            tutorialSlug={tutorialSlug}
            exercises={exercises}
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
            <h3 className="text-base font-semibold text-white mb-3 flex items-center gap-2">
              <Settings className="w-4 h-4" />
              🎛️ Global Controls
            </h3>

            {/* Master Play/Pause Button */}
            <div className="mb-3">
              <label className="text-xs text-slate-300 block mb-2">
                Master Playback
              </label>
              <div className="flex flex-col gap-2">
                <Button
                  onClick={widgetState.togglePlayback}
                  className={`${
                    widgetState.isPlaying
                      ? 'bg-red-600 hover:bg-red-500'
                      : 'bg-green-600 hover:bg-green-500'
                  } text-white w-full`}
                  size="sm"
                >
                  {widgetState.isPlaying ? (
                    <Pause className="w-4 h-4 mr-2" />
                  ) : (
                    <Play className="w-4 h-4 mr-2" />
                  )}
                  {widgetState.isPlaying ? 'Pause All' : 'Play All'}
                </Button>
                <span className="text-xs text-slate-400 text-center">
                  Controls all widgets & fretboard
                </span>
              </div>
            </div>

            {/* Timeline Scrubber */}
            <div className="mb-3">
              <label className="text-xs text-slate-300 block mb-1">
                Timeline
              </label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 w-8">0:00</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={widgetState.currentTime}
                  onChange={(e) =>
                    widgetState.setCurrentTime(Number(e.target.value))
                  }
                  className="flex-1 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                />
                <span className="text-xs text-slate-400 w-8">4:32</span>
              </div>
            </div>

            {/* Tempo Controls */}
            <div className="mb-3">
              <label className="text-xs text-slate-300 block mb-1">Tempo</label>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    handleTempoChange(Math.max(60, widgetState.tempo - 5))
                  }
                  className="text-slate-300 border-slate-600 px-2"
                >
                  -5
                </Button>
                <span className="text-sm font-bold text-white flex-1 text-center">
                  {widgetState.tempo} BPM
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    handleTempoChange(Math.min(200, widgetState.tempo + 5))
                  }
                  className="text-slate-300 border-slate-600 px-2"
                >
                  +5
                </Button>
              </div>
            </div>

            {/* Volume Controls */}
            <div className="space-y-2">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-slate-300 flex items-center gap-1">
                    <Volume2 className="w-3 h-3" />
                    Master
                  </label>
                  <span className="text-xs text-slate-400">
                    {widgetState.state.volume.master}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={widgetState.state.volume.master}
                  onChange={(e) =>
                    widgetState.setVolume('master', Number(e.target.value))
                  }
                  className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-slate-300 flex items-center gap-1">
                    <Volume2 className="w-3 h-3" />
                    Metronome
                  </label>
                  <span className="text-xs text-slate-400">
                    {widgetState.state.volume.metronome}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={widgetState.state.volume.metronome}
                  onChange={(e) =>
                    widgetState.setVolume('metronome', Number(e.target.value))
                  }
                  className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </div>

            {/* Synchronization Status */}
            <div className="mt-3 pt-3 border-t border-slate-700">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-300">Sync Status</span>
                <div className="flex items-center gap-2">
                  <div
                    className={`w-2 h-2 rounded-full ${widgetState.syncEnabled ? 'bg-green-400' : 'bg-red-400'}`}
                  />
                  <span className="text-xs text-slate-400">
                    {widgetState.syncEnabled ? 'Connected' : 'Disconnected'}
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

// Outer component that provides sync context
export function YouTubeWidgetPage({
  tutorialData,
  tutorialSlug,
  exercises,
}: YouTubeWidgetPageProps) {
  return (
    <SyncProvider
      debugMode={false} // Disable debug mode to reduce console noise
      monitoringInterval={15000} // 15 seconds monitoring interval
      enableGlobalMonitoring={true}
    >
      <YouTubeWidgetPageContent
        tutorialData={tutorialData}
        tutorialSlug={tutorialSlug}
        exercises={exercises}
      />
    </SyncProvider>
  );
}
