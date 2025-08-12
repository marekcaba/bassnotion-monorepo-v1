/**
 * useWidgetAudioRegistration Hook
 *
 * Provides automatic audio source registration and lifecycle management for widgets.
 * Integrates with Core Playback Engine and Widget Sync system for global playback synchronization.
 *
 * Part of Story 3.14: Global Playback Synchronization
 * Task 2.1: Widget Audio Registration System
 */

import { useEffect, useCallback, useRef, useState } from 'react';
import { useCorePlaybackEngine } from '@/domains/playback/hooks/useCorePlaybackEngine';
// Removed useWidgetSync - part of old pattern registration system
import type { AudioSourceConfig } from '@/domains/playback/types/audio';

// ============================================================================
// INTERFACES
// ============================================================================

export interface WidgetAudioSourceConfig extends AudioSourceConfig {
  // Widget-specific metadata
  widgetId: string;
  widgetType:
    | 'bass'
    | 'metronome'
    | 'drums'
    | 'harmony'
    | 'youtube'
    | 'fretboard';
  displayName: string;

  // Sync requirements
  syncRequirements: {
    requiresPreciseSync: boolean;
    latencyTolerance: number; // milliseconds
    tempoSensitive: boolean;
    volumeSensitive: boolean;
  };

  // Priority and mixing
  priority: number; // 1-10, higher = more important
  mixingGroup?: string; // Group for collective volume control

  // Widget state
  isActive: boolean;
  canBeSoloed: boolean;
  canBeMuted: boolean;
}

export interface UseWidgetAudioRegistrationOptions {
  // Widget identification
  widgetId: string;
  widgetType: WidgetAudioSourceConfig['widgetType'];
  displayName: string;

  // Audio configuration
  audioConfig: Omit<AudioSourceConfig, 'id'>;

  // Sync requirements
  requiresPreciseSync?: boolean;
  latencyTolerance?: number;
  tempoSensitive?: boolean;
  volumeSensitive?: boolean;

  // Priority and mixing
  priority?: number;
  mixingGroup?: string;

  // Control options
  canBeSoloed?: boolean;
  canBeMuted?: boolean;

  // Lifecycle callbacks
  onRegistered?: (config: WidgetAudioSourceConfig) => void;
  onUnregistered?: (widgetId: string) => void;
  onError?: (error: Error) => void;

  // Auto-registration
  autoRegister?: boolean; // Default: true
}

export interface AudioRegistrationState {
  isRegistered: boolean;
  isActive: boolean;
  isMuted: boolean;
  isSoloed: boolean;
  volume: number;
  error: string | null;
  lastUpdated: number;
}

export interface AudioRegistrationControls {
  // Registration lifecycle
  register: () => Promise<void>;
  unregister: () => void;

  // Audio controls
  setVolume: (volume: number) => void;
  setMute: (muted: boolean) => void;
  setSolo: (solo: boolean) => void;
  setActive: (active: boolean) => void;

  // Configuration updates
  updateConfig: (updates: Partial<WidgetAudioSourceConfig>) => void;
  updateSyncRequirements: (
    requirements: Partial<WidgetAudioSourceConfig['syncRequirements']>,
  ) => void;
}

export interface UseWidgetAudioRegistrationReturn {
  // State
  state: AudioRegistrationState;

  // Controls
  controls: AudioRegistrationControls;

  // Configuration
  config: WidgetAudioSourceConfig | null;

  // Registration status
  registrationId: string | null;
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

export function useWidgetAudioRegistration(
  options: UseWidgetAudioRegistrationOptions,
): UseWidgetAudioRegistrationReturn {
  const {
    widgetId,
    widgetType,
    displayName,
    audioConfig,
    requiresPreciseSync = false,
    latencyTolerance = 50,
    tempoSensitive = true,
    volumeSensitive = true,
    priority = 5,
    mixingGroup,
    canBeSoloed = true,
    canBeMuted = true,
    autoRegister = true,
    onRegistered,
    onUnregistered,
    onError,
  } = options;

  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================

  const [isRegistered, setIsRegistered] = useState(false);
  const [isActive, setIsActiveState] = useState(false);
  const [isMuted, setIsMutedState] = useState(false);
  const [isSoloed, setIsSoloedState] = useState(false);
  const [volume, setVolumeState] = useState(1.0);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState(Date.now());
  const [registrationId, setRegistrationId] = useState<string | null>(null);

  // Configuration ref
  const configRef = useRef<WidgetAudioSourceConfig | null>(null);

  // ============================================================================
  // CORE INTEGRATIONS
  // ============================================================================

  // Core Playback Engine integration
  const { controls: playbackControls, state: playbackState } =
    useCorePlaybackEngine({
      autoInitialize: false, // Disable auto-initialization to prevent autoplay violations
      enablePerformanceMonitoring: true,
    });

  // Widget Sync integration - DISABLED: Part of old pattern registration system
  // TODO: Migrate to track-based system
  const syncActions = {
    emitAudioSourceRegistered: () => {},
    emitAudioSourceUnregistered: () => {}
  };

  // ============================================================================
  // CONFIGURATION BUILDING
  // ============================================================================

  const buildAudioSourceConfig = useCallback((): WidgetAudioSourceConfig => {
    return {
      ...audioConfig,
      id: widgetId,
      widgetId,
      widgetType,
      displayName,
      syncRequirements: {
        requiresPreciseSync,
        latencyTolerance,
        tempoSensitive,
        volumeSensitive,
      },
      priority,
      mixingGroup,
      isActive,
      canBeSoloed,
      canBeMuted,
      volume,
      muted: isMuted,
      solo: isSoloed,
    };
  }, [
    audioConfig,
    widgetId,
    widgetType,
    displayName,
    requiresPreciseSync,
    latencyTolerance,
    tempoSensitive,
    volumeSensitive,
    priority,
    mixingGroup,
    isActive,
    canBeSoloed,
    canBeMuted,
    volume,
    isMuted,
    isSoloed,
  ]);

  // ============================================================================
  // REGISTRATION LIFECYCLE
  // ============================================================================

  const register = useCallback(async () => {
    if (isRegistered) return;

    try {
      setError(null);

      // Build configuration
      const config = buildAudioSourceConfig();
      configRef.current = config;

      // Register with Core Playback Engine
      await playbackControls.registerAudioSource(config);

      // Emit registration event
      syncActions.emitEvent(
        'AUDIO_SOURCE_REGISTERED',
        {
          widgetId,
          config,
        },
        'high',
      );

      setIsRegistered(true);
      setRegistrationId(widgetId);
      setLastUpdated(Date.now());

      if (onRegistered) {
        onRegistered(config);
      }

      // Debug log disabled for performance
      // console.log(`[${widgetId}] Audio source registered successfully`);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Registration failed';
      setError(errorMessage);

      if (onError) {
        onError(err instanceof Error ? err : new Error(errorMessage));
      }

      console.error(`[${widgetId}] Audio registration failed:`, err);
    }
  }, [
    isRegistered,
    buildAudioSourceConfig,
    playbackControls,
    syncActions,
    widgetId,
    onRegistered,
    onError,
  ]);

  const unregister = useCallback(() => {
    if (!isRegistered) return;

    try {
      // Unregister from Core Playback Engine
      playbackControls.unregisterAudioSource(widgetId);

      // Emit unregistration event
      syncActions.emitEvent(
        'AUDIO_SOURCE_UNREGISTERED',
        {
          widgetId,
        },
        'high',
      );

      setIsRegistered(false);
      setRegistrationId(null);
      setError(null);
      setLastUpdated(Date.now());
      configRef.current = null;

      if (onUnregistered) {
        onUnregistered(widgetId);
      }

      // Debug log disabled for performance
      // console.log(`[${widgetId}] Audio source unregistered`);
    } catch (err) {
      console.error(`[${widgetId}] Unregistration failed:`, err);
    }
  }, [isRegistered, playbackControls, syncActions, widgetId, onUnregistered]);

  // ============================================================================
  // AUDIO CONTROLS
  // ============================================================================

  const setVolume = useCallback(
    (newVolume: number) => {
      const clampedVolume = Math.max(0, Math.min(1, newVolume));

      if (isRegistered) {
        playbackControls.setSourceVolume(widgetId, clampedVolume);
        syncActions.emitEvent(
          'VOLUME_CHANGE',
          {
            widgetId,
            volume: clampedVolume,
          },
          'normal',
        );
      }

      setVolumeState(clampedVolume);
      setLastUpdated(Date.now());
    },
    [isRegistered, playbackControls, syncActions, widgetId],
  );

  const setMute = useCallback(
    (muted: boolean) => {
      if (isRegistered) {
        playbackControls.setSourceMute(widgetId, muted);
        syncActions.emitEvent(
          'MUTE_CHANGE',
          {
            widgetId,
            muted,
          },
          'high',
        );
      }

      setIsMutedState(muted);
      setLastUpdated(Date.now());
    },
    [isRegistered, playbackControls, syncActions, widgetId],
  );

  const setSolo = useCallback(
    (solo: boolean) => {
      if (isRegistered) {
        playbackControls.setSourceSolo(widgetId, solo);
        syncActions.emitEvent(
          'SOLO_CHANGE',
          {
            widgetId,
            solo,
          },
          'high',
        );
      }

      setIsSoloedState(solo);
      setLastUpdated(Date.now());
    },
    [isRegistered, playbackControls, syncActions, widgetId],
  );

  const setActive = useCallback(
    (active: boolean) => {
      setIsActiveState(active);
      setLastUpdated(Date.now());

      // Re-register with updated config if already registered
      if (isRegistered) {
        // Debounce re-registration to avoid rapid updates
        setTimeout(() => {
          if (configRef.current) {
            configRef.current.isActive = active;
            playbackControls.registerAudioSource(configRef.current);
          }
        }, 100);
      }
    },
    [isRegistered, playbackControls],
  );

  // ============================================================================
  // CONFIGURATION UPDATES
  // ============================================================================

  const updateConfig = useCallback(
    (updates: Partial<WidgetAudioSourceConfig>) => {
      if (!configRef.current) return;

      configRef.current = { ...configRef.current, ...updates };

      if (isRegistered) {
        playbackControls.registerAudioSource(configRef.current);
        setLastUpdated(Date.now());
      }
    },
    [isRegistered, playbackControls],
  );

  const updateSyncRequirements = useCallback(
    (requirements: Partial<WidgetAudioSourceConfig['syncRequirements']>) => {
      if (!configRef.current) return;

      configRef.current.syncRequirements = {
        ...configRef.current.syncRequirements,
        ...requirements,
      };

      if (isRegistered) {
        playbackControls.registerAudioSource(configRef.current);
        setLastUpdated(Date.now());
      }
    },
    [isRegistered, playbackControls],
  );

  // ============================================================================
  // EFFECT HOOKS
  // ============================================================================

  // Auto-register on mount if enabled
  useEffect(() => {
    if (autoRegister && playbackState.isInitialized && !isRegistered) {
      register().catch(console.error);
    }
  }, [autoRegister, playbackState.isInitialized, isRegistered, register]); // Include register in deps but register should be stable

  // Auto-unregister on unmount
  useEffect(() => {
    return () => {
      // Use ref to get the current state to avoid stale closure
      if (configRef.current && registrationId) {
        playbackControls.unregisterAudioSource(widgetId);
        syncActions.emitEvent(
          'AUDIO_SOURCE_UNREGISTERED',
          {
            widgetId,
          },
          'high',
        );
      }
    };
  }, [widgetId, playbackControls, syncActions]);

  // ============================================================================
  // RETURN OBJECT
  // ============================================================================

  return {
    // State
    state: {
      isRegistered,
      isActive,
      isMuted,
      isSoloed,
      volume,
      error,
      lastUpdated,
    },

    // Controls
    controls: {
      register,
      unregister,
      setVolume,
      setMute,
      setSolo,
      setActive,
      updateConfig,
      updateSyncRequirements,
    },

    // Configuration
    config: configRef.current,

    // Registration status
    registrationId,
  };
}
