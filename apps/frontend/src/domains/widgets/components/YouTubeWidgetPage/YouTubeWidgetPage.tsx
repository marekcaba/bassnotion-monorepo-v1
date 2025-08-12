'use client';

import React, { useEffect, useRef, useCallback } from 'react';
// Import our new components
import { YouTubeVideoSection } from './YouTubeVideoSection';
import { TutorialInfoCard } from './TutorialInfoCard';
import { FretboardCard } from './FretboardCard';
import Fretboard3D from './FretboardCard/components/Fretboard3D';

import { FourWidgetsCard } from './components/FourWidgetsCard';
import { GlobalControlsCard } from './components/GlobalControlsCard';
import { LooperCard } from './components/LooperCard';
import { TeachingTakeawayCard } from './TeachingTakeawayCard';
import { ExerciseTimelineIndicator } from './components/ExerciseTimelineIndicator';
import { TransportClock } from './components/TransportClock';
import { TimingDebugWindow } from './components/TimingDebugWindow';
import { useWidgetPageState } from '@/domains/widgets/hooks/useWidgetPageState';
import { useAudioFretboard } from '@/domains/widgets/hooks/useAudioFretboard';
import { Button } from '@/shared/components/ui/button';
import { Play, Pause, Volume2, Settings } from 'lucide-react';
import { SyncProvider, useSyncContext } from '../base/SyncProvider';
import { UserIndicator } from '@/domains/user/components/UserIndicator';
import { useUserProfile } from '@/domains/user/hooks/use-user-profile';
import { beatTimingAnalyzer } from '@/domains/playback/utils/BeatTimingAnalyzer';
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

  const widgetState = useWidgetPageState();
  const { emitGlobalEvent, syncState } = useSyncContext();
  const { profile } = useUserProfile();
  const [is3DMode, setIs3DMode] = React.useState(false);
  const [selectedDots, setSelectedDots] = React.useState<Map<string, number[]>>(
    new Map(),
  );
  const [stringCount, setStringCount] = React.useState<4 | 5 | 6>(4);
  const [maxFrets, setMaxFrets] = React.useState(25);
  const [showTimingDebug, setShowTimingDebug] = React.useState(false);

  // Load bass settings from user profile
  useEffect(() => {
    if (profile?.preferences?.bassConfiguration) {
      setStringCount(profile.preferences.bassConfiguration.stringCount);
      setMaxFrets(profile.preferences.bassConfiguration.maxFrets);
    }
  }, [profile]);

  // Listen for bass settings changes from dashboard (still useful for real-time updates)
  useEffect(() => {
    const handleBassSettingsChange = (event: CustomEvent) => {
      const { stringCount: newStringCount, maxFrets: newMaxFrets } =
        event.detail;
      setStringCount(newStringCount);
      setMaxFrets(newMaxFrets);
      // Clear selection when changing string count to avoid invalid selections
      setSelectedDots(new Map());
    };

    window.addEventListener(
      'bass-settings-changed',
      handleBassSettingsChange as EventListener,
    );

    return () => {
      window.removeEventListener(
        'bass-settings-changed',
        handleBassSettingsChange as EventListener,
      );
    };
  }, []);
  const [tiltAngle, setTiltAngle] = React.useState(35);
  const [cameraDistance, _setCameraDistance] = React.useState(7);
  const [cameraMode, setCameraMode] = React.useState<'overview' | 'action'>(
    'overview',
  );

  // Use refs to track previous values and prevent infinite loops
  const prevSelectedExerciseRef = useRef<any>(null);
  const prevTempoRef = useRef<number>(120);
  const prevVolumeRef = useRef<number>(80);

  // Audio fretboard integration for 3D mode
  const { triggerNote } = useAudioFretboard({
    stringCount,
    autoPlayOnClick: true,
    exercise: widgetState.selectedExercise,
  });

  const handleExerciseSelect = useCallback((exerciseId: string) => {
    // Find the exercise from the exercises array
    const exercise = exercises?.find(ex => ex.id === exerciseId);
    if (exercise) {
      console.log('🎵 YouTubeWidgetPage: Exercise selected:', {
        id: exercise.id,
        title: exercise.title,
        hasDrumPattern: !!exercise.drum_pattern,
        drumPatternEnabled: exercise.drum_pattern?.enabled,
        drumPatternLength: exercise.drum_pattern?.pattern?.length
      });
      
      // Update widget state with the selected exercise
      widgetState.setSelectedExercise(exercise);
      
      // Also emit to sync context for global synchronization
      emitGlobalEvent('exercise:selected', { exerciseId, exercise });
    }
  }, [exercises, widgetState, emitGlobalEvent]);

  const handleDotClick = useCallback(
    (stringIndex: number, fret: number | 'open') => {
      // Trigger audio using the shared hook (for 3D mode)
      triggerNote(stringIndex, fret);

      const key = `${stringIndex}-${fret}`;
      setSelectedDots((prev) => {
        const newMap = new Map(prev);
        if (newMap.has(key)) {
          newMap.delete(key);
        } else {
          newMap.set(key, [newMap.size + 1]);
        }
        return newMap;
      });
    },
    [triggerNote],
  );

  const handleResetSelection = useCallback(() => {
    setSelectedDots(new Map());
  }, []);

  const handleTiltAngleChange = useCallback((newTiltAngle: number) => {
    setTiltAngle(newTiltAngle);
  }, []);

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

  // Initialize beat timing analyzer when playback starts
  React.useEffect(() => {
    // Use syncState.playback.isPlaying which comes from the actual transport
    const isTransportPlaying = syncState.playback.isPlaying;
    const currentTempo = widgetState.tempo || syncState.playback.tempo || 120;
    
    if (isTransportPlaying && currentTempo > 0) {
      // Reset analyzer to clear old data
      beatTimingAnalyzer.reset();
      // Start fresh with current tempo
      beatTimingAnalyzer.start(currentTempo);
      console.log(`🎯 BeatTimingAnalyzer started with tempo ${currentTempo}`);
    }
  }, [syncState.playback.isPlaying, widgetState.tempo, syncState.playback.tempo]);

  React.useEffect(() => {
    // Debug: Log mount/unmount
    // console.log('🟢 YouTubeWidgetPageContent MOUNTED');
    
    // Don't start analyzer on mount - wait for playback to start
    // This prevents drift calculations from page load time
    
    return () => {
      // console.log('🔴 YouTubeWidgetPageContent UNMOUNTED');
      // Keep analyzer data for debugging even after unmount
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Mobile-first central container */}
      <div className="mx-auto px-4 py-6 max-w-[600px]">
        <div className="space-y-4">
          {/* User Indicator - Show login status and role */}
          <div className="flex justify-end">
            <UserIndicator />
          </div>

          {/* YouTube Video Section - Standalone at the top */}
          <YouTubeVideoSection tutorialData={tutorialData} />

          {/* Tutorial Info Card - Separate card with tutorial details */}
          <TutorialInfoCard tutorialData={tutorialData} />

          {/* 2. Interactive Fretboard Card with integrated Exercise Selector */}
          <FretboardCard
            is3DMode={is3DMode}
            onToggle3DMode={() => setIs3DMode(!is3DMode)}
            selectedDots3D={selectedDots}
            setSelectedDots3D={setSelectedDots}
            stringCount3D={stringCount}
            setStringCount3D={setStringCount}
            cameraMode={cameraMode}
            setCameraMode={setCameraMode}
            maxFrets={maxFrets}
            tiltAngle={tiltAngle}
            onTiltAngleChange={handleTiltAngleChange}
            tutorialData={tutorialData}
            tutorialSlug={tutorialSlug}
            exercises={exercises}
            onExerciseSelect={handleExerciseSelect}
          />

          {/* Transport Clock for monitoring */}
          <TransportClock />
          
          {/* 4. Global Playback Controls Card - Dedicated panel for global controls */}
          <GlobalControlsCard
            is3DMode={is3DMode}
            tiltAngle={tiltAngle}
            hasSelectedDots={selectedDots.size > 0}
            cameraMode={cameraMode}
            onToggle3DMode={() => setIs3DMode(!is3DMode)}
            onTiltAngleChange={handleTiltAngleChange}
            onCameraModeChange={setCameraMode}
            onResetFretboard={handleResetSelection}
            loopRegion={widgetState.loopRegion}
            isLoopEnabled={widgetState.isLoopEnabled}
          />

          {/* Exercise Timeline Indicator */}
          {widgetState.selectedExercise && (
            <div className="bg-slate-900 rounded-lg p-4 border border-slate-800">
              <ExerciseTimelineIndicator
                className="w-full"
                showDetails={true}
              />
            </div>
          )}

          {/* 5. Looper Card - Dedicated looper controls */}
          <LooperCard
            isLoopEnabled={widgetState.isLoopEnabled}
            loopRegion={widgetState.loopRegion}
            onLoopRegionChange={(region) => widgetState.setLoopRegion(region)}
            onToggleLoop={() => widgetState.toggleLoopEnabled()}
          />

          {/* 6. Four Widgets Card - 4 essential widgets */}
          <FourWidgetsCard widgetState={widgetState} />

          {/* 7. Teaching Takeaway Card - Lesson summaries */}
          <TeachingTakeawayCard tutorialData={tutorialData} />
          
          {/* Debug: Timing analysis toggle */}
          <div className="text-center mt-4">
            <button
              onClick={() => setShowTimingDebug(!showTimingDebug)}
              className="px-4 py-2 bg-slate-800 rounded-lg text-sm text-slate-200 hover:bg-slate-700 hover:text-white transition-colors border border-slate-600"
            >
              {showTimingDebug ? '🔴 Hide' : '🟢 Show'} Timing Debug
            </button>
          </div>
        </div>
      </div>
      
      {/* Timing Debug Window */}
      <TimingDebugWindow 
        isVisible={showTimingDebug} 
        onClose={() => setShowTimingDebug(false)} 
      />
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
      monitoringInterval={1000} // 1 second - performance metrics don't need high frequency updates
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
