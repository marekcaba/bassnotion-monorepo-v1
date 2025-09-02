'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { VolumeKnob } from './VolumeKnob';
import { useTrack } from '@/domains/playback/hooks/useTrack';
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

interface DrummerWidgetProps {
  pattern: string;
  isVisible: boolean;
  isPlaying: boolean;
  exercise?: Exercise;
  onPatternChange: (pattern: string) => void;
  onToggleVisibility: () => void;
  onTogglePlay?: () => void;
  tempo?: number;
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

export function DrummerWidget({
  pattern,
  isVisible,
  isPlaying: isPlayingProp,
  exercise,
  onPatternChange,
  onToggleVisibility,
  onTogglePlay,
  tempo = 120,
}: DrummerWidgetProps) {
  const { correlationId, logger: componentLogger } = useCorrelation('DrummerWidget');
  const [currentBeat, setCurrentBeat] = useState(0);
  const [isTransportPlaying, setIsTransportPlaying] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
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

  // We'll load the plugin manually
  const [wamPluginLoaded, setWamPluginLoaded] = useState(false);
  const [pluginClassLoaded, setPluginClassLoaded] = useState(false);

  // Reference to the plugin class and instance
  const wamPluginClassRef = useRef<any>(null);
  const drummerPluginRef = useRef<any>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentRegionRef = useRef<string | null>(null);

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
            position: toMusicalPosition(bar, beat, 0),
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
    if (!pluginClassLoaded || !track.isReady || wamPluginLoaded) return;

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

          // Register initial pattern with track
          if (track && track.createRegionFromPattern) {
            const pattern = createDrumPattern();
            const region = track.createRegionFromPattern(pattern, {
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
  }, [track.isReady, wamPluginLoaded, pluginClassLoaded, pluginLoadAttempts]);

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
    const globalServices =
      (window as any).__globalCoreServices || (window as any).__coreServices;
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
    if (audioServicesReady && track.isReady && !wamPluginLoaded) {
      logger.debug('Audio services ready, retrying plugin load...');
      // Small delay to ensure everything is fully initialized
      retryTimeoutRef.current = setTimeout(() => {
        setWamPluginLoaded(false); // Force a retry by changing the dependency
      }, 100);
    }
  }, [audioServicesReady, track.isReady, wamPluginLoaded]);

  // Update pattern when selection changes
  useEffect(() => {
    const newPattern =
      drumPatterns[pattern as keyof typeof drumPatterns] ||
      drumPatterns['Rock Steady'];
    setCurrentPattern(newPattern);

    // Update pattern in track when drum pattern changes
    if (track && track.regions && wamPluginLoaded && currentRegionRef.current) {
      const drumPattern = createDrumPattern();
      // Remove old region and create new one
      track.removeRegion(currentRegionRef.current);
      const region = track.createRegionFromPattern(drumPattern, {
        name: 'Drum Pattern',
        startPosition: '0:0:0',
        duration: `${drumPattern.loopLength}:0:0`,
        loopCount: 0, // Infinite loop
      });
      currentRegionRef.current = region.id;
      logger.debug('Updated drum pattern', { pattern, drumPattern });
    }
  }, [pattern, wamPluginLoaded, createDrumPattern]); // Removed track from dependencies to prevent loops

  // Note: Drum triggering is handled by the AudioEventRouter service
  // The widget only handles visual updates based on transport position

  // Monitor transport state directly from EventBus
  useEffect(() => {
    const coreServices =
      (window as any).__coreServices || (window as any).__globalCoreServices;
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
                        {Object.keys(drumPatterns).map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </div>

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

