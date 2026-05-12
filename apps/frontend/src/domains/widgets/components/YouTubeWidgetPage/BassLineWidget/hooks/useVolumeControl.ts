'use client';

/**
 * useVolumeControl Hook (Bass-specific)
 *
 * Manages volume and mute state for the BassLineWidget:
 * - Supports both controlled and uncontrolled modes
 * - Applies volume changes to local gain node
 * - Applies volume changes to PlaybackEngine bass instrument
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
 *   gainNodeRef,
 *   audioContextRef,
 * });
 */

import { useState, useCallback, useEffect } from 'react';
import { WindowRegistry } from '@/domains/playback/services/WindowRegistry.js';
import type {
  UseBassVolumeControlOptions,
  UseBassVolumeControlReturn,
} from '../types.js';

/**
 * Hook for managing volume and mute state for the bass widget
 */
export function useVolumeControl(
  options: UseBassVolumeControlOptions
): UseBassVolumeControlReturn {
  const {
    controlledVolume,
    controlledMuted,
    onVolumeChange,
    onMuteToggle,
    gainNodeRef,
    audioContextRef,
    defaultVolume = 80,
  } = options;

  // Local state for uncontrolled mode
  const [localVolume, setLocalVolume] = useState(defaultVolume);
  const [localMuted, setLocalMuted] = useState(false);

  // Use controlled values if provided, otherwise use local state
  const volume = controlledVolume !== undefined ? controlledVolume : localVolume;
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
    [onVolumeChange]
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
   * Apply volume changes to gain node and PlaybackEngine
   */
  useEffect(() => {
    // Update local gain node (legacy path)
    if (gainNodeRef?.current && audioContextRef?.current) {
      gainNodeRef.current.gain.setTargetAtTime(
        effectiveVolume,
        audioContextRef.current.currentTime,
        0.05 // 50ms transition
      );
    }

    // Update PlaybackEngine bass volume (new path)
    const coreServices = WindowRegistry.getCoreServices();
    const playbackEngine = coreServices?.getPlaybackEngine?.();
    if (playbackEngine) {
      playbackEngine.setInstrumentVolume('bass', effectiveVolume);
      playbackEngine.setInstrumentMuted('bass', isMuted);
    }
  }, [volume, isMuted, effectiveVolume, gainNodeRef, audioContextRef]);

  return {
    volume,
    isMuted,
    handleVolumeChange,
    handleMuteToggle,
    effectiveVolume,
  };
}
