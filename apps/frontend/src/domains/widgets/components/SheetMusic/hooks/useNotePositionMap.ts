'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { RefObject } from 'react';
import type { OpenSheetMusicDisplay } from 'opensheetmusicdisplay';
import {
  buildPositionMapFromOSMD,
  getXForPosition,
  type NotePositionMap,
  type TransportPosition,
} from '../utils/positionMapBuilder.js';

export interface UseNotePositionMapOptions {
  /** Reference to the OSMD instance */
  osmdRef: RefObject<OpenSheetMusicDisplay | null>;
  /** Whether OSMD has finished rendering */
  isReady: boolean;
  /** Notes array (used to detect when to rebuild the map) */
  notesKey: string;
  /** Beats per measure for interpolation (default: 4) */
  beatsPerMeasure?: number;
}

export interface UseNotePositionMapReturn {
  /** The current position map (null if not built yet) */
  positionMap: NotePositionMap | null;
  /** Get X position for a transport position */
  getX: (position: TransportPosition) => number | null;
  /** Whether the position map is ready for use */
  isMapReady: boolean;
  /** Manually rebuild the position map */
  rebuildMap: () => void;
}

/**
 * Hook for managing OSMD note position map
 *
 * Builds a position map after OSMD renders, allowing for accurate
 * scroll position calculations based on actual rendered note positions.
 *
 * @example
 * ```tsx
 * const { getX, isMapReady } = useNotePositionMap({
 *   osmdRef,
 *   isReady: !isLoading,
 *   notesKey: JSON.stringify(notes),
 * });
 *
 * // In scroll effect:
 * if (isMapReady && currentPosition) {
 *   const x = getX(currentPosition);
 *   if (x !== null) scrollTo(x - containerCenter);
 * }
 * ```
 */
export function useNotePositionMap({
  osmdRef,
  isReady,
  notesKey,
  beatsPerMeasure = 4,
}: UseNotePositionMapOptions): UseNotePositionMapReturn {
  const [positionMap, setPositionMap] = useState<NotePositionMap | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);

  // Track the notesKey that was used to build the current map
  const lastNotesKeyRef = useRef<string>('');

  /**
   * Build position map from current OSMD state
   */
  const rebuildMap = useCallback(() => {
    console.log(
      '[SHEETMUSIC] rebuildMap called, osmdRef.current:',
      !!osmdRef.current,
    );

    const osmd = osmdRef.current;
    if (!osmd) {
      console.log('[SHEETMUSIC] rebuildMap: No OSMD instance');
      setPositionMap(null);
      setIsMapReady(false);
      return;
    }

    const map = buildPositionMapFromOSMD(osmd);
    console.log('[SHEETMUSIC] Position map built:', {
      isValid: map.isValid,
      totalWidth: map.totalWidth,
      measureCount: map.measures.length,
      measures: map.measures.map((m) => ({
        idx: m.measureIndex,
        xStart: Math.round(m.xStart),
        xEnd: Math.round(m.xEnd),
        width: Math.round(m.width),
        beatPositions: m.beatPositions.length,
      })),
    });

    setPositionMap(map);
    setIsMapReady(map.isValid);
    lastNotesKeyRef.current = notesKey;
  }, [osmdRef, notesKey]);

  /**
   * Build map when OSMD becomes ready or notes change
   */
  useEffect(() => {
    console.log('[SHEETMUSIC] useNotePositionMap effect:', {
      isReady,
      notesKeyChanged: lastNotesKeyRef.current !== notesKey,
      hasPositionMap: !!positionMap,
    });

    if (!isReady) {
      // OSMD not ready yet, clear the map
      console.log('[SHEETMUSIC] OSMD not ready, clearing map');
      setPositionMap(null);
      setIsMapReady(false);
      return;
    }

    // Check if we need to rebuild (notes changed or first build)
    if (lastNotesKeyRef.current !== notesKey || !positionMap) {
      console.log('[SHEETMUSIC] Scheduling map rebuild in 100ms');
      // Use a small delay to ensure OSMD has fully rendered
      // OSMD render is async and DOM updates need to complete
      const timeoutId = setTimeout(() => {
        rebuildMap();
      }, 100);

      return () => clearTimeout(timeoutId);
    }
  }, [isReady, notesKey, positionMap, rebuildMap]);

  /**
   * Get X position for a transport position
   * Memoized to avoid recreating on every render
   */
  const getX = useCallback(
    (position: TransportPosition): number | null => {
      if (!positionMap) return null;
      return getXForPosition(positionMap, position, beatsPerMeasure);
    },
    [positionMap, beatsPerMeasure],
  );

  return {
    positionMap,
    getX,
    isMapReady,
    rebuildMap,
  };
}
