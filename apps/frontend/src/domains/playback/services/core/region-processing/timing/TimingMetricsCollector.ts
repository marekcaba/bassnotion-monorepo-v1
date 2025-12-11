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
    expectedFrameInterval: 24000, // 0.5s at 48kHz
  };

  private metricsInterval: any = null;
  private sampleRate: number = 48000;
  private transportStartTime: number = 0;

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
   * Track timing accuracy for a scheduled event
   * @param frame - Target frame number for the event
   * @param transportTime - Transport time in beats
   */
  track(frame: number, transportTime: number): void {
    this.metrics.totalEvents++;

    // Calculate expected frame based on beat number (0, 0.5, 1, 1.5...)
    // Assuming 120 BPM = 2 beats/sec = 0.5sec/beat = 24000 frames/beat at 48kHz
    const expectedBeatNumber = Math.round(transportTime * 2); // 0→0, 0.5→1, 1.0→2, etc
    const expectedFrame = Math.round(
      expectedBeatNumber * this.metrics.expectedFrameInterval,
    );

    // Calculate actual frame offset from first beat
    const firstBeatFrame = Math.round(
      this.transportStartTime * this.sampleRate,
    );
    const frameFromStart = frame - firstBeatFrame;

    // Calculate jitter (deviation from expected grid)
    const jitterFrames = Math.abs(frameFromStart - expectedFrame);
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
   */
  reset(): void {
    this.metrics = {
      totalEvents: 0,
      frameDeltas: [],
      maxJitter: 0,
      avgJitter: 0,
      perfectFrames: 0,
      lastBeatTime: 0,
      expectedFrameInterval: 24000,
    };
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
