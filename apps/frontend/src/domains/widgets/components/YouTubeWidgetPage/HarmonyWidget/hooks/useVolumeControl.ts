'use client';

/**
 * useVolumeControl Hook
 *
 * Manages volume and mute state for the HarmonyWidget:
 * - Supports both controlled and uncontrolled modes
 * - Applies volume changes to WAM plugin
 * - Applies volume changes to PlaybackEngine
 *
 * @example
 * const {
 *   volume,
 *   isMuted,
 *   handleVolumeChange,
 *   handleMuteToggle,
 * } = useVolumeControl({
 *   controlledVolume: props.volume,
 *   controlledMuted: props.isMuted,
 *   onVolumeChange: props.onVolumeChange,
 *   onMuteToggle: props.onMuteToggle,
 * });
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { WindowRegistry } from '@/domains/playback/services/WindowRegistry.js';
import { isVerboseDebugEnabled } from '@/config/debug';
import type { WamKeyboardPlugin } from '../types.js';

/**
 * Options for the useVolumeControl hook
 */
export interface UseVolumeControlOptions {
  /** Controlled volume value (0-100) */
  controlledVolume?: number;
  /** Controlled mute state */
  controlledMuted?: boolean;
  /** Callback when volume changes (for controlled mode) */
  onVolumeChange?: (volume: number) => void;
  /** Callback when mute state changes (for controlled mode) */
  onMuteToggle?: () => void;
  /** Reference to the keyboard plugin for direct volume control */
  keyboardPluginRef?: React.RefObject<WamKeyboardPlugin | null>;
  /** Default volume when uncontrolled (0-100) */
  defaultVolume?: number;
}

/**
 * Return type for the useVolumeControl hook
 */
export interface UseVolumeControlReturn {
  /** Current volume level (0-100) */
  volume: number;
  /** Whether audio is muted */
  isMuted: boolean;
  /** Handler for volume changes */
  handleVolumeChange: (newVolume: number) => void;
  /** Handler for mute toggle */
  handleMuteToggle: () => void;
  /** Effective volume (0 if muted, otherwise volume/100) */
  effectiveVolume: number;
}

/**
 * Hook for managing volume and mute state
 */
export function useVolumeControl(
  options: UseVolumeControlOptions,
): UseVolumeControlReturn {
  const {
    controlledVolume,
    controlledMuted,
    onVolumeChange,
    onMuteToggle,
    keyboardPluginRef,
    defaultVolume = 80,
  } = options;

  // Local state for uncontrolled mode
  const [localVolume, setLocalVolume] = useState(defaultVolume);
  const [localMuted, setLocalMuted] = useState(false);

  // Use controlled values if provided, otherwise use local state
  const volume =
    controlledVolume !== undefined ? controlledVolume : localVolume;
  const isMuted = controlledMuted !== undefined ? controlledMuted : localMuted;
  const effectiveVolume = isMuted ? 0 : volume / 100;

  /**
   * Handle volume change
   */
  const handleVolumeChange = useCallback(
    (newVolume: number) => {
      if (onVolumeChange) {
        onVolumeChange(newVolume);
      } else {
        setLocalVolume(newVolume);
      }
    },
    [onVolumeChange],
  );

  /**
   * Handle mute toggle
   */
  const handleMuteToggle = useCallback(() => {
    if (onMuteToggle) {
      onMuteToggle();
    } else {
      setLocalMuted((prev) => !prev);
    }
  }, [onMuteToggle]);

  /**
   * Apply volume changes to WAM plugin and PlaybackEngine
   */
  useEffect(() => {
    // Update WAM plugin volume (legacy path)
    if (keyboardPluginRef?.current?.audioNode) {
      keyboardPluginRef.current.audioNode.setParameterValues({
        volume: effectiveVolume,
      });
    }

    // Update PlaybackEngine harmony volume (new path)
    const coreServices = WindowRegistry.getCoreServices();
    const playbackEngine = coreServices?.getPlaybackEngine?.();
    if (playbackEngine) {
      playbackEngine.setInstrumentVolume('harmony', effectiveVolume);
      playbackEngine.setInstrumentMuted('harmony', isMuted);
      if (isVerboseDebugEnabled()) {
        console.log('[HARMONY-WIDGET] Volume updated via PlaybackEngine:', {
          volume,
          isMuted,
          effectiveVolume,
        });
      }
    }
  }, [volume, isMuted, effectiveVolume, keyboardPluginRef]);

  return {
    volume,
    isMuted,
    handleVolumeChange,
    handleMuteToggle,
    effectiveVolume,
  };
}
