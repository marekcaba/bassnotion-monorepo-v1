'use client';

/**
 * useVolumeControl Hook (Metronome-specific)
 *
 * Manages volume and mute state for the MetronomeWidget:
 * - Supports both controlled and uncontrolled modes
 * - Applies volume changes to WAM plugin
 * - Applies volume changes to PlaybackEngine metronome instrument
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
 *   metronomePluginRef,
 * });
 */

import { useState, useCallback, useEffect } from 'react';
import { WindowRegistry } from '@/domains/playback/services/WindowRegistry.js';
import type {
  UseMetronomeVolumeControlOptions,
  UseMetronomeVolumeControlReturn,
} from '../types.js';

/**
 * Hook for managing volume and mute state for the metronome widget
 */
export function useVolumeControl(
  options: UseMetronomeVolumeControlOptions,
): UseMetronomeVolumeControlReturn {
  const {
    controlledVolume,
    controlledMuted,
    onVolumeChange,
    onMuteToggle,
    metronomePluginRef,
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
    if (metronomePluginRef?.current?.audioNode) {
      metronomePluginRef.current.audioNode.setParameterValues({
        volume: effectiveVolume,
      });
    }

    // Update PlaybackEngine metronome volume (new path)
    const coreServices = WindowRegistry.getCoreServices();
    const playbackEngine = coreServices?.getPlaybackEngine?.();
    if (playbackEngine) {
      playbackEngine.setInstrumentVolume('metronome', effectiveVolume);
      playbackEngine.setInstrumentMuted('metronome', isMuted);
    }
  }, [volume, isMuted, effectiveVolume, metronomePluginRef]);

  return {
    volume,
    isMuted,
    handleVolumeChange,
    handleMuteToggle,
    effectiveVolume,
  };
}
