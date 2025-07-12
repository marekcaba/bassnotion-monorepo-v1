'use client';

import React, { useEffect, useRef, useCallback } from 'react';
// Import our new components
import { YouTubeVideoSection } from './YouTubeVideoSection';
import { TutorialInfoCard } from './TutorialInfoCard';
import { ExerciseSelectorCard } from './ExerciseSelectorCard';
import { FretboardCard } from './FretboardCard';
import Fretboard3D from './Fretboard3D';

import { FourWidgetsCard } from './components/FourWidgetsCard';
import { GlobalControlsCard } from './components/GlobalControlsCard';
import { TeachingTakeawayCard } from './TeachingTakeawayCard';
import { useWidgetPageState } from '@/domains/widgets/hooks/useWidgetPageState';
import { useAudioFretboard } from '@/domains/widgets/hooks/useAudioFretboard';
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

  const widgetState = useWidgetPageState();
  const { emitGlobalEvent, syncState } = useSyncContext();
  const [is3DMode, setIs3DMode] = React.useState(false);
  const [selectedDots, setSelectedDots] = React.useState<Map<string, number[]>>(
    new Map(),
  );
  const [stringCount, setStringCount] = React.useState<4 | 5 | 6>(4);
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
    // Exercise selection logic can be implemented here if needed
    console.log('Exercise selected:', exerciseId);
  }, []);

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
          newMap.set(key, newMap.size + 1);
        }
        return newMap;
      });
    },
    [triggerNote],
  );

  const handleResetSelection = useCallback(() => {
    setSelectedDots(new Map());
  }, []);

  const handleStringCountChange = useCallback((newCount: 4 | 5) => {
    setStringCount(newCount);
    // Clear selection when changing string count to avoid invalid selections
    setSelectedDots(new Map());
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

          {/* 3. Interactive Fretboard Card - Toggle between 2D and 3D modes */}
          <FretboardCard
            is3DMode={is3DMode}
            onToggle3DMode={() => setIs3DMode(!is3DMode)}
            selectedDots3D={selectedDots}
            setSelectedDots3D={setSelectedDots}
            stringCount3D={stringCount}
            setStringCount3D={setStringCount}
            cameraMode={cameraMode}
            setCameraMode={setCameraMode}
          />

          {/* 4. Global Playback Controls Card - Dedicated panel for global controls */}
          <GlobalControlsCard />

          {/* 5. Four Widgets Card - 4 essential widgets */}
          <FourWidgetsCard widgetState={widgetState} />

          {/* 6. Teaching Takeaway Card - Lesson summaries */}
          <TeachingTakeawayCard tutorialData={tutorialData} />
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
