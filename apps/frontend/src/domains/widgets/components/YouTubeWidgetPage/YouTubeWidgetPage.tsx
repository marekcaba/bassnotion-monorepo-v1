'use client';

import React, { useEffect, useRef, useCallback } from 'react';
// Import our new components
import { YouTubeVideoSection } from './YouTubeVideoSection';
import { TutorialInfoCard } from './TutorialInfoCard';
import { ExerciseSelector } from './ExerciseSelector';
import { FretboardCard } from './FretboardCard';
import Fretboard3D from './FretboardCard/components/Fretboard3D';

import { FourWidgetsCard } from './components/FourWidgetsCard';
import { GlobalControlsCard } from './components/GlobalControlsCard';
import { TeachingTakeawayCard } from './TeachingTakeawayCard';
import { TransportClock } from './components/TransportClock';
import { TimingDebugWindow } from './components/TimingDebugWindow';
import { useWidgetPageState } from '@/domains/widgets/hooks/useWidgetPageState';
import { useAudioFretboard } from '@/domains/widgets/hooks/useAudioFretboard';
import { useCorePlaybackEngine } from '@/domains/playback/hooks/useCorePlaybackEngine';
// REMOVED: useExerciseSelection import - not needed for tutorial pages
import { Button } from '@/shared/components/ui/button';
import { Play, Pause, Volume2, Settings } from 'lucide-react';
import { SyncProvider, useSyncContext } from '../base/SyncProvider';
import { UserIndicator } from '@/domains/user/components/UserIndicator';
import { useUserProfile } from '@/domains/user/hooks/use-user-profile';
import { beatTimingAnalyzer } from '@/domains/playback/utils/BeatTimingAnalyzer';
import { getLogger } from '@/utils/logger.js';
import { useObjectChangeTracker, useWhyDidYouUpdate } from '@/utils/debugUtils';
import type { Tutorial } from '@bassnotion/contracts';
import { useCorrelation } from '@/shared/hooks/useCorrelation';

const logger = getLogger('youtube-widget');

interface YouTubeWidgetPageProps {
  tutorialData?: Tutorial;
  tutorialSlug?: string;
  exercises?: any[]; // Exercise data from tutorial API
}

// Render counter for debugging
let youTubeWidgetPageContentRenderCount = 0;

// Track what's causing re-renders
let prevProps: any = {};

// Inner component that has access to sync context
function YouTubeWidgetPageContent({
  tutorialData,
  tutorialSlug,
  exercises,
}: YouTubeWidgetPageProps) {
  youTubeWidgetPageContentRenderCount++;

  // Track prop changes
  const propChanges: string[] = [];
  if (prevProps.tutorialData !== tutorialData) propChanges.push('tutorialData');
  if (prevProps.tutorialSlug !== tutorialSlug) propChanges.push('tutorialSlug');
  if (prevProps.exercises !== exercises) propChanges.push('exercises');

  prevProps = { tutorialData, tutorialSlug, exercises };

  // Debug: Log component render for debugging re-render issues (only every 10th render)
  if (youTubeWidgetPageContentRenderCount % 10 === 0) {
    logger.info(
      `🔄 YouTubeWidgetPageContent RENDER #${youTubeWidgetPageContentRenderCount}:`,
      {
        tutorialData: tutorialData?.title,
        tutorialSlug,
        exercisesCount: exercises?.length || 0,
        propChanges: propChanges.length > 0 ? propChanges : 'no prop changes',
        timestamp: new Date().toISOString(),
        stack: new Error().stack?.split('\n').slice(1, 4).join(' <- '),
      },
    );
  }

  // Only log hook calls every 10th render
  if (youTubeWidgetPageContentRenderCount % 10 === 0) {
    logger.info('🔍 HOOK CALLS - starting hook calls...');
  }

  const widgetState = useWidgetPageState();
  if (youTubeWidgetPageContentRenderCount % 10 === 0) {
    logger.info('🔍 widgetState returned:', {
      isPlaying: widgetState.isPlaying,
      tempo: widgetState.tempo,
      selectedExerciseId: widgetState.selectedExercise?.id,
      objectIdentity: widgetState === widgetState ? 'SAME' : 'DIFFERENT',
    });
  }

  const { emitGlobalEvent, syncState } = useSyncContext();
  if (youTubeWidgetPageContentRenderCount % 10 === 0) {
    logger.info('🔍 syncContext returned:', {
      exerciseId: syncState.exercise?.selectedExercise?.id,
      isPlaying: syncState.playback?.isPlaying,
      tempo: syncState.playback?.tempo,
    });
  }

  const { profile } = useUserProfile();
  if (youTubeWidgetPageContentRenderCount % 10 === 0) {
    logger.info('🔍 profile returned:', {
      hasProfile: !!profile,
      profileId: profile?.id,
    });
  }

  // Track object changes for debugging - but limit to avoid noise
  useObjectChangeTracker(
    'widgetState',
    widgetState,
    youTubeWidgetPageContentRenderCount % 10 === 0,
  );
  useObjectChangeTracker(
    'syncState',
    syncState,
    youTubeWidgetPageContentRenderCount % 10 === 0,
  );
  useObjectChangeTracker(
    'profile',
    profile,
    youTubeWidgetPageContentRenderCount % 10 === 0,
  );
  useObjectChangeTracker(
    'exercises',
    exercises,
    youTubeWidgetPageContentRenderCount % 10 === 0,
  );

  // Track SyncProvider context changes
  const prevSyncContextRef = useRef({ syncState, emitGlobalEvent, profile });
  useEffect(() => {
    if (youTubeWidgetPageContentRenderCount % 10 === 0) {
      const changes: string[] = [];
      if (prevSyncContextRef.current.syncState !== syncState) {
        changes.push('syncState');
        // Deep compare to see what changed in syncState
        logger.info(`🔍 SyncState changes detected:`, {
          prevPlayback: prevSyncContextRef.current.syncState?.playback,
          newPlayback: syncState?.playback,
          playbackSame:
            prevSyncContextRef.current.syncState?.playback ===
            syncState?.playback,
          prevExercise: prevSyncContextRef.current.syncState?.exercise,
          newExercise: syncState?.exercise,
          exerciseSame:
            prevSyncContextRef.current.syncState?.exercise ===
            syncState?.exercise,
          prevUi: prevSyncContextRef.current.syncState?.ui,
          newUi: syncState?.ui,
          uiSame: prevSyncContextRef.current.syncState?.ui === syncState?.ui,
          prevTransport: prevSyncContextRef.current.syncState?.transport,
          newTransport: syncState?.transport,
          transportSame:
            prevSyncContextRef.current.syncState?.transport ===
            syncState?.transport,
        });
      }
      if (prevSyncContextRef.current.emitGlobalEvent !== emitGlobalEvent)
        changes.push('emitGlobalEvent');
      if (prevSyncContextRef.current.profile !== profile)
        changes.push('profile');

      if (changes.length > 0) {
        logger.info(
          `🔄 Context changes detected #${youTubeWidgetPageContentRenderCount}:`,
          changes,
        );
      }

      prevSyncContextRef.current = { syncState, emitGlobalEvent, profile };
    }
  });
  // REMOVED: globalExerciseSelection - causes circular updates
  // Tutorial pages should use local state only, not global exercise selection

  // Get playback controls for seek functionality
  const { controls: playbackControls } = useCorePlaybackEngine({
    debugMode: false,
    enablePerformanceMonitoring: false, // CRITICAL: Disable to prevent 1s re-renders
  });
  const [is3DMode, setIs3DMode] = React.useState(false);
  const [selectedDots, setSelectedDots] = React.useState<Map<string, number[]>>(
    new Map(),
  );
  const [stringCount, setStringCount] = React.useState<4 | 5 | 6>(4);
  const [maxFrets, setMaxFrets] = React.useState(25);
  const [showTimingDebug, setShowTimingDebug] = React.useState(false);

  // Track why this component is re-rendering (only every 10th render)
  // Moved after playbackControls is defined
  useWhyDidYouUpdate('YouTubeWidgetPageContent', {
    tutorialData,
    tutorialSlug,
    exercises,
    widgetState,
    syncState,
    profile,
    emitGlobalEvent,
    playbackControls,
  });

  // Track playbackControls object specifically
  const prevPlaybackControlsRef = useRef<any>(null);
  useEffect(() => {
    if (
      youTubeWidgetPageContentRenderCount % 10 === 0 ||
      prevPlaybackControlsRef.current !== playbackControls
    ) {
      logger.info(
        `🎮 PlaybackControls check #${youTubeWidgetPageContentRenderCount}:`,
        {
          sameReference: prevPlaybackControlsRef.current === playbackControls,
          hadPrevious: !!prevPlaybackControlsRef.current,
          controlsKeys: playbackControls ? Object.keys(playbackControls) : [],
          timestamp: Date.now(),
        },
      );

      if (prevPlaybackControlsRef.current && playbackControls) {
        // Check individual method references
        const methodChecks: Record<string, boolean> = {};
        Object.keys(playbackControls).forEach((key) => {
          methodChecks[key] =
            prevPlaybackControlsRef.current[key] === playbackControls[key];
        });
        logger.info(`🎮 Method reference checks:`, methodChecks);
      }

      prevPlaybackControlsRef.current = playbackControls;
    }
  });

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

  // FAANG Solution: Lift selected exercise state to parent
  const [selectedExerciseId, setSelectedExerciseId] = React.useState<
    string | null
  >(null);

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

  // FIX: Store exercises in a ref to prevent callback recreation on data changes
  const exercisesRef = useRef(exercises);
  exercisesRef.current = exercises;

  // FAANG Solution: Auto-select first exercise when exercises load (parent controls selection)
  useEffect(() => {
    if (exercises && exercises.length > 0 && !selectedExerciseId) {
      // CRITICAL FIX: Defer auto-selection with longer delay to avoid race condition
      const timeoutId = setTimeout(() => {
        const firstExercise = exercises[0];
        if (firstExercise?.id && !selectedExerciseId) {
          logger.debug(
            'Auto-selecting first exercise in parent (deferred 150ms):',
            firstExercise.id,
          );
          // Update state gradually
          setSelectedExerciseId(firstExercise.id);
          // Update widget state after a frame
          requestAnimationFrame(() => {
            widgetStateRef.current.setSelectedExercise(firstExercise);
            // REMOVED: globalExerciseSelection update - not needed
          });
        }
      }, 150); // 150ms delay to let FretboardCard initialize first

      return () => clearTimeout(timeoutId);
    }
  }, [exercises, selectedExerciseId]); // Removed widgetState and globalExerciseSelection - using refs

  // Store widgetState methods in refs to avoid dependencies
  const widgetStateRef = useRef(widgetState);
  widgetStateRef.current = widgetState;

  // REMOVED: globalExerciseSelectionRef - not needed without global selection

  // Memoize event handlers to prevent re-renders
  const handleToggle3DMode = useCallback(() => {
    setIs3DMode((prev) => !prev);
  }, []);

  const handleSetStringCount3D = useCallback((count: number) => {
    setStringCount(count);
  }, []);

  const handleSetCameraMode = useCallback((mode: CameraMode) => {
    setCameraMode(mode);
  }, []);

  const handleSetSelectedDots3D = useCallback((dots: Set<string>) => {
    setSelectedDots(dots);
  }, []);

  const handleExerciseSelect = useCallback(
    (exerciseId: string) => {
      // Find the exercise from the exercises array using ref
      const exercise = exercisesRef.current?.find((ex) => ex.id === exerciseId);
      if (exercise) {
        logger.debug('Exercise selected:', {
          id: exercise.id,
          title: exercise.title,
          hasDrumPattern: !!exercise.drum_pattern,
          drumPatternEnabled: exercise.drum_pattern?.enabled,
          drumPatternLength: exercise.drum_pattern?.pattern?.length,
        });

        // Update parent state (single source of truth)
        setSelectedExerciseId(exerciseId);

        // Update widget state with the selected exercise
        widgetStateRef.current.setSelectedExercise(exercise);

        // REMOVED: globalExerciseSelection update - causes circular updates
        // Only emit to sync context for widget synchronization
        emitGlobalEvent('exercise:selected', { exerciseId, exercise });
      }
    },
    [emitGlobalEvent], // Only depend on emitGlobalEvent
  );

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
    // Only log every 10th time to reduce noise
    if (youTubeWidgetPageContentRenderCount % 10 === 0) {
      logger.info('🔥 useEffect [selectedExercise] triggered:', {
        selectedExercise: selectedExercise?.id,
        prevSelectedExercise: prevSelectedExerciseRef.current?.id,
        areEqual: selectedExercise === prevSelectedExerciseRef.current,
      });
    }

    if (
      selectedExercise &&
      selectedExercise !== prevSelectedExerciseRef.current
    ) {
      // Debug log (disabled to reduce console noise)
      // logger.info(
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
        // logger.info(
        //   '🎛️ Global Controls: Updating tempo to:',
        //   selectedExercise.bpm,
        // );
        widgetStateRef.current.setTempo(selectedExercise.bpm);
        prevTempoRef.current = selectedExercise.bpm;
      }

      // Update selected exercise in widget state
      // COMMENTED OUT: This line causes infinite loop and blocks all clicks
      // widgetStateRef.current.setSelectedExercise(selectedExercise);
    }
  }, [selectedExercise]); // Removed widgetState - using ref

  // Listen for tempo changes in sync state
  useEffect(() => {
    // Only log every 10th time to reduce noise
    if (youTubeWidgetPageContentRenderCount % 10 === 0) {
      logger.info('🔥 useEffect [syncTempo] triggered:', {
        syncTempo,
        prevTempo: prevTempoRef.current,
        widgetTempo: widgetState.tempo,
        condition1: !!syncTempo,
        condition2: syncTempo !== prevTempoRef.current,
        condition3: syncTempo !== widgetState.tempo,
      });
    }

    if (
      syncTempo &&
      syncTempo !== prevTempoRef.current &&
      syncTempo !== widgetState.tempo
    ) {
      widgetStateRef.current.setTempo(syncTempo);
      prevTempoRef.current = syncTempo;
    }
  }, [syncTempo, widgetState.tempo]); // Removed widgetState - using ref

  // Listen for volume changes in sync state
  useEffect(() => {
    const currentVolume = widgetState.state.volume.master / 100;

    // Only log every 10th time to reduce noise
    if (youTubeWidgetPageContentRenderCount % 10 === 0) {
      logger.info('🔥 useEffect [syncMasterVolume] triggered:', {
        syncMasterVolume,
        prevVolume: prevVolumeRef.current,
        currentVolume,
        widgetVolumeObject: widgetState.state.volume.master,
        condition1: !!syncMasterVolume,
        condition2: syncMasterVolume !== prevVolumeRef.current,
        condition3: syncMasterVolume !== currentVolume,
      });
    }

    if (
      syncMasterVolume &&
      syncMasterVolume !== prevVolumeRef.current &&
      syncMasterVolume !== currentVolume
    ) {
      // Debug log (disabled to reduce console noise)
      // logger.info(
      //   '🎛️ Global Controls: Master volume changed in sync state:',
      //   syncMasterVolume,
      // );
      widgetStateRef.current.setVolume(
        'master',
        Math.round(syncMasterVolume * 100),
      );
      prevVolumeRef.current = syncMasterVolume;
    }
  }, [syncMasterVolume, widgetState.state.volume.master]); // Only depend on the actual value, not the whole object

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
      logger.debug(`BeatTimingAnalyzer started with tempo ${currentTempo}`);
    }
  }, [
    syncState.playback.isPlaying,
    widgetState.tempo,
    syncState.playback.tempo,
  ]);

  React.useEffect(() => {
    // Debug: Log mount/unmount
    // logger.info('🟢 YouTubeWidgetPageContent MOUNTED');

    // Don't start analyzer on mount - wait for playback to start
    // This prevents drift calculations from page load time

    return () => {
      // logger.info('🔴 YouTubeWidgetPageContent UNMOUNTED');
      // Keep analyzer data for debugging even after unmount
    };
  }, []);

  return (
    <div className="bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Mobile-first central container */}
      <div className="mx-auto px-4 py-6 max-w-[600px]">
        <div className="space-y-4">
          {/* User Indicator - Show login status and role */}
          <div className="flex justify-end">
            <UserIndicator />
          </div>

          {/* 1. YouTube Video Section - Standalone at the top */}
          <YouTubeVideoSection tutorialData={tutorialData} />

          {/* 2. Tutorial Info Card - Separate card with tutorial details */}
          <TutorialInfoCard tutorialData={tutorialData} />

          {/* 3. Exercise Selector - Now separated from Fretboard */}
          <ExerciseSelector
            exercises={exercises || []}
            selectedExerciseId={selectedExerciseId}
            onExerciseSelect={handleExerciseSelect}
          />

          {/* 4. Transport Clock with Timeline Loop Strip */}
          <TransportClock
            selectedExercise={widgetState.selectedExercise}
            loopRegion={widgetState.loopRegion}
            onLoopRegionChange={(region) => widgetState.setLoopRegion(region)}
            currentTime={widgetState.currentTime || 0}
            onSeek={(position) => {
              // Handle seek through playback controls
              if (playbackControls && playbackControls.seek) {
                playbackControls.seek(position);
                logger.info(`🎵 Seeking to position: ${position}s`);
              }
            }}
          />

          {/* 5. Interactive Fretboard Card - Now without Exercise Selector */}
          <FretboardCard
            is3DMode={is3DMode}
            onToggle3DMode={handleToggle3DMode}
            selectedDots3D={selectedDots}
            setSelectedDots3D={handleSetSelectedDots3D}
            stringCount3D={stringCount}
            setStringCount3D={handleSetStringCount3D}
            cameraMode={cameraMode}
            setCameraMode={handleSetCameraMode}
            maxFrets={maxFrets}
            tiltAngle={tiltAngle}
            onTiltAngleChange={handleTiltAngleChange}
            tutorialData={tutorialData}
            tutorialSlug={tutorialSlug}
            exercises={exercises}
            selectedExerciseId={selectedExerciseId}
            onExerciseSelect={handleExerciseSelect}
          />

          {/* 6. Global Playback Controls Card - Dedicated panel for global controls */}
          <GlobalControlsCard
            selectedExercise={widgetState.selectedExercise}
            exercises={exercises}
            is3DMode={is3DMode}
            tiltAngle={tiltAngle}
            hasSelectedDots={selectedDots.size > 0}
            cameraMode={cameraMode}
            onToggle3DMode={handleToggle3DMode}
            onTiltAngleChange={handleTiltAngleChange}
            onCameraModeChange={handleSetCameraMode}
            loopRegion={widgetState.loopRegion}
            isLoopEnabled={widgetState.isLoopEnabled}
          />

          {/* 7. Four Widgets Card - 4 essential widgets */}
          <FourWidgetsCard widgetState={widgetState} />

          {/* 8. Teaching Takeaway Card - Lesson summaries */}
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
// Add render counter for outer component
let youTubeWidgetPageRenderCount = 0;

export function YouTubeWidgetPage({
  tutorialData,
  tutorialSlug,
  exercises,
}: YouTubeWidgetPageProps) {
  const { correlationId, logger } = useCorrelation('YouTubeWidgetPage');
  youTubeWidgetPageRenderCount++;

  if (youTubeWidgetPageRenderCount % 10 === 0) {
    logger.info(
      `🔄 YouTubeWidgetPage (OUTER) RENDER #${youTubeWidgetPageRenderCount}`,
      {
        timestamp: Date.now(),
      },
    );
  }

  // Track why the outer component is re-rendering
  useWhyDidYouUpdate('YouTubeWidgetPage', {
    tutorialData,
    tutorialSlug,
    exercises,
  });

  // Log if parent is causing re-renders
  React.useEffect(() => {
    if (youTubeWidgetPageRenderCount % 10 === 0) {
      logger.info(
        `🔍 YouTubeWidgetPage (OUTER) investigating re-render #${youTubeWidgetPageRenderCount}`,
        {
          tutorialDataId: tutorialData?.id,
          exercisesLength: exercises?.length,
          timestamp: new Date().toISOString(),
          parentCaller: new Error().stack?.split('\n').slice(2, 5).join(' <- '),
        },
      );
    }
  });

  return (
    <SyncProvider
      debugMode={false} // Disable debug mode to reduce console noise
      monitoringInterval={30000} // 30 seconds - much less frequent to prevent re-render loops
      enableGlobalMonitoring={false} // CRITICAL FIX: Disable monitoring to prevent 1s re-render loop
    >
      <YouTubeWidgetPageContent
        tutorialData={tutorialData}
        tutorialSlug={tutorialSlug}
        exercises={exercises}
      />
    </SyncProvider>
  );
}
