'use client';

import React, { useEffect, useState } from 'react';
import { useTransport } from '@/domains/playback/hooks/useTransport';
import { Clock, Activity } from 'lucide-react';
import { LoopGridStrip } from './LoopGridStrip';
import type { LoopRegion } from './LoopGridStrip';
import type { Exercise } from '@bassnotion/contracts';
import { useCorrelation } from '@/shared/hooks/useCorrelation';

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
  const { correlationId, logger } = useCorrelation('TransportClock');
  transportClockRenderCount++;

  const { position, tempo, timeSignature, isPlaying, isPaused, isStopped } =
    useTransport();

  // Track render count for this instance
  const renderCountRef = React.useRef(0);
  renderCountRef.current++;

  // Log transport state every 10th render
  React.useEffect(() => {
    if (transportClockRenderCount % 10 === 0) {
      logger.info('⏰ [TransportClock] Transport state:', {
        position,
        tempo,
        timeSignature,
        isPlaying,
        isPaused,
        isStopped,
        renderCount: transportClockRenderCount,
        timestamp: new Date().toISOString(),
      });
    }
  });

  const [audioContextState, setAudioContextState] = useState<string>('unknown');
  const [updateCount, setUpdateCount] = useState(0);

  // Use ref to track current state to avoid closure issues
  const audioContextStateRef = React.useRef(audioContextState);
  audioContextStateRef.current = audioContextState;

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

      const coreServices = (window as any).__globalCoreServices;
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
  useEffect(() => {
    setUpdateCount((prev) => prev + 1);
  }, [position]);

  // Format position for display
  const formatPosition = () => {
    if (!position) return '1:1:0';

    // Display as bars:beats:sixteenths (1-based for musician-friendly display)
    const bar = position.bars + 1;
    const beat = position.beats + 1;
    const sixteenth = position.sixteenths;

    return `${bar}:${beat}:${sixteenth.toString().padStart(2, '0')}`;
  };

  // Format seconds
  const formatSeconds = () => {
    if (!position?.seconds) return '0.000s';
    return `${position.seconds.toFixed(3)}s`;
  };

  // Get transport state string
  const getTransportState = () => {
    if (isPlaying && !isPaused) return 'PLAYING';
    if (isPaused) return 'PAUSED';
    if (isStopped) return 'STOPPED';
    return 'UNKNOWN';
  };

  // Get state color
  const getStateColor = () => {
    if (audioContextState !== 'running') return 'text-yellow-500';
    if (isPlaying && !isPaused) return 'text-green-500';
    if (isPaused) return 'text-yellow-500';
    return 'text-gray-500';
  };

  return (
    <div className="bg-slate-800 rounded-2xl p-3 shadow-[inset_2px_2px_5px_rgba(0,0,0,0.5),inset_-2px_-2px_5px_rgba(255,255,255,0.1)]">
      {/* First Row - Time Signature, Clock, Tempo */}
      <div className="flex items-center justify-between mb-3">
        {/* Time Signature - Left */}
        <div className="flex items-center gap-2">
          <div className="bg-slate-700 rounded-xl px-4 py-2 shadow-[inset_2px_2px_4px_rgba(0,0,0,0.4),inset_-2px_-2px_4px_rgba(255,255,255,0.08)]">
            <div className="text-xs text-slate-400 mb-0.5">Time</div>
            <div className="text-lg font-mono font-bold text-white">
              {timeSignature.numerator}/{timeSignature.denominator}
            </div>
          </div>
        </div>

        {/* Master Clock - Center */}
        <div className="flex-1 flex justify-center">
          <div className="bg-slate-900 rounded-2xl px-8 py-3 shadow-[inset_3px_3px_6px_rgba(0,0,0,0.6),inset_-3px_-3px_6px_rgba(255,255,255,0.1)]">
            <div className="flex items-center gap-3">
              <div
                className={`w-2 h-2 rounded-full ${isPlaying ? 'bg-green-500' : 'bg-slate-600'} shadow-[0_0_4px_rgba(0,255,0,0.6)]`}
              />
              <div className="text-3xl font-mono font-bold text-white tracking-wider">
                {formatPosition()}
              </div>
              <div className="text-sm text-slate-400">{formatSeconds()}</div>
            </div>
          </div>
        </div>

        {/* Tempo Adjustment - Right */}
        <div className="flex items-center gap-2">
          <div className="bg-slate-700 rounded-xl px-4 py-2 shadow-[inset_2px_2px_4px_rgba(0,0,0,0.4),inset_-2px_-2px_4px_rgba(255,255,255,0.08)]">
            <div className="text-xs text-slate-400 mb-0.5">Tempo</div>
            <div className="text-lg font-mono font-bold text-white">
              {tempo} BPM
            </div>
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
            if (selectedExercise.duration_beats && selectedExercise.bpm) {
              const beatsPerSecond = selectedExercise.bpm / 60;
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
        />
      </div>
    </div>
  );
}
