'use client';

/**
 * HarmonyRegistrationHost
 *
 * Mounts at YouTubeWidgetPage level and runs the harmony PlaybackEngine
 * registration lifecycle regardless of which block (understand / practice /
 * groove) is currently visible.
 *
 * Why this exists: HarmonyWidget — which originally owned registration — is
 * only rendered inside the `groove` block (via FourWidgetsCard, gated by
 * `block.type === 'groove'` in YouTubeWidgetPage.tsx). Tutorials that start on
 * a non-groove block never mounted `useHarmonyRegistration`, so
 * `PlaybackEngine.setHarmonyBuffers()` / `registerTracks()` were never called
 * and pressing play produced silent harmony. This mirrors the bass bug that
 * BassRegistrationHost already fixed (PR #68).
 *
 * IMPORTANT — this host does NOT mount `useHarmonyPlugin`.
 * The WAM keyboard plugin's audioNode is a singleton-shared node, and
 * `useHarmonyPlugin` calls `audioNode.connect(masterBusInput)` on every mount
 * but deliberately never disconnects on unmount (it keeps the instance in the
 * singleton cache for reuse). A second mount point would therefore:
 *   - double the connection to the master bus (doubled gain + leaked node), and
 *   - clobber the instrument via competing `loadInstrument` / `resetState` calls.
 * So the host passes a `null` keyboardPluginRef and relies on
 * `useHarmonyRegistration`'s "Scheduler-only mode" — harmony *sound* goes
 * through PlaybackEngine.setHarmonyBuffers, not through the WAM node. The
 * on-screen WAM keyboard stays a widget-only concern (there is no visible
 * keyboard on a non-groove block, so none is needed here).
 *
 * Double-registration with the widget (when the groove block IS mounted) is
 * safe: both instances write identical, deterministic data under the fixed
 * trackId `'harmony-widget-track'`, and each instance has its own
 * re-entrancy + per-exercise dedup guard inside the hook. This component
 * renders nothing.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Exercise } from '@bassnotion/contracts';
import type {
  HarmonyExercise,
  KeyboardInstrumentType,
  WamKeyboardPlugin,
} from './HarmonyWidget/types.js';
import { useHarmonyRegistration } from './HarmonyWidget/hooks/useHarmonyRegistration.js';
import { useSampleLoadingSync } from './HarmonyWidget/hooks/useSampleLoadingSync.js';
import { WindowRegistry } from '@/domains/playback/services/WindowRegistry';

interface HarmonyRegistrationHostProps {
  exercise?: Exercise;
  volume?: number;
  isMuted?: boolean;
  /** Read-only instrument hint. `'pad'` is accepted to mirror widget state but
   *  is never acted on here (no WAM plugin is mounted). */
  harmonyInstrument?: KeyboardInstrumentType | 'pad';
}

export function HarmonyRegistrationHost({
  exercise,
  volume = 80,
  isMuted = false,
  harmonyInstrument,
}: HarmonyRegistrationHostProps): null {
  // Poll for CoreServices readiness — the HarmonyWidget historically gated
  // registration on `useTrack('harmony-widget-track').isReady`. We can't open a
  // second `useTrack` with the same id (trackIds must be unique), so we mirror
  // the readiness signal by observing CoreServices directly. Same effective
  // gate. Identical to BassRegistrationHost.
  const [coreServicesReady, setCoreServicesReady] = useState(false);

  useEffect(() => {
    if (coreServicesReady || typeof window === 'undefined') return;

    const check = () => {
      const services = WindowRegistry.getCoreServices();
      if (services?.getPlaybackEngine?.()) {
        setCoreServicesReady(true);
        return true;
      }
      return false;
    };

    if (check()) return;

    const handleReady = () => check();
    window.addEventListener('audioServicesReady', handleReady);
    window.addEventListener('audioContextStarted', handleReady);
    const interval = window.setInterval(() => {
      if (check()) window.clearInterval(interval);
    }, 200);

    return () => {
      window.removeEventListener('audioServicesReady', handleReady);
      window.removeEventListener('audioContextStarted', handleReady);
      window.clearInterval(interval);
    };
  }, [coreServicesReady]);

  const harmonyExercise = exercise as HarmonyExercise | undefined;

  // exerciseRef synced to the prop so the hook reads fresh data without stale
  // closures (the widget keeps its own ref; this is the host's independent one).
  const exerciseRef = useRef<HarmonyExercise | undefined>(harmonyExercise);
  useEffect(() => {
    exerciseRef.current = harmonyExercise;
  }, [harmonyExercise]);

  // No SyncContext at page scope — window-level sample events
  // (harmony-samples-loaded / samplesReady / samplesPreloaded) are still
  // received without a subscribeToEvent callback.
  const { samplesLoadedTrigger } = useSampleLoadingSync({});

  const harmonyNoteCount = useMemo(
    () => harmonyExercise?.harmonyNotes?.length ?? 0,
    [harmonyExercise?.harmonyNotes],
  );

  // Scheduler-only mode: null plugin ref means the registration hook never
  // touches the shared WAM audioNode (connect / loadInstrument / resetState are
  // all guarded by `keyboardPluginRef.current`).
  const keyboardPluginRef = useRef<WamKeyboardPlugin | null>(null);
  const isPlayingRef = useRef(false);

  // UI-only inputs — the host has no UI, so these are inert.
  const noopSetInstrument = useCallback((_i: KeyboardInstrumentType) => {}, []);
  const noopNextChord = useCallback(() => {}, []);

  useHarmonyRegistration({
    exercise: harmonyExercise,
    exerciseRef,
    keyboardPluginRef,
    // `'pad'` is not a KeyboardInstrumentType; the value is only used as a
    // useEffect-dependency hint here (never to drive the absent WAM plugin),
    // so narrowing it away is safe.
    currentInstrument:
      harmonyInstrument === 'pad' ? undefined : harmonyInstrument,
    setCurrentInstrument: noopSetInstrument,
    trackIsReady: coreServicesReady,
    wamPluginLoaded: false,
    samplesLoadedTrigger,
    isPlaying: false,
    isPlayingRef,
    harmonyNoteCount,
    volume,
    isMuted,
    selectedProgression: 'Jazz Standard',
    onNextChord: noopNextChord,
  });

  return null;
}
