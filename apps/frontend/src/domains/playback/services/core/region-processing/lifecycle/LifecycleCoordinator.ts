/**
 * LifecycleCoordinator - Manages RegionProcessor start/stop lifecycle
 *
 * Responsibilities:
 * - Start playback (transport anchor, scheduler sync, initial scheduling)
 * - Stop playback (graceful vs manual, audio cleanup, state reset)
 * - Audio source lifecycle (tracking, cleanup, fadeouts)
 * - Interval management (scheduling loop)
 * - Metrics coordination (start/stop reporting)
 *
 * This module handles the complex orchestration of starting and stopping
 * the playback engine, ensuring proper cleanup and preventing audio artifacts.
 */

import * as Tone from 'tone';
import { getLogger } from '@/utils/logger.js';

const logger = getLogger('RegionProcessor');

// Types
interface Track {
  id?: string;
  name?: string;
  instrumentType?: string;
  audioNode?: {
    clearEvents?: () => void;
  };
}

interface AudioSourceInfo {
  type: 'one-shot' | 'sustained';
  hasStopScheduled: boolean;
}

interface TimingMetrics {
  totalEvents: number;
  perfectFrames: number;
  accuracy: number;
  avgJitterMs: number;
  maxJitterMs: number;
  grade: string;
  isStable: boolean;
}

export class LifecycleCoordinator {
  private instanceId: string;

  constructor(instanceId: string) {
    this.instanceId = instanceId;
  }

  /**
   * Start playback - initialize transport, sync schedulers, begin scheduling
   *
   * CRITICAL RESPONSIBILITIES:
   * - Capture transport start time (anchor musical timeline to hardware clock)
   * - Sync all schedulers with AudioContext and transport start time
   * - Clear old scheduled events to prevent double-playback
   * - Schedule initial events upfront
   * - Start scheduling interval for dynamic scheduling
   *
   * @param isRunning - Current running state
   * @param audioContext - AudioContext for timing
   * @param sampleRate - Sample rate from context
   * @param tracks - Registered tracks
   * @param metronomeBuffers - Metronome buffers for validation
   * @param audioDestination - Audio destination node
   * @param scheduledIds - Set of Tone.Transport IDs to clear
   * @param scheduledEvents - Map of scheduled events per track
   * @param scheduleInterval - Current interval handle (to clear)
   * @param isInitialScheduling - Guard flag for backup scheduler
   *
   * @param setAudioContext - Function to update audio context
   * @param setSampleRate - Function to update sample rate
   * @param setTransportStartTime - Function to update transport start time
   * @param syncTransportStartTime - Function to sync transport start time to all modules
   * @param clearScheduledState - Function to clear scheduled events/IDs
   * @param resetMetrics - Function to reset timing metrics
   * @param startMetricsReporting - Function to start metrics reporting
   * @param scheduleAllRegions - Function to schedule all regions
   * @param getDebugger - Function to get debugger instance
   * @param processCurrentPosition - Function to process current position
   *
   * @returns Updated state: {isRunning, transportStartTime, scheduleInterval, isInitialScheduling}
   */
  start(
    isRunning: boolean,
    audioContext: AudioContext | null,
    sampleRate: number,
    tracks: Map<string, Track>,
    metronomeBuffers: any,
    audioDestination: any,
    scheduledIds: Set<number>,
    scheduledEvents: Map<string, Set<string>>,
    scheduleInterval: any,
    isInitialScheduling: boolean,

    // Dependencies
    setAudioContext: (context: AudioContext) => void,
    setSampleRate: (rate: number) => void,
    setTransportStartTime: (time: number) => void,
    syncTransportStartTime: (time: number) => void,
    clearScheduledState: () => void,
    resetMetrics: () => void,
    startMetricsReporting: () => void,
    scheduleAllRegions: () => void,
    getDebugger: () => any,
    processCurrentPosition: () => void,
  ): {
    isRunning: boolean;
    transportStartTime: number;
    scheduleInterval: any;
    isInitialScheduling: boolean;
  } {
    if (isRunning) {
      return {
        isRunning,
        transportStartTime: 0,
        scheduleInterval,
        isInitialScheduling,
      };
    }

    // CRITICAL: Capture transport start time to anchor musical timeline to hardware clock
    // Try to get AudioContext from Tone.js if not set explicitly
    if (!audioContext && Tone.context) {
      logger.warn(
        '⚠️ AudioContext not set via setAudioContext(), using Tone.context as fallback',
        {
          instanceId: this.instanceId,
          hasBuffers: !!(metronomeBuffers.accent && metronomeBuffers.click),
          hasDestination: !!audioDestination,
        },
      );
      audioContext = Tone.context as unknown as AudioContext;
      sampleRate = audioContext.sampleRate;
      setAudioContext(audioContext);
      setSampleRate(sampleRate);
    }

    let transportStartTime = 0;

    if (audioContext) {
      // FAANG SOLUTION: Add startup lookahead to prevent first beat latency
      const startupLookahead = 0.2; // 200ms
      transportStartTime = audioContext.currentTime + startupLookahead;
      setTransportStartTime(transportStartTime);

      // Sync transport start time to all modules
      syncTransportStartTime(transportStartTime);

      logger.info(
        '🎯 Transport start anchor captured with FAANG startup lookahead',
        {
          transportStartTime: transportStartTime.toFixed(3),
          currentContextTime: audioContext.currentTime.toFixed(3),
          startupLookahead: `${startupLookahead * 1000}ms`,
          sampleRate,
        },
      );
    } else {
      logger.error(
        '❌ CRITICAL: No AudioContext available! Time domain conversion will fail completely.',
      );
    }

    logger.info('Starting RegionProcessor');
    const audioDebugger = getDebugger();
    audioDebugger.log('RegionProcessor', 'starting', {
      tracks: tracks.size,
      transportState: Tone.Transport.state,
      transportSeconds: Tone.Transport.seconds,
      transportPosition: Tone.Transport.position,
      transportStartTime,
    });

    isRunning = true;

    // FAANG FIX: Clear old Tone.Transport scheduled events FIRST
    scheduledIds.forEach((toneId) => {
      try {
        Tone.Transport.clear(toneId);
      } catch (e) {
        // Ignore errors when clearing
      }
    });
    scheduledIds.clear();
    scheduledEvents.clear();

    // Reset and start timing metrics
    resetMetrics();
    startMetricsReporting();

    // DIAGNOSTIC: Check BPM before scheduling
    const currentToneBpm = Tone.Transport.bpm.value;
    logger.info(
      '🎵 RegionProcessor.start() - Checking Tone.Transport BPM before scheduling',
      {
        toneBpm: currentToneBpm,
        instanceId: this.instanceId,
      },
    );

    // AUDIO DOUBLING FIX: Disable Tone.Transport.loop
    if (Tone.Transport.loop) {
      logger.warn(
        '⚠️ Tone.Transport.loop was enabled - disabling to prevent double playback',
        {
          loopStart: Tone.Transport.loopStart,
          loopEnd: Tone.Transport.loopEnd,
          instanceId: this.instanceId,
        },
      );
      Tone.Transport.loop = false;
    }

    // AUDIO DOUBLING FIX: Set guard flag
    isInitialScheduling = true;

    // Schedule events ahead of time
    scheduleAllRegions();

    // AUDIO DOUBLING FIX: Clear guard flag
    isInitialScheduling = false;

    // Set up regular check for dynamic scheduling
    scheduleInterval = setInterval(() => {
      logger.debug('⏰ Interval callback fired', {
        isRunning,
        transportState: Tone.Transport.state,
        isInitialScheduling,
        timestamp: Date.now(),
      });

      if (
        isRunning &&
        Tone.Transport.state === 'started' &&
        !isInitialScheduling
      ) {
        processCurrentPosition();
      }
    }, 25); // Check every 25ms

    return {
      isRunning,
      transportStartTime,
      scheduleInterval,
      isInitialScheduling,
    };
  }

  /**
   * Stop playback - cleanup audio, reset state
   *
   * @param graceful - If true, allow one-shot samples to finish naturally.
   *                   If false (manual stop), force-stop ALL audio immediately.
   * @param isRunning - Current running state
   * @param scheduleInterval - Interval handle to clear
   * @param scheduledIds - Set of Tone.Transport IDs to clear
   * @param scheduledEvents - Map of scheduled events per track
   * @param currentCC64Timeline - CC64 timeline map to clear
   * @param activeHarmonySources - Active harmony sources map
   * @param activeBassSources - Active bass sources map
   * @param scheduledAudioSources - Scheduled audio sources map
   * @param tracks - Registered tracks (for WAM plugin cleanup)
   * @param audioContext - AudioContext for timing
   *
   * @param getTimingMetrics - Function to get final metrics
   * @param stopMetricsReporting - Function to stop metrics reporting
   *
   * @returns Updated state: {isRunning, scheduleInterval, lastProcessedPosition}
   */
  stop(
    graceful: boolean,
    isRunning: boolean,
    scheduleInterval: any,
    scheduledIds: Set<number>,
    scheduledEvents: Map<string, Set<string>>,
    currentCC64Timeline: Map<number, boolean>,
    activeHarmonySources: Map<
      string,
      Array<{
        source: AudioBufferSourceNode;
        gain: GainNode;
        gainValue: number;
        noteEndTime: number;
      }>
    >,
    activeBassSources: Map<string, AudioBufferSourceNode>,
    scheduledAudioSources: Map<AudioBufferSourceNode, AudioSourceInfo>,
    tracks: Map<string, Track>,
    audioContext: AudioContext | null,

    // Dependencies
    getTimingMetrics: () => TimingMetrics,
    stopMetricsReporting: () => void,
  ): { isRunning: boolean; scheduleInterval: any; lastProcessedPosition: number } {
    if (!isRunning) {
      return { isRunning, scheduleInterval, lastProcessedPosition: -1 };
    }

    logger.info('Stopping RegionProcessor', { graceful });

    // Stop metrics reporting and log final stats
    const metricsBeforeStop = getTimingMetrics();
    stopMetricsReporting();
    if (metricsBeforeStop.totalEvents > 0) {
      logger.info('📊 Final Timing Report', metricsBeforeStop);
    }

    // CRITICAL FIX: Clear interval BEFORE setting isRunning = false
    logger.info('🛑 STOP: Clearing interval FIRST to prevent race condition', {
      hasInterval: !!scheduleInterval,
      timestamp: Date.now(),
    });

    if (scheduleInterval) {
      clearInterval(scheduleInterval);
      scheduleInterval = null;
      logger.info('🛑 STOP: Interval cleared successfully');
    }

    // Now safe to set flag
    isRunning = false;
    logger.info('🛑 STOP: isRunning = false');

    // Clear all scheduled events
    scheduledIds.forEach((toneId) => {
      try {
        Tone.Transport.clear(toneId);
      } catch (e) {
        // Ignore errors
      }
    });
    scheduledIds.clear();
    scheduledEvents.clear();

    // Cancel ALL events on Tone.Transport
    try {
      Tone.Transport.cancel(0);
      logger.info('🎵 RegionProcessor: Cancelled all Tone.Transport events');
    } catch (e) {
      logger.error(
        '🎵 RegionProcessor: Failed to cancel Tone.Transport events',
        e,
      );
    }

    // Clear CC64 timeline
    currentCC64Timeline.clear();

    // Handle audio sources based on stop type
    const now = audioContext?.currentTime || 0;
    const fadeOutTime = 0.03; // 30ms

    if (!graceful) {
      // MANUAL STOP: Fade out all active harmony notes
      activeHarmonySources.forEach((sourceGainPairs) => {
        sourceGainPairs.forEach(({ gain }) => {
          try {
            const currentGain = gain.gain.value;
            gain.gain.cancelScheduledValues(now);
            gain.gain.setValueAtTime(currentGain, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + fadeOutTime);
          } catch (e) {
            // Ignore if already stopped
          }
        });
      });
    }

    // Clear harmony sustain state
    activeHarmonySources.clear();

    if (graceful) {
      // GRACEFUL STOP: Let one-shot samples finish naturally
      logger.info(
        '🎵 GRACEFUL STOP: Allowing one-shot samples to finish, last harmony notes ring naturally',
      );

      let oneShotCount = 0;
      scheduledAudioSources.forEach((info) => {
        if (info.type === 'one-shot') {
          oneShotCount++;
        }
      });

      logger.info('🎵 GRACEFUL STOP: Audio cleanup complete', {
        oneShotsPreserved: oneShotCount,
        harmonyLastNotes: 'pre-scheduled to ring for 2s (1s hold + 1s fade)',
      });
    } else {
      // MANUAL STOP: Fast fadeout
      logger.info('🛑 MANUAL STOP: Fast 30ms fadeout for all harmony notes');

      // Stop harmony WAM plugin
      const harmonyTrack = Array.from(tracks.values()).find(
        (t) => t.instrumentType === 'harmony',
      );
      if (harmonyTrack?.audioNode?.clearEvents) {
        logger.info('🛑 Stopping harmony WAM plugin via clearEvents()');
        harmonyTrack.audioNode.clearEvents();
      }

      // Stop non-harmony sources
      scheduledAudioSources.forEach((info, source) => {
        try {
          if (info.type === 'one-shot') {
            source.stop(now + fadeOutTime);
            logger.debug(
              `🛑 Stopped ${info.type} source with ${fadeOutTime * 1000}ms fadeout`,
            );
          } else if (info.hasStopScheduled) {
            logger.debug(`🛑 Harmony note - fast fadeout applied`);
          }
        } catch (e) {
          logger.debug(`🛑 Error stopping source: ${e}`);
        }
      });

      logger.info(
        '🛑 MANUAL STOP: Non-harmony sources stopped, harmony with fast 30ms fadeout',
      );
    }

    // Handle scheduled audio sources
    let futureSourcesStopped = 0;

    if (graceful) {
      // GRACEFUL: Only stop future sources
      scheduledAudioSources.forEach((info, source) => {
        try {
          if (info.type === 'sustained' && info.hasStopScheduled) {
            logger.debug(
              `🎵 GRACEFUL: Preserving ${info.type} source with scheduled ring-out`,
            );
          } else {
            source.stop(now + fadeOutTime);
            futureSourcesStopped++;
            logger.debug(`🛑 GRACEFUL: Stopped future ${info.type} source`);
          }
        } catch (e) {
          logger.debug(`🛑 Source already stopped: ${info.type}`);
        }
      });

      logger.info(
        `🎵 GRACEFUL STOP: Stopped ${futureSourcesStopped} future sources`,
      );

      // Schedule cleanup after ring-out
      setTimeout(() => {
        scheduledAudioSources.clear();
        logger.info(
          '🎵 GRACEFUL STOP: Cleared scheduled sources after ring-out period',
        );
      }, 3500); // 3s ring-out + 500ms buffer
    } else {
      // MANUAL: Stop ALL sources
      scheduledAudioSources.forEach((info, source) => {
        try {
          source.stop(now + fadeOutTime);
          futureSourcesStopped++;
          logger.debug(
            `🛑 Stopped future ${info.type} source with ${fadeOutTime * 1000}ms fadeout`,
          );
        } catch (e) {
          logger.debug(`🛑 Source already stopped: ${info.type}`);
        }
      });

      logger.info(
        `🛑 MANUAL STOP: Stopped ${futureSourcesStopped} future sources`,
      );

      scheduledAudioSources.clear();
      logger.info('🛑 MANUAL STOP: All scheduled audio sources cleared');
    }

    // Stop active bass notes
    activeBassSources.forEach((source) => {
      try {
        source.stop(now + fadeOutTime);
      } catch (e) {
        // Ignore errors
      }
    });
    activeBassSources.clear();

    return {
      isRunning,
      scheduleInterval,
      lastProcessedPosition: -1,
    };
  }
}
