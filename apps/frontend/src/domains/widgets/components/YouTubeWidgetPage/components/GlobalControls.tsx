import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import type {
  MusicalExercise as Exercise,
  ExerciseNote,
} from '@bassnotion/contracts';
import { MIDIFileParser } from '@bassnotion/contracts';
import { useTransportControls } from '@/domains/playback/contexts/TransportContext';
import { useTrack } from '@/domains/playback/hooks';
import type { CoreServices } from '@/domains/playback/services/core/CoreServices.js';
import { getLogger } from '@/utils/logger.js';
import { useAudioServices } from '@/domains/playback/providers/AudioProvider';
import { logSkeletonDebug } from '@/utils/skeletonDebug';
import { useCountdown } from '@/domains/widgets/hooks/useCountdown';
import { useAuth } from '@/domains/user/hooks/use-auth';

// Extracted hooks from GlobalControls folder
import { useSocialInteractions } from '../GlobalControls/hooks/useSocialInteractions.js';
import { useTempoControl } from '../GlobalControls/hooks/useTempoControl.js';
import { usePlaybackControl } from '../GlobalControls/hooks/usePlaybackControl.js';
import { useExerciseLoader } from '../GlobalControls/hooks/useExerciseLoader.js';
import { PlaybackControlsBar } from '../GlobalControls/components/PlaybackControlsBar.js';
import type { GlobalControlsProps } from '../GlobalControls/types.js';

const logger = getLogger('global-controls');

// Add a render counter for GlobalControls
let globalControlsRenderCount = 0;

const GlobalControlsComponent: React.FC<GlobalControlsProps> = ({
  selectedExercise,
  duration,
  exercises = [],
  onExerciseSelect,
  hasSelectedDots = false,
  loopRegion,
  isLoopEnabled = false,
  onToggleLoop,
  onPlayStateChange,
  onCountdownStateChange,
  compact = false,
}) => {
  globalControlsRenderCount++;

  // SKELETON-DEBUG: Log first 5 renders with timing (using shared baseline)
  logSkeletonDebug('🎛️', 'GlobalControls', globalControlsRenderCount, {
    hasExercise: !!selectedExercise,
    exerciseId: selectedExercise?.id,
  });

  // ✅ FIX: Get services directly from AudioProvider context (no race conditions)
  const {
    coreServices: contextCoreServices,
    audioEngine: contextAudioEngine,
    eventBus: contextEventBus,
    coreServicesReady,
  } = useAudioServices();

  // Render counter logging disabled - was causing 176+ log entries during playback
  // Enable for debugging by uncommenting:
  // if (globalControlsRenderCount % 10 === 0) {
  //   logger.info(`GlobalControls RENDER #${globalControlsRenderCount}`, {
  //     selectedExerciseId: selectedExercise?.id,
  //     duration,
  //     is3DMode,
  //     coreServicesReady,
  //     timestamp: Date.now(),
  //   });
  // }

  // Track prop changes
  const prevPropsRef = useRef<GlobalControlsProps>({
    selectedExercise: undefined,
    duration: 0,
    hasSelectedDots: false,
    loopRegion: null,
    isLoopEnabled: false,
  });

  useEffect(() => {
    const changedProps: string[] = [];

    if (prevPropsRef.current.selectedExercise?.id !== selectedExercise?.id) {
      changedProps.push(
        `selectedExercise: ${prevPropsRef.current.selectedExercise?.id} -> ${selectedExercise?.id}`,
      );
    }
    if (prevPropsRef.current.duration !== duration) {
      changedProps.push(
        `duration: ${prevPropsRef.current.duration} -> ${duration}`,
      );
    }
    if (prevPropsRef.current.hasSelectedDots !== hasSelectedDots) {
      changedProps.push(
        `hasSelectedDots: ${prevPropsRef.current.hasSelectedDots} -> ${hasSelectedDots}`,
      );
    }
    if (prevPropsRef.current.loopRegion !== loopRegion) {
      changedProps.push('loopRegion changed');
    }
    if (prevPropsRef.current.isLoopEnabled !== isLoopEnabled) {
      changedProps.push(
        `isLoopEnabled: ${prevPropsRef.current.isLoopEnabled} -> ${isLoopEnabled}`,
      );
    }

    // Prop change logging disabled - was causing excessive log spam during playback
    // Enable for debugging by uncommenting:
    // if (changedProps.length > 0 || globalControlsRenderCount % 10 === 0) {
    //   logger.info(`GlobalControls RENDER #${globalControlsRenderCount}:`, {
    //     changedProps,
    //     selectedExerciseId: selectedExercise?.id,
    //     exerciseNotesLength: selectedExercise?.notes?.length || 0,
    //     timestamp: Date.now(),
    //   });
    // }

    // Update prev props
    prevPropsRef.current = {
      selectedExercise,
      duration,
      hasSelectedDots,
      loopRegion,
      isLoopEnabled,
    };
  }, [selectedExercise, duration, hasSelectedDots, loopRegion, isLoopEnabled]);
  // Core DAW state
  const [coreServices, setCoreServices] = useState<CoreServices | null>(null);
  const [systemInitialized, setSystemInitialized] = useState(false);
  const [audioInitialized, setAudioInitialized] = useState(false);
  // NOTE: isLoadingExercise and loadingRef are now in useExerciseLoader hook

  // PERFORMANCE FIX: Use useTransportControls for stable controls (prevents 60Hz re-renders)
  // Position updates are handled by PositionAwareSheetMusic component below
  const transport = useTransportControls();
  // Create tracks using hooks
  const metronomeTrack = useTrack({
    trackId: 'metronome',
    name: 'Metronome',
    type: 'metronome',
    debugMode: false, // Disable debug logging for cleaner console
  });

  const drumTrack = useTrack({
    trackId: 'drums',
    name: 'Drums',
    type: 'drums',
    debugMode: false, // Disable debug logging for cleaner console
  });

  const bassTrack = useTrack({
    trackId: 'bass-widget-track',
    name: 'Bass',
    type: 'bass',
    debugMode: false,
  });

  // Countdown hook for metronome countdown before playback
  const { countdownState, startCountdown, cancelCountdown, resetCountdown } =
    useCountdown({
      timeSignature: selectedExercise?.timeSignature || {
        numerator: 4,
        denominator: 4,
      },
      onCountdownComplete: useCallback(async () => {
        logger.info('✅ Countdown complete, starting playback');
        // This will be called after countdown finishes
        // The actual transport.play() will be handled in the play button handler
      }, []),
      onBeatTick: useCallback((beat: number, isAccented: boolean) => {
        logger.debug(`🎵 Countdown beat ${beat + 1} (accented: ${isAccented})`);
      }, []),
    });

  // Notify parent of countdown state changes (for external rendering of countdown dots)
  useEffect(() => {
    onCountdownStateChange?.(countdownState);
  }, [countdownState, onCountdownStateChange]);

  // ✅ FIX: Initialize using AudioProvider context (no polling/retries needed)
  useEffect(() => {
    // Wait for services to be available from context
    if (!contextCoreServices || !contextAudioEngine || !contextEventBus) {
      logger.debug(
        '🎮 GlobalControls: Waiting for services from AudioProvider context...',
      );
      return;
    }

    logger.debug(
      '🎮 GlobalControls: Services ready from AudioProvider context',
    );

    // Set services from context
    setCoreServices({
      eventBus: contextEventBus,
      audioEngine: contextAudioEngine,
    } as any);
    setSystemInitialized(true);

    // Check if audio is already initialized
    try {
      const context = contextAudioEngine.getContext();
      if (context) {
        setAudioInitialized(true);
        logger.debug('🎮 GlobalControls: Audio already initialized');
      }
    } catch (e) {
      logger.debug('🎮 GlobalControls: Audio not yet initialized');
    }
  }, [contextCoreServices, contextAudioEngine, contextEventBus]); // Re-run when services change

  // Log track state for debugging
  useEffect(() => {
    logger.debug('🎮 GlobalControls: Track states:', {
      metronome: {
        isInitialized: metronomeTrack.isInitialized,
        isReady: metronomeTrack.isReady,
      },
      drum: {
        isInitialized: drumTrack.isInitialized,
        isReady: drumTrack.isReady,
      },
    });
  }, [
    metronomeTrack.isInitialized,
    metronomeTrack.isReady,
    drumTrack.isInitialized,
    drumTrack.isReady,
  ]);

  // Tempo control hook - manages localTempo, drag state, and sync logic
  const {
    localTempo,
    isDragging: isDraggingTempo,
    handleTempoChange,
    handleDragStart: handleTempoMouseDown,
    handleDragEnd: handleTempoMouseUp,
    lastUserTempoRef: lastUserTempo,
  } = useTempoControl({ transport });

  // Volume state - independent of tempo control
  const [localVolume, setLocalVolume] = useState(1.0); // Set default to 100%
  const lastUserVolume = useRef(1.0); // Set default to 100%

  // TEMPO FIX: Removed local hasUserModifiedTempo ref - now using musicalTruth.hasUserModifiedTempo()
  // as the SINGLE source of truth for user tempo modifications
  const currentExerciseId = useRef<string | null>(null);
  // Sheet music state
  const [currentPosition, setCurrentPosition] = useState(2);
  const currentPositionRef = useRef(currentPosition);
  const [isLooping, setIsLooping] = useState(true);
  const [importedExercise, setImportedExercise] = useState<Exercise | null>(
    null,
  );
  const [importSource, setImportSource] = useState<'musicxml' | 'midi' | null>(
    null,
  );

  // Keep ref in sync with state
  useEffect(() => {
    currentPositionRef.current = currentPosition;
  }, [currentPosition]);

  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get exercise data from imported exercise or selected exercise
  const activeExercise = importedExercise || selectedExercise;

  // Normalize notes to handle field name variations (duration vs noteDuration)
  // CRITICAL: Memoize to prevent SheetMusicDisplay from re-rendering on every render
  // PERFORMANCE FIX: Depend on exercise ID, not notes array reference
  // The .map() creates a new array on every call, so we must stabilize dependencies
  // Using exercise ID ensures we only recalculate when the exercise actually changes
  const activeExerciseId = activeExercise?.id;
  const rawNotesLength = activeExercise?.notes?.length ?? 0;

  // Store notes in ref to access current value without triggering recalculation
  const rawNotesRef = useRef(activeExercise?.notes);
  rawNotesRef.current = activeExercise?.notes;

  // eslint-disable-next-line react-hooks/exhaustive-deps -- Intentional: use ID + length for stable invalidation, ref for data access
  const exerciseNotes: ExerciseNote[] = useMemo(() => {
    const notes = rawNotesRef.current;
    if (!notes || notes.length === 0) {
      return [];
    }
    return notes.map((note: any) => ({
      ...note,
      // Handle both 'duration' and 'noteDuration' field names
      duration: note.duration || note.noteDuration || 'quarter',
    }));
  }, [activeExerciseId, rawNotesLength]);

  const exerciseBpm = activeExercise?.bpm || 120;
  const exerciseKey = activeExercise?.key || 'C';
  const exerciseTitle = activeExercise?.title || 'No Exercise Selected';
  // Memoize timeSignature to prevent SheetMusicDisplay re-renders
  const timeSignature = useMemo(() => {
    return (
      activeExercise?.timeSignature || {
        numerator: 4,
        denominator: 4,
      }
    );
  }, [activeExercise?.timeSignature]);

  // Calculate totalBars - single source of truth for measure count
  // Priority: total_bars from exercise > calculated from duration_beats > inferred from notes
  const exerciseTotalBars = useMemo(() => {
    // 1. Use total_bars if explicitly set
    if (activeExercise?.total_bars) {
      return activeExercise.total_bars;
    }
    // 2. Calculate from duration_beats if available
    if (activeExercise?.duration_beats) {
      const beatsPerBar = timeSignature.numerator;
      return Math.ceil(activeExercise.duration_beats / beatsPerBar);
    }
    // 3. Infer from notes - find the highest measure number
    if (exerciseNotes.length > 0) {
      return Math.max(...exerciseNotes.map((n) => n.position?.measure || 1));
    }
    // 4. Default fallback
    return 4;
  }, [
    activeExercise?.total_bars,
    activeExercise?.duration_beats,
    activeExercise?.id,
    timeSignature.numerator,
    timeSignature.denominator,
    exerciseNotes,
  ]);

  const isImported = !!importedExercise;

  // Track if exerciseNotes reference is changing
  const prevExerciseNotesRef = useRef(exerciseNotes);
  useEffect(() => {
    if (prevExerciseNotesRef.current !== exerciseNotes) {
      logger.info('🎵 exerciseNotes reference changed', {
        prevLength: prevExerciseNotesRef.current.length,
        newLength: exerciseNotes.length,
        sameContent:
          JSON.stringify(prevExerciseNotesRef.current) ===
          JSON.stringify(exerciseNotes),
        timestamp: Date.now(),
      });
      prevExerciseNotesRef.current = exerciseNotes;
    }
  }, [exerciseNotes]);

  // Handle MusicXML upload - memoized to prevent re-renders
  const handleMusicXMLUpload = useCallback((exercise: Exercise) => {
    setImportedExercise(exercise);
    setImportSource('musicxml');
    setCurrentPosition(1);
  }, []);

  // Handle MIDI upload - memoized to prevent re-renders
  const handleMIDIUpload = useCallback((exercise: Exercise) => {
    setImportedExercise(exercise);
    setImportSource('midi');
    setCurrentPosition(1);
  }, []);

  // Handle upload error - memoized to prevent re-renders
  const handleUploadError = useCallback((error: string) => {
    logger.error('File upload error:', error);
  }, []);

  // Handle clear imported - memoized to prevent re-renders
  const handleClearImported = useCallback(() => {
    setImportedExercise(null);
    setImportSource(null);
    setCurrentPosition(2);
  }, []);

  // Handle file input change - memoized to prevent re-renders
  const handleFileSelect = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const fileExtension = file.name.split('.').pop()?.toLowerCase();

      if (fileExtension === 'xml' || fileExtension === 'musicxml') {
        // Process MusicXML file
        try {
          const text = await file.text();
          const parser = new DOMParser();
          const xmlDoc = parser.parseFromString(text, 'text/xml');

          // Create a mock exercise from the MusicXML (simplified version)
          const exercise: Exercise = {
            id: `imported-${Date.now()}`,
            title: file.name.replace(/\.(xml|musicxml)$/i, ''),
            notes: [], // This would need proper MusicXML parsing
            bpm: 120,
            timeSignature: { numerator: 4, denominator: 4 },
            key: 'C',
            difficulty: 'intermediate',
            duration: 0,
            duration_beats: 16, // Default to 4 bars
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

          handleMusicXMLUpload(exercise);
        } catch (error) {
          handleUploadError('Failed to parse MusicXML file');
        }
      } else if (fileExtension === 'mid' || fileExtension === 'midi') {
        // Process MIDI file using the actual MIDI parser
        try {
          const arrayBuffer = await file.arrayBuffer();
          const parser = new MIDIFileParser();

          const parsingResult = await parser.parseFile(arrayBuffer, file.name);

          if (!parsingResult.success) {
            throw new Error(
              `MIDI parsing failed: ${parsingResult.errors.join(', ')}`,
            );
          }

          if (!parsingResult.exercise) {
            throw new Error(
              'No bass track found in MIDI file. Try a MIDI file with bass content.',
            );
          }

          handleMIDIUpload(parsingResult.exercise);
        } catch (error) {
          const errorMessage =
            error instanceof Error
              ? error.message
              : 'Failed to parse MIDI file';
          handleUploadError(errorMessage);
        }
      } else {
        handleUploadError(`Unsupported file format: ${fileExtension}`);
      }

      // Clear the input value so the same file can be selected again
      event.target.value = '';
    },
    [handleMusicXMLUpload, handleMIDIUpload, handleUploadError],
  );

  // NOTE: tempoTimeoutRef moved to useTempoControl hook
  // NOTE: isTogglingPlayback moved to usePlaybackControl hook

  // Auth state for checking if user is logged in
  const { isAuthenticated, isReady: isAuthReady } = useAuth();

  // Extract exercise ID for social hooks
  const exerciseId = useMemo(() => {
    if (!selectedExercise) return '';
    return typeof selectedExercise.id === 'object'
      ? selectedExercise.id.value
      : selectedExercise.id;
  }, [selectedExercise]);

  // Social interactions hook - handles like/favorite state, sparkles, and handlers
  const {
    isLiked,
    likeCount,
    isLikePending,
    likeSparkles,
    isFavorited,
    isFavoritePending,
    favoriteSparkles,
    loopSparkles,
    isLooped,
    loopBump,
    commentSparkles,
    isCommented,
    commentBump,
    handleLikeClick,
    handleFavoriteClick,
    handleLoopClick,
    handleCommentClick,
    handleLoopMouseLeave,
    handleCommentMouseLeave,
  } = useSocialInteractions({
    exerciseId,
    isAuthenticated,
    isAuthReady,
  });

  // Region processor for audio playback
  const regionProcessorRef = useRef<RegionProcessor | null>(null);

  // Track refs - needed for playback control hook
  const metronomeTrackRef = useRef(metronomeTrack);
  const drumTrackRef = useRef(drumTrack);
  const bassTrackRef = useRef(bassTrack);

  // Update track refs when tracks change
  useEffect(() => {
    metronomeTrackRef.current = metronomeTrack;
    drumTrackRef.current = drumTrack;
    bassTrackRef.current = bassTrack;
  }, [metronomeTrack, drumTrack, bassTrack]);

  // Playback control hook - handles play/stop button logic
  const { handlePlayButtonClick, isTogglingPlayback } = usePlaybackControl({
    selectedExercise,
    transport,
    countdownState,
    cancelCountdown,
    startCountdown,
    systemInitialized,
    onPlayStateChange,
    metronomeTrackRef,
    drumTrackRef,
    bassTrackRef,
    regionProcessorRef,
  });

  // Exercise loader hook - handles MIDI loading and track registration
  const { isLoadingExercise } = useExerciseLoader({
    selectedExercise,
    transport,
    metronomeTrackRef,
    drumTrackRef,
    bassTrackRef,
    lastUserTempoRef: lastUserTempo,
  });

  // Exercise navigation handlers
  const currentExerciseIndex = useMemo(() => {
    if (!selectedExercise || !exercises.length) return -1;
    return exercises.findIndex((ex) => {
      const exId = typeof ex.id === 'object' ? ex.id.value : ex.id;
      const selectedId =
        typeof selectedExercise.id === 'object'
          ? selectedExercise.id.value
          : selectedExercise.id;
      return exId === selectedId;
    });
  }, [selectedExercise, exercises]);

  const handlePreviousExercise = useCallback(() => {
    if (!onExerciseSelect || exercises.length === 0) return;

    // If no exercise selected or at first, go to last exercise
    const newIndex =
      currentExerciseIndex <= 0
        ? exercises.length - 1
        : currentExerciseIndex - 1;
    const exercise = exercises[newIndex];
    if (exercise) {
      const exerciseId =
        typeof exercise.id === 'object' ? exercise.id.value : exercise.id;
      onExerciseSelect(exerciseId);
      logger.info('⏮️ Previous exercise selected', { newIndex, exerciseId });
    }
  }, [currentExerciseIndex, exercises, onExerciseSelect]);

  const handleNextExercise = useCallback(() => {
    if (!onExerciseSelect || exercises.length === 0) return;

    // If no exercise selected or at last, go to first exercise
    const newIndex =
      currentExerciseIndex >= exercises.length - 1
        ? 0
        : currentExerciseIndex + 1;
    const exercise = exercises[newIndex];
    if (exercise) {
      const exerciseId =
        typeof exercise.id === 'object' ? exercise.id.value : exercise.id;
      onExerciseSelect(exerciseId);
      logger.info('⏭️ Next exercise selected', { newIndex, exerciseId });
    }
  }, [currentExerciseIndex, exercises, onExerciseSelect]);

  // NOTE: handleTempoChange, tempo sync, and drag handling are now in useTempoControl hook

  // PERFORMANCE FIX: Position tracking moved to PositionAwareSheetMusic component
  // This effect was causing 60Hz re-renders. Now the position-dependent UI updates
  // happen in the isolated PositionAwareSheetMusic component.
  // The currentPosition state is no longer needed here as the sheet music component
  // handles its own position tracking via useTransportPosition().

  // NOTE: Tempo cleanup, drag handlers, and global event listeners are now in useTempoControl hook

  // Sheet music ready callback - memoized to prevent PositionAwareSheetMusic re-renders
  const handleSheetMusicReady = useCallback(() => {
    logger.debug('Sheet music rendered successfully');
  }, []);

  // Sheet Player Toolbar Handlers
  const handleToolbarImport = () => {
    fileInputRef.current?.click();
  };

  const handleToolbarSave = async () => {
    if (!activeExercise) return;

    try {
      // TODO: Implement save to backend/library functionality
      logger.debug('Saving exercise:', activeExercise.title);
      // This would call an API to save the exercise to the database
      alert(
        'Save functionality will be implemented - exercise would be saved to library',
      );
    } catch (error) {
      logger.error('Error saving exercise:', error);
      alert('Failed to save exercise');
    }
  };

  const handleToolbarExportPDF = () => {
    if (!containerRef.current || !activeExercise) return;

    try {
      // Get the SVG element from VexFlow
      const svgElement = containerRef.current.querySelector('svg');
      if (!svgElement) {
        alert('No sheet music to export');
        return;
      }

      // Create a new window for printing
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        alert('Please allow popups for PDF export');
        return;
      }

      // Create a print-friendly HTML document
      const svgData = new XMLSerializer().serializeToString(svgElement);
      const htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>${activeExercise.title} - Sheet Music</title>
            <style>
              body { margin: 0; padding: 20px; background: white; }
              .header { text-align: center; margin-bottom: 20px; }
              .sheet-music { text-align: center; }
              svg { max-width: 100%; height: auto; }
              @media print {
                body { margin: 0; }
                .header { margin-bottom: 10px; }
              }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>${activeExercise.title}</h1>
              <p>Tempo: ${activeExercise.bpm} BPM | Key: ${activeExercise.key} | Time: ${activeExercise.timeSignature?.numerator}/${activeExercise.timeSignature?.denominator}</p>
            </div>
            <div class="sheet-music">
              ${svgData}
            </div>
          </body>
        </html>
      `;

      printWindow.document.write(htmlContent);
      printWindow.document.close();

      // Trigger print dialog
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 250);
    } catch (error) {
      logger.error('Error exporting PDF:', error);
      alert('Failed to export PDF');
    }
  };

  return (
    <PlaybackControlsBar
      selectedExercise={selectedExercise}
      exercises={exercises}
      countdownState={countdownState}
      isPlaying={transport.isPlaying}
      isLoopEnabled={isLoopEnabled}
      isLiked={isLiked}
      likeCount={likeCount}
      isLikePending={isLikePending}
      likeSparkles={likeSparkles}
      isFavorited={isFavorited}
      isFavoritePending={isFavoritePending}
      favoriteSparkles={favoriteSparkles}
      loopSparkles={loopSparkles}
      isLooped={isLooped}
      loopBump={loopBump}
      commentSparkles={commentSparkles}
      isCommented={isCommented}
      commentBump={commentBump}
      handlePlayButtonClick={handlePlayButtonClick}
      handlePreviousExercise={handlePreviousExercise}
      handleNextExercise={handleNextExercise}
      handleLikeClick={handleLikeClick}
      handleFavoriteClick={handleFavoriteClick}
      handleLoopClick={handleLoopClick}
      handleCommentClick={handleCommentClick}
      handleLoopMouseLeave={handleLoopMouseLeave}
      handleCommentMouseLeave={handleCommentMouseLeave}
      onToggleLoop={onToggleLoop}
      compact={compact}
    />
  );
};

// Create a custom comparison function for React.memo
const arePropsEqual = (
  prevProps: GlobalControlsProps,
  nextProps: GlobalControlsProps,
) => {
  // Check each prop individually for better debugging
  const checks = {
    selectedExerciseId:
      prevProps.selectedExercise?.id === nextProps.selectedExercise?.id,
    duration: prevProps.duration === nextProps.duration,
    hasSelectedDots: prevProps.hasSelectedDots === nextProps.hasSelectedDots,
    loopRegion:
      JSON.stringify(prevProps.loopRegion) ===
      JSON.stringify(nextProps.loopRegion),
    isLoopEnabled: prevProps.isLoopEnabled === nextProps.isLoopEnabled,
  };

  const allEqual = Object.values(checks).every((check) => check);

  // PERFORMANCE FIX: Removed per-comparison logging that was causing 1400+ log entries during playback
  // The parent component re-renders frequently (e.g., currentTime changes), triggering React.memo comparisons.
  // When allEqual=true, GlobalControls correctly does NOT re-render. The comparisons are expected React behavior.
  //
  // To debug props changes, uncomment the block below:
  // if (!allEqual) {
  //   const changedProps = Object.entries(checks)
  //     .filter(([_, equal]) => !equal)
  //     .map(([key]) => key);
  //   logger.info('🎯 GlobalControls props changed, will re-render:', {
  //     changedProps,
  //     renderCount: globalControlsRenderCount,
  //   });
  // }

  return allEqual;
};

// Export the memoized component
// RE-ENABLED React.memo to fix excessive re-renders during playback
export const GlobalControls = React.memo(
  GlobalControlsComponent,
  arePropsEqual,
);
