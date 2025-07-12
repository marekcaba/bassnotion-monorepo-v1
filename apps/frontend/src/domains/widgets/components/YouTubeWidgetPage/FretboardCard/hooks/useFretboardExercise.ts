import { useMemo, useCallback, useEffect, useRef } from 'react';
import type { SyncedWidgetRenderProps } from '../../../base';
import type { ExerciseNote } from '@bassnotion/contracts';
import type {
  Fret,
  BasslineData,
  CustomBasslineEvent,
} from '../types/fretboardTypes';
import { useAudioFretboard } from '../../../../hooks/useAudioFretboard';

/**
 * Hook to manage exercise integration with the fretboard
 */
export const useFretboardExercise = (
  syncProps: SyncedWidgetRenderProps,
  options?: {
    setSelectedDots?: (dots: Map<string, number[]>) => void;
    autoPopulateOnExerciseLoad?: boolean;
    onManualReset?: () => void;
    stringCount?: 4 | 5 | 6;
  },
) => {
  // Extract options with defaults
  const {
    setSelectedDots,
    autoPopulateOnExerciseLoad = true,
    onManualReset,
    stringCount = 4,
  } = options || {};

  // Audio fretboard integration with dynamic string count
  const audioIntegration = useAudioFretboard({
    stringCount: stringCount === 6 ? 5 : stringCount === 5 ? 5 : 4, // Ensure audio system gets correct string count
    autoPlayOnClick: true,
  });

  // Track if user has manually reset to prevent auto-population
  const userHasManuallyResetRef = useRef(false);
  const lastExerciseIdRef = useRef<string | null>(null);
  const lastPopulationTimestampRef = useRef<number>(0);

  // Extract exercise data from sync props
  const exerciseData = useMemo(() => {
    const selectedExercise = syncProps.selectedExercise;
    const exerciseNotes = selectedExercise?.notes || [];
    const hasExercise = !!selectedExercise && exerciseNotes.length > 0;

    return {
      selectedExercise,
      exerciseNotes,
      hasExercise,
      exerciseProgress: hasExercise ? (exerciseNotes.length / 100) * 100 : 0, // Simple progress calculation
    };
  }, [syncProps.selectedExercise]);

  // Check if a position matches an exercise note
  const isExerciseNote = useCallback(
    (stringIndex: number, fret: Fret): boolean => {
      if (!exerciseData.hasExercise) return false;

      return exerciseData.exerciseNotes.some((note: ExerciseNote) => {
        // Use the same mapping logic as convertExerciseNotesToSelectedDots
        // Determine the string count of the exercise by finding the max string number
        const maxString = Math.max(
          ...exerciseData.exerciseNotes.map((n: ExerciseNote) => n.string),
        );

        let noteStringIndex: number;

        if (maxString <= 4) {
          // 4-string bass exercise: strings 1-4 map to E(1), A(2), D(3), G(4)
          noteStringIndex = note.string; // string 1 -> index 1, string 2 -> index 2, etc.
        } else if (maxString <= 5) {
          // 5-string bass exercise: strings 1-5 map to B(0), E(1), A(2), D(3), G(4)
          noteStringIndex = note.string - 1; // string 1 -> index 0, string 2 -> index 1, etc.
        } else {
          // 6-string bass exercise: strings 1-6 map to B(0), E(1), A(2), D(3), G(4), C(5)
          noteStringIndex = note.string - 1; // string 1 -> index 0, string 2 -> index 1, etc.
        }

        const noteFret = note.fret === 0 ? 'open' : note.fret;

        return noteStringIndex === stringIndex && noteFret === fret;
      });
    },
    [exerciseData.exerciseNotes, exerciseData.hasExercise],
  );

  // Check if a position is the current note being played
  const isCurrentNote = useCallback(
    (stringIndex: number, fret: Fret): boolean => {
      // Convert absolute string index to relative index for audio system
      let relativeStringIndex = stringIndex;

      if (stringCount === 4) {
        if (stringIndex >= 1 && stringIndex <= 4) {
          relativeStringIndex = 4 - stringIndex;
        }
      } else if (stringCount >= 5) {
        if (stringIndex >= 0 && stringIndex <= 4) {
          relativeStringIndex = 4 - stringIndex;
        }
      }

      return audioIntegration.isCurrentNote(relativeStringIndex, fret);
    },
    [audioIntegration, stringCount],
  );

  // Get exercise note at specific position
  const getExerciseNoteAt = useCallback(
    (stringIndex: number, fret: Fret): ExerciseNote | null => {
      if (!exerciseData.hasExercise) return null;

      const foundNote = exerciseData.exerciseNotes.find(
        (note: ExerciseNote) => {
          const noteStringIndex = note.string - 1; // Convert 1-based to 0-based
          const noteFret = note.fret === 0 ? 'open' : note.fret;

          return noteStringIndex === stringIndex && noteFret === fret;
        },
      );

      return foundNote || null;
    },
    [exerciseData.exerciseNotes, exerciseData.hasExercise],
  );

  // Create bassline data from selected dots for sync events
  const createBasslineData = useCallback(
    (selectedDots: Map<string, number[]>): BasslineData[] => {
      const basslineData: BasslineData[] = [];

      selectedDots.forEach((orders, positionKey) => {
        // Safe parsing of position key
        if (!positionKey.includes(',')) return;
        const indexOfComma = positionKey.indexOf(',');
        const stringIndexStr = positionKey.substring(0, indexOfComma);
        const fretStr = positionKey.substring(indexOfComma + 1);
        if (!stringIndexStr || !fretStr) return;
        const stringIndex = parseInt(stringIndexStr, 10);
        const fret: Fret = fretStr === 'open' ? 'open' : parseInt(fretStr, 10);

        // Create bassline entry for each order number at this position
        orders.forEach((order) => {
          // Get note name from string configs if available
          const stringConfigs = audioIntegration.stringConfigs;
          const noteBase =
            stringConfigs[4]?.[stringIndex] ||
            stringConfigs[5]?.[stringIndex] ||
            'E';

          basslineData.push({
            stringIndex,
            fret,
            order,
            note: fret === 'open' ? noteBase : `${noteBase}${fret}`, // Simple note naming
          });
        });
      });

      // Sort by order
      return basslineData.sort((a, b) => a.order - b.order);
    },
    [audioIntegration.stringConfigs],
  );

  // Emit bassline sync event
  const emitBasslineEvent = useCallback(
    (selectedDots: Map<string, number[]>) => {
      const basslineData = createBasslineData(selectedDots);

      const customEvent: CustomBasslineEvent = {
        bassline: basslineData,
        source: 'interactive-fretboard',
        timestamp: Date.now(),
      };

      // Emit through sync system
      if (syncProps.sync?.actions?.emitEvent) {
        syncProps.sync.actions.emitEvent('CUSTOM_BASSLINE', customEvent);
      }
    },
    [createBasslineData, syncProps.sync],
  );

  // Audio playback functions
  const triggerNote = useCallback(
    (stringIndex: number, fret: Fret) => {
      // Convert absolute string index to relative index for audio system
      // FretboardCard uses absolute indices: B(0), E(1), A(2), D(3), G(4), C(5)
      // Audio system expects relative indices: 0-based for current string count

      let relativeStringIndex = stringIndex;

      if (stringCount === 4) {
        // 4-string bass: audio expects [0,1,2,3] for [G,D,A,E]
        // FretboardCard passes [4,3,2,1] for [G,D,A,E] (absolute indices)
        if (stringIndex >= 1 && stringIndex <= 4) {
          // Map absolute indices [1,2,3,4] to relative indices [3,2,1,0]
          // E(1) -> index 3, A(2) -> index 2, D(3) -> index 1, G(4) -> index 0
          relativeStringIndex = 4 - stringIndex;
        } else {
          // Invalid string index for 4-string bass - skip audio
          return;
        }
      } else if (stringCount >= 5) {
        // 5+ string bass: audio expects [0,1,2,3,4] for [G,D,A,E,B]
        // FretboardCard passes [0,1,2,3,4] for [B,E,A,D,G] (absolute indices)
        if (stringIndex >= 0 && stringIndex <= 4) {
          // Map absolute indices [0,1,2,3,4] to relative indices [4,3,2,1,0]
          // B(0) -> index 4, E(1) -> index 3, A(2) -> index 2, D(3) -> index 1, G(4) -> index 0
          relativeStringIndex = 4 - stringIndex;
        } else {
          // Invalid string index for 5+ string bass - skip audio
          return;
        }
      }

      audioIntegration.triggerNote(relativeStringIndex, fret);
    },
    [audioIntegration, stringCount],
  );

  const createNoteEvent = useCallback(
    (stringIndex: number, fret: Fret) => {
      // Convert absolute string index to relative index for audio system
      let relativeStringIndex = stringIndex;

      if (stringCount === 4) {
        if (stringIndex >= 1 && stringIndex <= 4) {
          relativeStringIndex = 4 - stringIndex;
        }
      } else if (stringCount >= 5) {
        if (stringIndex >= 0 && stringIndex <= 4) {
          relativeStringIndex = 4 - stringIndex;
        }
      }

      return audioIntegration.createNoteEvent(relativeStringIndex, fret);
    },
    [audioIntegration, stringCount],
  );

  // Convert exercise notes to fretboard selected dots format
  const convertExerciseNotesToSelectedDots = useCallback(
    (exerciseNotes: ExerciseNote[]): Map<string, number[]> => {
      const selectedDots = new Map<string, number[]>();

      exerciseNotes.forEach((note, index) => {
        // Map exercise strings to full 6-string layout indices
        // Full layout: B(0), E(1), A(2), D(3), G(4), C(5)

        // Determine the string count of the exercise by finding the max string number
        const maxString = Math.max(
          ...exerciseNotes.map((n: ExerciseNote) => n.string),
        );

        let stringIndex: number;

        if (maxString <= 4) {
          // 4-string bass exercise: strings 1-4 map to E(1), A(2), D(3), G(4)
          stringIndex = note.string; // string 1 -> index 1, string 2 -> index 2, etc.
        } else if (maxString <= 5) {
          // 5-string bass exercise: strings 1-5 map to B(0), E(1), A(2), D(3), G(4)
          stringIndex = note.string - 1; // string 1 -> index 0, string 2 -> index 1, etc.
        } else {
          // 6-string bass exercise: strings 1-6 map to B(0), E(1), A(2), D(3), G(4), C(5)
          stringIndex = note.string - 1; // string 1 -> index 0, string 2 -> index 1, etc.
        }

        // Convert fret number (0 means open string)
        const fret: Fret = note.fret === 0 ? 'open' : note.fret;

        // Create position key in the format expected by fretboard
        const positionKey = `${stringIndex},${fret}`;

        // Assign order number (sequential from 1)
        const orderNumber = index + 1;

        // Store in map
        selectedDots.set(positionKey, [orderNumber]);
      });

      return selectedDots;
    },
    [],
  );

  // Auto-populate fretboard when exercise loads or is re-selected
  useEffect(() => {
    const currentExerciseId = exerciseData.selectedExercise?.id || null;
    const currentTimestamp = Date.now();

    // Check if this is a new exercise selection or re-selection
    const isNewExercise = currentExerciseId !== lastExerciseIdRef.current;
    // At least 500ms between populations (not currently used but kept for future reference)
    // const isRecentSelection = currentTimestamp - lastPopulationTimestampRef.current > 500;

    // Reset the manual reset flag when a new exercise is selected
    if (isNewExercise && currentExerciseId) {
      userHasManuallyResetRef.current = false;
      lastExerciseIdRef.current = currentExerciseId;
    }

    // Auto-populate if:
    // 1. Auto-population is enabled
    // 2. We have an exercise with notes
    // 3. It's a new exercise (disable re-selection auto-population as it's handled by FretboardCard)
    // 4. User hasn't manually reset
    if (
      autoPopulateOnExerciseLoad &&
      setSelectedDots &&
      exerciseData.hasExercise &&
      exerciseData.exerciseNotes.length > 0 &&
      isNewExercise && // Only auto-populate for NEW exercises, not re-selections
      !userHasManuallyResetRef.current
    ) {
      // Auto-populate with exercise notes

      // Convert exercise notes to selected dots format
      const exerciseDotsMap = convertExerciseNotesToSelectedDots(
        exerciseData.exerciseNotes,
      );

      // Update the fretboard selected dots
      setSelectedDots(exerciseDotsMap);

      // Update the last population timestamp
      lastPopulationTimestampRef.current = currentTimestamp;

      // Emit bassline event for sync with other widgets
      setTimeout(() => {
        emitBasslineEvent(exerciseDotsMap);
      }, 100); // Small delay to ensure state is updated
    }
  }, [
    exerciseData.hasExercise,
    exerciseData.exerciseNotes,
    exerciseData.selectedExercise?.id, // Track exercise ID changes
    exerciseData.selectedExercise, // Track the entire exercise object (helps detect re-selections)
    autoPopulateOnExerciseLoad,
    setSelectedDots,
    convertExerciseNotesToSelectedDots,
    emitBasslineEvent,
  ]);

  // Function to mark that user has manually reset
  const markManualReset = useCallback(() => {
    userHasManuallyResetRef.current = true;
    onManualReset?.();
  }, [onManualReset]);

  // Function to force re-population (e.g., when user clicks same exercise again)
  const forcePopulateExercise = useCallback(() => {
    if (
      setSelectedDots &&
      exerciseData.hasExercise &&
      exerciseData.exerciseNotes.length > 0
    ) {
      // Force re-populate with exercise notes

      // Reset manual reset flag to allow re-population
      userHasManuallyResetRef.current = false;

      // Convert exercise notes to selected dots format
      const exerciseDotsMap = convertExerciseNotesToSelectedDots(
        exerciseData.exerciseNotes,
      );

      // Update the fretboard selected dots
      setSelectedDots(exerciseDotsMap);

      // Emit bassline event for sync with other widgets
      setTimeout(() => {
        emitBasslineEvent(exerciseDotsMap);
      }, 100);
    }
  }, [
    setSelectedDots,
    exerciseData.hasExercise,
    exerciseData.exerciseNotes,
    exerciseData.selectedExercise?.title,
    convertExerciseNotesToSelectedDots,
    emitBasslineEvent,
  ]);

  // Exercise playback integration
  const playbackIntegration = useMemo(() => {
    return audioIntegration.playbackIntegration;
  }, [audioIntegration.playbackIntegration]);

  return {
    // Exercise data
    exerciseData,

    // Exercise note checking
    isExerciseNote,
    isCurrentNote,
    getExerciseNoteAt,

    // Exercise note conversion
    convertExerciseNotesToSelectedDots,

    // Manual reset tracking
    markManualReset,
    forcePopulateExercise,

    // Bassline creation and sync
    createBasslineData,
    emitBasslineEvent,

    // Audio integration
    triggerNote,
    createNoteEvent,
    playbackIntegration,
    audioIntegration,
  };
};
