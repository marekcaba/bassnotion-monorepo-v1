'use client';

/**
 * useChordProgression Hook
 *
 * Manages chord progression state and UI:
 * - Tracks selected progression name
 * - Calculates current chord index from measure
 * - Handles progression changes
 * - Provides pattern library integration
 *
 * @example
 * const {
 *   selectedProgression,
 *   localCurrentChord,
 *   handleProgressionChange,
 *   handlePatternLibraryChange,
 *   showPatternLibrary,
 *   setShowPatternLibrary,
 * } = useChordProgression({
 *   progression: props.progression,
 *   measureIndex,
 *   isPlaying,
 *   onProgressionChange: props.onProgressionChange,
 *   tempo,
 * });
 */

import { useState, useCallback, useMemo } from 'react';
import { useCorrelation } from '@/shared/hooks/useCorrelation';
import type {
  ChordProgressionItem,
  HarmonyPatternLibraryItem,
} from '../types.js';

/**
 * Predefined chord progressions with musical timing
 */
export const CHORD_PROGRESSIONS: Record<string, ChordProgressionItem[]> = {
  'Jazz Standard': [
    { chord: 'Dm7', duration: 1 },
    { chord: 'G7', duration: 1 },
    { chord: 'CMaj7', duration: 1 },
    { chord: 'Am7', duration: 1 },
  ],
  'Blues in C': [
    { chord: 'C7', duration: 4 },
    { chord: 'F7', duration: 2 },
    { chord: 'C7', duration: 2 },
    { chord: 'G7', duration: 1 },
    { chord: 'F7', duration: 1 },
    { chord: 'C7', duration: 2 },
  ],
  'Pop Progression': [
    { chord: 'C', duration: 1 },
    { chord: 'G', duration: 1 },
    { chord: 'Am', duration: 1 },
    { chord: 'F', duration: 1 },
  ],
  'Modal Jazz': [
    { chord: 'Dm7', duration: 2 },
    { chord: 'Em7', duration: 2 },
    { chord: 'FMaj7', duration: 2 },
    { chord: 'G7', duration: 2 },
  ],
  'Bossa Nova': [
    { chord: 'CMaj7', duration: 2 },
    { chord: 'Dm7', duration: 1 },
    { chord: 'G7', duration: 1 },
    { chord: 'Em7', duration: 1 },
    { chord: 'A7', duration: 1 },
    { chord: 'Dm7', duration: 1 },
    { chord: 'G7', duration: 1 },
  ],
  'Funk Groove': [
    { chord: 'Dm7', duration: 2 },
    { chord: 'Dm7', duration: 2 },
    { chord: 'G7', duration: 2 },
    { chord: 'G7', duration: 2 },
  ],
};

/**
 * Options for the useChordProgression hook
 */
export interface UseChordProgressionOptions {
  /** Current chord progression */
  progression: string[];
  /** Current measure index from visual beat hook */
  measureIndex: number;
  /** Whether playback is active */
  isPlaying: boolean;
  /** Callback when progression changes */
  onProgressionChange: (progression: string[]) => void;
  /** Current tempo (for MIDI pattern loading) */
  tempo: number;
}

/**
 * Return type for the useChordProgression hook
 */
export interface UseChordProgressionReturn {
  /** Currently selected progression name */
  selectedProgression: string;
  /** Current chord index based on measure */
  localCurrentChord: number;
  /** Handler for progression selection change */
  handleProgressionChange: (newProgression: string) => void;
  /** Handler for pattern library pattern selection */
  handlePatternLibraryChange: (
    pattern: HarmonyPatternLibraryItem,
  ) => Promise<void>;
  /** Whether pattern library is visible */
  showPatternLibrary: boolean;
  /** Set pattern library visibility */
  setShowPatternLibrary: React.Dispatch<React.SetStateAction<boolean>>;
  /** Available progression names */
  availableProgressions: string[];
}

/**
 * Hook for managing chord progression state and UI
 */
export function useChordProgression(
  options: UseChordProgressionOptions,
): UseChordProgressionReturn {
  const { progression, measureIndex, isPlaying, onProgressionChange, tempo } =
    options;

  const { correlationId, logger } = useCorrelation('useChordProgression');

  // UI state
  const [selectedProgression, setSelectedProgression] =
    useState('Jazz Standard');
  const [showPatternLibrary, setShowPatternLibrary] = useState(false);

  // Calculate current chord index from measure
  const localCurrentChord = useMemo(() => {
    if (!isPlaying || progression.length === 0) return 0;
    return measureIndex % progression.length;
  }, [isPlaying, measureIndex, progression.length]);

  // Available progression names
  const availableProgressions = useMemo(
    () => Object.keys(CHORD_PROGRESSIONS),
    [],
  );

  /**
   * Handle progression selection change
   */
  const handleProgressionChange = useCallback(
    (newProgression: string) => {
      setSelectedProgression(newProgression);
      const prog = CHORD_PROGRESSIONS[newProgression];
      if (prog) {
        onProgressionChange(prog.map((item) => item.chord));
      }
    },
    [onProgressionChange],
  );

  /**
   * Handle pattern library pattern selection
   */
  const handlePatternLibraryChange = useCallback(
    async (libraryPattern: HarmonyPatternLibraryItem) => {
      // Load MIDI file from URL
      if (libraryPattern.midiFileUrl) {
        try {
          logger.info('Loading harmony pattern from MIDI:', {
            name: libraryPattern.name,
            url: libraryPattern.midiFileUrl,
            correlationId,
          });

          // TODO: Implement full MIDI parsing for chord events
          // For now, use a simple progression based on genre
          let chords: string[] = [];

          if (libraryPattern.genre === 'jazz') {
            chords = ['Dm7', 'G7', 'CMaj7', 'Am7'];
          } else if (libraryPattern.genre === 'pop') {
            chords = ['C', 'Am', 'F', 'G'];
          } else if (libraryPattern.genre === 'rock') {
            chords = ['C5', 'G5', 'A5', 'F5'];
          } else {
            chords = ['CMaj7', 'Am7', 'Dm7', 'G7'];
          }

          if (chords.length > 0) {
            onProgressionChange(chords);
          }
        } catch (error) {
          logger.error('Failed to load harmony pattern:', error, {
            correlationId,
          });
        }
      }
    },
    [onProgressionChange, logger, correlationId],
  );

  return {
    selectedProgression,
    localCurrentChord,
    handleProgressionChange,
    handlePatternLibraryChange,
    showPatternLibrary,
    setShowPatternLibrary,
    availableProgressions,
  };
}
