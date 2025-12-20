/**
 * useTrackMixing Hook
 *
 * React hook for integrating track-based mixing controls with the
 * TrackMixingEngine. Provides real-time mixing updates, solo/mute
 * management, and effects routing.
 *
 * Part of Story 3.21 Task 6 - Track Mixing and Routing System
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  TrackMixingEngine,
  type TrackChannel,
  type MixBus,
} from '../services/core/TrackMixingEngine.js';
import { Track } from '../services/core/Track.js';
import { serviceRegistry } from '../services/core/ServiceRegistry.js';
import { EventBus } from '../services/core/EventBus.js';
import type { TrackMixingState } from '../types/track.js';
import type * as ToneTypes from 'tone';
import { useCorrelation } from '@/shared/hooks/useCorrelation';
import { createStructuredLogger } from '@bassnotion/contracts';

const logger = createStructuredLogger('useTrackMixing');

export interface UseTrackMixingOptions {
  track: Track;
  onSoloChange?: (isSoloed: boolean) => void;
  onMuteChange?: (isMuted: boolean) => void;
  debugMode?: boolean;
}

export interface TrackMixingControls {
  // Current state
  volume: number;
  pan: number;
  isMuted: boolean;
  isSoloed: boolean;

  // Control functions
  setVolume: (volume: number) => void;
  setPan: (pan: number) => void;
  toggleMute: () => void;
  toggleSolo: () => void;

  // Advanced features
  addEffect: (effect: ToneTypes.ToneAudioNode) => void;
  createSend: (
    auxBusId: string,
    level?: number,
    sendPoint?: 'pre-fader' | 'post-fader',
  ) => string;
  updateSendLevel: (auxBusId: string, level: number) => void;

  // Channel info
  channel?: TrackChannel;
  isChannelActive: boolean;
}

/**
 * Hook for track mixing controls
 */
export function useTrackMixing(
  options: UseTrackMixingOptions,
): TrackMixingControls {
  const { track, onSoloChange, onMuteChange, debugMode = false } = options;

  // Services
  const mixingEngineRef = useRef<TrackMixingEngine>();
  const eventBusRef = useRef<EventBus>();

  // State
  const [mixingState, setMixingState] = useState<TrackMixingState>(
    () => track.mixing,
  );
  const [channel, setChannel] = useState<TrackChannel | undefined>();

  // Debug logging
  const debug = useCallback(
    (message: string, data?: any) => {
      if (debugMode) {
        logger.info(`🎛️ useTrackMixing[${track.id}]: ${message}`, data);
      }
    },
    [track.id, debugMode],
  );

  /**
   * Initialize services
   */
  useEffect(() => {
    mixingEngineRef.current = TrackMixingEngine.getInstance();

    try {
      eventBusRef.current = serviceRegistry.get<EventBus>('eventBus');
    } catch (e) {
      logger.warn('EventBus not found in ServiceRegistry');
    }

    debug('Initialized services');
  }, [debug]);

  /**
   * Create/get track channel
   */
  useEffect(() => {
    if (!mixingEngineRef.current) return;

    // Get existing channel or create new one
    let trackChannel = mixingEngineRef.current.getTrackChannel(track.id);

    if (!trackChannel) {
      debug('Creating new channel');
      trackChannel = mixingEngineRef.current.createTrackChannel(track);
    }

    setChannel(trackChannel);

    // Cleanup on unmount
    return () => {
      // Note: We don't remove the channel on unmount as it might be used elsewhere
      // Channel lifecycle should be managed at a higher level
    };
  }, [track, debug]);

  /**
   * Subscribe to mixing events
   */
  useEffect(() => {
    if (!eventBusRef.current) return;

    const unsubscribers: (() => void)[] = [];

    // Subscribe to track updates
    const unsubUpdate = eventBusRef.current.on(
      'mixing:trackUpdated',
      (data: any) => {
        if (data.trackId === track.id) {
          debug('Track updated', data.params);
          setMixingState((prev) => ({ ...prev, ...data.params }));
        }
      },
    );
    unsubscribers.push(unsubUpdate);

    // Subscribe to solo state changes
    const unsubSolo = eventBusRef.current.on(
      'mixing:soloStateChanged',
      (data: any) => {
        if (data.soloedTracks.includes(track.id) !== mixingState.solo) {
          const newSoloState = data.soloedTracks.includes(track.id);
          setMixingState((prev) => ({ ...prev, solo: newSoloState }));
          onSoloChange?.(newSoloState);
        }
      },
    );
    unsubscribers.push(unsubSolo);

    // Cleanup
    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [track.id, mixingState.solo, onSoloChange, debug]);

  /**
   * Set volume
   */
  const setVolume = useCallback(
    (volume: number) => {
      if (!mixingEngineRef.current) return;

      debug('Setting volume', { volume });

      mixingEngineRef.current.updateTrackMixing(track.id, { volume });
      setMixingState((prev) => ({ ...prev, volume }));
    },
    [track.id, debug],
  );

  /**
   * Set pan
   */
  const setPan = useCallback(
    (pan: number) => {
      if (!mixingEngineRef.current) return;

      debug('Setting pan', { pan });

      mixingEngineRef.current.updateTrackMixing(track.id, { pan });
      setMixingState((prev) => ({ ...prev, pan }));
    },
    [track.id, debug],
  );

  /**
   * Toggle mute
   */
  const toggleMute = useCallback(() => {
    if (!mixingEngineRef.current) return;

    const newMuteState = !mixingState.mute;
    debug('Toggling mute', { mute: newMuteState });

    mixingEngineRef.current.updateTrackMixing(track.id, { mute: newMuteState });
    setMixingState((prev) => ({ ...prev, mute: newMuteState }));
    onMuteChange?.(newMuteState);
  }, [track.id, mixingState.mute, onMuteChange, debug]);

  /**
   * Toggle solo
   */
  const toggleSolo = useCallback(() => {
    if (!mixingEngineRef.current) return;

    const newSoloState = !mixingState.solo;
    debug('Toggling solo', { solo: newSoloState });

    mixingEngineRef.current.updateTrackMixing(track.id, { solo: newSoloState });
    setMixingState((prev) => ({ ...prev, solo: newSoloState }));
    onSoloChange?.(newSoloState);
  }, [track.id, mixingState.solo, onSoloChange, debug]);

  /**
   * Add effect to track
   */
  const addEffect = useCallback(
    (effect: ToneTypes.ToneAudioNode) => {
      if (!mixingEngineRef.current) return;

      debug('Adding effect');
      mixingEngineRef.current.addTrackEffect(track.id, effect);
    },
    [track.id, debug],
  );

  /**
   * Create send to aux bus
   */
  const createSend = useCallback(
    (
      auxBusId: string,
      level = 0.5,
      sendPoint: 'pre-fader' | 'post-fader' = 'post-fader',
    ): string => {
      if (!mixingEngineRef.current) {
        throw new Error('Mixing engine not initialized');
      }

      debug('Creating send', { auxBusId, level, sendPoint });

      return mixingEngineRef.current.createSend(
        track.id,
        auxBusId,
        level,
        sendPoint,
      );
    },
    [track.id, debug],
  );

  /**
   * Update send level
   */
  const updateSendLevel = useCallback(
    (auxBusId: string, level: number) => {
      if (!mixingEngineRef.current) return;

      debug('Updating send level', { auxBusId, level });
      mixingEngineRef.current.updateSendLevel(track.id, auxBusId, level);
    },
    [track.id, debug],
  );

  return {
    // Current state
    volume: mixingState.volume,
    pan: mixingState.pan,
    isMuted: mixingState.mute,
    isSoloed: mixingState.solo,

    // Control functions
    setVolume,
    setPan,
    toggleMute,
    toggleSolo,

    // Advanced features
    addEffect,
    createSend,
    updateSendLevel,

    // Channel info
    channel,
    isChannelActive: channel !== undefined,
  };
}

/**
 * Hook for managing mix buses
 */
export interface UseMixBusesState {
  buses: Map<string, MixBus>;
  masterBus?: MixBus;
  auxBuses: MixBus[];
  subBuses: MixBus[];

  // Bus management
  createSubBus: (name: string, parentBusId?: string) => string;
  createAuxBus: (name: string) => string;

  // Effects returns
  createReverbReturn: (
    name?: string,
    roomSize?: number,
    dampening?: number,
  ) => string;
  createDelayReturn: (
    name?: string,
    delayTime?: string,
    feedback?: number,
  ) => string;
  createCompressionReturn: (
    name?: string,
    threshold?: number,
    ratio?: number,
  ) => string;

  // Bus effects
  addBusEffect: (busId: string, effect: ToneTypes.ToneAudioNode) => void;
  removeBusEffect: (busId: string, effectIndex: number) => void;
}

export function useMixBuses(): UseMixBusesState {
  const mixingEngineRef = useRef<TrackMixingEngine>();
  const [buses, setBuses] = useState<Map<string, MixBus>>(new Map());
  const [updateTrigger, setUpdateTrigger] = useState(0);

  useEffect(() => {
    mixingEngineRef.current = TrackMixingEngine.getInstance();
    updateBuses();
  }, []);

  const updateBuses = useCallback(() => {
    if (!mixingEngineRef.current) return;
    setBuses(mixingEngineRef.current.getBuses());
    setUpdateTrigger((prev) => prev + 1);
  }, []);

  const createSubBus = useCallback(
    (name: string, parentBusId = 'master'): string => {
      if (!mixingEngineRef.current)
        throw new Error('Mixing engine not initialized');

      const busId = `sub-${name.toLowerCase().replace(/\s+/g, '-')}`;
      mixingEngineRef.current.createSubBus(busId, name, parentBusId);
      updateBuses();
      return busId;
    },
    [updateBuses],
  );

  const createAuxBus = useCallback(
    (name: string): string => {
      if (!mixingEngineRef.current)
        throw new Error('Mixing engine not initialized');

      const busId = `aux-${name.toLowerCase().replace(/\s+/g, '-')}`;
      mixingEngineRef.current.createAuxBus(busId, name);
      updateBuses();
      return busId;
    },
    [updateBuses],
  );

  const createReverbReturn = useCallback(
    (name?: string, roomSize?: number, dampening?: number): string => {
      if (!mixingEngineRef.current)
        throw new Error('Mixing engine not initialized');

      const busId = mixingEngineRef.current.createReverbReturn(
        name,
        roomSize,
        dampening,
      );
      updateBuses();
      return busId;
    },
    [updateBuses],
  );

  const createDelayReturn = useCallback(
    (name?: string, delayTime?: string, feedback?: number): string => {
      if (!mixingEngineRef.current)
        throw new Error('Mixing engine not initialized');

      const busId = mixingEngineRef.current.createDelayReturn(
        name,
        delayTime,
        feedback,
      );
      updateBuses();
      return busId;
    },
    [updateBuses],
  );

  const createCompressionReturn = useCallback(
    (name?: string, threshold?: number, ratio?: number): string => {
      if (!mixingEngineRef.current)
        throw new Error('Mixing engine not initialized');

      const busId = mixingEngineRef.current.createCompressionReturn(
        name,
        threshold,
        ratio,
      );
      updateBuses();
      return busId;
    },
    [updateBuses],
  );

  const addBusEffect = useCallback(
    (busId: string, effect: ToneTypes.ToneAudioNode) => {
      if (!mixingEngineRef.current) return;

      mixingEngineRef.current.addBusEffect(busId, effect);
      updateBuses();
    },
    [updateBuses],
  );

  const removeBusEffect = useCallback(
    (busId: string, effectIndex: number) => {
      if (!mixingEngineRef.current) return;

      mixingEngineRef.current.removeBusEffect(busId, effectIndex);
      updateBuses();
    },
    [updateBuses],
  );

  // Compute derived state
  const busArray = Array.from(buses.values());
  const masterBus = busArray.find((bus) => bus.type === 'master');
  const auxBuses = busArray.filter((bus) => bus.type === 'aux');
  const subBuses = busArray.filter((bus) => bus.type === 'sub');

  return {
    buses,
    masterBus,
    auxBuses,
    subBuses,
    createSubBus,
    createAuxBus,
    createReverbReturn,
    createDelayReturn,
    createCompressionReturn,
    addBusEffect,
    removeBusEffect,
  };
}

/**
 * Hook for mixing snapshots
 */
export function useMixingSnapshots() {
  const mixingEngineRef = useRef<TrackMixingEngine>();
  const [snapshots, setSnapshots] = useState<string[]>([]);

  useEffect(() => {
    mixingEngineRef.current = TrackMixingEngine.getInstance();
  }, []);

  const createSnapshot = useCallback((name: string) => {
    if (!mixingEngineRef.current) return;

    mixingEngineRef.current.createSnapshot(name);
    setSnapshots((prev) => [...prev, name]);
  }, []);

  const recallSnapshot = useCallback((name: string) => {
    if (!mixingEngineRef.current) return;

    mixingEngineRef.current.recallSnapshot(name);
  }, []);

  return {
    snapshots,
    createSnapshot,
    recallSnapshot,
  };
}
