'use client';

/**
 * useTempoControl Hook
 *
 * Manages tempo state for the GlobalControls component including:
 * - Local tempo state synchronized with transport
 * - Tempo change handling with debouncing
 * - Drag state for responsive UI during slider interactions
 * - Tempo sync with musicalTruth authority
 *
 * @example
 * const {
 *   localTempo,
 *   isDragging,
 *   handleTempoChange,
 *   handleDragStart,
 *   handleDragEnd,
 * } = useTempoControl({ transport });
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { musicalTruth } from '@/domains/playback/modules/tempo/MusicalTruthAuthority';
import { logger } from '@/utils/logger';

/**
 * Transport interface subset for tempo control
 */
export interface TempoControlTransport {
  tempo: number;
  setTempo: (tempo: number) => Promise<void>;
}

/**
 * Options for the useTempoControl hook
 */
export interface UseTempoControlOptions {
  /** Transport context providing tempo state and setTempo method */
  transport: TempoControlTransport;
  /** Initial tempo value (defaults to transport.tempo or 120) */
  initialTempo?: number;
}

/**
 * Return type for the useTempoControl hook
 */
export interface UseTempoControlReturn {
  /** Current local tempo value for UI display */
  localTempo: number;
  /** Whether user is currently dragging the tempo slider */
  isDragging: boolean;
  /** Handler for tempo value changes */
  handleTempoChange: (newTempo: number) => Promise<void>;
  /** Handler for drag start (mousedown/touchstart) */
  handleDragStart: () => void;
  /** Handler for drag end (mouseup/touchend) */
  handleDragEnd: () => void;
  /** Ref to track last user-set tempo for sync conflict resolution */
  lastUserTempoRef: React.MutableRefObject<number | null>;
}

/**
 * Hook for managing tempo control state and synchronization
 */
export function useTempoControl(
  options: UseTempoControlOptions,
): UseTempoControlReturn {
  const { transport, initialTempo } = options;

  // Local tempo state for responsive UI
  const [localTempo, setLocalTempo] = useState(
    initialTempo ?? transport.tempo ?? 120,
  );
  const [isDragging, setIsDragging] = useState(false);

  // Refs for managing sync and preventing feedback loops
  const lastUserTempoRef = useRef<number | null>(transport.tempo ?? 120);
  const ignoreNextSyncRef = useRef(false);
  const tempoTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Ref to track localTempo for sync effect (prevents stale closure)
  const localTempoRef = useRef(localTempo);
  useEffect(() => {
    localTempoRef.current = localTempo;
  }, [localTempo]);

  /**
   * Handle tempo change from user input
   */
  const handleTempoChange = useCallback(
    async (newTempo: number) => {
      // 🔍 TEMPO DIAGNOSTIC: Log user tempo slider change
      console.log(
        `🎵 [TEMPO-SLIDER] useTempoControl.handleTempoChange() called`,
        {
          newTempo,
          previousLocalTempo: localTempo,
          musicalTruthUserModifiedTempoBefore:
            musicalTruth.hasUserModifiedTempo(),
        },
      );

      try {
        // Update local state immediately for responsive UI
        setLocalTempo(newTempo);
        lastUserTempoRef.current = newTempo;

        // Set flag to ignore the next sync update to prevent feedback
        ignoreNextSyncRef.current = true;

        // Update tempo using transport (which calls musicalTruth.setBPM)
        await transport.setTempo(newTempo);

        // Clear any pending sync timeout
        if (tempoTimeoutRef.current) {
          clearTimeout(tempoTimeoutRef.current);
        }

        // Reset ignore flag after tempo change
        // TEMPO FIX: Increased timeout from 100ms to 500ms to allow React state propagation
        tempoTimeoutRef.current = setTimeout(() => {
          ignoreNextSyncRef.current = false;
        }, 500);
      } catch (error) {
        logger.error('Error setting tempo:', error);
      }
    },
    [transport, localTempo],
  );

  /**
   * Sync local state with transport tempo
   */
  useEffect(() => {
    if (!isDragging && !ignoreNextSyncRef.current && transport.tempo) {
      const tempoThreshold = 1;
      const currentLocalTempo = localTempoRef.current;

      if (Math.abs(transport.tempo - currentLocalTempo) > tempoThreshold) {
        const userModifiedTempo = musicalTruth.hasUserModifiedTempo();

        // 🔍 TEMPO DIAGNOSTIC: Log sync effect attempting to update localTempo
        console.log(`🎵 [TEMPO-SYNC] Sync effect updating localTempo`, {
          fromLocalTempo: currentLocalTempo,
          toTransportTempo: transport.tempo,
          isDragging,
          ignoreNextSync: ignoreNextSyncRef.current,
          musicalTruthUserModifiedTempo: userModifiedTempo,
          lastUserTempo: lastUserTempoRef.current,
        });

        // Skip sync if user recently modified tempo and values differ
        if (userModifiedTempo && lastUserTempoRef.current !== null) {
          if (
            Math.abs(transport.tempo - lastUserTempoRef.current) >
            tempoThreshold
          ) {
            console.log(
              `🎵 [TEMPO-SYNC] Skipping sync - user tempo ${lastUserTempoRef.current} differs from transport ${transport.tempo}`,
            );
            return;
          }
        }

        setLocalTempo(transport.tempo);
      }
    }
  }, [transport.tempo, isDragging]);

  /**
   * Handle drag start
   */
  const handleDragStart = useCallback(() => {
    setIsDragging(true);
    ignoreNextSyncRef.current = true;
  }, []);

  /**
   * Handle drag end
   */
  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
    // Keep ignoring sync updates for a bit after release
    setTimeout(() => {
      ignoreNextSyncRef.current = false;
    }, 300);
  }, []);

  /**
   * Global event listeners for drag end (handles drag ending outside slider)
   */
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDragging) {
        handleDragEnd();
      }
    };

    const handleGlobalTouchEnd = () => {
      if (isDragging) {
        handleDragEnd();
      }
    };

    document.addEventListener('mouseup', handleGlobalMouseUp);
    document.addEventListener('touchend', handleGlobalTouchEnd);

    return () => {
      document.removeEventListener('mouseup', handleGlobalMouseUp);
      document.removeEventListener('touchend', handleGlobalTouchEnd);
    };
  }, [isDragging, handleDragEnd]);

  /**
   * Cleanup timeouts on unmount
   */
  useEffect(() => {
    return () => {
      if (tempoTimeoutRef.current) {
        clearTimeout(tempoTimeoutRef.current);
      }
    };
  }, []);

  return {
    localTempo,
    isDragging,
    handleTempoChange,
    handleDragStart,
    handleDragEnd,
    lastUserTempoRef,
  };
}
