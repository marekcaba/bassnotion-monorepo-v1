import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import {
  Play,
  Square,
  Volume2,
  Heart,
  SkipBack,
  SkipForward,
  Star,
  Music,
  RotateCw,
  Upload,
  FileText,
} from 'lucide-react';
import { SheetPlayerToolbar } from './SheetPlayerToolbar';
import type {
  MusicalExercise as Exercise,
  ExerciseNote,
  NoteDuration,
} from '@bassnotion/contracts';
import { MIDIFileParser } from '@bassnotion/contracts';
import { Button } from '@/shared/components/ui/button';
import { useTransport, useTrack } from '@/domains/playback/hooks';
import { serviceRegistry } from '@/domains/playback/services/core/ServiceRegistry.js';
import type { CoreServices } from '@/domains/playback/services/core/CoreServices.js';
import { getLogger } from '@/utils/logger.js';

// VexFlow imports for sheet music
import * as VF from 'vexflow';
import { useCorrelation } from '@/shared/hooks/useCorrelation';

const logger = getLogger('global-controls');

// VexFlow utility functions for sheet music
const convertNoteDurationToVexFlow = (
  duration: NoteDuration | undefined,
): string => {
  // Validate and provide default
  if (!duration) {
    return 'q';
  }

  switch (duration) {
    case 'whole':
      return 'w';
    case 'half':
      return 'h';
    case 'quarter':
      return 'q';
    case 'eighth':
      return '8';
    case 'sixteenth':
      return '16';
    case 'thirty-second':
      return '32';
    case 'sixty-fourth':
      return '64';
    case 'dotted-half':
      return 'hd';
    case 'dotted-quarter':
      return 'qd';
    case 'dotted-eighth':
      return '8d';
    case 'dotted-sixteenth':
      return '16d';
    case 'triplet-quarter':
      return 'q';
    case 'triplet-eighth':
      return '8';
    case 'triplet-sixteenth':
      return '16';
    case 'triplet-half':
      return 'h';
    case 'triplet-whole':
      return 'w';
    case 'dotted-whole':
      return 'wd';
    case 'tied':
      return 'q'; // Default to quarter for tied notes
    default:
      return 'q'; // Always return a valid duration
  }
};

const convertNoteToVexFlow = (note: ExerciseNote): string => {
  // Convert note name to VexFlow format (e.g., "A2" -> "a/2", "A#2" -> "a#/2")
  const noteName = note.note;
  const octave = getOctaveFromNote(noteName);

  // Handle sharps and flats
  let vexFlowNote = noteName.replace(/\d+$/, '').toLowerCase();

  // Convert flat notation to sharp for VexFlow
  if (vexFlowNote.includes('b')) {
    vexFlowNote = vexFlowNote.replace('b', 'b');
  }

  return `${vexFlowNote}/${octave}`;
};

const getOctaveFromNote = (noteName: string): number => {
  // Extract octave from note name (e.g., "A2" -> 2)
  const match = noteName.match(/\d+/);
  return match ? parseInt(match[0]) : 2;
};

const getDurationInQuarterNotes = (duration: NoteDuration): number => {
  switch (duration) {
    case 'whole':
      return 4;
    case 'dotted-whole':
      return 6;
    case 'half':
      return 2;
    case 'dotted-half':
      return 3;
    case 'quarter':
      return 1;
    case 'dotted-quarter':
      return 1.5;
    case 'eighth':
      return 0.5;
    case 'dotted-eighth':
      return 0.75;
    case 'sixteenth':
      return 0.25;
    case 'dotted-sixteenth':
      return 0.375;
    case 'thirty-second':
      return 0.125;
    case 'sixty-fourth':
      return 0.0625;
    case 'triplet-whole':
      return 8 / 3; // 2.67
    case 'triplet-half':
      return 4 / 3; // 1.33
    case 'triplet-quarter':
      return 2 / 3; // 0.67
    case 'triplet-eighth':
      return 1 / 3; // 0.33
    case 'triplet-sixteenth':
      return 1 / 6; // 0.17
    default:
      return 1; // Default to quarter
  }
};

const convertDurationToRests = (duration: number): string[] => {
  const rests: string[] = [];
  let remaining = duration;
  const epsilon = 0.001; // Small tolerance for floating point comparisons

  // Break down duration into standard rest values - industry standard approach
  // Start with largest possible rest durations for proper visual representation
  while (remaining > epsilon) {
    if (remaining >= 3.75) {
      rests.push('w');
      remaining -= 4;
    } else if (remaining >= 1.75) {
      rests.push('h');
      remaining -= 2;
    } else if (remaining >= 0.875) {
      rests.push('q');
      remaining -= 1;
    } else if (remaining >= 0.4375) {
      rests.push('8');
      remaining -= 0.5;
    } else if (remaining >= 0.21875) {
      rests.push('16');
      remaining -= 0.25;
    } else if (remaining >= 0.109375) {
      rests.push('32');
      remaining -= 0.125;
    } else {
      // For very small remainders, round to smallest rest
      if (remaining > epsilon) {
        rests.push('32');
      }
      remaining = 0;
    }
  }

  // If no rests were added but duration was requested, add a quarter rest
  if (rests.length === 0 && duration > epsilon) {
    rests.push('q');
  }

  return rests;
};

interface GlobalControlsProps {
  selectedExercise?: Exercise;
  duration: number;
  // Fretboard actions
  is3DMode?: boolean;
  tiltAngle?: number;
  hasSelectedDots?: boolean;
  cameraMode?: 'overview' | 'action';
  // Fretboard action callbacks
  onToggle3DMode?: () => void;
  onTiltAngleChange?: (angle: number) => void;
  onCameraModeChange?: (mode: 'overview' | 'action') => void;
  // Loop settings
  loopRegion?: {
    startMeasure: number;
    endMeasure: number;
    startBeat?: number;
    endBeat?: number;
  } | null;
  isLoopEnabled?: boolean;
}

// Add a render counter for GlobalControls
let globalControlsRenderCount = 0;

const GlobalControlsComponent: React.FC<GlobalControlsProps> = ({
  selectedExercise,
  duration,
  is3DMode = false,
  tiltAngle = 35,
  hasSelectedDots = false,
  cameraMode = 'overview',
  onToggle3DMode,
  onTiltAngleChange,
  onCameraModeChange,
  loopRegion,
  isLoopEnabled = false,
}) => {
  globalControlsRenderCount++;

  // Log renders every 10th time
  if (globalControlsRenderCount % 10 === 0) {
    logger.info(`🎯 GlobalControls RENDER #${globalControlsRenderCount}`, {
      selectedExerciseId: selectedExercise?.id,
      duration,
      is3DMode,
      timestamp: Date.now(),
    });
  }

  // Track prop changes
  const prevPropsRef = useRef<GlobalControlsProps>({
    selectedExercise: undefined,
    duration: 0,
    is3DMode: false,
    tiltAngle: 35,
    hasSelectedDots: false,
    cameraMode: 'overview',
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
    if (prevPropsRef.current.is3DMode !== is3DMode) {
      changedProps.push(
        `is3DMode: ${prevPropsRef.current.is3DMode} -> ${is3DMode}`,
      );
    }
    if (prevPropsRef.current.tiltAngle !== tiltAngle) {
      changedProps.push(
        `tiltAngle: ${prevPropsRef.current.tiltAngle} -> ${tiltAngle}`,
      );
    }
    if (prevPropsRef.current.hasSelectedDots !== hasSelectedDots) {
      changedProps.push(
        `hasSelectedDots: ${prevPropsRef.current.hasSelectedDots} -> ${hasSelectedDots}`,
      );
    }
    if (prevPropsRef.current.cameraMode !== cameraMode) {
      changedProps.push(
        `cameraMode: ${prevPropsRef.current.cameraMode} -> ${cameraMode}`,
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

    if (changedProps.length > 0 || globalControlsRenderCount % 10 === 0) {
      logger.info(`🎮 GlobalControls RENDER #${globalControlsRenderCount}:`, {
        changedProps,
        selectedExerciseId: selectedExercise?.id,
        exerciseNotesLength: selectedExercise?.notes?.length || 0,
        timestamp: Date.now(),
      });
    }

    // Update prev props
    prevPropsRef.current = {
      selectedExercise,
      duration,
      is3DMode,
      tiltAngle,
      hasSelectedDots,
      cameraMode,
      loopRegion,
      isLoopEnabled,
    };
  });
  // Core DAW state
  const [coreServices, setCoreServices] = useState<CoreServices | null>(null);
  const [systemInitialized, setSystemInitialized] = useState(false);
  const [audioInitialized, setAudioInitialized] = useState(false);
  const [isLoadingExercise, setIsLoadingExercise] = useState(false);
  const loadingRef = useRef(false);

  // Use transport directly for playback control
  const transport = useTransport();

  // Create tracks using hooks
  const metronomeTrack = useTrack({
    trackId: 'metronome',
    name: 'Metronome',
    type: 'instrument',
    debugMode: false, // Disable debug logging for cleaner console
  });

  const drumTrack = useTrack({
    trackId: 'drums',
    name: 'Drums',
    type: 'instrument',
    debugMode: false, // Disable debug logging for cleaner console
  });

  // Initialize DAW system
  useEffect(() => {
    const initializeDAW = async () => {
      logger.debug('🎮 GlobalControls: Initializing DAW system...');

      // Wait for services to be available
      const maxRetries = 10;
      let retries = 0;

      const checkServices = async () => {
        try {
          const eventBus = serviceRegistry.get('eventBus');
          const audioEngine = serviceRegistry.get('audioEngine');

          if (eventBus && audioEngine) {
            logger.debug('🎮 GlobalControls: Services available from registry');
            setCoreServices({ eventBus, audioEngine } as any);
            setSystemInitialized(true);

            // Check if audio is already initialized
            try {
              const context = audioEngine.getContext();
              if (context) {
                setAudioInitialized(true);
                logger.debug('🎮 GlobalControls: Audio already initialized');
              }
            } catch (e) {
              logger.debug('🎮 GlobalControls: Audio not yet initialized');
            }
          } else if (retries < maxRetries) {
            retries++;
            logger.debug(
              `🎮 GlobalControls: Waiting for services... (${retries}/${maxRetries})`,
            );
            setTimeout(checkServices, 100);
          } else {
            logger.error(
              '🎮 GlobalControls: Failed to get services from registry',
            );
          }
        } catch (error) {
          // ServiceRegistry might not be initialized yet
          if (retries < maxRetries) {
            retries++;
            logger.debug(
              `🎮 GlobalControls: ServiceRegistry not ready (${retries}/${maxRetries})`,
            );
            setTimeout(checkServices, 100);
          } else {
            logger.error('🎮 GlobalControls: ServiceRegistry error:', error);
          }
        }
      };

      checkServices();
    };

    initializeDAW();
  }, []); // Only run once on mount

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

  // Local state for immediate UI responsiveness during dragging
  const [localTempo, setLocalTempo] = useState(transport.tempo || 120);
  const [localVolume, setLocalVolume] = useState(1.0); // Set default to 100%
  const [isDraggingTempo, setIsDraggingTempo] = useState(false);

  // Track the last user-initiated values to prevent feedback loops
  const lastUserTempo = useRef(transport.tempo || 120);
  const lastUserVolume = useRef(1.0); // Set default to 100%
  const ignoreNextSyncTempo = useRef(false);
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
  const rendererRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const savedScrollPosition = useRef<number>(0);
  const lastRenderedPosition = useRef<number>(-1);
  const isUserSeeking = useRef<boolean>(false);
  const userSeekTimeout = useRef<NodeJS.Timeout | null>(null);

  // Get exercise data from imported exercise or selected exercise
  const activeExercise = importedExercise || selectedExercise;
  const exerciseNotes: ExerciseNote[] = activeExercise?.notes || [];
  const exerciseBpm = activeExercise?.bpm || 120;
  const exerciseKey = activeExercise?.key || 'C';
  const exerciseTitle = activeExercise?.title || 'No Exercise Selected';
  const timeSignature = activeExercise?.timeSignature || {
    numerator: 4,
    denominator: 4,
  };
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

  // Handle MusicXML upload
  const handleMusicXMLUpload = (exercise: Exercise) => {
    setImportedExercise(exercise);
    setImportSource('musicxml');
    setCurrentPosition(1);
  };

  // Handle MIDI upload
  const handleMIDIUpload = (exercise: Exercise) => {
    setImportedExercise(exercise);
    setImportSource('midi');
    setCurrentPosition(1);
  };

  const handleUploadError = (error: string) => {
    logger.error('File upload error:', error);
  };

  const handleClearImported = () => {
    setImportedExercise(null);
    setImportSource(null);
    setCurrentPosition(2);
  };

  // Handle file input change
  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
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
          error instanceof Error ? error.message : 'Failed to parse MIDI file';
        handleUploadError(errorMessage);
      }
    } else {
      handleUploadError(`Unsupported file format: ${fileExtension}`);
    }

    // Clear the input value so the same file can be selected again
    event.target.value = '';
  };

  // Debounced sync to prevent rapid fire events during slider drag
  const tempoTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Prevent multiple simultaneous playback toggles
  const [isTogglingPlayback, setIsTogglingPlayback] = useState(false);

  // Global playback control handlers
  const handlePlayButtonClick = async () => {
    logger.debug('🎵 PLAY BUTTON CLICKED - handlePlayButtonClick called');
    logger.debug('🎵 Transport state:', {
      isPlaying: transport.isPlaying,
      isPaused: transport.isPaused,
      isStopped: transport.isStopped,
      position: transport.position,
      audioInitialized,
      selectedExercise: selectedExercise?.title,
      hasMetronomeRegions: metronomeTrack.regions.length,
      hasDrumRegions: drumTrack.regions.length,
    });

    if (isTogglingPlayback || !systemInitialized) {
      logger.debug('System not ready or already toggling playback:', {
        isTogglingPlayback,
        systemInitialized,
      });
      return;
    }

    // Check if we have an exercise and regions loaded
    if (!transport.isPlaying) {
      // Check if regions are loaded
      const hasRegions =
        metronomeTrack.regions.length > 0 || drumTrack.regions.length > 0;

      if (!hasRegions) {
        if (selectedExercise) {
          logger.debug(
            '🎵 No regions loaded yet, waiting for exercise to load...',
          );
          // The exercise loading effect should trigger and load regions
          // Give it a moment and then try to start
          const maxRetries = 5;
          let retryCount = 0;

          const checkAndStart = () => {
            retryCount++;
            if (
              metronomeTrack.regions.length > 0 ||
              drumTrack.regions.length > 0
            ) {
              logger.debug('🎵 Regions loaded, starting playback');
              // Start transport directly instead of recursive call
              transport.start();
              setIsPlaying(true);
            } else if (retryCount < maxRetries) {
              logger.debug(
                `🎵 Still no regions, retry ${retryCount}/${maxRetries}`,
              );
              setTimeout(checkAndStart, 100);
            } else {
              logger.warn('🎵 Still no regions after maximum retries');
            }
          };

          setTimeout(checkAndStart, 100);
          return;
        } else {
          // No exercise selected, create a default metronome pattern
          logger.debug(
            '🎵 No exercise selected, creating default metronome pattern',
          );

          const beats = 16; // 4 measures of 4/4
          const events = [];
          for (let i = 0; i < beats; i++) {
            events.push({
              id: `default-metronome-${i}`,
              type: 'metronome-trigger' as const,
              time: i,
              data: { accent: i % 4 === 0 },
            });
          }

          const metronomeRegion = {
            id: 'default-metronome-region',
            trackId: metronomeTrack.track?.id || 'metronome',
            name: 'Default Metronome',
            startTime: 0,
            duration: beats,
            pattern: {
              id: 'default-metronome-pattern',
              name: 'Click Track',
              type: 'metronome',
              timeSignature: { numerator: 4, denominator: 4 },
              events: events.map((evt, idx) => ({
                position: `0:${idx}:0`,
                type: evt.data.accent ? 'accent' : 'click',
                velocity: 0.8,
              })),
            },
          };

          metronomeTrack.clearRegions();
          metronomeTrack.addRegion(metronomeRegion as any);
          logger.debug('🎵 Added default metronome pattern');
        }
      }
    }

    try {
      setIsTogglingPlayback(true);

      // Configure loop if enabled (only when starting fresh from stopped state)
      if (
        transport.isStopped &&
        isLoopEnabled &&
        loopRegion &&
        selectedExercise
      ) {
        const timeSignature = selectedExercise.timeSignature || {
          numerator: 4,
          denominator: 4,
        };
        const beatsPerMeasure = timeSignature.numerator;

        // Calculate loop points
        const startMeasure = loopRegion.startMeasure - 1; // 0-indexed
        const startBeat = (loopRegion.startBeat || 1) - 1; // 0-indexed
        const endMeasure = loopRegion.endMeasure - 1; // 0-indexed
        const endBeat = (loopRegion.endBeat || beatsPerMeasure) - 1; // 0-indexed

        await transport.setLoop(
          startMeasure * beatsPerMeasure + startBeat,
          endMeasure * beatsPerMeasure + endBeat,
        );
        logger.debug('🎵 Loop configured');
      }

      // Handle play/stop logic (no pause)
      if (transport.isPlaying) {
        // Currently playing -> stop
        logger.debug('🎵 Stopping playback');
        await transport.stop();
      } else {
        // Not playing -> start
        logger.debug('🎵 Starting playback', {
          isPaused: transport.isPaused,
          isStopped: transport.isStopped,
        });

        // Get core services and ensure full initialization
        const globalCoreServices = (window as any).__globalCoreServices;
        if (globalCoreServices) {
          // Full initialization (including starting audio context) - this is the user gesture
          if (!globalCoreServices.isReady()) {
            logger.debug('🎵 Initializing audio system...');
            await globalCoreServices.initialize();
            await globalCoreServices.start();
            logger.debug('🎵 Audio system initialized');
          }

          // Ensure audio context is resumed (if it was already initialized but suspended)
          const { ensureAudioContext } = await import(
            '@/domains/playback/utils/ensureAudioContext'
          );
          await ensureAudioContext();
        }

        // Always start fresh (no resume)
        await transport.start();

        logger.debug('🎵 Transport command sent, waiting for state update...');

        // Give the transport a moment to update its state
        await new Promise((resolve) => setTimeout(resolve, 50));

        logger.debug('🎵 Transport state after command:', {
          isPlaying: transport.isPlaying,
          isPaused: transport.isPaused,
          isStopped: transport.isStopped,
        });
      }
    } catch (error: any) {
      logger.error('Error toggling playback:', error);

      // If this is an audio initialization error, try one more time
      if (
        error?.message?.includes('AudioContext not available') ||
        error?.message?.includes('Transport not initialized')
      ) {
        logger.debug('🎵 Audio system needs initialization, retrying...');

        // Give the system a moment to finish initialization
        setTimeout(async () => {
          try {
            if (transport.isPlaying) {
              await transport.stop();
            } else {
              await transport.start();
            }
            logger.debug('🎵 Playback started successfully on retry');
          } catch (retryError) {
            logger.error('Failed to start playback on retry:', retryError);
          }
        }, 100);
      }
    } finally {
      // Add a small delay before allowing the next toggle to ensure state updates
      setTimeout(() => {
        setIsTogglingPlayback(false);
      }, 100);
    }
  };

  const handleTempoChange = useCallback(
    async (newTempo: number) => {
      try {
        // Update local state immediately for responsive UI
        setLocalTempo(newTempo);
        lastUserTempo.current = newTempo;

        // Set flag to ignore the next sync update to prevent feedback
        ignoreNextSyncTempo.current = true;

        // Update tempo using transport
        await transport.setTempo(newTempo);

        // Clear any pending sync
        if (tempoTimeoutRef.current) {
          clearTimeout(tempoTimeoutRef.current);
        }

        // Reset ignore flag after tempo change
        tempoTimeoutRef.current = setTimeout(() => {
          ignoreNextSyncTempo.current = false;
        }, 100);
      } catch (error) {
        logger.error('Error setting tempo:', error);
      }
    },
    [transport],
  );

  // Sync local state with transport tempo
  useEffect(() => {
    if (!isDraggingTempo && !ignoreNextSyncTempo.current && transport.tempo) {
      // Only update if the value is significantly different
      const tempoThreshold = 1;
      if (Math.abs(transport.tempo - localTempo) > tempoThreshold) {
        setLocalTempo(transport.tempo);
      }
    }
  }, [transport.tempo, isDraggingTempo]);

  // Update position based on transport
  useEffect(() => {
    // Skip updating if user is seeking
    if (isUserSeeking.current) {
      return;
    }

    if (transport.position && exerciseNotes.length > 0) {
      // Convert transport position to sheet music position
      const currentBeat =
        transport.position.bars * 4 + transport.position.beats;
      const maxPosition = exerciseNotes.length;
      const newPosition = Math.min(Math.floor(currentBeat) + 1, maxPosition);
      if (newPosition > 0) {
        setCurrentPosition(newPosition);
      }
    }
  }, [transport.position, exerciseNotes.length]); // Removed currentPosition to prevent circular dependency

  // Track the last loaded exercise to prevent reloading
  const lastLoadedExerciseRef = useRef<string | null>(null);

  // Store track methods in refs to avoid dependency issues
  const metronomeTrackRef = useRef(metronomeTrack);
  const drumTrackRef = useRef(drumTrack);

  // Update refs when tracks change
  useEffect(() => {
    metronomeTrackRef.current = metronomeTrack;
    drumTrackRef.current = drumTrack;
  }, [metronomeTrack, drumTrack]);

  // Load exercise data when selected
  useEffect(() => {
    if (!selectedExercise || !systemInitialized) {
      logger.debug('🎮 GlobalControls: Not ready to load exercise:', {
        hasExercise: !!selectedExercise,
        systemInitialized,
      });
      return;
    }

    // Also wait for tracks to be initialized
    if (!metronomeTrack.isInitialized || !drumTrack.isInitialized) {
      logger.debug('🎮 GlobalControls: Waiting for tracks to initialize:', {
        metronomeTrack: {
          isInitialized: metronomeTrack.isInitialized,
          isReady: metronomeTrack.isReady,
        },
        drumTrack: {
          isInitialized: drumTrack.isInitialized,
          isReady: drumTrack.isReady,
        },
      });
      return;
    }

    // Check if this is a new exercise or if we're already loading
    if (
      lastLoadedExerciseRef.current === selectedExercise.id ||
      loadingRef.current
    ) {
      return;
    }

    // Load the exercise data
    const loadExercise = async () => {
      loadingRef.current = true;
      setIsLoadingExercise(true);
      lastLoadedExerciseRef.current = selectedExercise.id;

      logger.debug(
        '🎮 GlobalControls: Loading exercise:',
        selectedExercise.title,
      );

      try {
        // Clear existing regions
        metronomeTrackRef.current.clearRegions();
        drumTrackRef.current.clearRegions();

        // Load MIDI data if available
        if (selectedExercise.midi_data) {
          logger.debug('🎮 GlobalControls: Loading MIDI data...');

          try {
            const { Midi } = await import('@tonejs/midi');
            const midi = new Midi(selectedExercise.midi_data);
            logger.debug(
              `🎮 GlobalControls: Parsed MIDI: ${midi.tracks.length} tracks`,
            );
          } catch (error) {
            logger.error('🎮 GlobalControls: Error parsing MIDI:', error);
          }
        }

        // Create metronome pattern
        const metronome = metronomeTrackRef.current;
        logger.debug('🎮 GlobalControls: Metronome track state:', {
          isInitialized: metronome.isInitialized,
          hasTrack: !!metronome.track,
          trackId: metronome.track?.id,
          trackName: metronome.track?.name,
        });
        if (metronome.isInitialized && metronome.track) {
          const beats = selectedExercise.duration_beats || 16;
          const events = [];
          for (let i = 0; i < beats; i++) {
            events.push({
              id: `metronome-${i}`,
              type: 'metronome-trigger' as const,
              time: i,
              data: { accent: i % 4 === 0 },
            });
          }

          const metronomeRegion = {
            id: 'metronome-region',
            trackId: metronome.track?.id || 'metronome',
            name: 'Metronome',
            startTime: 0,
            duration: beats,
            pattern: {
              id: 'metronome-pattern',
              name: 'Click Track',
              type: 'metronome',
              timeSignature: { numerator: 4, denominator: 4 },
              events: events.map((evt, idx) => ({
                position: `0:${idx}:0`,
                type: evt.data.accent ? 'accent' : 'click',
                velocity: 0.8,
              })),
            },
          };
          metronome.addRegion(metronomeRegion as any);
          logger.debug('🎮 GlobalControls: Added metronome pattern');
        }

        // Create drum pattern if enabled
        const drum = drumTrackRef.current;
        logger.debug('🎮 GlobalControls: Drum track state:', {
          isInitialized: drum.isInitialized,
          hasTrack: !!drum.track,
          trackId: drum.track?.id,
          trackName: drum.track?.name,
          drumEnabled: selectedExercise.drum_pattern?.enabled,
        });
        if (
          drum.isInitialized &&
          drum.track &&
          selectedExercise.drum_pattern?.enabled
        ) {
          const drumRegion = {
            id: 'drum-test-region',
            trackId: drum.track?.id || 'drums',
            name: 'Drum Pattern',
            startTime: 0,
            duration: 4,
            pattern: {
              id: 'drum-pattern-1',
              name: 'Basic Beat',
              type: 'drum',
              events: [
                {
                  position: '0:0:0',
                  drum: 'kick',
                  velocity: 0.8,
                },
                {
                  position: '0:1:0',
                  drum: 'snare',
                  velocity: 0.7,
                },
                {
                  position: '0:2:0',
                  drum: 'kick',
                  velocity: 0.8,
                },
                {
                  position: '0:3:0',
                  drum: 'snare',
                  velocity: 0.7,
                },
              ],
            },
          };
          drum.addRegion(drumRegion as any);
          logger.debug('🎮 GlobalControls: Added drum pattern');
        }

        // Update tempo from exercise
        if (selectedExercise.bpm) {
          await transport.setTempo(selectedExercise.bpm);
          setLocalTempo(selectedExercise.bpm);
          lastUserTempo.current = selectedExercise.bpm;
        }

        logger.debug('🎮 GlobalControls: Exercise loaded successfully');
      } catch (error) {
        logger.error('🎮 GlobalControls: Error loading exercise:', error);
      } finally {
        loadingRef.current = false;
        setIsLoadingExercise(false);
      }
    };

    loadExercise();
  }, [
    selectedExercise?.id,
    systemInitialized,
    metronomeTrack.isInitialized,
    drumTrack.isInitialized,
    transport,
  ]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (tempoTimeoutRef.current) {
        clearTimeout(tempoTimeoutRef.current);
      }
    };
  }, []);

  // Drag event handlers for responsive UI
  const handleTempoMouseDown = useCallback(() => {
    setIsDraggingTempo(true);
    ignoreNextSyncTempo.current = true;
  }, []);

  const handleTempoMouseUp = useCallback(() => {
    setIsDraggingTempo(false);
    // Keep ignoring sync updates for a bit after release
    setTimeout(() => {
      ignoreNextSyncTempo.current = false;
    }, 300);
  }, []);

  // Add global mouse up listeners to handle drag end even outside the slider
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDraggingTempo) {
        handleTempoMouseUp();
      }
    };

    const handleGlobalTouchEnd = () => {
      if (isDraggingTempo) {
        handleTempoMouseUp();
      }
    };

    document.addEventListener('mouseup', handleGlobalMouseUp);
    document.addEventListener('touchend', handleGlobalTouchEnd);

    return () => {
      document.removeEventListener('mouseup', handleGlobalMouseUp);
      document.removeEventListener('touchend', handleGlobalTouchEnd);
    };
  }, [isDraggingTempo, handleTempoMouseUp]);

  // Calculate beats per measure for processing
  const beatsPerMeasure = timeSignature.numerator;

  // VexFlow rendering effect - Only render when notes change, not position
  useEffect(() => {
    if (!containerRef.current || exerciseNotes.length === 0) return;

    logger.info('🎵 VexFlow rendering effect triggered', {
      exerciseNotesLength: exerciseNotes.length,
      timeSignature,
      beatsPerMeasure,
      timestamp: Date.now(),
    });

    // Save scroll position only when paused
    if (scrollContainerRef.current && !transport.isPlaying) {
      savedScrollPosition.current = scrollContainerRef.current.scrollLeft;
    }

    // Clear previous rendering
    containerRef.current.innerHTML = '';
    // Reset the vexflowMapped flag so the event can be emitted again
    delete containerRef.current.dataset.vexflowMapped;

    try {
      // Industry best practice: Build data model first, then render
      const processedNotes = processNotesForDisplay(
        exerciseNotes,
        timeSignature,
        beatsPerMeasure,
      );
      renderSimpleNotation(
        processedNotes,
        containerRef.current,
        timeSignature,
        exerciseNotes,
        currentPosition,
      );

      // Restore scroll position ONLY when paused
      if (
        !transport.isPlaying &&
        scrollContainerRef.current &&
        savedScrollPosition.current > 0
      ) {
        // Restore immediately without requestAnimationFrame to avoid timing issues
        scrollContainerRef.current.scrollLeft = savedScrollPosition.current;
      }
    } catch (error) {
      logger.error('VexFlow rendering error:', error);
    }
  }, [exerciseNotes, timeSignature, beatsPerMeasure]); // Only re-render when notes or time signature changes

  // Track the last highlighted position to avoid unnecessary updates
  const lastHighlightedPosition = useRef<number>(-1);

  // Separate effect for highlighting only - doesn't re-render VexFlow
  useEffect(() => {
    if (!containerRef.current) return;

    // Function to apply highlighting
    const applyHighlighting = (force = false) => {
      const svg = containerRef.current?.querySelector('svg');
      if (!svg) return;

      // Skip if position hasn't changed and we're not forcing
      if (!force && lastHighlightedPosition.current === currentPosition) {
        return;
      }

      // Set flag to prevent MutationObserver from reacting
      isUpdatingHighlightRef.current = true;

      // Find all StaveNote elements
      const renderedGroups = svg.querySelectorAll('g.vf-stavenote');
      if (renderedGroups.length === 0) {
        isUpdatingHighlightRef.current = false;
        return;
      }

      // Only log when position actually changes
      if (lastHighlightedPosition.current !== currentPosition) {
        logger.info(
          `🎨 Highlighting position change: ${lastHighlightedPosition.current} → ${currentPosition - 1}`,
        );
      }

      // Update all elements in one pass
      renderedGroups.forEach((group) => {
        const unifiedIndexStr = group.getAttribute('data-unified-index');
        if (!unifiedIndexStr) return;

        const elementUnifiedIndex = parseInt(unifiedIndexStr);
        const shouldHighlight = elementUnifiedIndex === currentPosition - 1;
        const wasHighlighted = group.classList.contains('highlighted-note');

        // Skip if highlight state hasn't changed
        if (shouldHighlight === wasHighlighted && !force) {
          return;
        }

        if (shouldHighlight) {
          // Add highlight
          group.classList.add('highlighted-note');

          // Find all child elements that need color
          const coloredElements = group.querySelectorAll(
            'path, rect, circle, ellipse, polygon, line',
          );

          coloredElements.forEach((element) => {
            // Apply blue color using multiple methods for maximum persistence
            element.setAttribute('fill', '#3B82F6');
            element.setAttribute('stroke', '#3B82F6');

            // Force inline style to override any CSS or re-renders
            const style = (element as HTMLElement).style;
            style.setProperty('fill', '#3B82F6', 'important');
            style.setProperty('stroke', '#3B82F6', 'important');
            style.setProperty(
              'filter',
              'drop-shadow(0 0 8px #3B82F6)',
              'important',
            );

            // Mark element as highlighted
            element.setAttribute('data-highlighted', 'true');
          });

          // Also color any text elements
          const textElements = group.querySelectorAll('text');
          textElements.forEach((text) => {
            text.setAttribute('fill', '#3B82F6');
            const style = (text as HTMLElement).style;
            style.setProperty('fill', '#3B82F6', 'important');
            text.setAttribute('data-highlighted', 'true');
          });
        } else if (wasHighlighted) {
          // Remove highlight only if it was previously highlighted
          group.classList.remove('highlighted-note');

          // Reset colors to black
          const coloredElements = group.querySelectorAll(
            'path, rect, circle, ellipse, polygon, line',
          );
          coloredElements.forEach((element) => {
            element.removeAttribute('style');
            element.setAttribute('fill', '#000000');
            element.setAttribute('stroke', '#000000');
            element.removeAttribute('data-highlighted');
          });

          // Reset text colors
          const textElements = group.querySelectorAll('text');
          textElements.forEach((text) => {
            text.removeAttribute('style');
            text.setAttribute('fill', '#000000');
            text.removeAttribute('data-highlighted');
          });
        }
      });

      // Update the last highlighted position
      lastHighlightedPosition.current = currentPosition;

      // Clear flag after a small delay to ensure DOM updates are complete
      setTimeout(() => {
        isUpdatingHighlightRef.current = false;
      }, 10);
    };

    // Apply highlighting after VexFlow renders
    const initialTimeout = setTimeout(() => applyHighlighting(true), 100);

    // Set up a mutation observer to detect when VexFlow modifies the DOM
    const observer = new MutationObserver((mutations) => {
      // Check if any highlighted elements were modified
      const highlightedModified = mutations.some((mutation) => {
        return (
          mutation.type === 'attributes' &&
          (mutation.target as Element).closest('.highlighted-note') !== null
        );
      });

      if (highlightedModified) {
        // Reapply highlighting if highlighted elements were modified
        applyHighlighting(true);
      }
    });

    // Start observing the SVG for changes
    const svg = containerRef.current.querySelector('svg');
    if (svg) {
      observer.observe(svg, {
        attributes: true,
        attributeOldValue: true,
        subtree: true,
        attributeFilter: ['fill', 'stroke', 'style'],
      });
    }

    return () => {
      clearTimeout(initialTimeout);
      observer.disconnect();
    };
  }, [currentPosition]); // Only depend on position changes

  // Optimized click handler for sheet music with proper debouncing
  const attachTimeoutRef = useRef<NodeJS.Timeout>();
  const lastAttachTimeRef = useRef<number>(0);
  const DEBOUNCE_DELAY = 100; // Prevent rapid reattachment

  // Track if handlers are already attached to prevent infinite loops
  const handlersAttachedRef = useRef(false);
  const isUpdatingHighlightRef = useRef(false);

  const cleanupExistingHandlers = useCallback((svg: SVGSVGElement) => {
    const allNoteGroups = svg.querySelectorAll(
      'g.vf-stavenote[data-clickable="true"]',
    );
    allNoteGroups.forEach((group) => {
      const g = group as any;
      if (g._clickHandler) {
        group.removeEventListener('click', g._clickHandler);
        delete g._clickHandler;
      }
      if (g._mouseEnterHandler) {
        group.removeEventListener('mouseenter', g._mouseEnterHandler);
        delete g._mouseEnterHandler;
      }
      if (g._mouseLeaveHandler) {
        group.removeEventListener('mouseleave', g._mouseLeaveHandler);
        delete g._mouseLeaveHandler;
      }
    });
  }, []);

  const attachClickHandlers = useCallback(() => {
    const now = Date.now();
    if (now - lastAttachTimeRef.current < DEBOUNCE_DELAY) {
      // Clear any pending attachment
      if (attachTimeoutRef.current) {
        clearTimeout(attachTimeoutRef.current);
      }
      // Schedule for later
      attachTimeoutRef.current = setTimeout(
        () => {
          attachClickHandlers();
        },
        DEBOUNCE_DELAY - (now - lastAttachTimeRef.current),
      );
      return;
    }
    lastAttachTimeRef.current = now;

    // Additional check to prevent multiple attachments
    if (handlersAttachedRef.current) {
      logger.info('Click handlers already attached, skipping');
      return;
    }

    const svg = containerRef.current?.querySelector('svg');
    if (!svg) {
      logger.info('Click handler: No SVG found');
      return;
    }

    // Clean up any existing handlers first
    cleanupExistingHandlers(svg as SVGSVGElement);

    // Find all VexFlow note groups (notes and rests)
    const allNoteGroups = svg.querySelectorAll(
      'g.vf-stavenote[data-clickable="true"]',
    );

    if (allNoteGroups.length === 0) {
      logger.info('Click handler: No clickable note groups found');
      return;
    }

    logger.info(
      `Click handler: Found ${allNoteGroups.length} clickable elements`,
    );

    // Process each rendered element - simplified approach using stored data
    allNoteGroups.forEach((group, index) => {
      const groupElement = group as any;

      // Make clickable - but ensure it doesn't block other elements
      (group as SVGElement).style.cursor = 'pointer';
      (group as SVGElement).style.pointerEvents = 'auto';

      // Click handler
      const handleClick = async (event: MouseEvent) => {
        // Prevent event bubbling to avoid page-wide click blocking
        event.stopPropagation();
        event.preventDefault();

        // Read data from SVG attributes
        const isRest = group.getAttribute('data-click-type') === 'rest';
        const beatPosition = parseFloat(
          group.getAttribute('data-start-beat') || '0',
        );
        const noteIndexAttr = group.getAttribute('data-note-index');
        const noteIndex =
          noteIndexAttr && noteIndexAttr !== ''
            ? parseInt(noteIndexAttr)
            : null;
        const unifiedIndexAttr = group.getAttribute('data-unified-index');
        const unifiedIndex = unifiedIndexAttr
          ? parseInt(unifiedIndexAttr)
          : null;

        // Debug logging
        logger.info('=== CLICK DEBUG ===');
        logger.info('Clicked element:', {
          domIndex: index,
          isRest: isRest,
          noteIndex: noteIndex,
          unifiedIndex: unifiedIndex,
          beat: beatPosition,
          attributes: {
            clickType: group.getAttribute('data-click-type'),
            startBeat: group.getAttribute('data-start-beat'),
            noteIndex: group.getAttribute('data-note-index'),
            measureIndex: group.getAttribute('data-measure-index'),
            unifiedIndex: group.getAttribute('data-unified-index'),
            duration: group.getAttribute('data-duration'),
          },
        });
        logger.info('Total exerciseNotes:', exerciseNotes.length);
        logger.info('Current position before click:', currentPosition);

        // Update position using unified index (works for both notes and rests)
        if (
          unifiedIndex !== null &&
          unifiedIndex !== undefined &&
          !isNaN(unifiedIndex)
        ) {
          // For display purposes, we use unified index + 1 (1-based indexing)
          const newPosition = unifiedIndex + 1;

          // Set flag to prevent automatic position updates
          isUserSeeking.current = true;

          // Clear any existing timeout
          if (userSeekTimeout.current) {
            clearTimeout(userSeekTimeout.current);
          }

          // Update position immediately
          setCurrentPosition(newPosition);

          // Keep the flag set for a bit to allow transport to catch up
          userSeekTimeout.current = setTimeout(() => {
            isUserSeeking.current = false;
          }, 500); // Give transport 500ms to update
        }

        // Seek transport to the beat position for BOTH notes and rests
        if (transport && transport.seekTo) {
          try {
            logger.info(`🎵 Click data:`, {
              beatPosition,
              isRest,
              unifiedIndex,
              noteIndex,
            });

            // IMPORTANT: Don't initialize the entire CoreServices here!
            // Just ensure audio context is resumed if needed
            const { audioContextManager } = await import(
              '@/domains/widgets/utils/audioContextManager'
            );

            // Only resume audio context if it's suspended - don't trigger full initialization
            if (audioContextManager.getState() === 'suspended') {
              logger.debug('Resuming audio context on sheet music click...');
              await audioContextManager.ensureResumed();
            }

            // Convert beat position to MusicalPosition
            // For now, assume beatPosition counts quarter notes
            // TODO: Handle subdivisions properly if the note data includes them
            const beatsPerBar = 4; // Assuming 4/4 time signature
            const bars = Math.floor(beatPosition / beatsPerBar);
            const beats = beatPosition % beatsPerBar;

            // For now, set sixteenths to 0
            // TODO: Extract subdivision information from noteData if available
            const musicalPosition = {
              bars: bars,
              beats: beats,
              sixteenths: 0,
              ticks: 0,
            };

            logger.info(`🎯 Seeking to musical position:`, musicalPosition);
            await transport.seekTo(musicalPosition);

            logger.info('✅ Seek completed successfully');
          } catch (error) {
            logger.error('Transport seek failed:', error);
          }
        } else {
          logger.warn('Transport or transport.seekTo not available');
        }
      };

      // Store the handler reference so we can remove it later
      (group as any)._clickHandler = handleClick;
      group.addEventListener('click', handleClick);

      // Simple hover - only add opacity effect, don't change colors
      const handleMouseEnter = () => {
        if (!transport.isPlaying) {
          // Check if this is the highlighted element
          const unifiedIndex = group.getAttribute('data-unified-index');
          const isHighlighted =
            unifiedIndex &&
            parseInt(unifiedIndex) === currentPositionRef.current - 1;

          if (!isHighlighted) {
            group.style.opacity = '0.7';
          }
        }
      };

      const handleMouseLeave = () => {
        group.style.opacity = '1';
      };

      (group as any)._mouseEnterHandler = handleMouseEnter;
      (group as any)._mouseLeaveHandler = handleMouseLeave;

      // Add event listeners with passive option for better performance
      group.addEventListener('mouseenter', handleMouseEnter, { passive: true });
      group.addEventListener('mouseleave', handleMouseLeave, { passive: true });
    });

    // Mark handlers as attached after successful completion
    handlersAttachedRef.current = true;
  }, [transport, cleanupExistingHandlers]);

  // Separate effect for click handler attachment
  useEffect(() => {
    if (!containerRef.current) return;

    // Reset the flag when exercise notes change
    handlersAttachedRef.current = false;

    // Listen for the custom event that signals data mapping is complete
    const handleDataMapped = (event: Event) => {
      logger.info(
        'VexFlow data mapped event received:',
        (event as CustomEvent).detail,
      );
      // Only attach handlers if not already attached
      if (!handlersAttachedRef.current) {
        handlersAttachedRef.current = true;
        // Small delay to ensure DOM is settled
        setTimeout(attachClickHandlers, 50);
      }
    };

    containerRef.current.addEventListener(
      'vexflow-data-mapped',
      handleDataMapped,
    );

    // Also try to attach handlers after a delay as fallback
    const fallbackTimeout = setTimeout(() => {
      if (!handlersAttachedRef.current) {
        handlersAttachedRef.current = true;
        attachClickHandlers();
      }
    }, 600);

    // Set up MutationObserver with RAF batching for better performance
    let rafId: number;
    const pendingReattach = false;

    const observer = new MutationObserver((mutations) => {
      // Skip if we're updating highlights
      if (isUpdatingHighlightRef.current) {
        return;
      }

      // Check if we need to reattach handlers
      let needsReattach = false;
      for (const mutation of mutations) {
        // Only reattach if SVG structure changes, not just attributes
        if (mutation.type === 'childList') {
          // Check if actual note groups were added/removed
          const addedNodes = Array.from(mutation.addedNodes);
          const removedNodes = Array.from(mutation.removedNodes);
          const hasSignificantChange = [...addedNodes, ...removedNodes].some(
            (node) => {
              return (
                node.nodeType === Node.ELEMENT_NODE &&
                (node as Element).matches?.('g.vf-stavenote, svg')
              );
            },
          );
          if (hasSignificantChange) {
            needsReattach = true;
            break;
          }
        }
      }

      if (!needsReattach) {
        return;
      }

      // Cancel any pending RAF
      if (rafId) {
        cancelAnimationFrame(rafId);
      }

      // Schedule reattachment with RAF to batch updates
      rafId = requestAnimationFrame(() => {
        // Reset flag and reattach only if structure changed
        handlersAttachedRef.current = false;
        attachClickHandlers();
        handlersAttachedRef.current = true;
      });
    });

    const svg = containerRef.current.querySelector('svg');
    if (svg) {
      observer.observe(svg, {
        childList: true,
        subtree: true,
        // Don't observe attributes to prevent loops
        attributes: false,
      });
    }

    return () => {
      if (containerRef.current) {
        containerRef.current.removeEventListener(
          'vexflow-data-mapped',
          handleDataMapped,
        );
      }
      clearTimeout(fallbackTimeout);
      if (attachTimeoutRef.current) {
        clearTimeout(attachTimeoutRef.current);
      }
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      observer.disconnect();
      // Clean up handlers on unmount
      const svg = containerRef.current?.querySelector('svg');
      if (svg) {
        cleanupExistingHandlers(svg as SVGSVGElement);
      }
    };
  }, [exerciseNotes.length, attachClickHandlers, cleanupExistingHandlers]); // Include all dependencies used in handlers

  // Handle auto-scroll during playback
  useEffect(() => {
    if (
      !transport.isPlaying ||
      !scrollContainerRef.current ||
      exerciseNotes.length === 0
    )
      return;

    // Clear any saved position when starting playback
    if (savedScrollPosition.current > 0) {
      savedScrollPosition.current = 0;
    }

    // Use transport position directly for more accurate timing
    if (transport.position) {
      // Calculate which note/measure we should be at based on transport position
      const currentBeat =
        transport.position.bars * 4 + transport.position.beats;

      // Find the note that should be playing at this beat
      let targetMeasure = 1;
      let accumulatedBeats = 0;

      for (const note of exerciseNotes) {
        const noteDuration = getDurationInQuarterNotes(
          note.duration || 'quarter',
        );
        if (accumulatedBeats + noteDuration > currentBeat) {
          targetMeasure = note.position?.measure || 1;
          break;
        }
        accumulatedBeats += noteDuration;
      }

      // Calculate scroll position for the target measure
      const baseMeasureWidth = 180;
      const firstMeasureWidth = 220;
      const containerWidth = scrollContainerRef.current.clientWidth;

      let measureX = 20; // Left padding
      if (targetMeasure > 1) {
        measureX += firstMeasureWidth + (targetMeasure - 2) * baseMeasureWidth;
      }

      // Center the measure in view
      const targetScroll =
        measureX +
        (targetMeasure === 1 ? firstMeasureWidth : baseMeasureWidth) / 2 -
        containerWidth / 2;

      // Use direct assignment instead of scrollTo for immediate response
      scrollContainerRef.current.scrollLeft = Math.max(0, targetScroll);
    }
  }, [transport.position, transport.isPlaying, exerciseNotes]);

  // Industry standard: Separate data processing from rendering - Proper MIDI timing approach
  const processNotesForDisplay = (
    notes: ExerciseNote[],
    timeSignature: any,
    beatsPerMeasure: number,
  ) => {
    // Quantize and validate notes first (industry best practice)
    const validatedNotes = notes.filter((note) => {
      if (!note || !note.note) return false;

      // Ensure we have a valid duration
      const duration = note.duration || 'quarter';
      const vexFlowDuration = convertNoteDurationToVexFlow(duration);
      return vexFlowDuration && vexFlowDuration !== '';
    });

    // Group notes into measures using actual MIDI measure positions
    const measureMap = new Map<number, ExerciseNote[]>();

    // Group notes by their actual measure position from MIDI data
    for (const note of validatedNotes) {
      const measureNumber = note.position?.measure || 1;

      if (!measureMap.has(measureNumber)) {
        measureMap.set(measureNumber, []);
      }
      measureMap.get(measureNumber)!.push(note);
    }

    // Convert to array and ensure measures are in order
    const measures = [];
    const measureNumbers = Array.from(measureMap.keys()).sort((a, b) => a - b);

    for (const measureNumber of measureNumbers) {
      const measureNotes = measureMap.get(measureNumber) || [];
      // Sort notes within each measure by beat position
      measureNotes.sort((a, b) => {
        const beatA = a.position?.beat || 1;
        const beatB = b.position?.beat || 1;
        const subdivA = a.position?.subdivision || 0;
        const subdivB = b.position?.subdivision || 0;

        if (beatA !== beatB) return beatA - beatB;
        return subdivA - subdivB;
      });

      measures.push(measureNotes);
    }

    // Ensure we have at least one measure
    if (measures.length === 0) {
      measures.push([]);
    }

    return measures;
  };

  // Industry standard: Simple, robust rendering with continuous staff
  const renderSimpleNotation = (
    measures: ExerciseNote[][],
    container: HTMLDivElement,
    timeSignature: any,
    exerciseNotes: ExerciseNote[],
    currentPosition: number,
  ) => {
    try {
      // Get actual parent container width dynamically
      const containerWidth = container.parentElement?.clientWidth || 600;

      // Use EXACT same dimensions as working FretboardCard
      const svgHeight = 120; // Optimal height for staff display (from FretboardCard)
      const baseMeasureWidth = 180; // Base width for regular measures
      const firstMeasureWidth = 220; // Wider first measure for clef + time signature
      const totalStaffWidth =
        firstMeasureWidth + baseMeasureWidth * (measures.length - 1);

      // Define consistent padding
      const leftPadding = 20;
      const rightPadding = 40; // Extra padding on the right to compensate for VexFlow's internal spacing
      const svgWidth = Math.max(
        containerWidth,
        totalStaffWidth + leftPadding + rightPadding,
      ); // Ensure scrollability with padding

      // Create renderer following VexFlow best practices
      const renderer = new VF.Renderer(container, VF.Renderer.Backends.SVG);
      renderer.resize(svgWidth, svgHeight);
      const context = renderer.getContext();
      context.setFont('Arial', 10);

      // Set black colors for notes and staff
      context.setFillStyle('#000000'); // Black for notes
      context.setStrokeStyle('#000000'); // Black for lines

      // Use EXACT same approach as working FretboardCard
      const rowY = 0; // No top padding (from FretboardCard)
      const rowStartX = leftPadding; // Use consistent left padding

      // Create staves for all measures in a single row with proper widths
      const staves = [];
      const measureWidths = [];
      let currentX = rowStartX;

      for (
        let measureIndex = 0;
        measureIndex < measures.length;
        measureIndex++
      ) {
        // First measure is wider to accommodate clef and time signature
        const currentMeasureWidth =
          measureIndex === 0 ? firstMeasureWidth : baseMeasureWidth;
        measureWidths.push(currentMeasureWidth);

        const stave = new VF.Stave(currentX, rowY, currentMeasureWidth);

        // Add bass clef and time signature to first measure only
        if (measureIndex === 0) {
          stave.addClef('bass');
          stave.addTimeSignature(
            `${timeSignature.numerator}/${timeSignature.denominator}`,
          );
        }

        // Set black colors for the stave
        stave.setContext(context);
        context.setFillStyle('#000000');
        context.setStrokeStyle('#000000');
        stave.draw();
        staves.push(stave);
        currentX += currentMeasureWidth;
      }

      // Convert notes to VexFlow format - EXACT same approach as FretboardCard
      const vexFlowMeasures = [];
      for (let i = 0; i < measures.length; i++) {
        const measureNotes = measures[i];

        // Add null safety check for measureNotes
        if (!measureNotes) {
          vexFlowMeasures.push([]);
          continue;
        }

        // Define timeline item type for proper TypeScript support
        interface TimelineItem {
          type: 'note' | 'rest';
          startBeat: number;
          endBeat?: number;
          note?: ExerciseNote;
          duration: number | string;
          noteIndex?: number;
        }

        // Create a timeline-based approach for proper rhythm placement
        const timeline: TimelineItem[] = [];

        // Add all notes to timeline with their exact beat positions
        measureNotes.forEach((note) => {
          const beatPosition =
            (note.position?.beat || 1) -
            1 +
            (note.position?.subdivision || 0) / 16;
          const noteDuration = getDurationInQuarterNotes(
            note.duration || 'quarter',
          );

          // Find the index of this note in the original exerciseNotes array
          const noteIndex = exerciseNotes.findIndex((n) => n === note);

          // Debug note indexing (disabled to prevent spam)
          // if (i === 0) { // Only log for first measure to avoid spam
          //   logger.info(`Note in measure ${i}: index=${noteIndex}, note=${note.note}, octave=${note.octave}`);
          // }

          timeline.push({
            type: 'note',
            startBeat: beatPosition,
            endBeat: beatPosition + noteDuration,
            note: note,
            duration: noteDuration,
            noteIndex: noteIndex,
          });
        });

        // Sort timeline by start position
        timeline.sort((a, b) => a.startBeat - b.startBeat);

        // Fill gaps with rests to create complete rhythm
        const completeTimeline: TimelineItem[] = [];
        let currentBeat = 0;

        for (const item of timeline) {
          // Add rest if there's a gap before this note
          if (item.startBeat > currentBeat + 0.001) {
            const restDuration = item.startBeat - currentBeat;
            const restDurations = convertDurationToRests(restDuration);

            restDurations.forEach((restDur) => {
              completeTimeline.push({
                type: 'rest',
                duration: restDur,
                startBeat: currentBeat,
              });
              // Update currentBeat based on rest duration
              const restBeats =
                restDur === 'w'
                  ? 4
                  : restDur === 'h'
                    ? 2
                    : restDur === 'q'
                      ? 1
                      : restDur === '8'
                        ? 0.5
                        : restDur === '16'
                          ? 0.25
                          : restDur === '32'
                            ? 0.125
                            : 1;
              currentBeat += restBeats;
            });
          }

          // Add the note (item already contains noteIndex from timeline creation)
          completeTimeline.push(item);
          currentBeat = Math.max(currentBeat, item.endBeat || item.startBeat);
        }

        // Add final rest to complete the measure if needed
        if (currentBeat < beatsPerMeasure - 0.001) {
          const finalRestDuration = beatsPerMeasure - currentBeat;
          const restDurations = convertDurationToRests(finalRestDuration);

          restDurations.forEach((restDur) => {
            completeTimeline.push({
              type: 'rest',
              duration: restDur,
              startBeat: currentBeat,
            });
          });
        }

        // Convert timeline to VexFlow notes
        const vexFlowNotes = completeTimeline.map((item) => {
          if (item.type === 'note' && item.note) {
            const noteKey = convertNoteToVexFlow(item.note);
            const duration = convertNoteDurationToVexFlow(
              item.note.duration || 'quarter',
            );

            const staveNote = new VF.StaveNote({
              clef: 'bass',
              keys: [noteKey],
              duration: duration,
            });

            // Add current note highlighting or default black color
            // Find the note's actual index in the exerciseNotes array
            const noteIndex =
              item.noteIndex !== undefined
                ? item.noteIndex
                : exerciseNotes.findIndex((n) => n === item.note);
            // Highlighting will be based on unified position later
            const shouldHighlight = false; // Will be set during final rendering based on unified position

            // Debug highlighting - show which note should be highlighted
            if (item.noteIndex !== undefined) {
              // logger.info(`Note ${noteIndex} in measure ${i} will get unified position`);
            }

            // Always set initial black style
            staveNote.setStyle({
              fillStyle: '#000000',
              strokeStyle: '#000000',
            });

            // Store highlighting info on the note for post-render application
            (staveNote as any)._shouldHighlight = shouldHighlight;
            (staveNote as any)._noteIndex = noteIndex;

            // Store note data for click handling with unified position
            const absoluteBeat = item.startBeat + i * beatsPerMeasure;
            (staveNote as any)._clickData = {
              type: 'note',
              measureIndex: i,
              noteIndex: noteIndex,
              startBeat: absoluteBeat,
              note: item.note,
              unifiedIndex: -1, // Will be set later when processing all notes/rests
            };

            return staveNote;
          } else {
            // Create rest
            const restNote = new VF.StaveNote({
              clef: 'bass',
              keys: ['d/3'],
              duration: item.duration + 'r',
            });

            restNote.setStyle({
              fillStyle: '#000000',
              strokeStyle: '#000000',
            });

            // Store rest data for click handling with unified position
            const absoluteBeat = item.startBeat + i * beatsPerMeasure;
            (restNote as any)._clickData = {
              type: 'rest',
              measureIndex: i,
              startBeat: absoluteBeat,
              duration: item.duration,
              unifiedIndex: -1, // Will be set later when processing all notes/rests
            };

            return restNote;
          }
        });

        vexFlowMeasures.push(vexFlowNotes);
      }

      // Create unified position index for all elements (notes and rests)
      let unifiedPositionIndex = 0;
      const unifiedPositions = new Map(); // Maps unified index to element info

      // Create voices for all measures - EXACT same approach as FretboardCard
      const voices = [];
      const allVexFlowNotes = []; // Keep track of all notes/rests for later DOM mapping

      for (
        let measureIndex = 0;
        measureIndex < vexFlowMeasures.length;
        measureIndex++
      ) {
        if (measureIndex < vexFlowMeasures.length) {
          const voice = new VF.Voice({
            num_beats: beatsPerMeasure,
            beat_value: timeSignature.denominator,
          });

          // Use SOFT mode to handle incomplete measures
          voice.setMode(VF.Voice.Mode.SOFT);

          const measureNotes = vexFlowMeasures[measureIndex];
          if (measureNotes && measureNotes.length > 0) {
            voice.addTickables(measureNotes);
            voices.push(voice);
            // Store all notes/rests with their click data and VexFlow note object
            measureNotes.forEach((note, noteIdx) => {
              if (note && (note as any)._clickData) {
                // Assign unified position index
                (note as any)._clickData.unifiedIndex = unifiedPositionIndex;

                // Store position info for later use
                unifiedPositions.set(unifiedPositionIndex, {
                  type: (note as any)._clickData.type,
                  noteIndex: (note as any)._clickData.noteIndex,
                  startBeat: (note as any)._clickData.startBeat,
                  measureIndex: (note as any)._clickData.measureIndex,
                });

                allVexFlowNotes.push({
                  vfNote: note,
                  clickData: (note as any)._clickData,
                });

                unifiedPositionIndex++;
              }
            });
          }
        }
      }

      // Format each voice individually - EXACT same approach as FretboardCard
      if (voices.length > 0) {
        for (let i = 0; i < voices.length; i++) {
          const voice = voices[i];
          if (!voice) continue;

          // Create formatter with professional spacing settings
          const formatter = new VF.Formatter({ softmaxFactor: 5 });
          formatter.joinVoices([voice]);

          // Calculate available width for notes (account for clef/time signature in first measure)
          const measureWidth = measureWidths[i] || 0;
          const availableWidth =
            i === 0
              ? measureWidth - 80 // First measure: subtract space for clef + time signature
              : measureWidth - 20; // Other measures: just padding

          // Use industry-standard proportional spacing
          formatter.format([voice], availableWidth);
          const stave = staves[i];
          if (stave) {
            voice.draw(context, stave);
          }
        }
      }

      // After all rendering is complete, map click data to DOM elements
      // This ensures rests and notes can be properly clicked
      setTimeout(() => {
        const svg = container.querySelector('svg');
        if (svg && allVexFlowNotes.length > 0) {
          // Find all StaveNote elements (both notes and rests)
          const renderedGroups = svg.querySelectorAll('g.vf-stavenote');

          logger.debug(
            `Mapping data: ${allVexFlowNotes.length} notes to ${renderedGroups.length} DOM elements`,
          );

          // Map the rendered elements to our click data
          // VexFlow renders in the same order we created the notes
          renderedGroups.forEach((group, index) => {
            if (index < allVexFlowNotes.length) {
              const { clickData, vfNote } = allVexFlowNotes[index];
              // Store data directly on the SVG element using setAttribute
              group.setAttribute('data-click-type', clickData.type);
              group.setAttribute(
                'data-start-beat',
                clickData.startBeat.toString(),
              );
              group.setAttribute(
                'data-note-index',
                clickData.noteIndex !== undefined
                  ? clickData.noteIndex.toString()
                  : '',
              );
              group.setAttribute(
                'data-measure-index',
                clickData.measureIndex.toString(),
              );
              group.setAttribute(
                'data-unified-index',
                clickData.unifiedIndex.toString(),
              );

              if (clickData.type === 'rest') {
                group.setAttribute(
                  'data-duration',
                  clickData.duration?.toString() || '',
                );
              }

              // Also mark as clickable to help with debugging
              group.setAttribute('data-clickable', 'true');
            }
          });

          logger.debug(
            `Mapped ${renderedGroups.length} elements to click data`,
          );

          // Only emit the custom event once per render
          if (!container.dataset.vexflowMapped) {
            container.dataset.vexflowMapped = 'true';
            // Emit a custom event to signal that data mapping is complete
            container.dispatchEvent(
              new CustomEvent('vexflow-data-mapped', {
                detail: { noteCount: renderedGroups.length },
              }),
            );
          }

          // Rest rendering debug (disabled - we found the issue)
          // logger.info('=== VEXFLOW RENDERING DEBUG ===');
          // logger.info(`Created ${allVexFlowNotes.length} VexFlow elements`);
          // const restCount = allVexFlowNotes.filter(n => n.clickData.type === 'rest').length;
          // logger.info(`Including ${restCount} rests`);

          // 2. Analyze all SVG elements to find rests
          const allElements = svg.querySelectorAll('*');
          const potentialRests = [];

          allElements.forEach((el, index) => {
            const tagName = el.tagName.toLowerCase();
            const className = el.getAttribute('class') || '';
            const id = el.getAttribute('id') || '';
            const transform = el.getAttribute('transform') || '';
            const innerHTML = el.innerHTML || '';

            // Look for any indication this might be a rest
            if (
              className.includes('rest') ||
              id.includes('rest') ||
              innerHTML.includes('rest') ||
              (tagName === 'g' &&
                transform &&
                !el.querySelector('.vf-notehead') &&
                el.querySelector('path'))
            ) {
              potentialRests.push({
                index,
                element: el,
                tag: tagName,
                class: className,
                id: id,
                transform: transform,
                parent: el.parentElement?.tagName,
                parentClass: el.parentElement?.getAttribute('class'),
                hasPath: !!el.querySelector('path'),
                pathCount: el.querySelectorAll('path').length,
                innerHTML: innerHTML.substring(0, 100),
              });
            }
          });

          // logger.info('Potential rest elements found:', potentialRests);

          // 3. Compare notes vs rests structure
          const noteExample = svg.querySelector(
            'g.vf-stavenote:has(.vf-notehead)',
          );
          const nonNoteExample = svg.querySelector(
            'g.vf-stavenote:not(:has(.vf-notehead))',
          );

          if (noteExample && nonNoteExample) {
            // logger.info('Note vs Non-note comparison:', {
            //   note: {
            //     class: noteExample.getAttribute('class'),
            //     childCount: noteExample.children.length,
            //     hasNotehead: !!noteExample.querySelector('.vf-notehead'),
            //     innerHTML: noteExample.innerHTML.substring(0, 100)
            //   },
            //   nonNote: {
            //     class: nonNoteExample.getAttribute('class'),
            //     childCount: nonNoteExample.children.length,
            //     hasNotehead: !!nonNoteExample.querySelector('.vf-notehead'),
            //     innerHTML: nonNoteExample.innerHTML.substring(0, 100)
            //   }
            // });
          }

          // 4. List all g.vf-stavenote elements with details
          const allStaveNotes = svg.querySelectorAll('g.vf-stavenote');
          // logger.info('All g.vf-stavenote elements:', {
          //   count: allStaveNotes.length,
          //   elements: Array.from(allStaveNotes).map((g, i) => ({
          //     index: i,
          //     hasNotehead: !!g.querySelector('.vf-notehead'),
          //     pathCount: g.querySelectorAll('path').length,
          //     transform: g.getAttribute('transform'),
          //     firstPath: g.querySelector('path')?.getAttribute('d')?.substring(0, 50)
          //   }))
          // });
        }
      }, 10); // Small delay to ensure DOM is ready
    } catch (error) {
      logger.error('Failed to render notation:', error);

      // Ultimate fallback: display error message
      container.innerHTML = `<div style="padding: 20px; text-align: center; color: #666;">Unable to display sheet music</div>`;
    }
  };

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
    <>
      <style jsx>{`
        /* Ensure highlighted notes stay blue */
        .highlighted-note path,
        .highlighted-note rect,
        .highlighted-note circle,
        .highlighted-note ellipse,
        .highlighted-note polygon,
        .highlighted-note line {
          fill: #3b82f6 !important;
          stroke: #3b82f6 !important;
        }

        .slider-thumb {
          --webkit-appearance: none;
          appearance: none;
          /* Remove transition for smoother real-time updates */
        }
        .slider-thumb::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 16px;
          height: 16px;
          background: #64748b;
          border-radius: 50%;
          cursor: grab;
          box-shadow:
            2px 2px 4px rgba(0, 0, 0, 0.6),
            -2px -2px 4px rgba(255, 255, 255, 0.15);
          /* Reduce transition duration for more responsive feel */
          transition:
            transform 0.05s ease,
            box-shadow 0.05s ease;
        }
        .slider-thumb::-webkit-slider-thumb:hover {
          background: #3b82f6;
          transform: scale(1.15);
          box-shadow:
            3px 3px 6px rgba(0, 0, 0, 0.7),
            -3px -3px 6px rgba(255, 255, 255, 0.2);
        }
        .slider-thumb::-webkit-slider-thumb:active {
          cursor: grabbing;
          background: #2563eb;
          transform: scale(1.25);
          box-shadow:
            inset 2px 2px 4px rgba(0, 0, 0, 0.6),
            inset -2px -2px 4px rgba(255, 255, 255, 0.15);
        }
        .slider-thumb::-moz-range-thumb {
          width: 16px;
          height: 16px;
          background: #64748b;
          border-radius: 50%;
          cursor: grab;
          border: none;
          box-shadow:
            2px 2px 4px rgba(0, 0, 0, 0.6),
            -2px -2px 4px rgba(255, 255, 255, 0.15);
          /* Reduce transition duration for more responsive feel */
          transition:
            transform 0.05s ease,
            box-shadow 0.05s ease;
        }
        .slider-thumb::-moz-range-thumb:hover {
          background: #3b82f6;
          transform: scale(1.15);
          box-shadow:
            3px 3px 6px rgba(0, 0, 0, 0.7),
            -3px -3px 6px rgba(255, 255, 255, 0.2);
        }
        .slider-thumb::-moz-range-thumb:active {
          cursor: grabbing;
          background: #2563eb;
          transform: scale(1.25);
          box-shadow:
            inset 2px 2px 4px rgba(0, 0, 0, 0.6),
            inset -2px -2px 4px rgba(255, 255, 255, 0.15);
        }

        /* Optimize slider track for performance */
        .slider-thumb::-webkit-slider-runnable-track {
          will-change: auto;
        }
        .slider-thumb::-moz-range-track {
          will-change: auto;
        }
      `}</style>

      {/* Global Controls - Neumorphic style matching subwidgets */}
      <div className="bg-slate-800 rounded-2xl p-4 shadow-[inset_2px_2px_5px_rgba(0,0,0,0.5),inset_-2px_-2px_5px_rgba(255,255,255,0.1)]">
        {/* Two-Row Player Layout */}
        <div className="flex flex-col gap-3">
          {/* First Row - Mode Button, Playback Controls, View Button */}
          <div className="flex items-center justify-between">
            {/* Left Side - 3D Mode Toggle */}
            <div className="flex justify-center items-center py-2 w-24">
              <button
                onClick={onToggle3DMode}
                className="px-3 py-2 rounded-xl bg-slate-800 text-sm font-medium transition-all duration-300 shadow-[3px_3px_6px_rgba(0,0,0,0.5),-3px_-3px_6px_rgba(255,255,255,0.1)] hover:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.5),inset_-2px_-2px_5px_rgba(255,255,255,0.1)] text-slate-300"
              >
                {is3DMode ? '2D Mode' : '3D Mode'}
              </button>
            </div>

            {/* Center - Playback Controls */}
            <div className="flex items-center justify-center gap-4">
              <button className="p-2 rounded-full bg-slate-800 shadow-[3px_3px_6px_rgba(0,0,0,0.5),-3px_-3px_6px_rgba(255,255,255,0.1)] hover:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5),inset_-2px_-2px_4px_rgba(255,255,255,0.1)] transition-all duration-200">
                <Heart className="w-4 h-4 text-slate-400" />
              </button>
              <button className="p-2 rounded-full bg-slate-800 shadow-[3px_3px_6px_rgba(0,0,0,0.5),-3px_-3px_6px_rgba(255,255,255,0.1)] hover:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5),inset_-2px_-2px_4px_rgba(255,255,255,0.1)] transition-all duration-200">
                <SkipBack className="w-4 h-4 text-slate-300" />
              </button>
              <button
                onClick={handlePlayButtonClick}
                className="rounded-full bg-blue-500 shadow-[4px_4px_8px_rgba(0,0,0,0.5),-4px_-4px_8px_rgba(255,255,255,0.1)] hover:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5),inset_-2px_-2px_4px_rgba(255,255,255,0.1)] transition-all duration-200 flex items-center justify-center"
                style={{ width: '78px', height: '78px' }}
              >
                {transport.isPlaying ? (
                  <Square className="w-5 h-5 text-white" />
                ) : (
                  <Play className="w-5 h-5 ml-0.5 text-white" />
                )}
              </button>
              <button className="p-2 rounded-full bg-slate-800 shadow-[3px_3px_6px_rgba(0,0,0,0.5),-3px_-3px_6px_rgba(255,255,255,0.1)] hover:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5),inset_-2px_-2px_4px_rgba(255,255,255,0.1)] transition-all duration-200">
                <SkipForward className="w-4 h-4 text-slate-300" />
              </button>
              <button className="p-2 rounded-full bg-slate-800 shadow-[3px_3px_6px_rgba(0,0,0,0.5),-3px_-3px_6px_rgba(255,255,255,0.1)] hover:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5),inset_-2px_-2px_4px_rgba(255,255,255,0.1)] transition-all duration-200">
                <Star className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            {/* Right Side - View Button */}
            <div className="flex justify-center items-center py-2 w-24">
              {/* Single Toggle Button */}
              {is3DMode ? (
                /* 3D Mode: Camera Controls Toggle */
                <button
                  onClick={() =>
                    onCameraModeChange?.(
                      cameraMode === 'overview' ? 'action' : 'overview',
                    )
                  }
                  className="px-3 py-2 rounded-xl bg-slate-800 text-sm font-medium transition-all duration-300 shadow-[3px_3px_6px_rgba(0,0,0,0.5),-3px_-3px_6px_rgba(255,255,255,0.1)] hover:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.5),inset_-2px_-2px_5px_rgba(255,255,255,0.1)] text-blue-400"
                >
                  {cameraMode === 'overview' ? 'Overview' : 'Action'}
                </button>
              ) : (
                /* 2D Mode: Tilt Controls Toggle */
                <button
                  onClick={() => onTiltAngleChange?.(tiltAngle === 35 ? 0 : 35)}
                  className="px-3 py-2 rounded-xl bg-slate-800 text-sm font-medium transition-all duration-300 shadow-[3px_3px_6px_rgba(0,0,0,0.5),-3px_-3px_6px_rgba(255,255,255,0.1)] hover:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.5),inset_-2px_-2px_5px_rgba(255,255,255,0.1)] text-green-400"
                >
                  {tiltAngle === 35 ? 'Overview' : 'Flat'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Hidden file input for sheet player toolbar */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".xml,.musicxml,.mid,.midi"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />

        {/* Sheet Music Section - Integrated within the same panel */}
        <div className="mt-4 border-t border-slate-700/30 pt-4">
          {/* VexFlow Sheet Music */}
          {exerciseNotes.length > 0 ? (
            <div
              ref={scrollContainerRef}
              className="w-full overflow-x-auto scrollbar-hide"
              style={{
                maxHeight: '250px',
                borderRadius: '28px',
                background: 'linear-gradient(135deg, #bfbfbf 0%, #d1d1d1 100%)',
                boxShadow:
                  'inset 5px 5px 10px #b3b3b3, inset -5px -5px 10px #dfdfdf',
                position: 'relative',
                zIndex: 1,
                isolation: 'isolate',
              }}
              onScroll={(e) => {
                // Save scroll position only when not playing
                if (!transport.isPlaying) {
                  savedScrollPosition.current = e.currentTarget.scrollLeft;
                }
              }}
            >
              <div
                ref={containerRef}
                className="min-w-full"
                style={{
                  minHeight: '120px',
                  padding: '16px 16px 16px 16px',
                  position: 'relative',
                  pointerEvents: 'auto',
                  // Ensure clicks are properly handled
                  cursor: 'default',
                }}
              />
            </div>
          ) : (
            <div
              className="flex items-center justify-center h-32 flex-col gap-4"
              style={{
                borderRadius: '28px',
                background: 'linear-gradient(135deg, #bfbfbf 0%, #d1d1d1 100%)',
                boxShadow:
                  'inset 5px 5px 10px #b3b3b3, inset -5px -5px 10px #dfdfdf',
              }}
            >
              <span className="text-slate-600 text-sm">
                No exercise selected
              </span>
            </div>
          )}

          {/* Sheet Player Toolbar */}
          <SheetPlayerToolbar
            exercise={activeExercise}
            onImport={handleToolbarImport}
            onSave={handleToolbarSave}
            onExportPDF={handleToolbarExportPDF}
            disabled={false}
          />
        </div>
      </div>
    </>
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
    is3DMode: prevProps.is3DMode === nextProps.is3DMode,
    tiltAngle: prevProps.tiltAngle === nextProps.tiltAngle,
    hasSelectedDots: prevProps.hasSelectedDots === nextProps.hasSelectedDots,
    cameraMode: prevProps.cameraMode === nextProps.cameraMode,
    loopRegion:
      JSON.stringify(prevProps.loopRegion) ===
      JSON.stringify(nextProps.loopRegion),
    isLoopEnabled: prevProps.isLoopEnabled === nextProps.isLoopEnabled,
    // Check callback references
    onToggle3DMode: prevProps.onToggle3DMode === nextProps.onToggle3DMode,
    onTiltAngleChange:
      prevProps.onTiltAngleChange === nextProps.onTiltAngleChange,
    onCameraModeChange:
      prevProps.onCameraModeChange === nextProps.onCameraModeChange,
  };

  const allEqual = Object.values(checks).every((check) => check);

  // Log what changed every 10th check
  if (!allEqual && globalControlsRenderCount % 10 === 0) {
    const changedProps = Object.entries(checks)
      .filter(([_, equal]) => !equal)
      .map(([key]) => key);
    logger.info('🎯 GlobalControls props changed:', {
      changedProps,
      renderCount: globalControlsRenderCount,
    });
  }

  return allEqual;
};

// Export the memoized component
export const GlobalControls = React.memo(
  GlobalControlsComponent,
  arePropsEqual,
);
