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
import type { MusicalPosition } from '@bassnotion/contracts/types/musical-time';
// 🔧 FIX: Removed useTransportPosition - now using RAF-based interpolation directly from TransportContext
import type {
  MetronomePattern,
  MetronomePatternEvent,
} from '@/domains/playback/types/pattern';
import { toMusicalPosition } from '@/domains/playback/types/pattern';
// 🔧 FIX: Removed EventBus import - no longer using EventBus subscription for transport state
import { useCorrelation } from '@/shared/hooks/useCorrelation';
import { WindowRegistry } from '@/domains/playback/services/WindowRegistry.js';
import { lifecycle } from '@/domains/playback/utils/InitializationLifecycleLogger.js';

// Metronome sound presets
const MetronomeSound = {
  CLASSIC: 'classic',
  ELECTRONIC: 'electronic',
  ACOUSTIC: 'acoustic',
  SUBTLE: 'subtle',
} as const;

type MetronomeSoundType = (typeof MetronomeSound)[keyof typeof MetronomeSound];

interface MetronomeWidgetProps {
  isVisible: boolean;
  isPlaying: boolean;
  onToggleVisibility?: () => void;
  onTogglePlay?: () => void;
  timeSignature?: {
    numerator: number;
    denominator: number;
  };
}

interface MetronomeDot {
  id: number;
  isActive: boolean;
  isCurrent: boolean;
}

const initialDots: MetronomeDot[] = Array.from({ length: 8 }, (_, i) => ({
  id: i,
  isActive: i < 4,
  isCurrent: i === 0,
}));

const logger = getLogger('metronome-widget');

const MetronomeWidgetComponent = ({
  isVisible,
  isPlaying: isPlayingProp,
  onToggleVisibility,
  onTogglePlay,
  timeSignature,
}: MetronomeWidgetProps) => {
  const { correlationId, logger: componentLogger } =
    useCorrelation('MetronomeWidget');

  // Get tempo directly from Transport (single source of truth)
  const transport = useTransportContext();
  const bpm = transport.tempo;

  const [metronomeDots, setMetronomeDots] = useState(initialDots);
  const [volume, setVolume] = useState(80);
  const [isMuted, setIsMuted] = useState(false);
  // 🔧 FIX: REMOVED isTransportPlaying local state - now use TransportContext's isPlaying directly
  // The local state via EventBus was getting out of sync with TransportContext, causing the beat indicator
  // to continue animating after playback stopped (same issue as DrummerWidget)
  const [isExpanded, setIsExpanded] = useState(false);
  const [beats, setBeats] = useState(timeSignature?.numerator || 4);
  const [noteValue, setNoteValue] = useState(timeSignature?.denominator || 4);
  const [currentSound, setCurrentSound] = useState<MetronomeSoundType>(
    MetronomeSound.CLASSIC,
  );
  const [subdivisions, setSubdivisions] = useState(1); // 1 = quarter, 2 = eighth, 3 = triplet
  const [pluginLoadAttempts, setPluginLoadAttempts] = useState(0);

  // Create a track for metronome
  const track = useTrack({
    trackId: 'metronome-widget-track',
    name: 'Metronome',
    type: 'utility',
    debugMode: false,
  });

  // We don't need useWAMPlugin since we're loading manually
  const [wamPluginLoaded, setWamPluginLoaded] = useState(false);
  const [pluginClassLoaded, setPluginClassLoaded] = useState(false);

  // Reference to the actual plugin instance and class
  const wamPluginClassRef = useRef<any>(null);
  const metronomePluginRef = useRef<any>(null);
  const lastScheduledTimeRef = useRef<number>(0);
  const currentPatternRef = useRef<any[]>([]);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentRegionRef = useRef<string | null>(null);

  // Lifecycle checkpoint: Widget mounted
  useEffect(() => {
    lifecycle.checkpoint('METRONOME_WIDGET_MOUNTED');
  }, []);

  // Check for preloaded metronome on mount
  useEffect(() => {
    const checkPreloadedMetronome = async () => {
      // Check GlobalSampleCache first
      const { GlobalSampleCache } =
        await import('@/domains/playback/modules/storage/cache/GlobalSampleCache');
      const preloadedMetronome = GlobalSampleCache.getCachedInstrument(
        'metronome-preloaded',
      );

      if (preloadedMetronome) {
        logger.debug(
          '🔔 Metronome instrument found in GlobalSampleCache on mount!',
        );
        metronomePluginRef.current = preloadedMetronome;
        setWamPluginLoaded(true);
        setPluginClassLoaded(true);

        // Set initial volume
        if (preloadedMetronome.audioNode) {
          await preloadedMetronome.audioNode.setParameterValues({
            volume: isMuted ? 0 : volume / 100,
          });
        }
      }
    };

    checkPreloadedMetronome();
  }, []);

  // Phase 1: Load the plugin class (can be done before AudioContext)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (pluginClassLoaded) return;

    const loadPluginClass = async () => {
      logger.debug('Loading plugin class...');
      lifecycle.checkpoint('METRONOME_PLUGIN_LOADING');

      try {
        // Dynamic import to avoid SSR issues
        const { default: WamMetronome } =
          await import('@/domains/playback/modules/instruments/adapters/wam/WamMetronome');
        wamPluginClassRef.current = WamMetronome;
        setPluginClassLoaded(true);
        logger.debug('WAM Metronome plugin class loaded successfully');
      } catch (error) {
        logger.error('Failed to load WAM Metronome plugin class:', error);
      }
    };

    loadPluginClass();
  }, [pluginClassLoaded]);

  // Create metronome pattern when settings change
  const createMetronomePattern = useCallback(() => {
    const pattern: MetronomePattern = {
      id: 'metronome-pattern',
      events: [],
      timeSignature: {
        numerator: beats,
        denominator: noteValue,
      },
    };

    // Generate pattern events for one bar
    for (let beat = 0; beat < beats; beat++) {
      for (let subdiv = 0; subdiv < subdivisions; subdiv++) {
        const isAccent = beat === 0 && subdiv === 0;
        const sixteenth = subdiv * (16 / subdivisions / noteValue) * 4; // Convert subdivision to sixteenths

        const event: MetronomePatternEvent = {
          position: toMusicalPosition(0, beat, Math.round(sixteenth)),
          type: isAccent ? 'accent' : 'click',
          velocity: isAccent ? 0.8 : 0.6,
          duration: '16n',
        };

        pattern.events.push(event);
      }
    }

    return pattern;
  }, [beats, noteValue, subdivisions]);

  // Phase 2: Create the audio node when AudioContext is available
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!pluginClassLoaded || !track.isReady || wamPluginLoaded) return;

    // Add guard to prevent multiple instances
    if (metronomePluginRef.current) {
      logger.debug('Plugin already loaded, skipping creation');
      return;
    }

    const createAudioNode = async () => {
      logger.debug('Attempting to create audio node...', {
        trackIsReady: track.isReady,
        wamPluginLoaded,
        pluginClassLoaded,
      });

      // Check GlobalSampleCache first for preloaded metronome
      try {
        const { GlobalSampleCache } =
          await import('@/domains/playback/modules/storage/cache/GlobalSampleCache');
        const preloadedMetronome = GlobalSampleCache.getCachedInstrument(
          'metronome-preloaded',
        );

        if (preloadedMetronome && preloadedMetronome.audioNode) {
          logger.debug(
            '🔔 Found pre-loaded metronome instrument in GlobalSampleCache!',
          );
          metronomePluginRef.current = preloadedMetronome;
          setWamPluginLoaded(true);

          // Set initial volume
          await preloadedMetronome.audioNode.setParameterValues({
            volume: isMuted ? 0 : volume / 100,
          });

          return;
        }
      } catch (error) {
        logger.debug(
          'GlobalSampleCache check failed, proceeding with normal loading',
        );
      }

      try {
        const WamMetronome = wamPluginClassRef.current;
        if (!WamMetronome) {
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

        if (context && context instanceof AudioContext) {
          lifecycle.checkpoint('PLUGIN_AUDIOCONTEXT_CHECK', {
            widget: 'metronome',
            contextState: context.state,
          });

          // Check if context is running or needs to be resumed
          if (context.state === 'suspended') {
            logger.debug(
              'AudioContext is suspended, waiting for user gesture...',
            );
            lifecycle.checkpoint('PLUGIN_CREATION_BLOCKED', {
              widget: 'metronome',
              reason: 'AudioContext suspended',
              contextState: context.state,
            });
            // Don't create the audio node yet, wait for audioContextStarted event
            return;
          }

          // Create plugin instance
          const plugin = await WamMetronome.createInstance(context);
          logger.debug('Created plugin instance:', plugin);

          // Store the plugin instance
          metronomePluginRef.current = plugin;

          // Create the audio node - this is required!
          const audioNode = await plugin.createAudioNode();
          logger.debug('Created audio node:', audioNode);

          // Connect to master bus for proper mixing (with fallback to destination)
          try {
            const { Mixer } = await import('@/domains/playback/modules/tracks/mixing/Mixer.js');
            const mixer = Mixer.getInstance();
            const masterBusInput = mixer.getMasterBusInputAsAudioNode();
            if (masterBusInput) {
              audioNode.connect(masterBusInput);
              logger.debug('Connected to master bus for mixing');
            } else {
              audioNode.connect(context.destination);
              logger.debug('Connected to destination (master bus not ready)');
            }
          } catch (e) {
            // Fallback to direct destination if mixer not available
            audioNode.connect(context.destination);
            logger.debug('Connected to destination (mixer not available)');
          }

          // Store the audio node on the plugin for easy access
          plugin.audioNode = audioNode;

          setWamPluginLoaded(true);

          logger.debug('WAM Metronome plugin loaded and connected');
          lifecycle.checkpoint('METRONOME_PLUGIN_LOADED');

          // Register with InstrumentRegistry so AudioEventRouter can use it
          if (globalServices && globalServices.getInstrumentRegistry) {
            const instrumentRegistry = globalServices.getInstrumentRegistry();
            instrumentRegistry.setActive('metronome', plugin);
            logger.debug('Registered WAM Metronome with InstrumentRegistry');
          }

          // Load default samples
          if (plugin.loadDefaultSamples) {
            try {
              await plugin.loadDefaultSamples();
              logger.debug('Default metronome samples loaded successfully');
            } catch (error) {
              logger.error('Failed to load metronome samples:', error);
              logger.warn('Metronome will use fallback oscillators');
            }
          } else {
            logger.warn(
              'loadDefaultSamples method not available on metronome plugin',
            );
          }

          // Register initial pattern with track
          if (track && track.createRegionFromPattern) {
            const pattern = createMetronomePattern();
            const region = track.createRegionFromPattern(pattern, {
              name: 'Metronome Pattern',
              startPosition: '0:0:0',
              duration: `${beats}:0:0`,
              loopCount: 0, // Infinite loop
            });
            currentRegionRef.current = region.id;
            logger.debug('Registered metronome pattern with track', {
              pattern,
              region,
            });

            // Register track with PlaybackEngine to enable pattern playback
            if (globalServices && globalServices.getPlaybackEngine) {
              const playbackEngine = globalServices.getPlaybackEngine();
              if (playbackEngine) {
                // Use consistent track ID 'metronome' to prevent duplicate track registration
                playbackEngine.unregisterTrack('metronome'); // Remove any existing metronome track first
                playbackEngine.registerTrack({
                  id: 'metronome',
                  name: 'Metronome',
                  instrumentType: 'metronome',
                  regions: [
                    {
                      id: region.id,
                      trackId: 'metronome',
                      startTime: 0,
                      duration: beats * 4, // Convert beats to seconds (assuming 4/4 time)
                      pattern: {
                        id: 'metronome-pattern',
                        name: 'Metronome Pattern',
                        type: 'metronome',
                        events: pattern.events,
                      },
                    },
                  ],
                });
                logger.debug('Registered track with PlaybackEngine');
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
        logger.error('Failed to create WAM Metronome audio node:', error);
      }
    };

    createAudioNode();
  }, [track.isReady, wamPluginLoaded, pluginClassLoaded, pluginLoadAttempts]);

  // Handle volume changes
  useEffect(() => {
    if (metronomePluginRef.current) {
      metronomePluginRef.current.audioNode?.setParameterValues({
        volume: isMuted ? 0 : volume / 100,
      });
    }
  }, [volume, isMuted]);

  // Handle sound changes - wrapped with audio context initialization
  const handleSoundChange = useCallback(
    withAudioContext(async (sound: MetronomeSoundType) => {
      setCurrentSound(sound);
      if (metronomePluginRef.current) {
        const soundIndex = Object.values(MetronomeSound).indexOf(sound);
        await metronomePluginRef.current.audioNode?.setParameterValues({
          sound: soundIndex,
        });
      }
    }),
    [],
  );

  // Handle subdivision changes
  const handleSubdivisionChange = useCallback(
    async (subdiv: number) => {
      setSubdivisions(subdiv);
      if (metronomePluginRef.current) {
        await metronomePluginRef.current.audioNode?.setParameterValues({
          subdivisions: subdiv,
        });
      }

      // Update pattern when subdivisions change
      if (
        track &&
        track.createRegionFromPattern &&
        wamPluginLoaded &&
        currentRegionRef.current
      ) {
        const pattern = createMetronomePattern();
        // Remove old region and create new one
        track.removeRegion(currentRegionRef.current);
        const region = track.createRegionFromPattern(pattern, {
          name: 'Metronome Pattern',
          startPosition: '0:0:0',
          duration: `${beats}:0:0`,
          loopCount: 0, // Infinite loop
        });
        currentRegionRef.current = region.id;
        logger.debug('Updated metronome pattern for subdivision change', {
          subdiv,
          pattern,
        });

        // Update PlaybackEngine with new pattern
        const globalServices = WindowRegistry.getCoreServices();
        if (globalServices && globalServices.getPlaybackEngine) {
          const playbackEngine = globalServices.getPlaybackEngine();
          if (playbackEngine) {
            // Unregister old track, then register new one (use consistent ID 'metronome')
            playbackEngine.unregisterTrack('metronome');
            playbackEngine.registerTrack({
              id: 'metronome',
              name: 'Metronome',
              instrumentType: 'metronome',
              regions: [
                {
                  id: region.id,
                  trackId: 'metronome',
                  startTime: 0,
                  duration: beats * 4,
                  pattern: {
                    id: 'metronome-pattern',
                    name: 'Metronome Pattern',
                    type: 'metronome',
                    events: pattern.events,
                  },
                },
              ],
            });
          }
        }
      }
    },
    [beats, wamPluginLoaded, createMetronomePattern],
  ); // Removed track from dependencies to prevent loops

  // Handle time signature changes and update pattern
  useEffect(() => {
    if (metronomePluginRef.current) {
      metronomePluginRef.current.setTimeSignature(beats, noteValue);
    }

    // Update pattern in track when time signature changes
    // Only update if we have already created an initial pattern
    if (
      track &&
      track.createRegionFromPattern &&
      wamPluginLoaded &&
      currentRegionRef.current
    ) {
      const pattern = createMetronomePattern();
      // Remove old region and create new one
      track.removeRegion(currentRegionRef.current);
      const region = track.createRegionFromPattern(pattern, {
        name: 'Metronome Pattern',
        startPosition: '0:0:0',
        duration: `${beats}:0:0`,
        loopCount: 0, // Infinite loop
      });
      currentRegionRef.current = region.id;
      logger.debug('Updated metronome pattern for time signature change', {
        beats,
        noteValue,
        pattern,
      });

      // Update PlaybackEngine with new pattern
      const globalServices =
        (window as any).__globalCoreServices || (window as any).__coreServices;
      if (globalServices && globalServices.getPlaybackEngine) {
        const playbackEngine = globalServices.getPlaybackEngine();
        if (playbackEngine) {
          // Unregister old track, then register new one (use consistent ID 'metronome')
          playbackEngine.unregisterTrack('metronome');
          playbackEngine.registerTrack({
            id: 'metronome',
            name: 'Metronome',
            instrumentType: 'metronome',
            regions: [
              {
                id: region.id,
                trackId: 'metronome',
                startTime: 0,
                duration: beats * 4,
                pattern: {
                  id: 'metronome-pattern',
                  name: 'Metronome Pattern',
                  type: 'metronome',
                  events: pattern.events,
                },
              },
            ],
          });
        }
      }
    }
  }, [beats, noteValue, wamPluginLoaded, createMetronomePattern]); // Removed track from dependencies to prevent loops

  // Handle tempo changes
  useEffect(() => {
    logger.info('🎵 MetronomeWidget: BPM changed', {
      bpm,
      transportTempo: transport.tempo,
      hasPlugin: !!metronomePluginRef.current,
    });
    if (metronomePluginRef.current) {
      metronomePluginRef.current.setTempo(bpm);
      logger.info('🎵 MetronomeWidget: Called plugin.setTempo', { bpm });
    }
  }, [bpm, transport.tempo]);

  // Update time signature when prop changes
  useEffect(() => {
    if (timeSignature) {
      logger.debug('Time signature changed from props:', timeSignature);
      setBeats(timeSignature.numerator);
      setNoteValue(timeSignature.denominator);
    }
  }, [timeSignature?.numerator, timeSignature?.denominator]);

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

  // Schedule metronome pattern
  const schedulePattern = useCallback(() => {
    const plugin = metronomePluginRef.current;
    if (!plugin || !track.isPlaying) return;

    const context = track.track?.audioContext;
    if (!context) return;

    // Clear any existing pattern
    currentPatternRef.current = [];

    // Calculate timing
    const currentTime = context.currentTime;
    const beatDuration = 60 / bpm;
    const clickDuration = beatDuration / subdivisions;

    // Schedule one measure of clicks
    let scheduleTime = currentTime + 0.1; // Small lookahead

    for (let beat = 0; beat < beats; beat++) {
      for (let subdiv = 0; subdiv < subdivisions; subdiv++) {
        const isAccent = beat === 0 && subdiv === 0;

        // Create pattern event
        const event = {
          type: isAccent ? 'accent' : 'click',
          velocity: isAccent ? 0.8 : 0.6,
          position: { bar: 0, beat, sixteenth: subdiv * 4 },
        };

        // Handle the event
        plugin.handlePatternEvent(event, scheduleTime);

        // Store pattern info
        currentPatternRef.current.push({
          beat,
          subdivision: subdiv,
          time: scheduleTime,
          isAccent,
        });

        // Update visual
        const beatIndex = beat * subdivisions + subdiv;
        setTimeout(
          () => {
            if (track.isPlaying) {
              setMetronomeDots((prev) =>
                prev.map((dot, index) => ({
                  ...dot,
                  isCurrent: index === beatIndex % beats,
                })),
              );
            }
          },
          (scheduleTime - currentTime) * 1000,
        );

        scheduleTime += clickDuration;
      }
    }

    lastScheduledTimeRef.current = scheduleTime;
  }, [bpm, beats, subdivisions, track.isPlaying]);

  // NOTE: Pattern trigger events are handled by AudioEventRouter
  // The widget only needs to create patterns and handle visual updates

  // 🔧 FIX: REMOVED EventBus subscription for transport state
  // Now using TransportContext's isPlaying directly (via useTransportContext() above)
  // This ensures beat indicator stops immediately when transport stops, without EventBus sync delays

  // Cleanup effect to unregister from InstrumentRegistry on unmount
  useEffect(() => {
    return () => {
      if (metronomePluginRef.current) {
        const globalServices = WindowRegistry.getCoreServices();
        if (globalServices && globalServices.getInstrumentRegistry) {
          const instrumentRegistry = globalServices.getInstrumentRegistry();
          if (
            instrumentRegistry.getActive('metronome') ===
            metronomePluginRef.current
          ) {
            instrumentRegistry.removeActive('metronome');
            logger.debug(
              'Removed WAM Metronome from InstrumentRegistry on unmount',
            );
          }
        }
      }
    };
  }, []);

  // Get isPlaying from TransportContext (same source as TransportClock which works)
  const { position: transportPosition, isPlaying: isTransportContextPlaying } = transport;

  // 🔧 FIX: Use TransportContext's isPlaying as the AUTHORITATIVE source for beat indicator
  // The prop (isPlayingProp) indicates user INTENT to play, but TransportContext indicates ACTUAL playback state
  // When transport stops (auto-complete or manual), TransportContext.isPlaying becomes false immediately
  // This ensures beat indicator stops even if useWidgetPageState hasn't synced yet
  //
  // Previous bug: isPlaying = isPlayingProp || isTransportPlaying (via EventBus)
  // - When transport stopped, EventBus handler set isTransportPlaying to false
  // - But isPlayingProp stayed true (useWidgetPageState doesn't sync with transport:stop)
  // - Result: true || false = true, beat indicator kept animating
  //
  // Fix: For beat indicator control, ONLY use TransportContext's isPlaying
  const isPlaying = isTransportContextPlaying;

  // Handle play state changes (simplified - no longer schedules its own pattern)
  useEffect(() => {
    if (!isPlaying && metronomePluginRef.current) {
      // Reset visual when stopped
      setMetronomeDots(initialDots);
    }
  }, [isPlaying]);

  // ============================================================================
  // RAF-BASED INTERPOLATION FOR SMOOTH BEAT HIGHLIGHTING
  // ============================================================================
  // Problem: setInterval(20ms) position updates via useTransportPosition cause ±20-40ms jitter
  // Solution: Store snapshot with performance.now() timestamp, interpolate in RAF
  // Result: Frame-perfect 60fps animation (~16.7ms precision vs ±40ms jitter)
  // ============================================================================

  // State for current beat (0-indexed for display)
  const [currentBeat, setCurrentBeat] = useState(0);

  // Ref to track current beat without causing RAF loop restarts
  const currentBeatRef = useRef(currentBeat);
  useEffect(() => {
    currentBeatRef.current = currentBeat;
  }, [currentBeat]);

  // 🔧 FIX: Track isPlaying in a ref so RAF loop can check it in real-time
  const isPlayingRef = useRef(isPlaying);
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  // Position snapshot for RAF interpolation
  interface PositionSnapshot {
    bars: number;
    beats: number; // 1-based (display position)
    sixteenths: number;
    seconds: number;
    capturedAt: number; // performance.now() when captured
  }
  const positionSnapshotRef = useRef<PositionSnapshot | null>(null);
  const rafIdRef = useRef<number | null>(null);

  // Update snapshot when TransportContext position changes
  useEffect(() => {
    if (!isPlaying || !isVisible) {
      positionSnapshotRef.current = null;
      return;
    }

    // transportPosition comes from useTransportContext
    if (transportPosition) {
      positionSnapshotRef.current = {
        bars: transportPosition.bars,
        beats: transportPosition.beats,
        sixteenths: transportPosition.sixteenths,
        seconds: transportPosition.seconds,
        capturedAt: performance.now(),
      };
    }
  }, [transportPosition, isPlaying, isVisible]);

  // RAF loop for smooth beat highlighting
  useEffect(() => {
    if (!isPlaying || !isVisible) {
      // Clean up RAF when not playing
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      positionSnapshotRef.current = null;
      return;
    }

    const updateBeat = () => {
      // 🔧 FIX: Check isPlaying via ref to catch stop events immediately
      if (!isPlayingRef.current) {
        return; // Don't schedule next frame
      }

      const snapshot = positionSnapshotRef.current;

      if (!snapshot) {
        rafIdRef.current = requestAnimationFrame(updateBeat);
        return;
      }

      // COUNTDOWN FIX: Don't update beat indicators during countdown (negative bars)
      if (snapshot.bars < 0) {
        rafIdRef.current = requestAnimationFrame(updateBeat);
        return;
      }

      // Interpolate current position based on elapsed time since snapshot
      const elapsed = (performance.now() - snapshot.capturedAt) / 1000;
      const beatDuration = 60 / bpm;

      // Calculate interpolated beat position
      const sixteenthsPerBeat = 4;
      const totalSixteenthsAtSnapshot = (snapshot.beats - 1) * sixteenthsPerBeat + snapshot.sixteenths;
      const elapsedSixteenths = (elapsed / beatDuration) * sixteenthsPerBeat;
      const interpolatedTotalSixteenths = totalSixteenthsAtSnapshot + elapsedSixteenths;

      // Convert to beat index (0-based for array indexing)
      const interpolatedBeat = Math.floor(interpolatedTotalSixteenths / sixteenthsPerBeat);
      const beatIndex = interpolatedBeat % beats;

      // Only update state if beat changed
      if (beatIndex !== currentBeatRef.current) {
        setCurrentBeat(beatIndex);
        // Update dots
        setMetronomeDots((prev) =>
          prev.map((dot, index) => ({
            ...dot,
            isCurrent: index === beatIndex,
          })),
        );
      }

      rafIdRef.current = requestAnimationFrame(updateBeat);
    };

    // Start RAF loop
    rafIdRef.current = requestAnimationFrame(updateBeat);

    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [isPlaying, isVisible, bpm, beats]);

  // Test click function - wrapped with lightweight audio context initialization
  const testClick = useCallback(
    withAudioContext(
      async () => {
        logger.debug('testClick called:', {
          plugin: metronomePluginRef.current,
        });

        // If plugin isn't loaded, trigger a load attempt
        if (!metronomePluginRef.current && !wamPluginLoaded) {
          logger.debug('Plugin not loaded, triggering load attempt...');
          setPluginLoadAttempts((prev) => prev + 1);

          // Wait for plugin to load
          await new Promise((resolve) => setTimeout(resolve, 500));
        }

        if (metronomePluginRef.current) {
          logger.debug('Calling plugin.click()');
          metronomePluginRef.current.click(false);
        } else {
          logger.warn('Cannot trigger click - plugin not ready');
        }
      },
      { lightweight: true },
    ),
    [wamPluginLoaded],
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
            color="bg-green-400"
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
                    Metronome Track
                  </h3>
                  <p
                    className={`text-xs ${volume === 0 ? 'text-slate-600' : 'text-slate-400'}`}
                  >
                    {beats}/{noteValue} | {currentSound}
                  </p>
                </div>

                <button
                  onClick={() => setIsExpanded(true)}
                  className={`flex items-center gap-3 px-3 py-2 rounded-xl bg-slate-800 shadow-[5px_5px_10px_rgba(0,0,0,0.5),-5px_-5px_10px_rgba(255,255,255,0.1)] hover:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.5),inset_-2px_-2px_5px_rgba(255,255,255,0.1)] transition-all duration-300 cursor-pointer ${
                    volume === 0 ? 'opacity-50' : ''
                  }`}
                >
                  <div className="flex gap-1">
                    {metronomeDots.slice(0, beats).map((dot) => (
                      <div
                        key={dot.id}
                        className={`w-3 h-3 rounded-full transition-all duration-200 ${
                          dot.isCurrent && isPlaying
                            ? 'bg-orange-400 shadow-lg shadow-orange-400/50'
                            : 'bg-green-500'
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
                    {/* BPM Slider removed - tempo control is in TransportClock only */}

                    {/* Sound Selector */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400 w-16">
                        Sound:
                      </span>
                      <select
                        value={currentSound}
                        onChange={(e) =>
                          handleSoundChange(
                            e.target.value as MetronomeSoundType,
                          )
                        }
                        className="flex-1 bg-slate-700 text-white text-xs rounded px-2 py-1"
                      >
                        {Object.entries(MetronomeSound).map(([key, value]) => (
                          <option key={value} value={value}>
                            {key.charAt(0) + key.slice(1).toLowerCase()}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Subdivision Selector */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400 w-16">
                        Subdiv:
                      </span>
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleSubdivisionChange(1)}
                          className={`px-2 py-1 text-xs rounded ${
                            subdivisions === 1
                              ? 'bg-green-600 text-white'
                              : 'bg-slate-700 text-slate-400'
                          }`}
                        >
                          ♩
                        </button>
                        <button
                          onClick={() => handleSubdivisionChange(2)}
                          className={`px-2 py-1 text-xs rounded ${
                            subdivisions === 2
                              ? 'bg-green-600 text-white'
                              : 'bg-slate-700 text-slate-400'
                          }`}
                        >
                          ♫
                        </button>
                        <button
                          onClick={() => handleSubdivisionChange(3)}
                          className={`px-2 py-1 text-xs rounded ${
                            subdivisions === 3
                              ? 'bg-green-600 text-white'
                              : 'bg-slate-700 text-slate-400'
                          }`}
                        >
                          ♪³
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <button
                    onClick={testClick}
                    className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-500 transition-colors"
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
};

// Phase 5.1: Wrap in React.memo to prevent unnecessary re-renders
export const MetronomeWidget = React.memo(MetronomeWidgetComponent);
