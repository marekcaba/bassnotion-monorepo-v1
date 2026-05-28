import { useState, useCallback, useRef, useEffect } from 'react';
import { getLogger } from '@/utils/logger.js';

const logger = getLogger('useCountdown');

export interface CountdownState {
  isCountingDown: boolean;
  currentBeat: number; // 1-based index of current countdown beat (1 to totalBeats)
  totalBeats: number; // Total beats in countdown (matches time signature numerator)
}

export interface UseCountdownOptions {
  timeSignature?: { numerator: number; denominator: number };
  onCountdownComplete?: () => void;
  onBeatTick?: (beat: number, isAccented: boolean) => void;
}

/**
 * Hook to manage metronome countdown before playback starts.
 * Provides state and controls for visual countdown dots and scheduling countdown clicks.
 */
export function useCountdown(options: UseCountdownOptions = {}) {
  const { timeSignature, onCountdownComplete, onBeatTick } = options;

  const [countdownState, setCountdownState] = useState<CountdownState>({
    isCountingDown: false,
    currentBeat: -1,
    totalBeats: timeSignature?.numerator || 4,
  });

  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const firstBeatTimerRef = useRef<NodeJS.Timeout | null>(null);
  const completionTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioScheduleRef = useRef<number[]>([]);

  // Update total beats when time signature changes
  useEffect(() => {
    setCountdownState((prev) => ({
      ...prev,
      totalBeats: timeSignature?.numerator || 4,
    }));
  }, [timeSignature?.numerator]);

  /**
   * Starts the countdown sequence.
   * @param bpm - Tempo in beats per minute
   * @param audioContext - Web Audio API context for precise timing
   * @param metronome - Metronome instance with trigger() method
   * @param firstBeatAudioTime - Optional. Audio-context time at which the
   *   FIRST audible beat will play. Use this when the caller knows the
   *   engine's authoritative anchor (e.g. PlaybackEngine.transportStartTime,
   *   broadcast via the `playback:starting` event). Without it, the visual
   *   countdown anchors to `audioContext.currentTime + 0.05` — which is
   *   ~250ms AHEAD of the audible click when the engine applies a 300ms
   *   startupLookahead, producing the audio-visual drift the Groove Card
   *   hit. Defaults preserve the existing YouTube-player behaviour.
   */
  const startCountdown = useCallback(
    async (
      bpm: number,
      audioContext: AudioContext,
      metronome: any,
      firstBeatAudioTime?: number,
    ): Promise<void> => {
      logger.info('🎵 Starting countdown', {
        bpm,
        totalBeats: countdownState.totalBeats,
        timeSignature,
        firstBeatAudioTime,
      });

      // Clear any existing countdown timers
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
      if (firstBeatTimerRef.current) {
        clearTimeout(firstBeatTimerRef.current);
        firstBeatTimerRef.current = null;
      }
      if (completionTimerRef.current) {
        clearTimeout(completionTimerRef.current);
        completionTimerRef.current = null;
      }

      setCountdownState((prev) => ({
        ...prev,
        isCountingDown: true,
        currentBeat: 0,
      }));

      // Calculate timing. Prefer the caller's audio anchor (the engine's
      // transportStartTime) so visual ticks land on the actual audible
      // clicks. Fall back to the historic 50ms buffer for legacy callers.
      const beatDuration = 60 / bpm; // seconds per beat
      const startTime =
        firstBeatAudioTime !== undefined
          ? Math.max(firstBeatAudioTime, audioContext.currentTime + 0.001)
          : audioContext.currentTime + 0.05;

      // Schedule all countdown clicks in Web Audio timeline
      const scheduledTimes: number[] = [];
      for (let i = 0; i < countdownState.totalBeats; i++) {
        const clickTime = startTime + i * beatDuration;
        const isAccented = i === 0; // First beat is accented

        // Schedule click on metronome
        if (metronome && typeof metronome.trigger === 'function') {
          metronome.trigger({
            audioTime: clickTime,
            velocity: isAccented ? 100 : 80,
            data: {
              beat: i + 1,
              isDownbeat: isAccented,
            },
          });
        }

        scheduledTimes.push(clickTime);
        logger.debug(
          `⏰ Scheduled countdown beat ${i + 1} at ${clickTime.toFixed(3)}s`,
        );
      }

      audioScheduleRef.current = scheduledTimes;

      // Visual countdown updates (synced with audio schedule)
      let beatIndex = 0; // Start at 0, will increment to 1 for first beat
      const visualInterval = beatDuration * 1000; // Convert to ms

      const updateVisualBeat = () => {
        beatIndex++; // Increment FIRST, so first call sets beatIndex to 1

        logger.debug(`🔴 Visual beat update: beatIndex=${beatIndex}`);

        setCountdownState((prev) => ({
          ...prev,
          currentBeat: beatIndex,
        }));

        const isAccented = beatIndex === 1;
        onBeatTick?.(beatIndex - 1, isAccented); // Pass 0-based index to callback

        // Don't stop on the last beat - let it continue so the interval triggers one more time
        // This keeps the 4th dot visible for its full duration
      };

      const completeCountdown = () => {
        // This fires AFTER the final beat duration has passed
        if (countdownTimerRef.current) {
          clearInterval(countdownTimerRef.current);
          countdownTimerRef.current = null;
        }

        setCountdownState((prev) => ({
          ...prev,
          isCountingDown: false,
          currentBeat: 0,
        }));

        logger.info('✅ Countdown complete');
        onCountdownComplete?.();
      };

      // Trigger first beat to sync with audio start time
      const firstBeatDelay = (startTime - audioContext.currentTime) * 1000;
      logger.debug(
        `⏰ First beat will trigger in ${firstBeatDelay.toFixed(1)}ms`,
      );

      firstBeatTimerRef.current = setTimeout(() => {
        updateVisualBeat(); // First beat
        // Start interval for subsequent beats
        countdownTimerRef.current = setInterval(
          updateVisualBeat,
          visualInterval,
        );
      }, firstBeatDelay);

      // Schedule countdown completion exactly when it should end (after all beats have played)
      const totalCountdownDuration =
        countdownState.totalBeats * beatDuration * 1000;
      completionTimerRef.current = setTimeout(
        completeCountdown,
        firstBeatDelay + totalCountdownDuration,
      );
    },
    [countdownState.totalBeats, timeSignature, onCountdownComplete, onBeatTick],
  );

  /**
   * Cancels an ongoing countdown.
   */
  const cancelCountdown = useCallback(() => {
    logger.info('🛑 Canceling countdown');

    // Clear ALL timers to prevent race conditions
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    if (firstBeatTimerRef.current) {
      clearTimeout(firstBeatTimerRef.current);
      firstBeatTimerRef.current = null;
    }
    if (completionTimerRef.current) {
      clearTimeout(completionTimerRef.current);
      completionTimerRef.current = null;
    }

    setCountdownState((prev) => ({
      ...prev,
      isCountingDown: false,
      currentBeat: 0,
    }));

    audioScheduleRef.current = [];
  }, []);

  /**
   * Resets countdown state without triggering callbacks.
   */
  const resetCountdown = useCallback(() => {
    // Clear ALL timers to prevent race conditions
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    if (firstBeatTimerRef.current) {
      clearTimeout(firstBeatTimerRef.current);
      firstBeatTimerRef.current = null;
    }
    if (completionTimerRef.current) {
      clearTimeout(completionTimerRef.current);
      completionTimerRef.current = null;
    }

    setCountdownState({
      isCountingDown: false,
      currentBeat: 0,
      totalBeats: timeSignature?.numerator || 4,
    });

    audioScheduleRef.current = [];
  }, [timeSignature?.numerator]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Clear ALL timers on unmount
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
      }
      if (firstBeatTimerRef.current) {
        clearTimeout(firstBeatTimerRef.current);
      }
      if (completionTimerRef.current) {
        clearTimeout(completionTimerRef.current);
      }
    };
  }, []);

  return {
    countdownState,
    startCountdown,
    cancelCountdown,
    resetCountdown,
  };
}
