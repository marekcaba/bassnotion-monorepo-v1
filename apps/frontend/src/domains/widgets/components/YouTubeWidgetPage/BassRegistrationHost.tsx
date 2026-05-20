'use client';

/**
 * BassRegistrationHost
 *
 * Mounts at YouTubeWidgetPage level and runs the bass buffer registration
 * lifecycle regardless of which block (understand / practice / groove) is
 * currently visible.
 *
 * Why this exists: BassLineWidget — which originally owned the registration —
 * is only rendered inside the `groove` block. Tutorials that start on a
 * non-groove block (e.g. "find-notes-on-fretboard" lands on `understand`)
 * would mount, preload samples into the cache, fire `bass-samples-loaded`,
 * but never call `PlaybackEngine.setBassBuffers()` because the registration
 * hook wasn't mounted. Pressing play then timed out with
 * `Bass buffers not ready yet, waiting...` and silent bass.
 *
 * This component renders nothing. It owns the registration plumbing so the
 * groove block's visibility no longer gates bass readiness.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Exercise } from '@bassnotion/contracts';
import { useBassBufferRegistration } from './BassLineWidget/hooks/useBassBufferRegistration';
import { useSampleLoadingSync } from './BassLineWidget/hooks/useSampleLoadingSync';
import { WindowRegistry } from '@/domains/playback/services/WindowRegistry';

interface BassRegistrationHostProps {
  exercise?: Exercise;
  volume?: number;
  isMuted?: boolean;
}

export function BassRegistrationHost({
  exercise,
  volume = 75,
  isMuted = false,
}: BassRegistrationHostProps): null {
  // Poll for CoreServices readiness — the BassLineWidget historically gated
  // registration on `useTrack().isReady`, which transitions to true once the
  // global audio engine is up. We don't want a second `useTrack` instance
  // because trackIds must be unique; instead we mirror the readiness signal
  // by observing CoreServices directly. Same effective gate.
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

  const { samplesLoadedTrigger } = useSampleLoadingSync();

  const bassNoteCount = useMemo(
    () =>
      exercise?.notes?.filter(
        (note: { string: number }) => note.string >= 1 && note.string <= 5,
      )?.length ?? 0,
    [exercise?.notes],
  );

  // Local ref used only as the "test playback" buffer cache by
  // useBassBufferRegistration. Independent from BassLineWidget's ref —
  // safe because the ref is just a side-effect bag, not authoritative state.
  const bassBuffersRef = useRef<Record<string, AudioBuffer>>({});

  // Host doesn't drive UI feedback — supply no-op callbacks.
  const noopSamplesLoaded = useCallback(
    (_loaded: number, _total: number) => {},
    [],
  );
  const noopSamplerReady = useCallback((_ready: boolean) => {}, []);

  useBassBufferRegistration({
    exercise,
    samplesLoadedTrigger,
    trackIsReady: coreServicesReady,
    bassNoteCount,
    volume,
    isMuted,
    bassBuffersRef,
    onSamplesLoaded: noopSamplesLoaded,
    onSamplerReady: noopSamplerReady,
  });

  return null;
}
