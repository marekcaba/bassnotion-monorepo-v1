'use client';

import React, { useEffect, useState } from 'react';
import { useTransportContext } from '@/domains/playback/contexts/TransportContext';
import { LoopGridStrip } from './LoopGridStrip';
import type { LoopRegion } from './LoopGridStrip';
import type { Exercise } from '@bassnotion/contracts';
import { useCorrelation } from '@/shared/hooks/useCorrelation';
import { logSkeletonDebug } from '@/utils/skeletonDebug';
import { useTransportClockSync } from '@/domains/widgets/hooks/useBeatGridSync';

interface TransportClockProps {
  selectedExercise?: Exercise;
  loopRegion?: LoopRegion | null;
  onLoopRegionChange?: (region: LoopRegion | null) => void;
  currentTime?: number;
  onSeek?: (position: number) => void;
}

// Track render count at module level for logging
let transportClockRenderCount = 0;

// Singleton pattern to prevent multiple instances running simultaneously
let globalAudioContextInterval: NodeJS.Timeout | null = null;
let globalInstanceCount = 0;

export function TransportClock({
  selectedExercise,
  loopRegion,
  onLoopRegionChange,
  currentTime = 0,
  onSeek,
}: TransportClockProps) {
  // useCorrelation called for the side effect of binding a correlation
  // ID to logs in this scope; the returned values aren't read here.
  const { logger } = useCorrelation('TransportClock');
  transportClockRenderCount++;

  // SKELETON-DEBUG: Log first 5 renders with timing (using shared baseline)
  logSkeletonDebug('⏱️', 'TransportClock', transportClockRenderCount, {
    hasExercise: !!selectedExercise,
  });

  // MOUNT/UNMOUNT DETECTION for double countdown bug
  // TEMPORARILY DISABLED - too noisy in console
  // React.useEffect(() => {
  //   console.log('🔴 [MOUNT DEBUG] TransportClock MOUNTED', {
  //     timestamp: Date.now(),
  //     selectedExercise: selectedExercise?.id,
  //   });
  //   return () => {
  //     console.log('🔴 [UNMOUNT DEBUG] TransportClock UNMOUNTING', {
  //       timestamp: Date.now(),
  //     });
  //   };
  // }, []);

  const transport = useTransportContext();
  const { position, tempo, timeSignature, isPlaying, isPaused, isStopped } =
    transport;

  // 🚀 JITTER FIX: Direct DOM position display synchronization (bypasses React state)
  // This hook subscribes directly to AtomicPlaybackClock and updates the position text
  // via DOM manipulation, eliminating jitter from React's batched updates.
  const beatsPerMeasure = timeSignature?.numerator || 4;
  const { registerPositionDisplay, registerPlayingIndicator } =
    useTransportClockSync({
      isPlaying,
      beatsPerMeasure,
      isVisible: true,
    });

  // NOTE: isValidPosition useMemo lived here — used by the deleted
  // formatPosition helper to skip rendering corrupted positions during
  // AudioWorklet init. The clock display flow has moved to
  // useTransportClockSync which handles its own validation.

  // POSITION CHANGE DETECTION for double countdown bug
  // TEMPORARILY DISABLED - too noisy in console
  // React.useEffect(() => {
  //   console.log('📍 [POSITION DEBUG] TransportClock received new position', {
  //     position: `${position.bars}:${position.beats}:${position.sixteenths}`,
  //     isPlaying,
  //     isValid: isValidPosition,
  //     timestamp: Date.now(),
  //   });
  // }, [
  //   position.bars,
  //   position.beats,
  //   position.sixteenths,
  //   isPlaying,
  //   isValidPosition,
  // ]);

  // Track render count for this instance
  const renderCountRef = React.useRef(0);
  renderCountRef.current++;

  // Log transport state every 10th render
  React.useEffect(() => {
    if (transportClockRenderCount % 10 === 0) {
      logger.info('⏰ [TransportClock] Transport state:', {
        position,
        tempo,
        // CRITICAL FIX: Ensure timeSignature object is properly serialized for logging
        timeSignature: timeSignature
          ? `${timeSignature.numerator}/${timeSignature.denominator}`
          : 'undefined',
        timeSignatureRaw: JSON.stringify(timeSignature),
        isPlaying,
        isPaused,
        isStopped,
        renderCount: transportClockRenderCount,
        timestamp: new Date().toISOString(),
      });
    }
  });

  const [audioContextState, setAudioContextState] = useState<string>('unknown');
  // updateCount: setter is incremented to force a re-render after
  // direct DOM updates; the value itself isn't read anywhere.
  const [_updateCount, setUpdateCount] = useState(0);
  const [isEditingTempo, setIsEditingTempo] = useState(false);
  const [editedTempo, setEditedTempo] = useState<string>('');
  const [userTempo, setUserTempo] = useState<number | null>(null);
  const tempoInputRef = React.useRef<HTMLInputElement>(null);

  // Use ref to track current state to avoid closure issues
  const audioContextStateRef = React.useRef(audioContextState);
  audioContextStateRef.current = audioContextState;

  // Get current display tempo - prioritize transport tempo, then user-set, then exercise default
  const displayTempo = tempo || userTempo || selectedExercise?.bpm;

  // Initialize user tempo when exercise changes
  useEffect(() => {
    if (selectedExercise?.bpm && !userTempo) {
      setUserTempo(selectedExercise.bpm);
    }
  }, [selectedExercise?.bpm, userTempo]);

  // Sync userTempo when context tempo changes from external source
  useEffect(() => {
    if (tempo && tempo !== userTempo) {
      setUserTempo(tempo);
    }
  }, [tempo]);

  // Monitor AudioContext state using singleton pattern
  useEffect(() => {
    const instanceId = Math.random().toString(36).substr(2, 9);
    globalInstanceCount++;
    const currentInstanceCount = globalInstanceCount;

    logger.info(
      `⏰ [TransportClock-${instanceId}] Instance ${currentInstanceCount} mounting - total instances: ${globalInstanceCount}`,
    );

    let checkCount = 0;
    let isActiveInstance = true;

    const checkAudioContext = () => {
      if (!isActiveInstance) return;

      checkCount++;

      const coreServices = window.__globalCoreServices;
      if (coreServices?.getAudioEngine) {
        try {
          const audioEngine = coreServices.getAudioEngine();
          const context = audioEngine.getContext();
          if (context) {
            const newState = context.state;

            // Only update state if it actually changed
            if (newState !== audioContextStateRef.current) {
              logger.info(
                `⏰ [TransportClock-${instanceId}] Audio context state changed:`,
                audioContextStateRef.current,
                '->',
                newState,
              );
              setAudioContextState(newState);

              // If we got a running context, we can stop checking so frequently
              if (newState === 'running' && globalAudioContextInterval) {
                logger.info(
                  `⏰ [TransportClock-${instanceId}] Audio context is running, stopping frequent checks`,
                );
                clearInterval(globalAudioContextInterval);
                globalAudioContextInterval = null;
              }
            }

            return newState;
          }
        } catch (e) {
          // Only update if not already "not initialized"
          if (audioContextStateRef.current !== 'not initialized') {
            logger.info(
              `⏰ [TransportClock-${instanceId}] Audio context error, setting to "not initialized"`,
            );
            setAudioContextState('not initialized');
          }
        }
      }

      // If we've checked 10 times (50 seconds) and still not initialized, reduce frequency
      if (
        checkCount >= 10 &&
        audioContextStateRef.current === 'not initialized' &&
        globalAudioContextInterval &&
        isActiveInstance
      ) {
        logger.info(
          `⏰ [TransportClock-${instanceId}] Audio context still not initialized after 10 checks, reducing check frequency to 30s`,
        );
        clearInterval(globalAudioContextInterval);
        globalAudioContextInterval = setInterval(checkAudioContext, 30000); // Check every 30 seconds instead
      }

      return audioContextStateRef.current;
    };

    // Check immediately
    const initialState = checkAudioContext();

    // Only start global interval if not already running and state is not 'running'
    if (initialState !== 'running' && !globalAudioContextInterval) {
      logger.info(
        `⏰ [TransportClock-${instanceId}] Starting GLOBAL 5-second interval for audio context checks`,
      );
      globalAudioContextInterval = setInterval(checkAudioContext, 5000);
    } else if (initialState === 'running') {
      logger.info(
        `⏰ [TransportClock-${instanceId}] Audio context already running, no need for interval`,
      );
    } else {
      logger.info(
        `⏰ [TransportClock-${instanceId}] Global interval already running, sharing singleton`,
      );
    }

    return () => {
      logger.info(
        `⏰ [TransportClock-${instanceId}] Instance ${currentInstanceCount} unmounting`,
      );
      isActiveInstance = false;
      globalInstanceCount--;

      // Only clear global interval when the last instance unmounts
      if (globalInstanceCount === 0 && globalAudioContextInterval) {
        logger.info(
          `⏰ [TransportClock-${instanceId}] Last instance unmounting, cleaning up GLOBAL interval`,
        );
        clearInterval(globalAudioContextInterval);
        globalAudioContextInterval = null;
      } else {
        logger.info(
          `⏰ [TransportClock-${instanceId}] Instance unmounted, ${globalInstanceCount} instances remaining`,
        );
      }
    };
  }, []);

  // Count position updates to see if transport is running
  // 🚨 INFINITE LOOP FIX: Depend on primitive values, not entire object reference
  // position object is recreated every frame (60Hz), causing infinite re-renders
  useEffect(() => {
    setUpdateCount((prev) => prev + 1);
  }, [position.bars, position.beats, position.sixteenths]);

  // NOTE: formatPosition / formatSeconds / getTransportState /
  // getStateColor used to live here. The clock display now reads
  // directly from useTransportClockSync via LoopGridStrip — these
  // helpers are no longer called.

  // Handle tempo editing
  const handleTempoClick = React.useCallback(() => {
    if (displayTempo) {
      setEditedTempo(displayTempo.toString());
      setIsEditingTempo(true);
    }
  }, [displayTempo]);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditingTempo && tempoInputRef.current) {
      tempoInputRef.current.focus();
      tempoInputRef.current.select();
    }
  }, [isEditingTempo]);

  // Handle tempo change
  const handleTempoChange = React.useCallback(
    async (newTempo: number) => {
      if (newTempo >= 40 && newTempo <= 300) {
        try {
          // Save user tempo first
          setUserTempo(newTempo);
          // Then update transport
          await transport.setTempo(newTempo);
          logger.info('🎵 Tempo updated:', { newTempo });
        } catch (error) {
          logger.error('Failed to update tempo:', error);
        }
      }
    },
    [transport, logger],
  );

  // Handle input submission
  const handleTempoSubmit = React.useCallback(() => {
    const newTempo = parseInt(editedTempo, 10);
    if (!isNaN(newTempo)) {
      handleTempoChange(newTempo);
    }
    setIsEditingTempo(false);
  }, [editedTempo, handleTempoChange]);

  // Handle input blur
  const handleTempoBlur = React.useCallback(() => {
    handleTempoSubmit();
  }, [handleTempoSubmit]);

  // Handle input key press
  const handleTempoKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        handleTempoSubmit();
      } else if (e.key === 'Escape') {
        setIsEditingTempo(false);
      }
    },
    [handleTempoSubmit],
  );

  return (
    <div className="zone-card bg-slate-800 rounded-2xl p-3 shadow-[inset_2px_2px_5px_rgba(0,0,0,0.5),inset_-2px_-2px_5px_rgba(255,255,255,0.1)]">
      {/* First Row - Time Signature, Clock, Tempo */}
      <div className="flex items-center justify-between mb-3">
        {/* Time Signature - Left */}
        <div className="flex items-center gap-2">
          <div className="bg-slate-700 rounded-xl px-4 py-2 shadow-[inset_2px_2px_4px_rgba(0,0,0,0.4),inset_-2px_-2px_4px_rgba(255,255,255,0.08)]">
            <div className="text-xs text-slate-400 mb-0.5">Time</div>
            <div className="text-lg font-mono-display font-bold text-white tabular-nums">
              {timeSignature?.numerator || 4}/{timeSignature?.denominator || 4}
            </div>
          </div>
        </div>

        {/* Master Clock - Center */}
        {/* 🚀 JITTER FIX: Direct DOM position display via ref registration */}
        {/* The hook's textContent update bypasses React for jitter-free updates */}
        <div className="flex-1 flex justify-center">
          <div className="bg-slate-900 rounded-2xl px-8 py-3 shadow-[inset_3px_3px_6px_rgba(0,0,0,0.6),inset_-3px_-3px_6px_rgba(255,255,255,0.1)]">
            <div className="flex items-center gap-3">
              <div
                ref={registerPlayingIndicator}
                className={`w-2 h-2 rounded-full ${isPlaying ? 'bg-green-500' : 'bg-slate-600'} shadow-[0_0_4px_rgba(0,255,0,0.6)]`}
              />
              {/* Position display - content set by useTransportClockSync hook via direct DOM */}
              {/* Initial value shown before hook takes over, then hook updates via textContent */}
              <div
                ref={registerPositionDisplay}
                className="text-3xl font-mono-display font-bold text-white tracking-wider tabular-nums"
              >
                1:1:00
              </div>
            </div>
          </div>
        </div>

        {/* Tempo Adjustment - Right */}
        <div className="flex items-center gap-2">
          <div
            className="bg-slate-700 rounded-xl px-4 py-2 shadow-[inset_2px_2px_4px_rgba(0,0,0,0.4),inset_-2px_-2px_4px_rgba(255,255,255,0.08)] flex flex-col items-center cursor-pointer hover:bg-slate-600 transition-colors"
            onClick={handleTempoClick}
            title="Click to edit tempo"
          >
            {isEditingTempo ? (
              <input
                ref={tempoInputRef}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={editedTempo}
                onChange={(e) => setEditedTempo(e.target.value)}
                onBlur={handleTempoBlur}
                onKeyDown={handleTempoKeyDown}
                className="text-lg font-mono-display font-bold text-white bg-transparent border-none outline-none w-16 text-center tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            ) : (
              <div className="text-lg font-mono-display font-bold text-white tabular-nums">
                {displayTempo || '—'}
              </div>
            )}
            <div className="text-xs text-slate-400">BPM</div>
          </div>
        </div>
      </div>

      {/* Second Row - Timeline Loop Strip */}
      <div className="w-full">
        <LoopGridStrip
          exercise={selectedExercise}
          currentTime={currentTime}
          duration={(() => {
            if (!selectedExercise) return 0;
            // Calculate duration in milliseconds from beats and BPM
            // TEMPO FIX: Use current transport tempo for duration calculation
            const effectiveBpm = tempo || selectedExercise.bpm;
            if (selectedExercise.duration_beats && effectiveBpm) {
              const beatsPerSecond = effectiveBpm / 60;
              const durationSeconds =
                selectedExercise.duration_beats / beatsPerSecond;
              return durationSeconds * 1000; // Convert to milliseconds
            }
            // Fallback to deprecated duration field if available
            return selectedExercise.duration || 0;
          })()}
          loopRegion={loopRegion}
          onLoopRegionChange={onLoopRegionChange || (() => undefined)}
          onSeek={onSeek}
          className="[&>div]:bg-transparent [&>div]:shadow-none [&>div]:p-0"
          currentTempo={tempo}
        />
      </div>
    </div>
  );
}

/**
 * Skeleton loading state for TransportClock
 * Shows placeholder for time signature, clock display, and timeline strip
 */
export function TransportClockSkeleton() {
  return (
    <div className="zone-card bg-slate-800 rounded-2xl p-3 shadow-[inset_2px_2px_5px_rgba(0,0,0,0.5),inset_-2px_-2px_5px_rgba(255,255,255,0.1)]">
      {/* First Row - Time Signature, Clock, Tempo */}
      <div className="flex items-center justify-between mb-3">
        {/* Time Signature Skeleton */}
        <div className="bg-slate-700 rounded-xl px-4 py-2 shadow-[inset_2px_2px_4px_rgba(0,0,0,0.4),inset_-2px_-2px_4px_rgba(255,255,255,0.08)]">
          <div className="skeleton-shimmer h-3 w-8 rounded mb-1" />
          <div className="skeleton-shimmer h-6 w-12 rounded" />
        </div>

        {/* Master Clock Skeleton */}
        <div className="flex-1 flex justify-center">
          <div className="bg-slate-900 rounded-2xl px-8 py-3 shadow-[inset_3px_3px_6px_rgba(0,0,0,0.6),inset_-3px_-3px_6px_rgba(255,255,255,0.1)]">
            <div className="flex items-center gap-3">
              <div className="skeleton-shimmer w-2 h-2 rounded-full" />
              <div className="skeleton-shimmer h-8 w-28 rounded" />
            </div>
          </div>
        </div>

        {/* Tempo Skeleton */}
        <div className="bg-slate-700 rounded-xl px-4 py-2 shadow-[inset_2px_2px_4px_rgba(0,0,0,0.4),inset_-2px_-2px_4px_rgba(255,255,255,0.08)] flex flex-col items-center">
          <div className="skeleton-shimmer h-6 w-12 rounded mb-1" />
          <div className="skeleton-shimmer h-3 w-8 rounded" />
        </div>
      </div>

      {/* Timeline Strip Skeleton */}
      <div className="skeleton-shimmer h-12 w-full rounded-lg" />
      <span className="sr-only">Loading transport controls...</span>
    </div>
  );
}
