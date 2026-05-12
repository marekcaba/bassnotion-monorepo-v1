'use client';

/**
 * useHarmonyInstrument Hook
 *
 * Manages harmony instrument state and switching:
 * - Tracks current instrument selection
 * - Syncs with exercise harmonyInstrument prop
 * - Handles instrument switching on the WAM plugin
 * - Maintains ref for latest instrument value (avoids stale closures)
 *
 * @example
 * const {
 *   currentInstrument,
 *   currentInstrumentRef,
 *   setCurrentInstrument,
 *   handleInstrumentChange,
 * } = useHarmonyInstrument({
 *   harmonyInstrumentProp: props.harmonyInstrument,
 *   exercise: props.exercise,
 *   keyboardPluginRef,
 * });
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { withAudioContext } from '@/domains/playback/utils/ensureAudioContext';
import { isVerboseDebugEnabled } from '@/config/debug';
import type {
  KeyboardInstrumentType,
  KeyboardInstrument,
  WamKeyboardPlugin,
  HarmonyExercise,
} from '../types.js';

/**
 * Options for the useHarmonyInstrument hook
 */
export interface UseHarmonyInstrumentOptions {
  /** Instrument type from props */
  harmonyInstrumentProp?: KeyboardInstrumentType | 'pad';
  /** Exercise with harmonyInstrument field */
  exercise?: HarmonyExercise;
  /** Reference to the keyboard plugin */
  keyboardPluginRef?: React.RefObject<WamKeyboardPlugin | null>;
  /** Whether the track is ready */
  trackIsReady?: boolean;
  /** Whether the WAM plugin is loaded */
  wamPluginLoaded?: boolean;
  /** Whether audio services are ready */
  audioServicesReady?: boolean;
  /** Callback to trigger plugin creation */
  createAudioNodeAttempt?: () => void;
}

/**
 * Return type for the useHarmonyInstrument hook
 */
export interface UseHarmonyInstrumentReturn {
  /** Currently selected instrument */
  currentInstrument: KeyboardInstrumentType | undefined;
  /** Ref to current instrument (avoids stale closures) */
  currentInstrumentRef: React.MutableRefObject<KeyboardInstrumentType | undefined>;
  /** Set the current instrument */
  setCurrentInstrument: React.Dispatch<
    React.SetStateAction<KeyboardInstrumentType | undefined>
  >;
  /** Handle instrument change with audio context initialization */
  handleInstrumentChange: (instrument: KeyboardInstrumentType) => Promise<void>;
}

// Keyboard instrument enum for index lookup
const KeyboardInstrumentValues: KeyboardInstrumentType[] = [
  'grandpiano',
  'rhodes',
  'wurlitzer',
];

/**
 * Hook for managing harmony instrument state and switching
 */
export function useHarmonyInstrument(
  options: UseHarmonyInstrumentOptions
): UseHarmonyInstrumentReturn {
  const {
    harmonyInstrumentProp,
    exercise,
    keyboardPluginRef,
    trackIsReady = false,
    wamPluginLoaded = false,
    audioServicesReady = false,
    createAudioNodeAttempt,
  } = options;

  // Initialize with harmonyInstrument prop if available
  const [currentInstrument, setCurrentInstrument] = useState<
    KeyboardInstrumentType | undefined
  >(harmonyInstrumentProp as KeyboardInstrumentType | undefined);

  // Ref to always have the latest instrument value (avoids stale closure issues)
  const currentInstrumentRef = useRef<KeyboardInstrumentType | undefined>(
    currentInstrument
  );

  // Track previous instrument for change detection
  const previousInstrumentRef = useRef<KeyboardInstrumentType | undefined>(
    undefined
  );

  // Keep ref in sync with state
  useEffect(() => {
    currentInstrumentRef.current = currentInstrument;
  }, [currentInstrument]);

  // Update instrument when harmonyInstrument prop changes
  useEffect(() => {
    if (harmonyInstrumentProp && harmonyInstrumentProp !== currentInstrument) {
      setCurrentInstrument(harmonyInstrumentProp as KeyboardInstrumentType);
    }
    // Only depend on prop, not currentInstrument state
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [harmonyInstrumentProp]);

  /**
   * Handle instrument change from user input
   */
  const handleInstrumentChange = useCallback(
    withAudioContext(async (instrument: KeyboardInstrumentType) => {
      setCurrentInstrument(instrument);
      if (keyboardPluginRef?.current?.audioNode) {
        const instrumentIndex = KeyboardInstrumentValues.indexOf(instrument);
        await keyboardPluginRef.current.audioNode.setParameterValues({
          instrument: instrumentIndex,
        });
      }
    }),
    [keyboardPluginRef]
  );

  /**
   * Reload instrument when currentInstrument changes
   */
  useEffect(() => {
    if (isVerboseDebugEnabled()) {
      console.log(
        '[INSTRUMENT-SWITCH-DEBUG] reloadInstrument useEffect triggered:',
        {
          currentInstrument,
          previousInstrument: previousInstrumentRef.current,
          hasPlugin: !!keyboardPluginRef?.current?.audioNode,
          trackIsReady,
          wamPluginLoaded,
          audioServicesReady,
        }
      );
    }

    const reloadInstrument = async () => {
      // Skip if no instrument specified yet
      if (!currentInstrument) {
        if (isVerboseDebugEnabled()) {
          console.log(
            '[INSTRUMENT-SWITCH-DEBUG] No currentInstrument, skipping reload'
          );
        }
        return;
      }

      // Skip if this is the initial load (plugin just created)
      if (
        previousInstrumentRef.current === undefined &&
        keyboardPluginRef?.current?.audioNode
      ) {
        if (isVerboseDebugEnabled()) {
          console.log(
            '[INSTRUMENT-SWITCH-DEBUG] Initial load detected - instrument already loaded'
          );
        }
        previousInstrumentRef.current = currentInstrument;
        return;
      }

      // Skip if instrument hasn't actually changed
      if (previousInstrumentRef.current === currentInstrument) {
        if (isVerboseDebugEnabled()) {
          console.log(
            '[INSTRUMENT-SWITCH-DEBUG] Instrument unchanged, skipping reload'
          );
        }
        return;
      }

      if (keyboardPluginRef?.current?.audioNode) {
        // Plugin exists - just reload the instrument
        if (isVerboseDebugEnabled()) {
          console.log(
            '[INSTRUMENT-SWITCH-DEBUG] Plugin exists, calling loadInstrument():',
            {
              from: previousInstrumentRef.current,
              to: currentInstrument,
            }
          );
        }

        try {
          const audioNode = keyboardPluginRef.current.audioNode;

          // Clear any existing events before switching instruments
          if (audioNode.clearEvents) {
            audioNode.clearEvents();
          }

          // Load the new instrument
          if (audioNode.loadInstrument) {
            if (isVerboseDebugEnabled()) {
              console.log(
                '[INSTRUMENT-SWITCH-DEBUG] Calling audioNode.loadInstrument():',
                currentInstrument
              );
            }
            await audioNode.loadInstrument(currentInstrument);
            if (isVerboseDebugEnabled()) {
              console.log(
                '[INSTRUMENT-SWITCH-DEBUG] Successfully loaded instrument:',
                currentInstrument
              );
            }
            previousInstrumentRef.current = currentInstrument;
          }
        } catch (error) {
          console.error(
            '[INSTRUMENT-SWITCH-DEBUG] Failed to reload instrument:',
            error
          );
        }
      } else if (
        trackIsReady &&
        audioServicesReady &&
        !wamPluginLoaded &&
        createAudioNodeAttempt
      ) {
        // Plugin doesn't exist yet - create it with the new instrument
        if (isVerboseDebugEnabled()) {
          console.log(
            '[INSTRUMENT-SWITCH-DEBUG] Creating plugin for new instrument:',
            currentInstrument
          );
        }
        createAudioNodeAttempt();
        previousInstrumentRef.current = currentInstrument;
      } else {
        if (isVerboseDebugEnabled()) {
          console.log(
            '[INSTRUMENT-SWITCH-DEBUG] Conditions not met for instrument loading:',
            {
              hasPlugin: !!keyboardPluginRef?.current?.audioNode,
              trackIsReady,
              wamPluginLoaded,
              audioServicesReady,
            }
          );
        }
      }
    };

    reloadInstrument();
  }, [
    currentInstrument,
    trackIsReady,
    wamPluginLoaded,
    audioServicesReady,
    createAudioNodeAttempt,
    keyboardPluginRef,
  ]);

  return {
    currentInstrument,
    currentInstrumentRef,
    setCurrentInstrument,
    handleInstrumentChange,
  };
}
