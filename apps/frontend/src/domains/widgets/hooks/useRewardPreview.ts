import { useState, useEffect, useRef, useCallback } from 'react';
import { getOrCreatePersistentAudioContext } from '@/domains/playback/utils/audioContext';

/** Duration of the audio preview in seconds */
const PREVIEW_DURATION = 5;

/** Essential drum samples for the preview */
const ESSENTIAL_SAMPLES = [
  { key: 'kick', path: 'drums/admin-samples/Default kit/Kick1.wav' },
  { key: 'snare', path: 'drums/admin-samples/Default kit/Snare1.wav' },
  { key: 'hihat', path: 'drums/admin-samples/Default kit/Hihat1_closed.wav' },
] as const;

/** Map drum_pattern drum types to sample keys */
const DRUM_TO_SAMPLE: Record<string, string> = {
  kick: 'kick',
  snare: 'snare',
  snare_rimshot: 'snare',
  hihat_closed: 'hihat',
  hihat_open: 'hihat',
  hihat_pedal: 'hihat',
  clap: 'snare',
  tom_high: 'kick',
  tom_mid: 'kick',
  tom_low: 'kick',
  floor_tom: 'kick',
  crash: 'hihat',
  ride: 'hihat',
  ride_bell: 'hihat',
  cowbell: 'hihat',
  tambourine: 'hihat',
};

interface UseRewardPreviewReturn {
  isPlaying: boolean;
  isLoading: boolean;
  canPreview: boolean;
  togglePreview: () => void;
}

/**
 * Hook providing a 5-second audio preview of a locked exercise's drum pattern.
 *
 * Uses raw Web Audio API (AudioBufferSourceNode) — fully isolated from the
 * main PlaybackEngine singleton, following the proven useDrumEditorPlayback pattern.
 */
export function useRewardPreview(
  lockedExercise: any | null,
): UseRewardPreviewReturn {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [canPreview, setCanPreview] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const sampleBuffersRef = useRef<Map<string, AudioBuffer>>(new Map());
  const scheduledSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const stopTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load samples on mount
  useEffect(() => {
    const loadSamples = async () => {
      try {
        const ctx = await getOrCreatePersistentAudioContext();
        audioContextRef.current = ctx;

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        if (!supabaseUrl) {
          setIsLoading(false);
          return;
        }

        const loadPromises = ESSENTIAL_SAMPLES.map(async ({ key, path }) => {
          try {
            const url = `${supabaseUrl}/storage/v1/object/public/audio-samples/${path}`;
            const response = await fetch(url);
            if (!response.ok) return;
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
            sampleBuffersRef.current.set(key, audioBuffer);
          } catch {
            // Silently skip failed samples
          }
        });

        await Promise.all(loadPromises);

        const loaded = sampleBuffersRef.current.size > 0;
        setCanPreview(loaded && !!lockedExercise?.drum_pattern);
        setIsLoading(false);
      } catch {
        setIsLoading(false);
      }
    };

    loadSamples();

    return () => {
      // Stop all sources on unmount
      scheduledSourcesRef.current.forEach((source) => {
        try {
          source.stop();
          source.disconnect();
        } catch {
          // Already stopped
        }
      });
      scheduledSourcesRef.current = [];

      if (stopTimeoutRef.current) {
        clearTimeout(stopTimeoutRef.current);
      }
      // Do NOT close shared AudioContext
    };
  }, []);

  // Update canPreview when lockedExercise changes
  useEffect(() => {
    setCanPreview(
      sampleBuffersRef.current.size > 0 && !!lockedExercise?.drum_pattern,
    );
  }, [lockedExercise]);

  const stopPlayback = useCallback(() => {
    scheduledSourcesRef.current.forEach((source) => {
      try {
        source.stop();
        source.disconnect();
      } catch {
        // Already stopped
      }
    });
    scheduledSourcesRef.current = [];

    if (stopTimeoutRef.current) {
      clearTimeout(stopTimeoutRef.current);
      stopTimeoutRef.current = null;
    }

    setIsPlaying(false);
  }, []);

  const togglePreview = useCallback(async () => {
    if (isPlaying) {
      stopPlayback();
      return;
    }

    const ctx = audioContextRef.current;
    if (!ctx || !lockedExercise?.drum_pattern) return;

    // Resume AudioContext if suspended (browser autoplay policy)
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    const drumPattern = lockedExercise.drum_pattern;
    const bpm = lockedExercise.bpm || 120;
    const secondsPerBeat = 60 / bpm;

    // Schedule drum hits from the pattern for the first PREVIEW_DURATION seconds
    const startTime = ctx.currentTime + 0.05;

    drumPattern.forEach((hit: any) => {
      if (!hit || !hit.drum) return;

      // Calculate hit time from tick position
      // Assume PPQ = 480 (standard MIDI)
      const ppq = 480;
      const tickPosition = hit.position?.tick ?? hit.tick ?? 0;
      const hitSeconds = (tickPosition / ppq) * secondsPerBeat;

      // Only schedule hits within the preview window
      if (hitSeconds >= PREVIEW_DURATION) return;

      const sampleKey = DRUM_TO_SAMPLE[hit.drum] || 'kick';
      const buffer =
        sampleBuffersRef.current.get(sampleKey) ||
        sampleBuffersRef.current.get('kick');

      if (!buffer) return;

      const source = ctx.createBufferSource();
      const gain = ctx.createGain();
      source.buffer = buffer;
      gain.gain.value = (hit.velocity ?? 100) / 127;
      source.connect(gain);
      gain.connect(ctx.destination);
      source.start(startTime + hitSeconds);

      scheduledSourcesRef.current.push(source);
    });

    setIsPlaying(true);

    // Auto-stop after PREVIEW_DURATION
    stopTimeoutRef.current = setTimeout(() => {
      stopPlayback();
    }, PREVIEW_DURATION * 1000);
  }, [isPlaying, lockedExercise, stopPlayback]);

  return { isPlaying, isLoading, canPreview, togglePreview };
}
