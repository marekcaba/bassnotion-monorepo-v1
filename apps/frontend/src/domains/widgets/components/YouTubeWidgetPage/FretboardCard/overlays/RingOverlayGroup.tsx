'use client';

/**
 * RingOverlayGroup - Container for Multiple Floating Rings
 *
 * This component manages the collection of FloatingTorusRing components,
 * filtering the timeline to show only upcoming notes within the lookahead window.
 *
 * Responsibilities:
 * 1. Filter timeline entries to find upcoming notes
 * 2. Exclude notes during countdown period
 * 3. Limit the number of visible rings based on config
 * 4. Use the provided 2D-to-3D coordinate mapping function from parent
 *
 * @module RingOverlayGroup
 * @since Phase 1 - Foundation
 */

import { useMemo, useCallback } from 'react';
import type { NoteTimelineEntry } from '@/domains/widgets/hooks/useFretboardNoteSync';
import type { RingOverlayConfig } from './RingOverlayConfig.js';
import { FloatingTorusRing } from './FloatingTorusRing.js';
import type { Position3D } from './utils/fretboardTo3DCoords.js';

/**
 * Props for the RingOverlayGroup component.
 */
export interface RingOverlayGroupProps {
  /** Full note timeline from useFretboardNoteSync */
  timeline: NoteTimelineEntry[];
  /** Current playback time in seconds */
  currentTime: number;
  /** Ring overlay configuration */
  config: RingOverlayConfig;
  /**
   * Function to convert fretboard position (stringIndex, fret) to 3D world coordinates.
   * This should come from Ring3DOverlayCanvas to ensure coordinate system consistency.
   */
  get3DPosition: (stringIndex: number, fret: number | 'open') => Position3D;
  /** Number of countdown beats before exercise (to exclude from rings) */
  countdownBeats?: number;
  /** Tempo in BPM (for countdown calculation) */
  tempo?: number;
}

/**
 * Calculate the duration of countdown in seconds.
 *
 * @param countdownBeats - Number of countdown beats
 * @param tempo - Tempo in BPM
 * @returns Duration in seconds
 */
function getCountdownDuration(countdownBeats: number, tempo: number): number {
  if (tempo <= 0) return 0;
  // Each beat is 60/tempo seconds
  return (countdownBeats * 60) / tempo;
}

/**
 * RingOverlayGroup filters the timeline and renders FloatingTorusRing components
 * for upcoming notes within the lookahead window.
 */
export function RingOverlayGroup({
  timeline,
  currentTime,
  config,
  get3DPosition,
  countdownBeats = 4,
  tempo = 120,
}: RingOverlayGroupProps): JSX.Element {
  // Wrapper to ensure correct return type for FloatingTorusRing
  const get3DPositionTyped = useCallback(
    (stringIndex: number, fret: number | 'open'): [number, number, number] => {
      return get3DPosition(stringIndex, fret);
    },
    [get3DPosition]
  );

  // Calculate countdown end time to exclude countdown notes
  const countdownEndTime = useMemo(() => {
    return getCountdownDuration(countdownBeats, tempo);
  }, [countdownBeats, tempo]);

  // Filter timeline to get upcoming notes within lookahead window
  // Exclude: rests, past notes, notes during countdown
  const upcomingNotes = useMemo(() => {
    const lookaheadSec = config.lookaheadMs / 1000;
    const windowEnd = currentTime + lookaheadSec;

    return timeline
      .filter((entry) => {
        // Only include notes, not rests
        if (entry.type !== 'note') return false;

        // Exclude notes that have already passed
        if (entry.startTime <= currentTime) return false;

        // Exclude notes outside lookahead window
        if (entry.startTime > windowEnd) return false;

        // Exclude notes during countdown period
        if (entry.startTime < countdownEndTime) return false;

        return true;
      })
      .slice(0, config.showUpcoming);
  }, [timeline, currentTime, config.lookaheadMs, config.showUpcoming, countdownEndTime]);

  return (
    <group name="ring-overlay-group">
      {upcomingNotes.map((note, index) => (
        <FloatingTorusRing
          key={`ring-${note.noteIndex}-${note.startTime}`}
          note={note}
          currentTime={currentTime}
          config={config}
          get3DPosition={get3DPositionTyped}
          ringIndex={index}
        />
      ))}
    </group>
  );
}
