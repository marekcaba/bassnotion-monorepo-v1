'use client';

/**
 * useBassPlayback Hook
 *
 * Handles bass note playback, pattern scheduling, and audio management:
 * - Plays individual bass notes using sampler
 * - Schedules pattern notes with proper timing
 * - Manages active audio sources for cleanup
 * - Provides test playback functions for debugging
 *
 * @example
 * const {
 *   playBassNote,
 *   stopAllNotes,
 *   schedulePattern,
 *   patternNotes,
 *   testNote,
 *   testDirectPlayback,
 * } = useBassPlayback({
 *   audioContextRef,
 *   gainNodeRef,
 *   bassBuffersRef,
 *   tempo,
 *   isPlaying,
 *   trackIsReady,
 *   samplerReady,
 *   exercise,
 *   pattern,
 * });
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { WindowRegistry } from '@/domains/playback/services/WindowRegistry.js';
import { getLogger } from '@/utils/logger.js';
import { isVerboseDebugEnabled, verboseLog } from '@/config/debug';
import { BASS_PATTERNS } from '../types.js';
import type {
  UseBassPlaybackOptions,
  UseBassPlaybackReturn,
  BassNote,
  ActiveSource,
} from '../types.js';

const logger = getLogger('bassline-widget');

/**
 * Hook for managing bass playback
 */
export function useBassPlayback(
  options: UseBassPlaybackOptions,
): UseBassPlaybackReturn {
  const {
    audioContextRef,
    gainNodeRef,
    bassBuffersRef,
    tempo,
    isPlaying,
    trackIsReady,
    samplerReady,
    exercise,
    pattern,
  } = options;

  // Refs for audio management
  const activeSources = useRef<Map<string, ActiveSource>>(new Map());
  const lastScheduledTimeRef = useRef<number>(0);
  const currentPatternRef = useRef<BassNote[]>([]);

  /**
   * Get pattern notes from exercise or predefined patterns
   */
  const patternNotes = useMemo((): BassNote[] => {
    // If we have exercise notes, use those (filter for bass strings)
    if (exercise?.notes && exercise.notes.length > 0) {
      return exercise.notes.filter(
        (note: { string: number }) => note.string >= 1 && note.string <= 4,
      ) as BassNote[];
    }

    // Otherwise use predefined patterns
    return (
      BASS_PATTERNS[pattern as keyof typeof BASS_PATTERNS] ||
      BASS_PATTERNS['Root-Fifth']
    );
  }, [pattern, exercise]);

  /**
   * Play a bass note using the sampler
   */
  const playBassNote = useCallback(
    (
      midiNote: number,
      velocity = 0.7,
      duration = 0.5,
      scheduledTime?: number,
    ) => {
      const context = audioContextRef.current;
      if (!context || !gainNodeRef.current) {
        logger.warn('Cannot play bass note: audio context not ready');
        return;
      }

      // Get buffer for this MIDI note - check local buffers first
      const bufferKey = String(midiNote);
      let buffer = bassBuffersRef.current[bufferKey];

      // If not in local cache, try to get from PlaybackEngine's bass scheduler
      if (!buffer) {
        const coreServices = WindowRegistry.getCoreServices();
        const playbackEngine = coreServices?.getPlaybackEngine?.();
        if (playbackEngine?.bassScheduler) {
          const buffers = (
            playbackEngine.bassScheduler as {
              buffers?: Map<string, AudioBuffer>;
            }
          ).buffers;
          if (buffers instanceof Map) {
            buffer = buffers.get(bufferKey);
          }
        }
      }

      if (!buffer) {
        logger.warn('No buffer found for MIDI note', { midiNote, bufferKey });
        return;
      }

      const startTime = scheduledTime ?? context.currentTime;

      // Create source and gain nodes
      const source = context.createBufferSource();
      source.buffer = buffer;

      const noteGain = context.createGain();
      noteGain.gain.setValueAtTime(velocity, startTime);

      // Connect: source -> noteGain -> masterGain -> destination
      source.connect(noteGain);
      noteGain.connect(gainNodeRef.current);

      // Schedule the note
      source.start(startTime);

      // Store for cleanup
      const sourceKey = `${midiNote}-${startTime}`;
      activeSources.current.set(sourceKey, { source, gain: noteGain });

      // Schedule fadeout and cleanup
      const fadeOutTime = startTime + duration - 0.05;
      noteGain.gain.setTargetAtTime(0, fadeOutTime, 0.03);

      source.onended = () => {
        noteGain.disconnect();
        activeSources.current.delete(sourceKey);
      };

      logger.debug('Playing bass note', {
        midiNote,
        velocity,
        duration,
        startTime,
      });
    },
    [audioContextRef, gainNodeRef, bassBuffersRef],
  );

  /**
   * Stop all active bass notes
   */
  const stopAllNotes = useCallback(
    (graceful = false) => {
      const context = audioContextRef.current;
      if (!context) return;

      const currentTime = context.currentTime;
      const fadeTime = graceful ? 0.1 : 0.02;

      activeSources.current.forEach(({ source, gain }) => {
        try {
          gain.gain.cancelScheduledValues(currentTime);
          gain.gain.setTargetAtTime(0, currentTime, fadeTime);
          source.stop(currentTime + fadeTime * 3);
        } catch {
          // Source may have already stopped
        }
      });

      if (!graceful) {
        activeSources.current.clear();
      }
    },
    [audioContextRef],
  );

  /**
   * Schedule bass pattern for playback
   */
  const schedulePattern = useCallback(() => {
    const context = audioContextRef.current;
    if (!context || !isPlaying) return;

    // Clear any existing pattern
    currentPatternRef.current = [];

    // Calculate timing
    const currentTime = context.currentTime;
    const beatDuration = 60 / tempo;

    // Schedule pattern notes
    const scheduleTime = currentTime + 0.1; // Small lookahead

    patternNotes.forEach((noteInfo, index) => {
      const beat = noteInfo.beat ?? index;
      const noteTime = scheduleTime + beat * beatDuration;
      const duration = beatDuration * 0.9; // Slightly shorter for separation

      // Play the note using the sampler
      playBassNote(noteInfo.note, 0.7, duration, noteTime);

      // Store pattern info for visualization
      currentPatternRef.current.push({
        ...noteInfo,
        beat: noteTime,
      });
    });

    lastScheduledTimeRef.current = scheduleTime + 4 * beatDuration; // Assume 4/4 measure
  }, [patternNotes, tempo, isPlaying, playBassNote, audioContextRef]);

  /**
   * Test note function - plays open E string
   */
  const testNote = useCallback(() => {
    if (samplerReady) {
      // Play open E string (E1 = MIDI 28)
      playBassNote(28, 0.7, 0.5);
    } else {
      logger.warn('Bass sampler not ready for test');
    }
  }, [samplerReady, playBassNote]);

  /**
   * Direct test playback - bypasses all layers, plays raw buffer to destination
   */
  const testDirectPlayback = useCallback(async () => {
    const context = audioContextRef.current;
    if (!context) {
      console.error('[BASS TEST] No AudioContext');
      return;
    }

    // Get first available buffer from cache
    const availableKeys = Object.keys(bassBuffersRef.current);
    if (isVerboseDebugEnabled()) {
      verboseLog('[BASS TEST] Available buffers:', availableKeys);
    }

    const bufferKey = availableKeys[0] || '34';
    let buffer = bassBuffersRef.current[bufferKey];

    if (!buffer) {
      // Try to get from scheduler
      const coreServices = WindowRegistry.getCoreServices();
      const playbackEngine = coreServices?.getPlaybackEngine?.();
      if (playbackEngine?.bassScheduler) {
        const buffers = (
          playbackEngine.bassScheduler as { buffers?: Map<string, AudioBuffer> }
        ).buffers;
        if (buffers instanceof Map) {
          buffer = buffers.get(bufferKey);
        }
      }
    }

    if (!buffer) {
      console.error('[BASS TEST] No buffer for MIDI 28');
      return;
    }

    if (isVerboseDebugEnabled()) {
      // Analyze buffer
      const channelData = buffer.getChannelData(0);
      let maxAmp = 0;
      for (let i = 0; i < Math.min(4800, channelData.length); i++) {
        maxAmp = Math.max(maxAmp, Math.abs(channelData[i]));
      }

      verboseLog('[BASS TEST] Direct Playback Test', {
        bufferDuration: buffer.duration.toFixed(2) + 's',
        sampleRate: buffer.sampleRate,
        first100msMaxAmplitude: maxAmp.toFixed(4),
        contextState: context.state,
      });
    }

    // Play DIRECTLY to destination - no gain nodes, no effects
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    source.start(context.currentTime);

    if (isVerboseDebugEnabled()) {
      verboseLog(
        '[BASS TEST] Playing raw buffer directly to destination (no processing)',
      );

      // Expose to window for manual testing
      (
        window as Window & {
          __testBassBuffer?: AudioBuffer;
          __testBassContext?: AudioContext;
        }
      ).__testBassBuffer = buffer;
      (
        window as Window & {
          __testBassBuffer?: AudioBuffer;
          __testBassContext?: AudioContext;
        }
      ).__testBassContext = context;
    }
  }, [audioContextRef, bassBuffersRef]);

  /**
   * Expose test function to window for console access
   */
  useEffect(() => {
    (
      window as Window & { __testBassDirectPlayback?: () => Promise<void> }
    ).__testBassDirectPlayback = testDirectPlayback;

    if (isVerboseDebugEnabled()) {
      verboseLog(
        '[BASS-WIDGET] Direct test function exposed as window.__testBassDirectPlayback()',
      );
    }
  }, [testDirectPlayback]);

  /**
   * Handle play state changes for standalone pattern playback
   */
  useEffect(() => {
    if (isPlaying && trackIsReady && samplerReady) {
      // Only schedule pattern for standalone mode (not exercise playback)
      if (!exercise) {
        schedulePattern();

        // Set up interval to schedule next measures
        const measureDuration = (60 / tempo) * 4; // 4/4 time
        const interval = setInterval(
          () => {
            if (isPlaying) {
              schedulePattern();
            }
          },
          measureDuration * 1000 * 0.9,
        ); // Schedule slightly early

        return () => clearInterval(interval);
      }
    } else if (!isPlaying) {
      // Stop all notes gracefully
      stopAllNotes(true);
    }
  }, [
    isPlaying,
    trackIsReady,
    samplerReady,
    exercise,
    schedulePattern,
    stopAllNotes,
    tempo,
  ]);

  return {
    playBassNote,
    stopAllNotes,
    schedulePattern,
    patternNotes,
    testNote,
    testDirectPlayback,
  };
}
