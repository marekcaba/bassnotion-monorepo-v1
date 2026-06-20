/**
 * Beat Timing Analyzer
 *
 * Measures the accuracy of beat timing for drums, metronome, and other rhythmic elements.
 * Tracks drift, jitter, and synchronization accuracy.
 */

import { getLogger } from '@/utils/logger.js';

// Previously this file referenced a bare `logger` that only resolved via the
// runtime `window.logger` global — fragile (throws ReferenceError in any context
// where utils/logger hasn't run its window assignment yet, e.g. a fresh consumer).
// Import it explicitly like every other playback util.
const logger = getLogger('BeatTimingAnalyzer');

export interface BeatTimingData {
  expectedTime: number; // When the beat should have occurred (ms)
  actualTime: number; // When the beat actually occurred (ms)
  drift: number; // Difference between expected and actual (ms)
  beatNumber: number; // Which beat in the measure (0-based)
  measureNumber: number; // Which measure we're in
  source: string; // 'drums', 'metronome', 'bassline', etc.
}

export interface TimingStatistics {
  averageDrift: number; // Average timing drift in ms
  maxDrift: number; // Maximum drift observed
  minDrift: number; // Minimum drift observed
  jitter: number; // Standard deviation of timing
  consistency: number; // 0-100% score of timing consistency
  totalBeats: number; // Total beats analyzed
  driftTrend: 'stable' | 'early' | 'late' | 'erratic'; // Overall drift pattern
  syncScore: number; // 0-100% overall sync quality
}

export class BeatTimingAnalyzer {
  private beatHistory: BeatTimingData[] = [];
  private startTime = 0;
  private tempo = 120;
  private timeSignature: { numerator: number; denominator: number } = {
    numerator: 4,
    denominator: 4,
  };
  private maxHistorySize = 1000; // Keep last 1000 beats

  constructor() {
    this.reset();
  }

  /**
   * Start timing analysis
   */
  start(tempo: number, timeSignature = { numerator: 4, denominator: 4 }) {
    this.tempo = tempo;
    this.timeSignature = timeSignature;
    this.startTime = performance.now();
    this.beatHistory = [];
    logger.info(
      `🎯 Beat Timing Analyzer started: ${tempo} BPM, ${timeSignature.numerator}/${timeSignature.denominator}, startTime: ${this.startTime}`,
    );
  }

  /**
   * Record a beat event
   */
  recordBeat(
    source: string,
    beatNumber: number,
    measureNumber: number,
    actualTime?: number,
  ) {
    if (!this.startTime) {
      // Silently ignore if not started yet
      return;
    }

    // Debug log first beat from each source
    if (this.beatHistory.filter((b) => b.source === source).length === 0) {
      logger.info(
        `🎯 First beat recorded from ${source}: beat ${beatNumber}, measure ${measureNumber}, startTime: ${this.startTime}`,
      );
    }

    // Use the provided actualTime or current time
    const now = actualTime || performance.now();
    // Calculate elapsed time since analyzer started
    const elapsedTime = now - this.startTime;

    // Check for potential double reporting
    const recentDuplicate = this.beatHistory.slice(-10).find(
      (beat) =>
        beat.source === source &&
        beat.beatNumber === beatNumber &&
        beat.measureNumber === measureNumber &&
        Math.abs(beat.actualTime - elapsedTime) < 100, // Within 100ms
    );

    if (recentDuplicate) {
      logger.warn(
        `⚠️ Double beat report detected: ${source} measure ${measureNumber} beat ${beatNumber} (${elapsedTime.toFixed(0)}ms vs ${recentDuplicate.actualTime.toFixed(0)}ms)`,
      );
      return; // Skip this duplicate
    }

    // Calculate expected time based on perfect tempo
    const beatDuration = 60000 / this.tempo; // Duration of one beat in ms
    const beatsPerMeasure = this.timeSignature.numerator;
    const totalBeats = measureNumber * beatsPerMeasure + beatNumber;
    const expectedTime = totalBeats * beatDuration;

    // Calculate drift
    const drift = elapsedTime - expectedTime;

    const beatData: BeatTimingData = {
      expectedTime,
      actualTime: elapsedTime,
      drift,
      beatNumber,
      measureNumber,
      source,
    };

    this.beatHistory.push(beatData);

    // Maintain history size
    if (this.beatHistory.length > this.maxHistorySize) {
      this.beatHistory.shift();
    }

    // Log significant drift
    if (Math.abs(drift) > 10) {
      logger.warn(
        `⚠️ ${source} beat ${beatNumber} drift: ${drift.toFixed(1)}ms ${drift > 0 ? 'late' : 'early'}`,
      );
    }

    return beatData;
  }

  /**
   * Get timing statistics
   */
  getStatistics(source?: string): TimingStatistics {
    const beats = source
      ? this.beatHistory.filter((b) => b.source === source)
      : this.beatHistory;

    if (beats.length === 0) {
      return {
        averageDrift: 0,
        maxDrift: 0,
        minDrift: 0,
        jitter: 0,
        consistency: 100,
        totalBeats: 0,
        driftTrend: 'stable',
        syncScore: 100,
      };
    }

    // Calculate average drift
    const drifts = beats.map((b) => b.drift);
    const averageDrift = drifts.reduce((sum, d) => sum + d, 0) / drifts.length;

    // Calculate min/max
    const maxDrift = Math.max(...drifts);
    const minDrift = Math.min(...drifts);

    // Calculate jitter (standard deviation)
    const variance =
      drifts.reduce((sum, d) => {
        const diff = d - averageDrift;
        return sum + diff * diff;
      }, 0) / drifts.length;
    const jitter = Math.sqrt(variance);

    // Determine drift trend
    let driftTrend: 'stable' | 'early' | 'late' | 'erratic';
    if (jitter > 20) {
      driftTrend = 'erratic';
    } else if (averageDrift > 5) {
      driftTrend = 'late';
    } else if (averageDrift < -5) {
      driftTrend = 'early';
    } else {
      driftTrend = 'stable';
    }

    // Calculate consistency score (0-100%)
    // Perfect timing = 0ms jitter, 50ms jitter = 0% consistency
    const consistency = Math.max(0, 100 - jitter * 2);

    // Calculate sync score (0-100%)
    // Based on average drift and jitter
    const driftPenalty = Math.min(50, Math.abs(averageDrift) * 2);
    const jitterPenalty = Math.min(50, jitter);
    const syncScore = Math.max(0, 100 - driftPenalty - jitterPenalty);

    return {
      averageDrift,
      maxDrift,
      minDrift,
      jitter,
      consistency,
      totalBeats: beats.length,
      driftTrend,
      syncScore,
    };
  }

  /**
   * Get recent timing history for visualization
   */
  getRecentHistory(count = 50, source?: string): BeatTimingData[] {
    const beats = source
      ? this.beatHistory.filter((b) => b.source === source)
      : this.beatHistory;

    return beats.slice(-count);
  }

  /**
   * Get beat-by-beat timing comparison between sources
   */
  compareSourceTiming(
    source1: string,
    source2: string,
  ): {
    timingDifference: number[];
    averageDifference: number;
    correlation: number;
  } {
    const beats1 = this.beatHistory.filter((b) => b.source === source1);
    const beats2 = this.beatHistory.filter((b) => b.source === source2);

    const timingDifference: number[] = [];

    // Match beats by measure and beat number
    beats1.forEach((beat1) => {
      const matchingBeat = beats2.find(
        (b) =>
          b.measureNumber === beat1.measureNumber &&
          b.beatNumber === beat1.beatNumber,
      );

      if (matchingBeat) {
        timingDifference.push(beat1.actualTime - matchingBeat.actualTime);
      }
    });

    if (timingDifference.length === 0) {
      return { timingDifference: [], averageDifference: 0, correlation: 0 };
    }

    const averageDifference =
      timingDifference.reduce((sum, d) => sum + d, 0) / timingDifference.length;

    // Calculate correlation (how well they track together)
    const variance =
      timingDifference.reduce((sum, d) => {
        const diff = d - averageDifference;
        return sum + diff * diff;
      }, 0) / timingDifference.length;

    // Lower variance = better correlation
    const correlation = Math.max(0, 100 - Math.sqrt(variance));

    return {
      timingDifference,
      averageDifference,
      correlation,
    };
  }

  /**
   * Reset analyzer
   */
  reset() {
    this.beatHistory = [];
    this.startTime = 0;
  }

  /**
   * Export timing data for analysis
   */
  exportData(): string {
    const stats = this.getStatistics();
    const sources = [...new Set(this.beatHistory.map((b) => b.source))];

    let report = `Beat Timing Analysis Report\n`;
    report += `========================\n\n`;
    report += `Overall Statistics:\n`;
    report += `- Total Beats: ${stats.totalBeats}\n`;
    report += `- Average Drift: ${stats.averageDrift.toFixed(2)}ms\n`;
    report += `- Jitter: ${stats.jitter.toFixed(2)}ms\n`;
    report += `- Sync Score: ${stats.syncScore.toFixed(1)}%\n`;
    report += `- Drift Trend: ${stats.driftTrend}\n\n`;

    // Per-source statistics
    sources.forEach((source) => {
      const sourceStats = this.getStatistics(source);
      report += `\n${source.toUpperCase()} Statistics:\n`;
      report += `- Beats: ${sourceStats.totalBeats}\n`;
      report += `- Average Drift: ${sourceStats.averageDrift.toFixed(2)}ms\n`;
      report += `- Jitter: ${sourceStats.jitter.toFixed(2)}ms\n`;
      report += `- Consistency: ${sourceStats.consistency.toFixed(1)}%\n`;
    });

    // Source comparisons
    if (sources.length > 1) {
      report += `\n\nSource Timing Comparisons:\n`;
      for (let i = 0; i < sources.length - 1; i++) {
        for (let j = i + 1; j < sources.length; j++) {
          const sourceA = sources[i];
          const sourceB = sources[j];
          if (sourceA == null || sourceB == null) continue;
          const comparison = this.compareSourceTiming(sourceA, sourceB);
          if (comparison.timingDifference.length > 0) {
            report += `\n${sourceA} vs ${sourceB}:\n`;
            report += `- Average Difference: ${comparison.averageDifference.toFixed(2)}ms\n`;
            report += `- Correlation: ${comparison.correlation.toFixed(1)}%\n`;
          }
        }
      }
    }

    return report;
  }
}

// Global instance for easy access
export const beatTimingAnalyzer = new BeatTimingAnalyzer();
