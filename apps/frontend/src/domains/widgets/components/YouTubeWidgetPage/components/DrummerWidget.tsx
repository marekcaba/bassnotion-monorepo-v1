'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { VolumeKnob } from './VolumeKnob';
import { useTrack } from '@/domains/playback/hooks/useTrack';
import { useTransportContext } from '@/domains/playback/contexts/TransportContext';
import {
  ensureAudioContext,
  withAudioContext,
} from '@/domains/playback/utils/ensureAudioContext';
import { getLogger } from '@/utils/logger.js';
import type { Exercise } from '@bassnotion/contracts';
import {
  useTransportPosition,
  positionToBeatIndex,
} from '@/domains/widgets/hooks/useTransportPosition';
import type {
  DrumPattern,
  DrumPatternEvent,
} from '@/domains/playback/types/pattern';
import { toMusicalPosition } from '@/domains/playback/types/pattern';
import { EventBus } from '@/domains/playback/services/core/EventBus';
import { useCorrelation } from '@/shared/hooks/useCorrelation';
import { usePatternSelector } from '@/domains/patterns/hooks/usePatternSelector';
import { Settings2, Music2 } from 'lucide-react';
import { WindowRegistry } from '@/domains/playback/services/WindowRegistry.js';

interface DrummerWidgetProps {
  pattern: string;
  isVisible: boolean;
  isPlaying: boolean;
  exercise?: Exercise;
  tutorialId?: string;
  onPatternChange: (pattern: string) => void;
  onToggleVisibility?: () => void;
  onTogglePlay?: () => void;
  isAdminMode?: boolean;
}

// Drum pattern presets
const drumPatterns = {
  'Rock Steady': {
    kick: [1, 0, 0, 0, 1, 0, 0, 0],
    snare: [0, 0, 1, 0, 0, 0, 1, 0],
    hihat: [1, 1, 1, 1, 1, 1, 1, 1],
  },
  'Jazz Swing': {
    kick: [1, 0, 0, 0, 0, 0, 1, 0],
    snare: [0, 0, 0, 0, 1, 0, 0, 0],
    hihat: [1, 0, 1, 1, 0, 1, 1, 0],
  },
  'Bossa Nova': {
    kick: [1, 0, 0, 1, 0, 0, 1, 0],
    snare: [0, 0, 1, 0, 0, 1, 0, 0],
    hihat: [1, 0, 1, 0, 1, 0, 1, 0],
  },
  'Funk Groove': {
    kick: [1, 0, 0, 1, 0, 0, 1, 0],
    snare: [0, 1, 0, 1, 0, 0, 1, 0],
    hihat: [1, 1, 0, 1, 1, 0, 1, 1],
  },
  Latin: {
    kick: [1, 0, 0, 1, 0, 1, 0, 0],
    snare: [0, 0, 1, 0, 1, 0, 1, 0],
    hihat: [1, 1, 1, 0, 1, 1, 1, 0],
  },
  Shuffle: {
    kick: [1, 0, 1, 0, 1, 0, 1, 0],
    snare: [0, 0, 1, 0, 0, 0, 1, 0],
    hihat: [1, 0, 1, 1, 0, 1, 1, 0],
  },
};

const logger = getLogger('drummer-widget');

/**
 * Map MIDI note numbers to drum types (General MIDI drum map)
 */
const MIDI_DRUM_MAP: Record<number, 'kick' | 'snare' | 'hihat'> = {
  36: 'kick',  // Bass Drum 1
  35: 'kick',  // Acoustic Bass Drum
  38: 'snare', // Acoustic Snare
  40: 'snare', // Electric Snare
  42: 'hihat', // Closed Hi-Hat
  44: 'hihat', // Pedal Hi-Hat
  46: 'hihat', // Open Hi-Hat
};

/**
 * Convert parsed MIDI data to DrumPattern format
 */
function convertMidiToDrumPattern(parsedData: any): DrumPattern {
  const pattern: DrumPattern = {
    id: 'drum-pattern-from-midi',
    events: [],
    loopLength: parsedData.metadata?.totalBars || 2,
  };

  logger.info('🥁 Converting MIDI to drum pattern', {
    totalBars: parsedData.metadata?.totalBars,
    measureCount: parsedData.measures?.length,
    timeSignature: parsedData.metadata?.timeSignature,
  });

  // Process each measure
  parsedData.measures?.forEach((measure: any, measureIndex: number) => {
    measure.notes?.forEach((note: any) => {
      // Map MIDI note to drum type
      const drumType = MIDI_DRUM_MAP[note.pitch];

      if (drumType) {
        // Calculate position within the measure
        const timeInMeasure = note.time - measure.startTime;
        const measureDuration = measure.endTime - measure.startTime;
        const beatsPerMeasure = parsedData.metadata?.timeSignature?.numerator || 4;
        const beatDuration = measureDuration / beatsPerMeasure;

        const beat = Math.floor(timeInMeasure / beatDuration);
        const sixteenth = Math.floor(((timeInMeasure % beatDuration) / beatDuration) * 16);

        const event: DrumPatternEvent = {
          position: {
            measure: measureIndex,
            beat: beat,
            subdivision: sixteenth,
            tick: 0, // Drums typically use 16th note precision
          },
          drum: drumType,
          velocity: note.velocity / 127, // Normalize from 0-127 to 0-1
          duration: '16n',
        };

        pattern.events.push(event);
        logger.info(`🥁 Added drum event: ${drumType} at ${measureIndex}:${beat}:${sixteenth}`, {
          velocity: event.velocity.toFixed(2),
          position: event.position,
        });
      }
    });
  });

  logger.info(`🥁 Drum pattern created with ${pattern.events.length} events`);
  return pattern;
}

const DrummerWidgetComponent = ({
  pattern,
  isVisible,
  isPlaying: isPlayingProp,
  exercise,
  tutorialId,
  onPatternChange,
  onToggleVisibility,
  onTogglePlay,
  isAdminMode = false,
}: DrummerWidgetProps) {
  const { correlationId, logger: componentLogger } =
    useCorrelation('DrummerWidget');

  // DEBUG: Log exercise object to understand what we're receiving
  useEffect(() => {
    if (exercise) {
      console.log('🥁 DrummerWidget received exercise:', {
        id: exercise.id,
        title: exercise.title,
        drummerMidiUrl: exercise.drummerMidiUrl,
        hasDrummerMidi: exercise.hasDrummerMidi?.(),
        fullExercise: exercise,
      });
    }
  }, [exercise?.id]);

  // Get tempo directly from Transport (single source of truth)
  const transport = useTransportContext();
  const tempo = transport.tempo;

  // Store transport in ref to prevent infinite loops (transport object changes every render)
  const transportRef = useRef(transport);
  useEffect(() => {
    transportRef.current = transport;
  }, [transport]);

  const [currentBeat, setCurrentBeat] = useState(0);
  const [isTransportPlaying, setIsTransportPlaying] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showPatternLibrary, setShowPatternLibrary] = useState(false);
  const [volume, setVolume] = useState(80);
  const [isMuted, setIsMuted] = useState(false);
  const [currentPattern, setCurrentPattern] = useState(
    drumPatterns[pattern as keyof typeof drumPatterns] ||
      drumPatterns['Rock Steady'],
  );
  const [audioServicesReady, setAudioServicesReady] = useState(false);
  const [pluginLoadAttempts, setPluginLoadAttempts] = useState(0);

  // Create a track for drums
  const track = useTrack({
    trackId: 'drummer-widget-track',
    name: 'Drums',
    type: 'drums',
    debugMode: false,
  });

  // Extract track.isReady to prevent infinite loops (track object changes every render)
  const trackIsReady = track.isReady;

  // Store track in ref to access methods without triggering re-renders
  const trackRef = useRef(track);
  useEffect(() => {
    trackRef.current = track;
  }, [track]);

  // We'll load the plugin manually - MUST be declared before any effects that use it
  const [wamPluginLoaded, setWamPluginLoaded] = useState(false);
  const [pluginClassLoaded, setPluginClassLoaded] = useState(false);

  // Reference to the plugin class and instance
  const wamPluginClassRef = useRef<any>(null);
  const drummerPluginRef = useRef<any>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentRegionRef = useRef<string | null>(null);

  // Use pattern selector hook if tutorialId is provided
  const patternSelector = tutorialId ? usePatternSelector({
    tutorialId,
    onPatternChange: (type, pattern) => {
      if (type === 'drums' && pattern.midiData) {
        // Convert pattern library format to widget format
        handlePatternLibraryChange(pattern);
      }
    }
  }) : null;

  // DISABLED: DrummerWidget should NOT load MIDI independently
  // GlobalControls is responsible for loading exercise data and adding regions to tracks
  // This prevents race conditions and ensures the new architecture (pre-converted drum patterns) works correctly
  //
  // Previous behavior: Widget downloaded and parsed MIDI itself, creating regions independently
  // New behavior: Widget only displays regions created by GlobalControls
  //
  // Load MIDI from exercise when exercise prop changes
  // useEffect(() => {
  //   if (!exercise?.drummerMidiUrl || !wamPluginLoaded) return;
  //
  //   const loadExerciseMidi = async () => {
  //     try {
  //       componentLogger.info('Loading drum MIDI from exercise', {
  //         exerciseId: exercise.id,
  //         midiUrl: exercise.drummerMidiUrl,
  //         correlationId
  //       });
  //
  //       // Import MIDI parsing hook
  //       const { useMidiParsing } = await import('@/domains/admin/hooks/useMidiParsing');
  //
  //       // Create a temporary hook instance (not ideal but works outside React component)
  //       const parseMidi = async (midiUrl: string) => {
  //         const response = await fetch('/api/v1/midi/parse', {
  //           method: 'POST',
  //           headers: { 'Content-Type': 'application/json' },
  //           body: JSON.stringify({
  //             midiUrl,
  //             bpm: tempo,
  //             timeSignature: { numerator: 4, denominator: 4 },
  //             totalBars: 2,
  //           }),
  //         });
  //
  //         if (!response.ok) {
  //           throw new Error(`MIDI parsing failed: ${response.statusText}`);
  //         }
  //
  //         return response.json();
  //       };
  //
  //       const parsedData = await parseMidi(exercise.drummerMidiUrl);
  //
  //       // Convert parsed MIDI notes to drum pattern
  //       const drumPattern = convertMidiToDrumPattern(parsedData);
  //
  //       // Update track with new pattern
  //       const currentTrack = trackRef.current;
  //       if (currentTrack?.createRegionFromPattern && currentRegionRef.current) {
  //         currentTrack.removeRegion(currentRegionRef.current);
  //         const region = currentTrack.createRegionFromPattern(drumPattern, {
  //           name: 'Drum Pattern',
  //           startPosition: '0:0:0',
  //           duration: `${drumPattern.loopLength}:0:0`,
  //           loopCount: 0,
  //         });
  //         currentRegionRef.current = region.id;
  //
  //         // Update RegionProcessor with new MIDI-loaded pattern
  //         const globalServices = (window as any).__globalCoreServices || (window as any).__coreServices;
  //         if (globalServices && globalServices.getRegionProcessor) {
  //           const regionProcessor = globalServices.getRegionProcessor();
  //           regionProcessor.updateTracks([{
  //             id: 'drummer-widget-track',
  //             name: 'Drums',
  //             instrumentType: 'drums',
  //             regions: [{
  //               id: region.id,
  //               trackId: 'drummer-widget-track',
  //               startTime: 0,
  //               duration: drumPattern.loopLength * 4,
  //               pattern: {
  //                 id: 'drum-pattern-from-midi',
  //                 name: 'Drum Pattern',
  //                 type: 'drums',
  //                 events: drumPattern.events
  //               }
  //             }]
  //           }]);
  //         }
  //
  //         componentLogger.info('Loaded drum pattern from exercise MIDI', {
  //           exerciseId: exercise.id,
  //           events: drumPattern.events.length,
  //           loopLength: drumPattern.loopLength,
  //           correlationId
  //         });
  //       }
  //     } catch (error) {
  //       componentLogger.error('Failed to load exercise MIDI', error instanceof Error ? error : new Error(String(error)), {
  //         exerciseId: exercise.id,
  //         correlationId
  //       });
  //     }
  //   };
  //
  //   loadExerciseMidi();
  //   // Note: Removed track from dependencies to prevent infinite loops
  //   // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, [exercise?.id, exercise?.drummerMidiUrl, wamPluginLoaded, tempo, componentLogger, correlationId]);

  // Create drum pattern from current preset
  const createDrumPattern = useCallback(() => {
    const selectedPattern =
      drumPatterns[pattern as keyof typeof drumPatterns] ||
      drumPatterns['Rock Steady'];
    const drumPattern: DrumPattern = {
      id: 'drum-pattern',
      events: [],
      loopLength: 2, // 2 bars (8 beats)
    };

    // Convert pattern arrays to events
    const drums = ['kick', 'snare', 'hihat'] as const;

    drums.forEach((drumType) => {
      const patternArray = selectedPattern[drumType];
      patternArray.forEach((hit, index) => {
        if (hit === 1) {
          const bar = Math.floor(index / 4);
          const beat = index % 4;

          const event: DrumPatternEvent = {
            position: {
              measure: bar,
              beat: beat,
              subdivision: 0,
              tick: 0,
            },
            drum: drumType,
            velocity:
              drumType === 'kick' ? 0.9 : drumType === 'snare' ? 0.8 : 0.6,
            duration: '8n',
          };

          drumPattern.events.push(event);
        }
      });
    });

    return drumPattern;
  }, [pattern]);

  // Phase 1: Load the plugin class (can be done before AudioContext)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (pluginClassLoaded) return;

    const loadPluginClass = async () => {
      logger.debug('Loading plugin class...');

      try {
        // Dynamic import to avoid SSR issues
        const { default: WamDrummer } = await import(
          '@/domains/playback/modules/instruments/adapters/wam/WamDrummer'
        );
        wamPluginClassRef.current = WamDrummer;
        setPluginClassLoaded(true);
        logger.debug('WAM Drummer plugin class loaded successfully');
      } catch (error) {
        logger.error('Failed to load WAM Drummer plugin class:', error);
      }
    };

    loadPluginClass();
  }, [pluginClassLoaded]);

  // Phase 2: Create the audio node when AudioContext is available
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!pluginClassLoaded || !trackIsReady || wamPluginLoaded) return;

    // Add guard to prevent multiple instances
    if (drummerPluginRef.current) {
      logger.debug('Plugin already loaded, skipping creation');
      return;
    }

    const createAudioNode = async () => {
      logger.debug('Attempting to create audio node...', {
        trackIsReady: track.isReady,
        wamPluginLoaded,
        pluginClassLoaded,
      });

      try {
        const WamDrummer = wamPluginClassRef.current;
        if (!WamDrummer) {
          logger.error('Plugin class not loaded');
          return;
        }

        // Get audio context from global audio system
        let context = null;

        // Try to get context from global audio services
        const globalServices = WindowRegistry.getCoreServices();
        if (globalServices && globalServices.getAudioEngine) {
          const audioEngine = globalServices.getAudioEngine();
          if (audioEngine && audioEngine.getContext) {
            try {
              context = audioEngine.getContext();
            } catch (e) {
              logger.debug('AudioEngine not ready yet, will retry...');
              return; // Context not ready yet, will retry
            }
          }
        }

        logger.debug('Got context:', context, {
          type: context?.constructor?.name,
          isAudioContext: context instanceof AudioContext,
          contextState: context?.state,
        });

        if (context && context instanceof AudioContext) {
          // Check if context is running or needs to be resumed
          if (context.state === 'suspended') {
            logger.debug(
              'AudioContext is suspended, waiting for user gesture...',
            );
            // Don't create the audio node yet, wait for audioContextStarted event
            return;
          }

          // Create plugin instance
          const plugin = await WamDrummer.createInstance(context);
          logger.debug('Created plugin instance:', plugin);

          // Store the plugin instance for later use
          drummerPluginRef.current = plugin;

          // Create the audio node - this is required!
          const audioNode = await plugin.createAudioNode();
          logger.debug('Created audio node:', audioNode);

          // Connect to destination for now
          audioNode.connect(context.destination);
          logger.debug('Connected to audio destination');

          // Store the audio node on the plugin for easy access
          plugin.audioNode = audioNode;

          setWamPluginLoaded(true);

          logger.debug('WAM Drummer plugin loaded and connected');

          // Load default kit using the correct method
          if (plugin.loadDefaultKit) {
            await plugin.loadDefaultKit();
            logger.debug('Default drum kit loaded');
          }

          // Register the plugin with InstrumentRegistry
          if (globalServices && globalServices.getInstrumentRegistry) {
            const instrumentRegistry = globalServices.getInstrumentRegistry();
            instrumentRegistry.setActive('drums', plugin);
            logger.debug('Registered WAM Drummer with InstrumentRegistry');
          }

          // Register initial pattern with track
          const currentTrack = trackRef.current;
          if (currentTrack && currentTrack.createRegionFromPattern) {
            const pattern = createDrumPattern();
            const region = currentTrack.createRegionFromPattern(pattern, {
              name: 'Drum Pattern',
              startPosition: '0:0:0',
              duration: `${pattern.loopLength}:0:0`,
              loopCount: 0, // Infinite loop
            });
            currentRegionRef.current = region.id;
            logger.debug('Registered drum pattern with track', {
              pattern,
              region,
            });

            // Register track with PlaybackEngine to enable pattern playback
            if (globalServices && globalServices.getPlaybackEngine) {
              const playbackEngine = globalServices.getPlaybackEngine();
              if (playbackEngine) {
                playbackEngine.registerTrack({
                  id: 'drummer-widget-track',
                  name: 'Drums',
                  instrumentType: 'drums',
                  regions: [{
                    id: region.id,
                    trackId: 'drummer-widget-track',
                    startTime: 0,
                    duration: pattern.loopLength * 4, // Convert bars to seconds (assuming 4/4 time)
                    pattern: {
                      id: 'drum-pattern',
                      name: 'Drum Pattern',
                      type: 'drums',
                      events: pattern.events
                    }
                  }]
                });
                logger.debug('Registered drum track with PlaybackEngine');
              }
            }
          }
        } else {
          logger.debug('AudioContext not ready yet', {
            hasContext: !!context,
            contextState: context?.state,
          });
        }
      } catch (error) {
        logger.error('Failed to create WAM Drummer audio node:', error);
      }
    };

    createAudioNode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackIsReady, wamPluginLoaded, pluginClassLoaded, pluginLoadAttempts]);

  // Handle volume changes
  useEffect(() => {
    if (drummerPluginRef.current && drummerPluginRef.current.audioNode) {
      const audioNode = drummerPluginRef.current.audioNode;
      if (audioNode.setVolume) {
        audioNode.setVolume(isMuted ? 0 : volume / 100);
        audioNode.setMute(isMuted);
      }
    }
  }, [volume, isMuted]);

  // Listen for audio services ready event
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleAudioReady = () => {
      logger.debug('Audio services ready event received');
      setAudioServicesReady(true);
    };

    // Check if services are already ready
    const globalServices = WindowRegistry.getCoreServices();
    if (globalServices && globalServices.getAudioEngine) {
      try {
        const audioEngine = globalServices.getAudioEngine();
        if (audioEngine && audioEngine.isReady && audioEngine.isReady()) {
          logger.debug('Audio services already ready');
          setAudioServicesReady(true);
        }
      } catch (e) {
        // Not ready yet
      }
    }

    window.addEventListener('audioServicesReady', handleAudioReady);

    // Also listen for audioContext started event
    const handleAudioContextStarted = () => {
      logger.debug('AudioContext started event received');
      // Do nothing - the effect will handle retries
    };
    window.addEventListener('audioContextStarted', handleAudioContextStarted);

    return () => {
      window.removeEventListener('audioServicesReady', handleAudioReady);
      window.removeEventListener(
        'audioContextStarted',
        handleAudioContextStarted,
      );
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, [wamPluginLoaded]);

  // Retry plugin loading when audio services become ready
  useEffect(() => {
    if (audioServicesReady && trackIsReady && !wamPluginLoaded) {
      logger.debug('Audio services ready, retrying plugin load...');
      // Small delay to ensure everything is fully initialized
      retryTimeoutRef.current = setTimeout(() => {
        setWamPluginLoaded(false); // Force a retry by changing the dependency
      }, 100);
    }
  }, [audioServicesReady, trackIsReady, wamPluginLoaded]);

  // Update pattern when selection changes
  useEffect(() => {
    const newPattern =
      drumPatterns[pattern as keyof typeof drumPatterns] ||
      drumPatterns['Rock Steady'];
    setCurrentPattern(newPattern);

    // Update pattern in track when drum pattern changes
    const currentTrack = trackRef.current;
    if (currentTrack && currentTrack.regions && wamPluginLoaded && currentRegionRef.current) {
      const drumPattern = createDrumPattern();
      // Remove old region and create new one
      currentTrack.removeRegion(currentRegionRef.current);
      const region = currentTrack.createRegionFromPattern(drumPattern, {
        name: 'Drum Pattern',
        startPosition: '0:0:0',
        duration: `${drumPattern.loopLength}:0:0`,
        loopCount: 0, // Infinite loop
      });
      currentRegionRef.current = region.id;
      logger.debug('Updated drum pattern', { pattern, drumPattern });
    }
    // Note: createDrumPattern NOT in dependencies - it only depends on pattern prop which IS in deps
    // Including it would cause infinite loops as useCallback creates new ref when pattern changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pattern, wamPluginLoaded]); // Removed track and createDrumPattern from dependencies to prevent loops

  // Note: Drum triggering is handled by the AudioEventRouter service
  // The widget only handles visual updates based on transport position

  // Monitor transport state directly from EventBus
  useEffect(() => {
    const coreServices = WindowRegistry.getCoreServices();
    if (!coreServices || typeof coreServices.getEventBus !== 'function') {
      return;
    }

    const eventBus = coreServices.getEventBus();
    if (!eventBus) {
      return;
    }

    const handleTransportStart = () => {
      componentLogger.debug('Transport started', { correlationId });
      setIsTransportPlaying(true);
    };

    const handleTransportStop = () => {
      componentLogger.debug('Transport stopped', { correlationId });
      setIsTransportPlaying(false);
      setCurrentBeat(0);
    };

    const handleTransportPause = () => {
      componentLogger.debug('Transport paused', { correlationId });
      setIsTransportPlaying(false);
    };

    const unsubStart = eventBus.on('transport:start', handleTransportStart);
    const unsubStop = eventBus.on('transport:stop', handleTransportStop);
    const unsubPause = eventBus.on('transport:pause', handleTransportPause);

    return () => {
      unsubStart();
      unsubStop();
      unsubPause();
    };
  }, []);

  // Cleanup on unmount - remove from InstrumentRegistry
  useEffect(() => {
    return () => {
      const globalServices =
        (window as any).__globalCoreServices ||
        (window as any).__coreServices;
      if (globalServices && globalServices.getInstrumentRegistry) {
        const instrumentRegistry = globalServices.getInstrumentRegistry();
        if (instrumentRegistry.getActive('drums') === drummerPluginRef.current) {
          instrumentRegistry.removeActive('drums');
          logger.debug('Removed WAM Drummer from InstrumentRegistry on unmount');
        }
      }
    };
  }, []);

  // Handle play state changes (simplified - no longer schedules its own pattern)
  useEffect(() => {
    if (!isPlayingProp && !isTransportPlaying) {
      // Reset visual when stopped
      setCurrentBeat(0);
    }
  }, [isPlayingProp, isTransportPlaying]);

  // Use either prop or transport state
  const isPlaying = isPlayingProp || isTransportPlaying;

  // NOTE: Pattern trigger events are handled by AudioEventRouter
  // The widget only needs to create patterns and handle visual updates

  // Subscribe to transport position updates for beat highlighting
  useTransportPosition({
    onPositionUpdate: (position) => {
      // Removed console.log that fires every 50ms - causes performance issues!
      // logger.info('[DrummerWidget] Position update received:', position, 'isPlaying:', isPlaying);

      // COUNTDOWN FIX: Don't update beat indicators during countdown (negative bars)
      // Let the red countdown dots handle the countdown visualization
      if (position.bars < 0) {
        return;
      }

      if (isPlaying) {
        const beatIndex = positionToBeatIndex(position);
        // logger.info('[DrummerWidget] Setting current beat to:', beatIndex);
        setCurrentBeat(beatIndex);
      }
    },
    enabled: isPlaying && isVisible,
  });

  // Test drum function - wrapped with audio context initialization
  const testDrumSound = useCallback(
    withAudioContext(async (padNum: number) => {
      logger.debug('testDrumSound called:', {
        padNum,
        plugin: drummerPluginRef.current,
      });

      // If plugin isn't loaded, trigger a load attempt
      if (!drummerPluginRef.current && !wamPluginLoaded) {
        logger.debug('Plugin not loaded, triggering load attempt...');
        setPluginLoadAttempts((prev) => prev + 1);

        // Wait for plugin to load
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      if (drummerPluginRef.current && drummerPluginRef.current.audioNode) {
        const audioNode = drummerPluginRef.current.audioNode;
        if (audioNode.triggerPad) {
          logger.debug('Triggering pad:', padNum);
          audioNode.triggerPad(padNum, 0.8);
        } else {
          logger.warn(
            'Cannot trigger pad - audio node has no triggerPad method',
          );
        }
      } else {
        logger.warn('Cannot trigger pad - plugin not ready', {
          hasPlugin: !!drummerPluginRef.current,
          hasAudioNode: drummerPluginRef.current?.audioNode,
        });
      }
    }),
    [wamPluginLoaded],
  );

  // Toggle pattern functions - wrapped with audio context initialization
  const toggleDrum = useCallback(
    withAudioContext(
      async (drum: 'kick' | 'snare' | 'hihat', index: number) => {
        setCurrentPattern((prev) => ({
          ...prev,
          [drum]: prev[drum].map((beat, i) =>
            i === index ? (beat ? 0 : 1) : beat,
          ),
        }));

        // Play sound for feedback
        const padMap = { kick: 1, snare: 3, hihat: 5 };
        await testDrumSound(padMap[drum]);
      },
    ),
    [testDrumSound],
  );

  // Handle pattern change from pattern library
  const handlePatternLibraryChange = useCallback(async (libraryPattern: any) => {
    // Load MIDI file from URL
    if (libraryPattern.midiFileUrl) {
      try {
        componentLogger.info('Loading pattern from MIDI:', {
          name: libraryPattern.name,
          url: libraryPattern.midiFileUrl,
          correlationId
        });

        // Load and parse MIDI file using backend API
        const { useMidiParsing } = await import('@/domains/admin/hooks/useMidiParsing');
        const midiParsing = useMidiParsing();

        const parsedData = await midiParsing.parseMidi(
          'drums-midi', // placeholder ID
          {
            midiUrl: libraryPattern.midiFileUrl,
            bpm: tempo,
            timeSignature: { numerator: 4, denominator: 4 },
            totalBars: 2,
          }
        );

        // Convert parsed MIDI notes to drum pattern
        const drumPattern = convertMidiToDrumPattern(parsedData);

        // Update track with new pattern
        const currentTrack = trackRef.current;
        if (currentTrack && currentTrack.createRegionFromPattern && currentRegionRef.current) {
          currentTrack.removeRegion(currentRegionRef.current);
          const region = currentTrack.createRegionFromPattern(drumPattern, {
            name: libraryPattern.name || 'Drum Pattern',
            startPosition: '0:0:0',
            duration: `${drumPattern.loopLength}:0:0`,
            loopCount: 0,
          });
          currentRegionRef.current = region.id;

          // Update PlaybackEngine with new pattern
          const globalServices = WindowRegistry.getCoreServices();
          if (globalServices && globalServices.getPlaybackEngine) {
            const playbackEngine = globalServices.getPlaybackEngine();
            if (playbackEngine) {
              // Unregister old track, then register new one
              playbackEngine.unregisterTrack('drummer-widget-track');
              playbackEngine.registerTrack({
                id: 'drummer-widget-track',
                name: 'Drums',
                instrumentType: 'drums',
                regions: [{
                  id: region.id,
                  trackId: 'drummer-widget-track',
                  startTime: 0,
                  duration: drumPattern.loopLength * 4,
                  pattern: {
                    id: 'drum-pattern',
                    name: libraryPattern.name || 'Drum Pattern',
                    type: 'drums',
                    events: drumPattern.events
                  }
                }]
              });
            }
          }

          componentLogger.info('Updated drum pattern from MIDI', {
            name: libraryPattern.name,
            events: drumPattern.events.length,
            correlationId
          });
        }

        onPatternChange(libraryPattern.name);
      } catch (error) {
        componentLogger.error('Failed to load pattern', error instanceof Error ? error : new Error(String(error)), { correlationId });

        // Fallback to genre-based pattern
        const newPattern = {
          kick: Array(8).fill(0),
          snare: Array(8).fill(0),
          hihat: Array(8).fill(0),
        };

        // Simple pattern generation based on genre
        if (libraryPattern.genre === 'rock') {
          newPattern.kick = [1, 0, 0, 0, 1, 0, 0, 0];
          newPattern.snare = [0, 0, 1, 0, 0, 0, 1, 0];
          newPattern.hihat = [1, 1, 1, 1, 1, 1, 1, 1];
        } else if (libraryPattern.genre === 'jazz') {
          newPattern.kick = [1, 0, 0, 0, 0, 0, 1, 0];
          newPattern.snare = [0, 0, 0, 0, 1, 0, 0, 0];
          newPattern.hihat = [1, 0, 1, 1, 0, 1, 1, 0];
        } else if (libraryPattern.genre === 'funk') {
          newPattern.kick = [1, 0, 0, 1, 0, 0, 1, 0];
          newPattern.snare = [0, 1, 0, 1, 0, 0, 1, 0];
          newPattern.hihat = [1, 1, 0, 1, 1, 0, 1, 1];
        }

        setCurrentPattern(newPattern);
        onPatternChange(libraryPattern.name);
      }
    }
    // Note: Removed track from dependencies to prevent infinite loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onPatternChange, componentLogger, correlationId, tempo]);

  // Don't return null when not visible - we need effects to run for plugin loading
  // Just hide the UI
  if (!isVisible) {
    return <div style={{ display: 'none' }} />;
  }

  return (
    <div
      className={`relative bg-slate-800 rounded-2xl px-4 py-1 h-24 shadow-[inset_2px_2px_5px_rgba(0,0,0,0.5),inset_-2px_-2px_5px_rgba(255,255,255,0.1)] transition-all duration-300 select-none ${
        volume === 0 || isMuted ? 'bg-slate-850 grayscale brightness-100' : ''
      }`}
    >
      <div className="flex items-center justify-between h-full">
        {/* Volume Knob */}
        <div className="flex justify-center items-center w-20 h-16">
          <VolumeKnob
            value={volume}
            onChange={setVolume}
            color="bg-orange-400"
            size={45}
            isMuted={isMuted}
            onMuteToggle={() => setIsMuted(!isMuted)}
          />
        </div>

        {/* Main Content */}
        <div className="flex-1">
          <div className="flex items-center justify-between px-4 py-2">
            {!isExpanded ? (
              <>
                <div className="flex-1">
                  <h3
                    className={`font-semibold text-sm ${volume === 0 ? 'text-slate-600' : 'text-white'}`}
                  >
                    Drums Track
                  </h3>
                  <p
                    className={`text-xs ${volume === 0 ? 'text-slate-600' : 'text-slate-400'}`}
                  >
                    {pattern} | {wamPluginLoaded ? 'Ready' : 'Loading...'}
                  </p>
                </div>

                <button
                  onClick={() => setIsExpanded(true)}
                  className={`flex items-center gap-1 px-3 py-2 rounded-xl bg-slate-800 shadow-[5px_5px_10px_rgba(0,0,0,0.5),-5px_-5px_10px_rgba(255,255,255,0.1)] hover:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.5),inset_-2px_-2px_5px_rgba(255,255,255,0.1)] transition-all duration-300 cursor-pointer ${
                    volume === 0 ? 'opacity-50' : ''
                  }`}
                >
                  {/* Compact beat dots in 3x8 grid */}
                  <div className="grid grid-rows-3 grid-cols-8 gap-1">
                    {/* Hi-hat row */}
                    {currentPattern.hihat.map((beat, idx) => (
                      <div
                        key={`hh-${idx}`}
                        className={`w-2 h-2 rounded-full transition-all duration-200 ${
                          currentBeat === idx && isPlaying
                            ? 'bg-orange-200 shadow-lg shadow-orange-200/50'
                            : beat
                              ? 'bg-orange-500'
                              : 'bg-slate-700'
                        }`}
                      />
                    ))}

                    {/* Snare row */}
                    {currentPattern.snare.map((beat, idx) => (
                      <div
                        key={`sn-${idx}`}
                        className={`w-2 h-2 rounded-full transition-all duration-200 ${
                          currentBeat === idx && isPlaying
                            ? 'bg-orange-200 shadow-lg shadow-orange-200/50'
                            : beat
                              ? 'bg-orange-500'
                              : 'bg-slate-700'
                        }`}
                      />
                    ))}

                    {/* Kick row */}
                    {currentPattern.kick.map((beat, idx) => (
                      <div
                        key={`k-${idx}`}
                        className={`w-2 h-2 rounded-full transition-all duration-200 ${
                          currentBeat === idx && isPlaying
                            ? 'bg-orange-200 shadow-lg shadow-orange-200/50'
                            : beat
                              ? 'bg-orange-500'
                              : 'bg-slate-700'
                        }`}
                      />
                    ))}
                  </div>
                </button>
              </>
            ) : (
              <div className="flex items-center gap-4 w-full">
                <div className="flex-1">
                  <div className="flex flex-col gap-2">
                    {/* Pattern Selector with Library Button */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400 w-16">
                        Pattern:
                      </span>
                      <select
                        value={pattern}
                        onChange={(e) => onPatternChange(e.target.value)}
                        className="flex-1 bg-slate-700 text-white text-xs rounded px-2 py-1"
                      >
                        {Object.keys(drumPatterns).map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </select>
                      {/* Pattern Library Button */}
                      {tutorialId && (
                        <button
                          onClick={() => setShowPatternLibrary(!showPatternLibrary)}
                          className="p-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded transition-colors"
                          title="Browse Pattern Library"
                        >
                          <Music2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    {/* Pattern Library Selector */}
                    {showPatternLibrary && patternSelector && (
                      <div className="p-2 bg-slate-800 rounded-lg border border-slate-700">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-slate-300">Pattern Library</span>
                          <button
                            onClick={() => setShowPatternLibrary(false)}
                            className="text-xs text-slate-500 hover:text-slate-400"
                          >
                            ✕
                          </button>
                        </div>
                        {patternSelector.isLoading ? (
                          <div className="text-xs text-slate-500">Loading patterns...</div>
                        ) : (
                          <div className="space-y-1 max-h-32 overflow-y-auto">
                            {patternSelector.availableDrumPatterns.map((p) => (
                              <button
                                key={p.id}
                                onClick={() => {
                                  patternSelector.selectDrumPattern(p);
                                  handlePatternLibraryChange(p);
                                  setShowPatternLibrary(false);
                                }}
                                className={`w-full text-left p-1.5 text-xs rounded hover:bg-slate-700 transition-colors ${
                                  patternSelector.selectedDrumPattern?.id === p.id
                                    ? 'bg-slate-700 text-orange-400'
                                    : 'text-slate-300'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <span>{p.name}</span>
                                  {p.genre && (
                                    <span className="text-xs text-slate-500">{p.genre}</span>
                                  )}
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Drum pattern grid */}
                    <div className="space-y-1">
                      {/* Hi-hat row */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => testDrumSound(5)}
                          className="text-xs font-mono text-orange-400 w-6 hover:text-orange-300"
                        >
                          HH
                        </button>
                        <div className="grid grid-cols-8 gap-1">
                          {currentPattern.hihat.map((beat, i) => (
                            <button
                              key={i}
                              onClick={() => toggleDrum('hihat', i)}
                              className={`w-4 h-4 rounded-full transition-all duration-200 cursor-pointer hover:scale-110 ${
                                currentBeat === i && isPlaying
                                  ? 'bg-orange-300 shadow-lg shadow-orange-300/50'
                                  : beat
                                    ? 'bg-orange-500'
                                    : 'bg-slate-700'
                              }`}
                            />
                          ))}
                        </div>
                      </div>

                      {/* Snare row */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => testDrumSound(3)}
                          className="text-xs font-mono text-orange-400 w-6 hover:text-orange-300"
                        >
                          SN
                        </button>
                        <div className="grid grid-cols-8 gap-1">
                          {currentPattern.snare.map((beat, i) => (
                            <button
                              key={i}
                              onClick={() => toggleDrum('snare', i)}
                              className={`w-4 h-4 rounded-full transition-all duration-200 cursor-pointer hover:scale-110 ${
                                currentBeat === i && isPlaying
                                  ? 'bg-orange-300 shadow-lg shadow-orange-300/50'
                                  : beat
                                    ? 'bg-orange-500'
                                    : 'bg-slate-700'
                              }`}
                            />
                          ))}
                        </div>
                      </div>

                      {/* Kick row */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => testDrumSound(1)}
                          className="text-xs font-mono text-orange-400 w-6 hover:text-orange-300"
                        >
                          K
                        </button>
                        <div className="grid grid-cols-8 gap-1">
                          {currentPattern.kick.map((beat, i) => (
                            <button
                              key={i}
                              onClick={() => toggleDrum('kick', i)}
                              className={`w-4 h-4 rounded-full transition-all duration-200 cursor-pointer hover:scale-110 ${
                                currentBeat === i && isPlaying
                                  ? 'bg-orange-300 shadow-lg shadow-orange-300/50'
                                  : beat
                                    ? 'bg-orange-500'
                                    : 'bg-slate-700'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <button
                    onClick={async () => {
                      // Play drums in sequence with proper async handling
                      await testDrumSound(1); // kick
                      await new Promise((resolve) => setTimeout(resolve, 200));
                      await testDrumSound(3); // snare
                      await new Promise((resolve) => setTimeout(resolve, 200));
                      await testDrumSound(5); // hihat
                    }}
                    className="px-2 py-1 text-xs bg-orange-600 text-white rounded hover:bg-orange-500 transition-colors"
                    disabled={!trackIsReady}
                  >
                    Test
                  </button>
                  <button
                    onClick={() => setIsExpanded(false)}
                    className="px-2 py-1 text-xs bg-slate-700 text-slate-300 rounded hover:bg-slate-600 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Play Control (if provided) */}
      {onTogglePlay && isExpanded && (
        <div className="absolute bottom-2 right-2">
          <button
            onClick={onTogglePlay}
            className={`px-3 py-1 text-xs rounded font-medium transition-colors ${
              isPlaying
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-green-600 hover:bg-green-700 text-white'
            }`}
            disabled={!trackIsReady}
          >
            {isPlaying ? 'Stop' : 'Play'}
          </button>
        </div>
      )}
    </div>
  );
};

// Phase 5.1: Wrap in React.memo to prevent unnecessary re-renders
// Only re-render when props actually change
export const DrummerWidget = React.memo(DrummerWidgetComponent);
