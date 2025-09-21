/**
 * MIDI Velocity Processor
 *
 * Processes and transforms MIDI velocity values
 */

import { createStructuredLogger } from '@bassnotion/contracts';
import type { ParsedMidiFile, MidiEvent, MidiTrack } from '../parser/index.js';

const logger = createStructuredLogger('MidiVelocityProcessor');

export interface VelocityOptions {
  // Scaling factor (0.5 = half, 2.0 = double)
  scale?: number;

  // Fixed velocity (overrides all velocities)
  fixed?: number;

  // Add/subtract from velocity
  offset?: number;

  // Minimum velocity (floor)
  min?: number;

  // Maximum velocity (ceiling)
  max?: number;

  // Compression ratio (1.0 = no compression)
  compression?: number;

  // Compression threshold
  threshold?: number;

  // Velocity curve ('linear' | 'exponential' | 'logarithmic' | 'custom')
  curve?: string;

  // Custom curve function
  customCurve?: (velocity: number) => number;

  // Randomization amount (0-100%)
  randomize?: number;

  // Smooth velocity changes over time
  smooth?: boolean;

  // Smoothing window size (in events)
  smoothWindow?: number;

  // Process only specific channels
  channels?: number[];

  // Process only specific velocity ranges
  velocityRange?: {
    min: number;
    max: number;
  };
}

export interface VelocityResult {
  processedFile: ParsedMidiFile;
  statistics: {
    totalNotes: number;
    processedNotes: number;
    averageVelocityBefore: number;
    averageVelocityAfter: number;
    dynamicRangeBefore: number;
    dynamicRangeAfter: number;
  };
}

export interface VelocityAnalysis {
  averageVelocity: number;
  minVelocity: number;
  maxVelocity: number;
  standardDeviation: number;
  dynamicRange: number;
  histogram: Map<number, number>;
}

/**
 * Processes MIDI velocity values
 */
export class MidiVelocityProcessor {
  /**
   * Process velocity values in a MIDI file
   */
  static processVelocity(
    parsedFile: ParsedMidiFile,
    options: VelocityOptions,
  ): VelocityResult {
    const startTime = performance.now();

    const {
      scale = 1.0,
      fixed,
      offset = 0,
      min = 0,
      max = 127,
      compression = 1.0,
      threshold = 64,
      curve = 'linear',
      customCurve,
      randomize = 0,
      smooth = false,
      smoothWindow = 5,
      channels,
      velocityRange,
    } = options;

    logger.info('Processing velocity', {
      scale,
      fixed,
      offset,
      curve,
      compression,
      randomize,
    });

    // Analyze before processing
    const analysisBefore = this.analyzeVelocity(parsedFile);

    // Clone the file
    const processedFile = this.cloneMidiFile(parsedFile);

    // Statistics
    let totalNotes = 0;
    let processedNotes = 0;
    const processedVelocities: number[] = [];

    // Process each track
    for (const track of processedFile.tracks) {
      const velocityHistory: number[] = [];

      for (let eventIndex = 0; eventIndex < track.events.length; eventIndex++) {
        const event = track.events[eventIndex];

        // Check if this is a note on event with velocity
        if (event.type === 'channelNoteOn' && event.data && event.data[1] > 0) {
          totalNotes++;

          // Check channel filter
          if (channels && !channels.includes(event.channel)) {
            continue;
          }

          // Check velocity range filter
          const originalVelocity = event.data[1];
          if (
            velocityRange &&
            (originalVelocity < velocityRange.min ||
              originalVelocity > velocityRange.max)
          ) {
            continue;
          }

          // Process velocity
          let newVelocity = originalVelocity;

          // Apply fixed velocity if set
          if (fixed !== undefined) {
            newVelocity = fixed;
          } else {
            // Apply curve
            newVelocity = this.applyCurve(newVelocity, curve, customCurve);

            // Apply compression
            if (compression !== 1.0) {
              newVelocity = this.applyCompression(
                newVelocity,
                compression,
                threshold,
              );
            }

            // Apply scale
            newVelocity = newVelocity * scale;

            // Apply offset
            newVelocity = newVelocity + offset;

            // Apply randomization
            if (randomize > 0) {
              const randomAmount = (randomize / 100) * 127;
              const randomOffset = (Math.random() - 0.5) * randomAmount;
              newVelocity = newVelocity + randomOffset;
            }

            // Apply smoothing
            if (smooth && velocityHistory.length > 0) {
              newVelocity = this.smoothVelocity(
                newVelocity,
                velocityHistory,
                smoothWindow,
              );
            }
          }

          // Clamp to valid range
          newVelocity = Math.round(Math.max(min, Math.min(max, newVelocity)));

          // Update the event
          event.data[1] = newVelocity;
          processedVelocities.push(newVelocity);
          processedNotes++;

          // Update history for smoothing
          velocityHistory.push(newVelocity);
          if (velocityHistory.length > smoothWindow) {
            velocityHistory.shift();
          }
        }
      }
    }

    // Calculate after statistics
    const analysisAfter = this.analyzeVelocity(processedFile);

    const duration = performance.now() - startTime;
    logger.info('Velocity processing complete', {
      totalNotes,
      processedNotes,
      averageVelocityBefore: analysisBefore.averageVelocity,
      averageVelocityAfter: analysisAfter.averageVelocity,
      duration,
    });

    return {
      processedFile,
      statistics: {
        totalNotes,
        processedNotes,
        averageVelocityBefore: analysisBefore.averageVelocity,
        averageVelocityAfter: analysisAfter.averageVelocity,
        dynamicRangeBefore: analysisBefore.dynamicRange,
        dynamicRangeAfter: analysisAfter.dynamicRange,
      },
    };
  }

  /**
   * Apply velocity curve
   */
  private static applyCurve(
    velocity: number,
    curve: string,
    customCurve?: (velocity: number) => number,
  ): number {
    const normalized = velocity / 127; // 0-1 range
    let result: number;

    switch (curve) {
      case 'exponential':
        result = Math.pow(normalized, 2);
        break;

      case 'logarithmic':
        result = Math.log(normalized + 0.01) / Math.log(1.01);
        break;

      case 'custom':
        if (customCurve) {
          return customCurve(velocity);
        }
        result = normalized;
        break;

      default: // linear
        result = normalized;
    }

    return result * 127;
  }

  /**
   * Apply compression
   */
  private static applyCompression(
    velocity: number,
    ratio: number,
    threshold: number,
  ): number {
    if (velocity <= threshold) {
      return velocity;
    }

    // Apply compression above threshold
    const excess = velocity - threshold;
    const compressedExcess = excess / ratio;
    return threshold + compressedExcess;
  }

  /**
   * Smooth velocity based on history
   */
  private static smoothVelocity(
    currentVelocity: number,
    history: number[],
    windowSize: number,
  ): number {
    const relevantHistory = history.slice(-windowSize);
    const weights = relevantHistory.map((_, index) => index + 1);
    const totalWeight = weights.reduce((sum, w) => sum + w, 0) + windowSize;

    let weightedSum = currentVelocity * windowSize;
    for (let i = 0; i < relevantHistory.length; i++) {
      weightedSum += relevantHistory[i] * weights[i];
    }

    return weightedSum / totalWeight;
  }

  /**
   * Analyze velocity distribution
   */
  static analyzeVelocity(parsedFile: ParsedMidiFile): VelocityAnalysis {
    const velocities: number[] = [];
    const histogram = new Map<number, number>();

    // Collect all velocities
    for (const track of parsedFile.tracks) {
      for (const event of track.events) {
        if (event.type === 'channelNoteOn' && event.data && event.data[1] > 0) {
          const velocity = event.data[1];
          velocities.push(velocity);
          histogram.set(velocity, (histogram.get(velocity) || 0) + 1);
        }
      }
    }

    if (velocities.length === 0) {
      return {
        averageVelocity: 0,
        minVelocity: 0,
        maxVelocity: 0,
        standardDeviation: 0,
        dynamicRange: 0,
        histogram,
      };
    }

    // Calculate statistics
    const sum = velocities.reduce((a, b) => a + b, 0);
    const average = sum / velocities.length;
    const min = Math.min(...velocities);
    const max = Math.max(...velocities);

    // Standard deviation
    const squaredDifferences = velocities.map((v) => Math.pow(v - average, 2));
    const avgSquaredDiff =
      squaredDifferences.reduce((a, b) => a + b, 0) / velocities.length;
    const standardDeviation = Math.sqrt(avgSquaredDiff);

    return {
      averageVelocity: average,
      minVelocity: min,
      maxVelocity: max,
      standardDeviation,
      dynamicRange: max - min,
      histogram,
    };
  }

  /**
   * Clone a MIDI file
   */
  private static cloneMidiFile(file: ParsedMidiFile): ParsedMidiFile {
    return {
      header: { ...file.header },
      tracks: file.tracks.map((track) => ({
        ...track,
        events: track.events.map((event) => ({
          ...event,
          data: event.data ? [...event.data] : undefined,
        })),
      })),
    };
  }

  /**
   * Normalize velocity to specific dynamic range
   */
  static normalizeVelocity(
    parsedFile: ParsedMidiFile,
    targetMin = 40,
    targetMax = 100,
  ): VelocityResult {
    const analysis = this.analyzeVelocity(parsedFile);

    if (analysis.minVelocity === analysis.maxVelocity) {
      // No dynamic range to normalize
      return {
        processedFile: parsedFile,
        statistics: {
          totalNotes: 0,
          processedNotes: 0,
          averageVelocityBefore: analysis.averageVelocity,
          averageVelocityAfter: analysis.averageVelocity,
          dynamicRangeBefore: 0,
          dynamicRangeAfter: 0,
        },
      };
    }

    // Calculate scale and offset
    const currentRange = analysis.maxVelocity - analysis.minVelocity;
    const targetRange = targetMax - targetMin;
    const scale = targetRange / currentRange;
    const offset = targetMin - analysis.minVelocity * scale;

    logger.info('Normalizing velocity', {
      currentRange: { min: analysis.minVelocity, max: analysis.maxVelocity },
      targetRange: { min: targetMin, max: targetMax },
      scale,
      offset,
    });

    return this.processVelocity(parsedFile, {
      scale,
      offset,
      min: targetMin,
      max: targetMax,
    });
  }

  /**
   * Create velocity presets
   */
  static presets = {
    // Gentle, suitable for background music
    soft: (): VelocityOptions => ({
      scale: 0.7,
      max: 80,
      curve: 'logarithmic',
    }),

    // Punchy, suitable for dance music
    punchy: (): VelocityOptions => ({
      scale: 1.2,
      min: 60,
      compression: 2.0,
      threshold: 80,
      curve: 'exponential',
    }),

    // Consistent, suitable for electronic music
    consistent: (): VelocityOptions => ({
      compression: 4.0,
      threshold: 64,
      min: 50,
      max: 90,
      smooth: true,
      smoothWindow: 3,
    }),

    // Natural, with some randomization
    humanize: (): VelocityOptions => ({
      randomize: 15,
      smooth: true,
      smoothWindow: 5,
    }),

    // Extreme dynamics
    dramatic: (): VelocityOptions => ({
      scale: 1.5,
      curve: 'exponential',
      min: 20,
      max: 127,
    }),
  };
}
