'use client';

import React, {
  useEffect,
  useState,
  useCallback,
  useRef,
  useMemo,
} from 'react';
import { VolumeKnob } from './VolumeKnob';
import { useTrack } from '@/domains/playback/hooks/useTrack';
import { getLogger } from '@/utils/logger.js';
import type { MusicalPosition } from '@bassnotion/contracts/types/musical-time';
import type { Exercise } from '@bassnotion/contracts';

// Bass articulation types
const BassArticulation = {
  FINGERSTYLE: 'fingerstyle',
  SLAP: 'slap',
  PICK: 'pick',
  MUTE: 'mute',
  HARMONIC: 'harmonic',
} as const;

type BassArticulationType =
  (typeof BassArticulation)[keyof typeof BassArticulation];

interface BassLineWidgetProps {
  pattern: string;
  isVisible: boolean;
  isPlaying: boolean;
  exercise?: Exercise;
  onPatternChange: (pattern: string) => void;
  onToggleVisibility: () => void;
  onTogglePlay?: () => void;
  tempo?: number;
}

// Bass patterns for quick selection
const bassPatterns = {
  'Root-Fifth': [
    { note: 28, string: 1, fret: 0, beat: 0 }, // E1
    { note: 33, string: 2, fret: 0, beat: 1 }, // A1
    { note: 28, string: 1, fret: 0, beat: 2 }, // E1
    { note: 33, string: 2, fret: 0, beat: 3 }, // A1
  ],
  'Walking Bass': [
    { note: 38, string: 2, fret: 5, beat: 0 }, // D2
    { note: 41, string: 2, fret: 8, beat: 1 }, // F2
    { note: 43, string: 3, fret: 0, beat: 2 }, // G2
    { note: 45, string: 3, fret: 2, beat: 3 }, // A2
  ],
  'Chromatic Walk': [
    { note: 28, string: 1, fret: 0, beat: 0 }, // E1
    { note: 29, string: 1, fret: 1, beat: 0.5 }, // F1
    { note: 30, string: 1, fret: 2, beat: 1 }, // F#1
    { note: 31, string: 1, fret: 3, beat: 1.5 }, // G1
    { note: 32, string: 1, fret: 4, beat: 2 }, // G#1
    { note: 33, string: 2, fret: 0, beat: 2.5 }, // A1
    { note: 34, string: 2, fret: 1, beat: 3 }, // Bb1
    { note: 35, string: 2, fret: 2, beat: 3.5 }, // B1
  ],
  Octaves: [
    { note: 38, string: 2, fret: 5, beat: 0 }, // D2
    { note: 50, string: 3, fret: 7, beat: 1 }, // D3
    { note: 38, string: 2, fret: 5, beat: 2 }, // D2
    { note: 50, string: 3, fret: 7, beat: 3 }, // D3
  ],
  'Funky Slap': [
    { note: 28, string: 1, fret: 0, beat: 0, articulation: 'slap' }, // E1 slap
    { note: 40, string: 1, fret: 12, beat: 0.25, articulation: 'slap' }, // E2 ghost
    { note: 33, string: 2, fret: 0, beat: 0.5, articulation: 'slap' }, // A1 slap
    { note: 28, string: 1, fret: 0, beat: 1.5, articulation: 'slap' }, // E1 slap
    { note: 31, string: 1, fret: 3, beat: 2, articulation: 'pick' }, // G1 pop
    { note: 33, string: 2, fret: 0, beat: 3, articulation: 'slap' }, // A1 slap
  ],
};

const logger = getLogger('bassline-widget');

export function BassLineWidget({
  pattern,
  isVisible,
  isPlaying,
  exercise,
  onPatternChange,
  onToggleVisibility,
  onTogglePlay,
  tempo = 120,
}: BassLineWidgetProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [volume, setVolume] = useState(80);
  const [isMuted, setIsMuted] = useState(false);
  const [currentArticulation, setCurrentArticulation] =
    useState<BassArticulationType>(BassArticulation.FINGERSTYLE);
  const [selectedNotes, setSelectedNotes] = useState<any[]>([]);

  // Create a track for bass
  const track = useTrack({
    trackId: 'bass-widget-track',
    name: 'Bass',
    type: 'bass',
    debugMode: false,
  });

  // We don't need useWAMPlugin since we're loading manually
  const [wamPluginLoaded, setWamPluginLoaded] = useState(false);
  const [pluginClassLoaded, setPluginClassLoaded] = useState(false);

  // Reference to the actual plugin instance and class
  const wamPluginClassRef = useRef<any>(null);
  const bassPluginRef = useRef<any>(null);
  const lastScheduledTimeRef = useRef<number>(0);
  const currentPatternRef = useRef<any[]>([]);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Check for preloaded bass on mount
  useEffect(() => {
    const checkPreloadedBass = async () => {
      // Check GlobalSampleCache first
      const { GlobalSampleCache } = await import('@/domains/playback/services/storage/GlobalSampleCache');
      const preloadedBass = GlobalSampleCache.getCachedInstrument('bass-preloaded');
      
      if (preloadedBass) {
        logger.debug('🎸 Bass instrument found in GlobalSampleCache on mount!');
        bassPluginRef.current = preloadedBass;
        setWamPluginLoaded(true);
        setPluginClassLoaded(true);
        
        // Set initial volume
        if (preloadedBass.audioNode) {
          await preloadedBass.audioNode.setParameterValues({
            volume: isMuted ? 0 : volume / 100,
          });
        }
      }
    };

    checkPreloadedBass();
  }, []);

  // Phase 1: Load the plugin class (can be done before AudioContext)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (pluginClassLoaded) return;

    const loadPluginClass = async () => {
      logger.debug('Loading plugin class...');

      try {
        // Dynamic import to avoid SSR issues
        const { default: WamBass } = await import(
          '@/domains/playback/modules/instruments/adapters/wam/WamBass'
        );
        wamPluginClassRef.current = WamBass;
        setPluginClassLoaded(true);
        logger.debug('WAM Bass plugin class loaded successfully');
      } catch (error) {
        logger.error('Failed to load WAM Bass plugin class:', error);
      }
    };

    loadPluginClass();
  }, [pluginClassLoaded]);

  // Phase 2: Create the audio node when AudioContext is available
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!pluginClassLoaded || !track.isReady || wamPluginLoaded) return;

    // Add guard to prevent multiple instances
    if (bassPluginRef.current) {
      logger.debug('Plugin already loaded, skipping creation');
      return;
    }

    const createAudioNode = async () => {
      logger.debug('Attempting to create audio node...', {
        trackIsReady: track.isReady,
        wamPluginLoaded,
        pluginClassLoaded,
      });

      // Check GlobalSampleCache first for preloaded bass instrument
      try {
        const { GlobalSampleCache } = await import('@/domains/playback/services/storage/GlobalSampleCache');
        const preloadedBass = GlobalSampleCache.getCachedInstrument('bass-preloaded');
        
        if (preloadedBass && preloadedBass.audioNode) {
          logger.debug('🎸 Found pre-loaded bass instrument in GlobalSampleCache!');
          bassPluginRef.current = preloadedBass;
          setWamPluginLoaded(true);
          
          // Set initial volume
          await preloadedBass.audioNode.setParameterValues({
            volume: isMuted ? 0 : volume / 100,
          });
          
          return;
        }
      } catch (error) {
        logger.debug('GlobalSampleCache check failed, proceeding with normal loading');
      }

      try {
        const WamBass = wamPluginClassRef.current;
        if (!WamBass) {
          logger.error('Plugin class not loaded');
          return;
        }

        // Get audio context from global audio system
        let context = null;

        // Try to get context from global audio services
        const globalServices =
          (window as any).__globalCoreServices ||
          (window as any).__coreServices;
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
          const plugin = await WamBass.createInstance(context);
          logger.debug('Created plugin instance:', plugin);

          // Store the plugin instance
          bassPluginRef.current = plugin;

          // Note: Connection will happen inside WamBass.createAudioNode
          // The plugin handles its own connection to context.destination

          setWamPluginLoaded(true);

          logger.debug(
            'WAM Bass plugin loaded and connected (waiting for samples)',
          );
        } else {
          logger.debug('AudioContext not ready yet', {
            hasContext: !!context,
            contextState: context?.state,
          });
        }
      } catch (error) {
        logger.error('Failed to create WAM Bass audio node:', error);
      }
    };

    createAudioNode();
  }, [track.isReady, wamPluginLoaded, pluginClassLoaded]);

  // Handle volume changes
  useEffect(() => {
    if (bassPluginRef.current) {
      bassPluginRef.current.audioNode?.setParameterValues({
        volume: isMuted ? 0 : volume / 100,
      });
    }
  }, [volume, isMuted]);

  // Listen for audio services ready event
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleAudioReady = () => {
      logger.debug('Audio services ready event received');
      // Do nothing - the effect will handle retries
    };

    const handleAudioContextStarted = () => {
      logger.debug('AudioContext started event received');
      // Do nothing - the effect will handle retries
    };

    window.addEventListener('audioServicesReady', handleAudioReady);
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

  // Handle articulation changes
  const handleArticulationChange = useCallback(
    async (articulation: BassArticulationType) => {
      setCurrentArticulation(articulation);
      if (bassPluginRef.current) {
        const articulationIndex =
          Object.values(BassArticulation).indexOf(articulation);
        await bassPluginRef.current.audioNode?.setParameterValues({
          articulation: articulationIndex,
        });
      }
    },
    [],
  );

  // Get pattern notes
  const patternNotes = useMemo(() => {
    // If we have exercise notes, use those
    if (exercise?.notes && exercise.notes.length > 0) {
      return exercise.notes.filter(
        (note) =>
          // Filter for bass strings (assuming strings 1-4 are bass in a 6-string system)
          note.string >= 1 && note.string <= 4,
      );
    }

    // Otherwise use predefined patterns
    return (
      bassPatterns[pattern as keyof typeof bassPatterns] ||
      bassPatterns['Root-Fifth']
    );
  }, [pattern, exercise]);

  // Schedule bass pattern
  const schedulePattern = useCallback(() => {
    const plugin = bassPluginRef.current;
    if (!plugin || !track.isPlaying) return;

    const context = track.track?.audioContext;
    if (!context) return;

    // Clear any existing pattern
    currentPatternRef.current = [];

    // Calculate timing
    const currentTime = context.currentTime;
    const beatDuration = 60 / tempo;

    // Schedule pattern notes
    const scheduleTime = currentTime + 0.1; // Small lookahead

    patternNotes.forEach((noteInfo, index) => {
      const beat = noteInfo.beat || index;
      const noteTime = scheduleTime + beat * beatDuration;

      // Create pattern event
      const event = {
        note: noteInfo.note,
        velocity: 0.7,
        string: noteInfo.string,
        fret: noteInfo.fret,
        duration: beatDuration * 0.9, // Slightly shorter for separation
        articulation: noteInfo.articulation || currentArticulation,
      };

      // Handle the event
      plugin.handlePatternEvent(event, noteTime);

      // Store pattern info
      currentPatternRef.current.push({
        ...event,
        time: noteTime,
      });

      // Update visual selection
      setSelectedNotes(currentPatternRef.current);
    });

    lastScheduledTimeRef.current = scheduleTime + 4 * beatDuration; // Assume 4/4 measure
  }, [patternNotes, tempo, track.isPlaying, currentArticulation]);

  // Handle play state changes
  useEffect(() => {
    if (isPlaying && track.isReady && bassPluginRef.current) {
      schedulePattern();

      // Set up interval to schedule next measures
      const measureDuration = (60 / tempo) * 4; // 4/4 time
      const interval = setInterval(
        () => {
          if (track.isPlaying) {
            schedulePattern();
          }
        },
        measureDuration * 1000 * 0.9,
      ); // Schedule slightly early

      return () => clearInterval(interval);
    } else if (!isPlaying && bassPluginRef.current) {
      // Clear events
      bassPluginRef.current.audioNode?.clearEvents();
      setSelectedNotes([]);
    }
  }, [isPlaying, track.isReady, schedulePattern]);

  // Listen for bass trigger events from the transport/track system
  useEffect(() => {
    if (!bassPluginRef.current) return;

    // Get EventBus instance
    const eventBus = (window as any).__globalCoreServices?.getEventBus?.();
    if (!eventBus) {
      logger.warn('EventBus not available for bass triggers');
      return;
    }

    // Handle bass trigger events from PatternScheduler
    const handleBassTrigger = (event: any) => {
      logger.debug('🎸 Bass received trigger event:', event);

      if (bassPluginRef.current && event.audioTime) {
        const note = event.note ?? 28; // Default to E1 if no note specified
        const velocity = event.velocity ?? 80;
        const duration = event.duration ?? 0.5;
        const articulation = event.articulation || 'fingerstyle';

        // Set articulation if different
        if (articulation !== currentArticulation) {
          bassPluginRef.current.setArticulation?.(articulation);
        }

        // Play the note at the scheduled time
        bassPluginRef.current.playNote(
          note,
          velocity,
          duration,
          event.audioTime,
        );

        // Update visual feedback (selected notes)
        const currentTime =
          bassPluginRef.current.audioNode?.context.currentTime || 0;
        const delay = Math.max(0, (event.audioTime - currentTime) * 1000);

        setTimeout(() => {
          if (track.isPlaying && event.string && event.fret !== undefined) {
            // Update selected notes for visual feedback
            setSelectedNotes([
              {
                note: event.note,
                string: event.string,
                fret: event.fret,
                beat: event.beat || 0,
              },
            ]);

            // Clear visual after note duration
            setTimeout(() => {
              setSelectedNotes([]);
            }, duration * 1000);
          }
        }, delay);
      }
    };

    // Subscribe to bass trigger events
    const unsubscribe = eventBus.on('bass-trigger', handleBassTrigger);
    logger.debug('✅ Bass subscribed to trigger events');

    return () => {
      unsubscribe();
      logger.debug('🔴 Bass unsubscribed from trigger events');
    };
  }, [currentArticulation, track.isPlaying]);

  // Test note function
  const testNote = useCallback(() => {
    if (bassPluginRef.current) {
      // Play open E string
      bassPluginRef.current.playNote(28, 80, 0.5);
    }
  }, []);

  // Fretboard visualization helpers
  const fretWindow = useMemo(() => {
    const windowSize = 8;

    if (selectedNotes.length === 0) {
      return { start: 0, end: 7, showOpenString: true };
    }

    const fretPositions = selectedNotes
      .map((note) => note.fret)
      .filter((fret) => typeof fret === 'number' && fret > 0)
      .sort((a, b) => a - b);

    if (fretPositions.length === 0) {
      return { start: 0, end: 7, showOpenString: true };
    }

    const minFret = Math.max(0, fretPositions[0] - 1);
    const maxFret = fretPositions[fretPositions.length - 1];

    // Try to include 12th fret if possible
    if (minFret <= 12 && maxFret >= 12) {
      return { start: Math.max(0, 12 - 4), end: 12 + 3, showOpenString: false };
    }

    return {
      start: minFret,
      end: Math.min(minFret + windowSize - 1, 24),
      showOpenString: minFret === 0,
    };
  }, [selectedNotes]);

  if (!isVisible) return null;

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
            color="bg-purple-400"
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
                    Bass Track
                  </h3>
                  <p
                    className={`text-xs ${volume === 0 ? 'text-slate-600' : 'text-slate-400'}`}
                  >
                    {pattern} | {currentArticulation}
                  </p>
                </div>

                <button
                  onClick={() => setIsExpanded(true)}
                  className={`flex items-center gap-3 px-3 py-2 rounded-xl bg-slate-800 shadow-[5px_5px_10px_rgba(0,0,0,0.5),-5px_-5px_10px_rgba(255,255,255,0.1)] hover:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.5),inset_-2px_-2px_5px_rgba(255,255,255,0.1)] transition-all duration-300 cursor-pointer ${
                    volume === 0 ? 'opacity-50' : ''
                  }`}
                >
                  {/* Mini fretboard visualization - 4 strings */}
                  <div className="space-y-px">
                    {[4, 3, 2, 1].map((string) => (
                      <div key={`string-${string}`} className="flex gap-px">
                        {Array.from({ length: 8 }, (_, fretIndex) => {
                          const fret = fretWindow.start + fretIndex;
                          const hasNote = selectedNotes.some(
                            (note) =>
                              note.string === string && note.fret === fret,
                          );
                          const isFretMarker = [
                            3, 5, 7, 9, 12, 15, 17, 19,
                          ].includes(fret);

                          return (
                            <div
                              key={`s${string}-f${fret}`}
                              className={`w-2 h-2 rounded-full transition-all duration-200 ${
                                hasNote
                                  ? 'bg-purple-500'
                                  : isFretMarker
                                    ? 'bg-slate-500'
                                    : 'bg-slate-600'
                              }`}
                            />
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </button>
              </>
            ) : (
              <div className="flex items-center gap-4 w-full">
                <div className="flex-1">
                  <div className="flex flex-col gap-2">
                    {/* Pattern Selector */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400 w-16">
                        Pattern:
                      </span>
                      <select
                        value={pattern}
                        onChange={(e) => onPatternChange(e.target.value)}
                        className="flex-1 bg-slate-700 text-white text-xs rounded px-2 py-1"
                      >
                        {Object.keys(bassPatterns).map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Articulation Selector */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400 w-16">
                        Style:
                      </span>
                      <div className="flex gap-1">
                        {Object.entries(BassArticulation).map(
                          ([key, value]) => (
                            <button
                              key={value}
                              onClick={() => handleArticulationChange(value)}
                              className={`px-2 py-1 text-xs rounded ${
                                currentArticulation === value
                                  ? 'bg-purple-600 text-white'
                                  : 'bg-slate-700 text-slate-400'
                              }`}
                            >
                              {key.charAt(0) + key.slice(1).toLowerCase()}
                            </button>
                          ),
                        )}
                      </div>
                    </div>

                    {/* Status */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400 w-16">
                        Status:
                      </span>
                      <span className="text-xs text-yellow-500">
                        ⏳ Waiting for bass samples...
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <button
                    onClick={testNote}
                    className="px-2 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-500 transition-colors"
                    disabled={!track.isReady}
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

        {/* Status and Close Button */}
        <div className="flex items-center gap-2 ml-4">
          <span className="text-xs text-gray-400">
            {track.isReady ? '🟢' : '🟡'}
          </span>
          <button
            onClick={onToggleVisibility}
            className="text-gray-400 hover:text-white"
          >
            ✕
          </button>
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
            disabled={!track.isReady}
          >
            {isPlaying ? 'Stop' : 'Play'}
          </button>
        </div>
      )}
    </div>
  );
}

