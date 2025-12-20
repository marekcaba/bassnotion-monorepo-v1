/**
 * Drum Editor Playback Hook
 *
 * Provides audio preview functionality for the drum pattern editor.
 * - One-shot preview: Click a cell to hear the drum sound immediately
 * - Pattern playback: Play/Stop button to preview the entire pattern
 * - Playhead sync: Updates playhead position during playback
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { MidiDrumType, DrumHit } from '@bassnotion/contracts';
import { DRUM_TO_MIDI_NOTE, PPQ } from '../constants.js';
import { musicalToSeconds } from '../utils/gridPositionUtils.js';

/**
 * Playback state for the hook
 */
export interface DrumPlaybackState {
  /** Whether audio is ready to play */
  isReady: boolean;
  /** Whether samples are currently loading */
  isLoading: boolean;
  /** Error message if loading failed */
  error: string | null;
  /** Whether pattern is currently playing */
  isPlaying: boolean;
}

/**
 * Return type for the playback hook
 */
export interface UseDrumEditorPlaybackReturn {
  /** Current playback state */
  state: DrumPlaybackState;
  /** Preview a single drum hit (one-shot) */
  previewHit: (drum: MidiDrumType, velocity?: number) => void;
  /** Start pattern playback */
  play: (pattern: DrumHit[], tempo: number, loop?: boolean) => void;
  /** Stop pattern playback */
  stop: () => void;
  /** Current playhead tick position */
  playheadTick: number;
}

/**
 * Map MidiDrumType to sample key names used in the audio system
 */
const DRUM_TO_SAMPLE_KEY: Record<MidiDrumType, string> = {
  kick: 'kick',
  snare: 'snare',
  snare_rimshot: 'snare', // Fallback to snare
  clap: 'clap',
  hihat_closed: 'hihat',
  hihat_open: 'openhat',
  hihat_pedal: 'hihat', // Fallback to closed hihat
  tom_high: 'tom1',
  tom_mid: 'tom2',
  tom_low: 'tom3',
  floor_tom: 'tom3', // Fallback to tom3
  crash: 'crash',
  ride: 'ride',
  ride_bell: 'ride', // Fallback to ride
  cowbell: 'cowbell',
  tambourine: 'tambourine',
};

/**
 * Hook for drum editor audio playback
 *
 * Uses Web Audio API directly for lightweight, isolated playback
 * that doesn't interfere with the main playback engine.
 */
export function useDrumEditorPlayback(): UseDrumEditorPlaybackReturn {
  // State
  const [state, setState] = useState<DrumPlaybackState>({
    isReady: false,
    isLoading: true,
    error: null,
    isPlaying: false,
  });
  const [playheadTick, setPlayheadTick] = useState(0);

  // Refs for audio resources
  const audioContextRef = useRef<AudioContext | null>(null);
  const sampleBuffersRef = useRef<Map<string, AudioBuffer>>(new Map());
  const scheduledSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const playbackIntervalRef = useRef<number | null>(null);
  const playbackStartTimeRef = useRef<number>(0);
  const patternDurationRef = useRef<number>(0);
  const isLoopingRef = useRef<boolean>(false);

  /**
   * Initialize AudioContext and load samples
   */
  useEffect(() => {
    const initialize = async () => {
      try {
        // Create AudioContext (will be suspended until user interaction)
        const ctx = new AudioContext();
        audioContextRef.current = ctx;

        // Load essential drum samples from Supabase
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        if (!supabaseUrl) {
          throw new Error('Supabase URL not configured');
        }

        // Essential samples to load (fallback kit has these)
        const essentialSamples = [
          { key: 'kick', path: 'drums/hydrogen-kits/colombo-acoustic/kick-v1.wav' },
          { key: 'snare', path: 'drums/hydrogen-kits/colombo-acoustic/snare-v1.wav' },
          { key: 'hihat', path: 'drums/hydrogen-kits/colombo-acoustic/hihat-v1.wav' },
        ];

        // Load samples in parallel
        const loadPromises = essentialSamples.map(async ({ key, path }) => {
          try {
            const url = `${supabaseUrl}/storage/v1/object/public/audio-samples/${path}`;
            const response = await fetch(url);
            if (!response.ok) {
              console.warn(`[DrumEditorPlayback] Failed to load ${key}: ${response.status}`);
              return;
            }
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
            sampleBuffersRef.current.set(key, audioBuffer);
          } catch (err) {
            console.warn(`[DrumEditorPlayback] Error loading ${key}:`, err);
          }
        });

        await Promise.all(loadPromises);

        const loadedCount = sampleBuffersRef.current.size;
        console.log(`[DrumEditorPlayback] Loaded ${loadedCount}/${essentialSamples.length} samples`);

        setState({
          isReady: loadedCount > 0,
          isLoading: false,
          error: loadedCount === 0 ? 'No samples loaded' : null,
          isPlaying: false,
        });
      } catch (err) {
        console.error('[DrumEditorPlayback] Initialization failed:', err);
        setState({
          isReady: false,
          isLoading: false,
          error: err instanceof Error ? err.message : 'Unknown error',
          isPlaying: false,
        });
      }
    };

    initialize();

    // Cleanup
    return () => {
      if (playbackIntervalRef.current) {
        cancelAnimationFrame(playbackIntervalRef.current);
      }
      scheduledSourcesRef.current.forEach((source) => {
        try {
          source.stop();
          source.disconnect();
        } catch {
          // Ignore errors from already stopped sources
        }
      });
      audioContextRef.current?.close();
    };
  }, []);

  /**
   * Resume AudioContext after user interaction
   */
  const ensureAudioContextRunning = useCallback(async () => {
    const ctx = audioContextRef.current;
    if (ctx && ctx.state === 'suspended') {
      await ctx.resume();
    }
    return ctx;
  }, []);

  /**
   * Play a single drum sample (one-shot preview)
   */
  const previewHit = useCallback(
    async (drum: MidiDrumType, velocity: number = 100) => {
      const ctx = await ensureAudioContextRunning();
      if (!ctx) return;

      const sampleKey = DRUM_TO_SAMPLE_KEY[drum] || 'kick';
      const buffer = sampleBuffersRef.current.get(sampleKey);

      if (!buffer) {
        // Fallback: try kick if specific sample not available
        const fallbackBuffer = sampleBuffersRef.current.get('kick');
        if (!fallbackBuffer) {
          console.warn(`[DrumEditorPlayback] No sample available for ${drum}`);
          return;
        }
        // Use fallback
        const source = ctx.createBufferSource();
        const gain = ctx.createGain();
        source.buffer = fallbackBuffer;
        gain.gain.value = velocity / 127;
        source.connect(gain);
        gain.connect(ctx.destination);
        source.start(0);
        return;
      }

      // Play the sample
      const source = ctx.createBufferSource();
      const gain = ctx.createGain();
      source.buffer = buffer;
      gain.gain.value = velocity / 127;
      source.connect(gain);
      gain.connect(ctx.destination);
      source.start(0);
    },
    [ensureAudioContextRunning]
  );

  /**
   * Stop all playback
   */
  const stop = useCallback(() => {
    // Cancel animation frame
    if (playbackIntervalRef.current) {
      cancelAnimationFrame(playbackIntervalRef.current);
      playbackIntervalRef.current = null;
    }

    // Stop all scheduled sources
    scheduledSourcesRef.current.forEach((source) => {
      try {
        source.stop();
        source.disconnect();
      } catch {
        // Ignore errors from already stopped sources
      }
    });
    scheduledSourcesRef.current = [];

    // Reset state
    isLoopingRef.current = false;
    setPlayheadTick(0);
    setState((prev) => ({ ...prev, isPlaying: false }));
  }, []);

  /**
   * Schedule pattern playback
   */
  const schedulePattern = useCallback(
    (ctx: AudioContext, pattern: DrumHit[], tempo: number, startTime: number) => {
      pattern.forEach((hit) => {
        const sampleKey = DRUM_TO_SAMPLE_KEY[hit.drum] || 'kick';
        const buffer = sampleBuffersRef.current.get(sampleKey) || sampleBuffersRef.current.get('kick');

        if (!buffer) return;

        // Calculate hit time in seconds
        const hitSeconds = musicalToSeconds(hit.position, tempo, { numerator: 4, denominator: 4 });
        const hitTime = startTime + hitSeconds;

        // Skip hits that are in the past
        if (hitTime < ctx.currentTime) return;

        // Create and schedule source
        const source = ctx.createBufferSource();
        const gain = ctx.createGain();
        source.buffer = buffer;
        gain.gain.value = hit.velocity / 127;
        source.connect(gain);
        gain.connect(ctx.destination);
        source.start(hitTime);

        scheduledSourcesRef.current.push(source);
      });
    },
    []
  );

  /**
   * Start pattern playback
   */
  const play = useCallback(
    async (pattern: DrumHit[], tempo: number, loop: boolean = false) => {
      const ctx = await ensureAudioContextRunning();
      if (!ctx || pattern.length === 0) return;

      // Stop any existing playback
      stop();

      // Calculate pattern duration (assume 2 bars in 4/4 at given tempo)
      const beatsPerBar = 4;
      const bars = 2;
      const totalBeats = bars * beatsPerBar;
      const secondsPerBeat = 60 / tempo;
      const patternDuration = totalBeats * secondsPerBeat;
      patternDurationRef.current = patternDuration;
      isLoopingRef.current = loop;

      // Schedule initial playback
      const startTime = ctx.currentTime + 0.1; // Small lookahead
      playbackStartTimeRef.current = startTime;
      schedulePattern(ctx, pattern, tempo, startTime);

      // Update state
      setState((prev) => ({ ...prev, isPlaying: true }));

      // Playhead animation loop
      const updatePlayhead = () => {
        if (!audioContextRef.current) return;

        const elapsed = audioContextRef.current.currentTime - playbackStartTimeRef.current;

        if (elapsed >= patternDurationRef.current) {
          if (isLoopingRef.current) {
            // Loop: reschedule pattern and reset playhead
            playbackStartTimeRef.current = audioContextRef.current.currentTime;
            schedulePattern(audioContextRef.current, pattern, tempo, playbackStartTimeRef.current);
            setPlayheadTick(0);
          } else {
            // Stop playback
            stop();
            return;
          }
        } else {
          // Update playhead tick
          const ticksPerBeat = PPQ;
          const beatsElapsed = elapsed / secondsPerBeat;
          const ticksElapsed = Math.floor(beatsElapsed * ticksPerBeat);
          setPlayheadTick(ticksElapsed);
        }

        playbackIntervalRef.current = requestAnimationFrame(updatePlayhead);
      };

      playbackIntervalRef.current = requestAnimationFrame(updatePlayhead);
    },
    [ensureAudioContextRunning, schedulePattern, stop]
  );

  return {
    state,
    previewHit,
    play,
    stop,
    playheadTick,
  };
}

export default useDrumEditorPlayback;
