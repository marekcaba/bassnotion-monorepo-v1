/**
 * useWamDrummer Hook
 *
 * Connects the WAM Drummer plugin to the existing DrummerWidget UI.
 * This allows us to use the new track-based architecture while keeping
 * the familiar UI that users love.
 *
 * Features:
 * - Automatic WAM plugin initialization
 * - Sample loading from Supabase
 * - Pattern playback through track system
 * - Full integration with UnifiedTransport
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  DrumPattern,
  DrumPatternEvent,
} from '@/domains/playback/types/pattern';
import type { MusicalPosition } from '@/domains/playback/services/core/UnifiedTransport';
import { useCorrelation } from '@/shared/hooks/useCorrelation';

interface UseWamDrummerOptions {
  widgetId: string;
  autoLoad?: boolean;
  debugMode?: boolean;
}

interface UseWamDrummerReturn {
  // Plugin state
  isLoaded: boolean;
  isReady: boolean;
  error: Error | null;

  // Sample management
  loadSample: (padNumber: number, url: string) => Promise<void>;
  loadKit: (kitPath: string) => Promise<void>;

  // Playback control
  triggerPad: (padNumber: number, velocity?: number) => void;
  schedulePattern: (pattern: DrumPattern) => void;
  stop: () => void;

  // Volume control
  setVolume: (volume: number) => void;
  setMute: (muted: boolean) => void;

  // WAM instance access
  wamInstance: any;
  adapter: any;
}

/**
 * Hook to use WAM Drummer in React components
 */
export function useWamDrummer(
  options: UseWamDrummerOptions,
): UseWamDrummerReturn {
  const { widgetId, autoLoad = true, debugMode = false } = options;

  // State
  const [isLoaded, setIsLoaded] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [volume, setVolumeState] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);

  // Refs
  const wamInstanceRef = useRef<any>(null);
  const adapterRef = useRef<any>(null);
  const drummerNodeRef = useRef<any>(null);
  const audioEngineRef = useRef<any>(null);
  const transportRef = useRef<any>(null);
  const scheduledEventsRef = useRef<Set<number>>(new Set());

  // Debug logging
  const debug = useCallback(
    (message: string, data?: any) => {
      if (debugMode) {
        logger.info(`🥁 useWamDrummer[${widgetId}]: ${message}`, data);
      }
    },
    [widgetId, debugMode],
  );

  /**
   * Initialize WAM drummer
   */
  useEffect(() => {
    if (!autoLoad || typeof window === 'undefined') return;

    const initializeWamDrummer = async () => {
      try {
        debug('Initializing WAM Drummer');

        // Dynamically import modules only on client side
        const [
          { default: WamDrummer },
          { WamPluginAdapter },
          { WamHostManager },
          { serviceRegistry },
          { AudioEngine },
          { UnifiedTransport },
        ] = await Promise.all([
          import('@/domains/playback/modules/instruments/adapters/wam/WamDrummer'),
          import('@/domains/playback/services/plugins/WamPluginAdapter'),
          import('@/domains/playback/services/plugins/WamHostManager'),
          import('@/domains/playback/services/core/ServiceRegistry'),
          import('@/domains/playback/services/core/AudioEngine'),
          import('@/domains/playback/services/core/UnifiedTransport'),
        ]);

        // Get services
        audioEngineRef.current =
          serviceRegistry.get<AudioEngine>('audioEngine');
        transportRef.current = UnifiedTransport.getInstance();

        const audioContext = audioEngineRef.current.getContext();
        if (!audioContext) {
          throw new Error('AudioContext not available');
        }

        // Create WAM instance
        const wamInstance = await WamDrummer.createInstance(audioContext);
        wamInstanceRef.current = wamInstance;

        // Create audio node
        const drummerNode = await wamInstance.createAudioNode();
        drummerNodeRef.current = drummerNode;

        // Connect to audio output
        drummerNode.connect(audioContext.destination);

        // Load default kit
        await wamInstance.loadDefaultKit();

        // Create adapter for BassNotion integration
        const adapter = new WamPluginAdapter(
          '/wam/drummer', // Virtual URL
          wamInstance.descriptor,
          {
            id: `wam-drummer-${widgetId}`,
            name: 'WAM Drummer',
            enabled: true,
            priority: 100, // High priority for drums
          },
        );

        // Override the load method since we already have the instance
        adapter['wamInstance'] = wamInstance;
        adapter['wamNode'] = drummerNode;
        adapter['_state'] = 'active' as any;

        adapterRef.current = adapter;

        // Register with host manager
        const hostManager = WamHostManager.getInstance();
        await hostManager.registerPlugin({
          moduleId: `wam-drummer-${widgetId}`,
          url: '/wam/drummer',
          descriptor: wamInstance.descriptor,
          loadedAt: Date.now(),
          instanceCount: 1,
        });

        setIsLoaded(true);
        setIsReady(true);
        debug('WAM Drummer initialized successfully');
      } catch (err) {
        logger.error('Failed to initialize WAM Drummer:', err);
        setError(err as Error);
      }
    };

    initializeWamDrummer();

    // Cleanup
    return () => {
      if (drummerNodeRef.current) {
        drummerNodeRef.current.destroy();
      }
      scheduledEventsRef.current.clear();
    };
  }, [widgetId, autoLoad, debug]);

  /**
   * Load a sample for a specific pad
   */
  const loadSample = useCallback(
    async (padNumber: number, url: string) => {
      if (!drummerNodeRef.current) {
        throw new Error('WAM Drummer not initialized');
      }

      debug(`Loading sample for pad ${padNumber}`, url);

      try {
        await drummerNodeRef.current.loadSample(padNumber, url);
        debug(`Sample loaded for pad ${padNumber}`);
      } catch (error) {
        logger.error(`Failed to load sample for pad ${padNumber}:`, error);
        throw error;
      }
    },
    [debug],
  );

  /**
   * Load a complete drum kit
   */
  const loadKit = useCallback(
    async (kitPath: string) => {
      if (!drummerNodeRef.current) {
        throw new Error('WAM Drummer not initialized');
      }

      debug('Loading drum kit', kitPath);

      // Map of common drum kit files to pad numbers
      const kitMapping = {
        kick: 1,
        kik: 1,
        bd: 1,
        snare: 3,
        sn: 3,
        clap: 3,
        clp: 3,
        hihat: 7,
        hh: 7,
        cht: 7,
        hat: 7,
      };

      try {
        // This is a simplified version - in production you'd fetch the kit manifest
        for (const [pattern, padNum] of Object.entries(kitMapping)) {
          try {
            await loadSample(padNum, `${kitPath}/${pattern}.mp3`);
          } catch (e) {
            // Try variations
          }
        }

        debug('Drum kit loaded');
      } catch (error) {
        logger.error('Failed to load drum kit:', error);
        throw error;
      }
    },
    [loadSample, debug],
  );

  /**
   * Trigger a pad immediately
   */
  const triggerPad = useCallback(
    (padNumber: number, velocity = 0.8) => {
      if (!drummerNodeRef.current || isMuted) return;

      debug(`Triggering pad ${padNumber}`, { velocity });

      drummerNodeRef.current.triggerPad(padNumber, velocity * volume);
    },
    [volume, isMuted, debug],
  );

  /**
   * Schedule a drum pattern
   */
  const schedulePattern = useCallback(
    (pattern: DrumPattern) => {
      if (
        !drummerNodeRef.current ||
        !transportRef.current ||
        !adapterRef.current
      )
        return;

      debug('Scheduling drum pattern', pattern);

      // Clear previous scheduled events
      stop();

      const transport = transportRef.current;
      const currentTime = transport.getCurrentTime();
      const tempo = transport.getTempo();

      // Schedule each event
      for (const event of pattern.events) {
        const position = event.position || event;
        const musicalTime: MusicalPosition = {
          bars: position.bars || 0,
          beats: position.beats || 0,
          sixteenths: position.sixteenths || 0,
          ticks: position.ticks || 0,
        };

        // Convert to seconds
        const timeInSeconds = transport.musicalPositionToSeconds(musicalTime);

        // Map drum type to pad number
        const padNumber = mapDrumTypeToPad(event.drum);
        if (padNumber) {
          // Schedule with WAM
          const midiNote = PAD_MIDI_NOTES[padNumber];
          const midiEvent = new Uint8Array([
            0x90, // Note On
            midiNote,
            Math.round((event.velocity / 100) * 127),
          ]);

          adapterRef.current.scheduleMidiEvent(midiEvent, musicalTime);

          // Track scheduled events
          scheduledEventsRef.current.add(timeInSeconds);
        }
      }

      debug(`Scheduled ${pattern.events.length} events`);
    },
    [debug],
  );

  /**
   * Stop all scheduled events
   */
  const stop = useCallback(() => {
    if (!drummerNodeRef.current) return;

    debug('Stopping playback');

    drummerNodeRef.current.clearEvents();
    scheduledEventsRef.current.clear();
  }, [debug]);

  /**
   * Set volume
   */
  const setVolume = useCallback((newVolume: number) => {
    setVolumeState(newVolume);

    if (drummerNodeRef.current) {
      // Apply volume to all pads
      const values: any = {};
      for (let i = 1; i <= 16; i++) {
        values[`pad${i}_volume`] = newVolume;
      }
      drummerNodeRef.current.setParameterValues(values);
    }
  }, []);

  /**
   * Set mute state
   */
  const setMute = useCallback((muted: boolean) => {
    setIsMuted(muted);

    if (drummerNodeRef.current) {
      drummerNodeRef.current.gain.value = muted ? 0 : 1;
    }
  }, []);

  return {
    // Plugin state
    isLoaded,
    isReady,
    error,

    // Sample management
    loadSample,
    loadKit,

    // Playback control
    triggerPad,
    schedulePattern,
    stop,

    // Volume control
    setVolume,
    setMute,

    // WAM instance access
    wamInstance: wamInstanceRef.current,
    adapter: adapterRef.current,
  };
}

// Helper to map drum types to pad numbers
function mapDrumTypeToPad(drumType: string): number | null {
  const mapping: Record<string, number> = {
    kick: 1,
    snare: 3,
    hihat: 7,
    openhat: 11,
    crash: 14,
    ride: 16,
    tom1: 5,
    tom2: 10,
    tom3: 13,
  };

  return mapping[drumType] || null;
}

// PAD_MIDI_NOTES mapping for pattern scheduling
const PAD_MIDI_NOTES: Record<number, number> = {
  1: 36, // C1 - Kick
  3: 38, // D1 - Snare
  7: 42, // F#1 - Closed HH
  11: 46, // A#1 - Open HH
  14: 49, // C#2 - Crash
  16: 51, // D#2 - Ride
};
