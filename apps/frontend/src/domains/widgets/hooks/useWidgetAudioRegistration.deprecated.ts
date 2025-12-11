/**
 * DEPRECATED: useWidgetAudioRegistration Hook
 *
 * This hook is part of the old audio registration pattern that is no longer needed.
 * In the modern architecture:
 * - Use useTrack() for individual instrument control
 * - Use useTransport() for playback control
 * - No registration is needed - instruments are managed automatically
 *
 * This file provides empty implementations for backward compatibility.
 */

import { useCallback } from 'react';
import type { AudioSourceConfig } from '@/domains/playback/types/audio';

// Re-export the original interfaces for compatibility
export interface WidgetAudioSourceConfig extends AudioSourceConfig {
  widgetId: string;
  widgetType:
    | 'bass'
    | 'metronome'
    | 'drums'
    | 'harmony'
    | 'youtube'
    | 'fretboard';
  displayName: string;
  syncRequirements: {
    requiresPreciseSync: boolean;
    latencyTolerance: number;
    tempoSensitive: boolean;
    volumeSensitive: boolean;
  };
  priority: number;
  mixingGroup?: string;
  isActive: boolean;
  canBeSoloed: boolean;
  canBeMuted: boolean;
}

export interface UseWidgetAudioRegistrationOptions {
  widgetId: string;
  widgetType: WidgetAudioSourceConfig['widgetType'];
  displayName: string;
  audioConfig: Partial<AudioSourceConfig>;
  requiresPreciseSync?: boolean;
  latencyTolerance?: number;
  tempoSensitive?: boolean;
  volumeSensitive?: boolean;
  priority?: number;
  mixingGroup?: string;
  canBeSoloed?: boolean;
  canBeMuted?: boolean;
  autoRegister?: boolean;
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
  register: () => Promise<void>;
  unregister: () => void;
  setVolume: (volume: number) => void;
  setMute: (muted: boolean) => void;
  setSolo: (solo: boolean) => void;
  setActive: (active: boolean) => void;
  updateConfig: (updates: Partial<WidgetAudioSourceConfig>) => void;
  updateSyncRequirements: (
    requirements: Partial<WidgetAudioSourceConfig['syncRequirements']>,
  ) => void;
}

export interface UseWidgetAudioRegistrationReturn {
  state: AudioRegistrationState;
  controls: AudioRegistrationControls;
  config: WidgetAudioSourceConfig | null;
  registrationId: string | null;
}

/**
 * @deprecated This hook is no longer needed. Use useTrack() or useTransport() instead.
 */
export function useWidgetAudioRegistration(
  options: UseWidgetAudioRegistrationOptions,
): UseWidgetAudioRegistrationReturn {
  console.warn(
    `⚠️ useWidgetAudioRegistration is deprecated. Widget "${options.widgetId}" should use useTrack() or useTransport() instead.`,
  );

  // Provide empty implementations that do nothing
  const controls: AudioRegistrationControls = {
    register: useCallback(async () => {
      // No-op - registration not needed
    }, []),
    unregister: useCallback(() => {
      // No-op - registration not needed
    }, []),
    setVolume: useCallback(() => {
      // Use track.setVolume() instead
    }, []),
    setMute: useCallback(() => {
      // Use track.setMute() instead
    }, []),
    setSolo: useCallback(() => {
      // Use track.setSolo() instead
    }, []),
    setActive: useCallback(() => {
      // Tracks are always active when playing
    }, []),
    updateConfig: useCallback(() => {
      // Configuration is handled by track options
    }, []),
    updateSyncRequirements: useCallback(() => {
      // Sync is handled automatically by transport
    }, []),
  };

  const state: AudioRegistrationState = {
    isRegistered: true, // Always "registered" for compatibility
    isActive: true,
    isMuted: false,
    isSoloed: false,
    volume: 1,
    error: null,
    lastUpdated: Date.now(),
  };

  return {
    state,
    controls,
    config: null,
    registrationId: options.widgetId,
  };
}
