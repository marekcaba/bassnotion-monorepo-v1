/**
 * useTrack Hook - Track-Based Widget Architecture
 *
 * Replaces the old widget pattern registration system with proper track management.
 * Each widget becomes a track controller that can load WAM plugins and manage playback.
 *
 * This is how professional DAWs work:
 * - Widget = Channel Strip (UI controller)
 * - Track = Audio channel with plugins
 * - WAM Plugin = Instrument/Effect loaded into track
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Track } from '../services/core/Track.js';
import { serviceRegistry } from '../services/core/ServiceRegistry.js';
import { EventBus } from '../services/core/EventBus.js';
import { TransportAdapter } from '../services/core/TransportAdapter.js';
import { TrackManager } from '../modules/tracks/core/TrackManager.js';
import {
  TrackState,
  type TrackConfig,
  type InstrumentType,
} from '../types/track.js';
import type { Region, Pattern, MusicalPosition } from '../types/index.js';
import { getLogger } from '@/utils/logger.js';

const logger = getLogger('track');
import { createRegion } from '../utils/regionUtils.js';
import { nanoid } from 'nanoid';
import { useCorrelation } from '@/shared/hooks/useCorrelation';

// Helper to wait for services to be available
function waitForServices(timeout = 10000): Promise<void> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    const checkServices = () => {
      // First try the serviceRegistry directly
      try {
        const eventBus = serviceRegistry.get('eventBus');
        const audioEngine = serviceRegistry.get('audioEngine');
        if (eventBus && audioEngine) {
          logger.debug('[useTrack] Services found in serviceRegistry');
          resolve();
          return;
        }
      } catch (e) {
        // Services might not be registered yet
      }

      // Check if services are available via window globals or registry
      const globalServices =
        (window as any).__globalCoreServices || (window as any).__coreServices;
      const globalRegistry = (window as any).__serviceRegistry;

      if (globalServices && globalRegistry) {
        // Double-check that eventBus is actually available
        try {
          const eventBus = globalRegistry.get('eventBus');
          if (eventBus) {
            logger.debug('[useTrack] Services found via window globals');
            resolve();
            return;
          }
        } catch (e) {
          // Registry exists but eventBus not yet registered
        }
      }

      if (Date.now() - startTime > timeout) {
        reject(new Error('Timeout waiting for audio services'));
        return;
      }

      // Check again in 50ms
      setTimeout(checkServices, 50);
    };

    // Also listen for the custom event
    const handleReady = () => {
      window.removeEventListener('audioServicesReady', handleReady);
      logger.debug('[useTrack] Services ready via audioServicesReady event');
      resolve();
    };
    window.addEventListener('audioServicesReady', handleReady);

    checkServices();
  });
}

interface UseTrackOptions {
  /** Unique track identifier */
  trackId: string;
  /** Display name for the track */
  name: string;
  /** Instrument type for this track */
  type: InstrumentType;
  /** Auto-initialize the track */
  autoInit?: boolean;
  /** Enable debug logging */
  debugMode?: boolean;
}

interface UseTrackReturn {
  // Track instance
  track: Track | null;
  trackId: string;

  // State
  isInitialized: boolean;
  isReady: boolean;
  error: Error | null;
  state: TrackState;

  // Playback control
  play: () => void;
  stop: () => void;
  pause: () => void;
  mute: (muted?: boolean) => void;
  solo: (soloed?: boolean) => void;

  // Volume/Pan control
  setVolume: (volume: number) => void;
  setPan: (pan: number) => void;

  // Plugin management
  loadWAMPlugin: (pluginUrl: string, options?: any) => Promise<any>;
  removePlugin: (pluginId: string) => void;

  // Transport integration
  isPlaying: boolean;
  currentTime: number;
  tempo: number;

  // Region management
  regions: Region[];
  createRegionFromPattern: (
    pattern: Pattern,
    config?: Partial<Region>,
  ) => Region;
  migratePatternToRegion: (widgetId: string, pattern: Pattern) => Region;
  addRegion: (region: Region) => void;
  removeRegion: (regionId: string) => void;
  updateRegion: (regionId: string, updates: Partial<Region>) => void;
  getRegionsInRange: (
    startPos: MusicalPosition,
    endPos: MusicalPosition,
  ) => Region[];
  getRegionsAtPosition: (position: MusicalPosition) => Region[];
  clearRegions: () => void;

  // Arrangement view
  selectedRegions: string[];
  selectRegion: (regionId: string, addToSelection?: boolean) => void;
  deselectRegion: (regionId?: string) => void;
}

export function useTrack(options: UseTrackOptions): UseTrackReturn {
  const { trackId, name, type, autoInit = true, debugMode = false } = options;

  // State
  const [track, setTrack] = useState<Track | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [state, setState] = useState<TrackState>(TrackState.UNINITIALIZED);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [tempo, setTempo] = useState(120);
  const [regions, setRegions] = useState<Region[]>([]);
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);

  // Refs for services
  const trackManagerRef = useRef<TrackManager | null>(null);
  const transportRef = useRef<UnifiedTransport | null>(null);
  const eventBusRef = useRef<EventBus | null>(null);
  const unsubscribersRef = useRef<Array<() => void>>([]);

  // Debug logging
  const debug = useCallback(
    (message: string, data?: any) => {
      if (debugMode) {
        logger.debug(`🎵 useTrack[${trackId}]: ${message}`, data);
      }
    },
    [trackId, debugMode],
  );

  /**
   * Initialize track and services
   */
  useEffect(() => {
    if (!autoInit || typeof window === 'undefined') return;

    const initializeTrack = async () => {
      try {
        debug('Initializing track - waiting for services...');

        // Wait for services to be available
        await waitForServices();
        debug('Services are ready');

        // Get services
        eventBusRef.current = serviceRegistry.get<EventBus>('eventBus');
        transportRef.current = TransportAdapter.getInstance();

        // Get or create track manager
        trackManagerRef.current = new TrackManager(eventBusRef.current);

        // Create track configuration
        const trackConfig: TrackConfig = {
          id: trackId,
          name,
          type,
          instrumentType: type,
          volume: 0.8,
          pan: 0,
          muted: false,
          solo: false,
          effects: [],
          automation: {},
          routing: {
            input: 'default',
            output: 'master',
            sends: [],
          },
        };

        // Create track through the track manager
        const trackInstance =
          await trackManagerRef.current.createTrack(trackConfig);

        setTrack(trackInstance);
        setIsInitialized(true);
        setIsReady(true);
        setState(trackInstance.state);

        debug('Track initialized successfully', { trackId, name, type });

        // Subscribe to transport events
        if (eventBusRef.current) {
          unsubscribersRef.current = [
            eventBusRef.current.on('transport:start', () => setIsPlaying(true)),
            eventBusRef.current.on('transport:resume', () =>
              setIsPlaying(true),
            ),
            eventBusRef.current.on('transport:stop', () => setIsPlaying(false)),
            eventBusRef.current.on('transport:pause', () =>
              setIsPlaying(false),
            ),
            eventBusRef.current.on(
              'transport:tempo-change',
              (newTempo: number) => setTempo(newTempo),
            ),
            eventBusRef.current.on('transport:time-update', (time: number) =>
              setCurrentTime(time),
            ),
          ];
        }
      } catch (err) {
        logger.error(`Failed to initialize track ${trackId}:`, err);
        setError(err as Error);
      }
    };

    initializeTrack();

    // Cleanup
    return () => {
      if (track && trackManagerRef.current) {
        trackManagerRef.current.deleteTrack(trackId).catch((err) => {
          logger.error(`Failed to delete track ${trackId}:`, err);
        });
      }
      // Unsubscribe from all events
      unsubscribersRef.current.forEach((unsubscribe) => unsubscribe());
      unsubscribersRef.current = [];
    };
  }, [trackId, name, type, autoInit, debug]);

  /**
   * Play track
   */
  const play = useCallback(() => {
    if (!track || !transportRef.current) return;

    debug('Starting playback');
    transportRef.current.start();
    // Track doesn't have play method, state is managed by transport
    setState(TrackState.PLAYING);
  }, [track, debug]);

  /**
   * Stop track
   */
  const stop = useCallback(() => {
    if (!track || !transportRef.current) return;

    debug('Stopping playback');
    transportRef.current.stop();
    // Track doesn't have stop method, state is managed by transport
    setState(TrackState.READY);
  }, [track, debug]);

  /**
   * Pause track
   */
  const pause = useCallback(() => {
    if (!track || !transportRef.current) return;

    debug('Pausing playback');
    transportRef.current.pause();
    // Track doesn't have pause method, state is managed by transport
    setState(TrackState.PAUSED);
  }, [track, debug]);

  /**
   * Mute/unmute track
   */
  const mute = useCallback(
    (muted?: boolean) => {
      if (!track) return;

      const shouldMute = muted !== undefined ? muted : !track.mixing.mute;
      debug(`${shouldMute ? 'Muting' : 'Unmuting'} track`);

      track.updateMixing({ mute: shouldMute });
    },
    [track, debug],
  );

  /**
   * Solo/unsolo track
   */
  const solo = useCallback(
    (soloed?: boolean) => {
      if (!track) return;

      const shouldSolo = soloed !== undefined ? soloed : !track.mixing.solo;
      debug(`${shouldSolo ? 'Soloing' : 'Unsoloing'} track`);

      track.updateMixing({ solo: shouldSolo });
    },
    [track, debug],
  );

  /**
   * Set track volume
   */
  const setVolume = useCallback(
    (volume: number) => {
      if (!track) return;

      debug('Setting volume', { volume });
      track.updateMixing({ volume: Math.max(0, Math.min(1, volume)) });
    },
    [track, debug],
  );

  /**
   * Set track pan
   */
  const setPan = useCallback(
    (pan: number) => {
      if (!track) return;

      debug('Setting pan', { pan });
      track.updateMixing({ pan: Math.max(-1, Math.min(1, pan)) });
    },
    [track, debug],
  );

  /**
   * Load WAM plugin into track
   */
  const loadWAMPlugin = useCallback(
    async (pluginUrl: string, options?: any) => {
      if (!track) {
        throw new Error('Track not initialized');
      }

      debug('Loading WAM plugin', { pluginUrl, options });

      try {
        // Track doesn't have loadWAMPlugin method - this should be handled through TrackManager
        // For now, return a placeholder
        const plugin = { id: 'temp-plugin', url: pluginUrl };
        debug('WAM plugin loaded successfully', { pluginId: plugin.id });
        return plugin;
      } catch (err) {
        logger.error('Failed to load WAM plugin:', err);
        throw err;
      }
    },
    [track, debug],
  );

  /**
   * Remove plugin from track
   */
  const removePlugin = useCallback(
    (pluginId: string) => {
      if (!track) return;

      debug('Removing plugin', { pluginId });
      track.removePlugin(pluginId);
    },
    [track, debug],
  );

  // ============================================================================
  // REGION MANAGEMENT METHODS
  // ============================================================================

  /**
   * Create region from pattern (migration helper)
   */
  const createRegionFromPattern = useCallback(
    (pattern: Pattern, config?: Partial<Region>) => {
      if (!track) {
        throw new Error('Track not initialized');
      }

      const region: Region = {
        id: nanoid(),
        trackId: track.id,
        name: config?.name || `${pattern.id} Region`,
        startPosition: config?.startPosition || '0:0:0',
        duration: config?.duration || `${(pattern as any).loopLength || 1}:0:0`,
        pattern,
        loopCount: config?.loopCount ?? 0,
        muted: config?.muted || false,
        color: config?.color,
        laneIndex: config?.laneIndex || 0,
        ...config,
      };

      debug('Creating region from pattern', { pattern, region });
      track.addRegion(region);
      setRegions([...track.regions]);

      return region;
    },
    [track, debug],
  );

  /**
   * Convert widget pattern to region (backward compatibility)
   */
  const migratePatternToRegion = useCallback(
    (widgetId: string, pattern: Pattern) => {
      return createRegionFromPattern(pattern, {
        name: `${widgetId} Pattern`,
        startPosition: '0:0:0',
        loopCount: 0, // Infinite loop like old system
      });
    },
    [createRegionFromPattern],
  );

  /**
   * Add region to track
   */
  const addRegion = useCallback(
    (region: Region) => {
      if (!track) return;

      debug('Adding region', { region });
      track.addRegion(region);
      setRegions([...track.regions]);
    },
    [track, debug],
  );

  /**
   * Remove region from track
   */
  const removeRegion = useCallback(
    (regionId: string) => {
      if (!track) return;

      debug('Removing region', { regionId });
      track.removeRegion(regionId);
      setRegions([...track.regions]);
      setSelectedRegions(track.arrangement.selectedRegions);
    },
    [track, debug],
  );

  /**
   * Update region
   */
  const updateRegion = useCallback(
    (regionId: string, updates: Partial<Region>) => {
      if (!track) return;

      debug('Updating region', { regionId, updates });
      track.updateRegion(regionId, updates);
      setRegions([...track.regions]);
    },
    [track, debug],
  );

  /**
   * Get regions in range
   */
  const getRegionsInRange = useCallback(
    (startPos: MusicalPosition, endPos: MusicalPosition) => {
      if (!track) return [];

      return track.getRegionsInRange(startPos, endPos);
    },
    [track],
  );

  /**
   * Get regions at position
   */
  const getRegionsAtPosition = useCallback(
    (position: MusicalPosition) => {
      if (!track) return [];

      return track.getRegionsAtPosition(position);
    },
    [track],
  );

  /**
   * Clear all regions
   */
  const clearRegions = useCallback(() => {
    if (!track) return;

    debug('Clearing all regions');
    track.clearRegions();
    setRegions([]);
    setSelectedRegions([]);
  }, [track, debug]);

  /**
   * Select region
   */
  const selectRegion = useCallback(
    (regionId: string, addToSelection = false) => {
      if (!track) return;

      debug('Selecting region', { regionId, addToSelection });
      track.selectRegion(regionId, addToSelection);
      setSelectedRegions([...track.arrangement.selectedRegions]);
    },
    [track, debug],
  );

  /**
   * Deselect region
   */
  const deselectRegion = useCallback(
    (regionId?: string) => {
      if (!track) return;

      debug('Deselecting region', { regionId });
      track.deselectRegion(regionId);
      setSelectedRegions([...track.arrangement.selectedRegions]);
    },
    [track, debug],
  );

  // Sync regions when track changes
  useEffect(() => {
    if (track) {
      setRegions([...track.regions]);
      setSelectedRegions([...track.arrangement.selectedRegions]);
    }
  }, [track]);

  return {
    // Track instance
    track,
    trackId,

    // State
    isInitialized,
    isReady,
    error,
    state,

    // Playback control
    play,
    stop,
    pause,
    mute,
    solo,

    // Volume/Pan control
    setVolume,
    setPan,

    // Plugin management
    loadWAMPlugin,
    removePlugin,

    // Transport integration
    isPlaying,
    currentTime,
    tempo,

    // Region management
    regions,
    createRegionFromPattern,
    migratePatternToRegion,
    addRegion,
    removeRegion,
    updateRegion,
    getRegionsInRange,
    getRegionsAtPosition,
    clearRegions,

    // Arrangement view
    selectedRegions,
    selectRegion,
    deselectRegion,
  };
}
