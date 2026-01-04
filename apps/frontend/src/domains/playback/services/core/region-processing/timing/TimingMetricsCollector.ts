/**
 * TimingMetricsCollector - Tracks scheduling accuracy and timing metrics
 *
 * Measures frame-perfect timing accuracy by comparing scheduled audio times
 * with expected beat grid positions. Reports metrics periodically.
 */

import { getLogger } from '@/utils/logger.js';

const logger = getLogger('TimingMetricsCollector');

interface TimingMetrics {
  totalEvents: number;
  frameDeltas: number[];
  maxJitter: number;
  avgJitter: number;
  perfectFrames: number;
  lastBeatTime: number;
  expectedFrameInterval: number;
}

export class TimingMetricsCollector {
  private metrics: TimingMetrics = {
    totalEvents: 0,
    frameDeltas: [],
    maxJitter: 0,
    avgJitter: 0,
    perfectFrames: 0,
    lastBeatTime: 0,
    expectedFrameInterval: 24000, // 0.5s at 48kHz (default 120 BPM)
  };

  private metricsInterval: any = null;
  private sampleRate = 48000;
  private transportStartTime = 0;
  private currentTempo = 120; // Default tempo in BPM

  constructor() {
    // Empty constructor
  }

  /**
   * Set sample rate for timing calculations
   */
  setSampleRate(sampleRate: number): void {
    this.sampleRate = sampleRate;
  }

  /**
   * Set transport start time anchor
   */
  setTransportStartTime(time: number): void {
    this.transportStartTime = time;
  }

  /**
   * Set tempo (BPM) for timing calculations
   *
   * This recalculates expectedFrameInterval based on the actual exercise tempo.
   * Without this, the collector assumes 120 BPM which causes massive jitter
   * calculations when the exercise uses a different tempo (e.g., 69 BPM).
   *
   * Formula: expectedFrameInterval = sampleRate / (bpm / 60)
   * - At 120 BPM: 48000 / (120/60) = 48000 / 2 = 24000 frames/beat
   * - At 69 BPM: 48000 / (69/60) = 48000 / 1.15 = 41739 frames/beat
   *
   * @param bpm - Tempo in beats per minute
   */
  setTempo(bpm: number): void {
    if (bpm <= 0) {
      logger.warn('Invalid tempo provided, using default 120 BPM', { bpm });
      bpm = 120;
    }

    this.currentTempo = bpm;

    // Calculate frames per beat: sampleRate / (bpm / 60) = sampleRate * 60 / bpm
    const beatsPerSecond = bpm / 60;
    this.metrics.expectedFrameInterval = Math.round(
      this.sampleRate / beatsPerSecond,
    );

    logger.info('[TimingMetricsCollector] Tempo set', {
      bpm,
      expectedFrameInterval: this.metrics.expectedFrameInterval,
      sampleRate: this.sampleRate,
      framesPerBeat: this.metrics.expectedFrameInterval,
    });
  }

  /**
   * Track timing accuracy for a scheduled event
   * @param frame - Target frame number for the event (absolute AudioContext frame)
   * @param transportTime - Transport time in SECONDS (not beats!)
   */
  track(frame: number, transportTime: number): void {
    this.metrics.totalEvents++;

    // transportTime is in SECONDS, not beats!
    // Convert to expected frame directly: expectedFrame = transportTime * sampleRate
    // This gives us the frame offset from transport start (t=0)
    const expectedFrameFromTransportStart = Math.round(
      transportTime * this.sampleRate,
    );

    // The actual frame passed is an absolute AudioContext frame
    // We need to convert it to frame-from-transport-start for comparison
    const transportStartFrame = Math.round(
      this.transportStartTime * this.sampleRate,
    );
    const actualFrameFromTransportStart = frame - transportStartFrame;

    // Calculate jitter (deviation from expected position)
    // Both values are now in "frames from transport start" for apples-to-apples comparison
    const jitterFrames = Math.abs(
      actualFrameFromTransportStart - expectedFrameFromTransportStart,
    );
    const jitterMs = (jitterFrames / this.sampleRate) * 1000;

    // Track perfect frames (within 1 frame tolerance)
    if (jitterFrames <= 1) {
      this.metrics.perfectFrames++;
    }

    // Update max jitter
    if (jitterMs > this.metrics.maxJitter) {
      this.metrics.maxJitter = jitterMs;
    }

    // Keep last 100 frame deltas for rolling average
    this.metrics.frameDeltas.push(jitterFrames);
    if (this.metrics.frameDeltas.length > 100) {
      this.metrics.frameDeltas.shift();
    }

    // Calculate average jitter
    const avgFrames =
      this.metrics.frameDeltas.reduce((a, b) => a + b, 0) /
      this.metrics.frameDeltas.length;
    this.metrics.avgJitter = (avgFrames / this.sampleRate) * 1000;
  }

  /**
   * Start periodic metrics reporting
   */
  startReporting(): void {
    // Report metrics every 10 events or every 5 seconds, whichever comes first
    // This ensures we get feedback even on short 1-2 bar exercises
    let lastReportedCount = 0;

    this.metricsInterval = setInterval(() => {
      // Only report if we have new events (at least 8 new events, or any events after 5 seconds)
      const newEvents = this.metrics.totalEvents - lastReportedCount;
      if (newEvents >= 8 || (newEvents > 0 && this.metrics.totalEvents > 0)) {
        const accuracy =
          (this.metrics.perfectFrames / this.metrics.totalEvents) * 100;

        logger.info('⏱️  Timing Metrics', {
          totalEvents: this.metrics.totalEvents,
          perfectFrames: this.metrics.perfectFrames,
          accuracy: `${accuracy.toFixed(2)}%`,
          avgJitter: `${this.metrics.avgJitter.toFixed(4)}ms`,
          maxJitter: `${this.metrics.maxJitter.toFixed(4)}ms`,
          grade:
            accuracy >= 99
              ? '🟢 EXCELLENT'
              : accuracy >= 95
                ? '🟡 GOOD'
                : '🔴 NEEDS IMPROVEMENT',
        });

        lastReportedCount = this.metrics.totalEvents;
      }
    }, 2000); // Check every 2 seconds instead of 5
  }

  /**
   * Stop metrics reporting
   */
  stopReporting(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }
  }

  /**
   * Reset timing metrics
   *
   * Preserves the current tempo setting to maintain correct expectedFrameInterval.
   * If tempo was previously set, the expectedFrameInterval will be recalculated
   * based on that tempo rather than resetting to the default 120 BPM.
   */
  reset(): void {
    // Preserve the current expectedFrameInterval based on the set tempo
    // instead of resetting to hardcoded 24000 (120 BPM)
    const preservedInterval = this.metrics.expectedFrameInterval;

    this.metrics = {
      totalEvents: 0,
      frameDeltas: [],
      maxJitter: 0,
      avgJitter: 0,
      perfectFrames: 0,
      lastBeatTime: 0,
      expectedFrameInterval: preservedInterval,
    };

    logger.debug('[TimingMetricsCollector] Reset with preserved tempo', {
      preservedTempo: this.currentTempo,
      expectedFrameInterval: preservedInterval,
    });
  }

  /**
   * Get current timing metrics (public API)
   */
  getMetrics() {
    return {
      ...this.metrics,
      accuracy:
        this.metrics.totalEvents > 0
          ? (this.metrics.perfectFrames / this.metrics.totalEvents) * 100
          : 0,
    };
  }
}
