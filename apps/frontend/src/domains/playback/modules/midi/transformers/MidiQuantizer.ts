/**
 * MIDI Quantizer
 *
 * Quantizes MIDI timing to musical grid positions
 */

import { createStructuredLogger } from '@bassnotion/contracts';
import type { ParsedMidiFile, MidiEvent, MidiTrack } from '../parser/index.js';

const logger = createStructuredLogger('MidiQuantizer');

export interface QuantizeOptions {
  // Grid resolution (e.g., 16 = 16th notes, 8 = 8th notes)
  resolution: number;

  // Strength (0-100%). 100% = full quantization, 0% = no change
  strength: number;

  // Swing amount (-50 to +50). Positive = late swing, negative = early
  swing?: number;

  // Humanize amount (0-100%). Adds controlled randomness
  humanize?: number;

  // Threshold in ticks. Notes closer than this to grid are quantized
  threshold?: number;

  // Preserve note lengths
  preserveDurations?: boolean;

  // Only quantize specific event types
  eventTypes?: string[];

  // Ticks per quarter note (from MIDI file)
  ticksPerQuarterNote?: number;
}

export interface QuantizeResult {
  quantizedFile: ParsedMidiFile;
  statistics: {
    totalEvents: number;
    quantizedEvents: number;
    averageCorrection: number;
    maxCorrection: number;
  };
}

/**
 * Quantizes MIDI events to a musical grid
 */
export class MidiQuantizer {
  private static readonly DEFAULT_TICKS_PER_QUARTER = 480;

  /**
   * Quantize a parsed MIDI file
   */
  static quantize(
    parsedFile: ParsedMidiFile,
    options: QuantizeOptions,
  ): QuantizeResult {
    const startTime = performance.now();

    const {
      resolution,
      strength,
      swing = 0,
      humanize = 0,
      threshold = Infinity,
      preserveDurations = true,
      eventTypes = ['channelNoteOn', 'channelNoteOff'],
      ticksPerQuarterNote = parsedFile.header.ticksPerQuarterNote ||
        this.DEFAULT_TICKS_PER_QUARTER,
    } = options;

    logger.info('Starting quantization', {
      resolution,
      strength,
      swing,
      humanize,
      trackCount: parsedFile.tracks.length,
    });

    // Calculate grid size in ticks
    const gridSize = (ticksPerQuarterNote * 4) / resolution;

    // Clone the file for modification
    const quantizedFile = this.cloneMidiFile(parsedFile);

    // Statistics
    let totalEvents = 0;
    let quantizedEvents = 0;
    let totalCorrection = 0;
    let maxCorrection = 0;

    // Process each track
    for (
      let trackIndex = 0;
      trackIndex < quantizedFile.tracks.length;
      trackIndex++
    ) {
      const track = quantizedFile.tracks[trackIndex];
      const noteOnTimes = new Map<string, number>(); // For preserving durations
      let currentTime = 0;

      for (let eventIndex = 0; eventIndex < track.events.length; eventIndex++) {
        const event = track.events[eventIndex];
        currentTime += event.deltaTime;

        // Check if this event type should be quantized
        if (!eventTypes.includes(event.type)) {
          continue;
        }

        totalEvents++;

        // Find nearest grid position
        const nearestGrid = Math.round(currentTime / gridSize) * gridSize;
        const correction = nearestGrid - currentTime;

        // Check if within threshold
        if (Math.abs(correction) > threshold) {
          continue;
        }

        // Apply swing
        let targetTime = nearestGrid;
        if (swing !== 0 && Math.round(currentTime / gridSize) % 2 === 1) {
          // Apply swing to off-beats
          const swingAmount = (gridSize * swing) / 100;
          targetTime += swingAmount;
        }

        // Apply humanization
        if (humanize > 0) {
          const humanizeAmount = (gridSize * humanize) / 100;
          const randomOffset = (Math.random() - 0.5) * humanizeAmount;
          targetTime += randomOffset;
        }

        // Calculate final correction
        const finalCorrection = targetTime - currentTime;
        const appliedCorrection = (finalCorrection * strength) / 100;

        // Handle note durations
        if (preserveDurations && event.type === 'channelNoteOn' && event.data) {
          const noteKey = `${event.channel}-${event.data[0]}`;

          if (event.data[1] > 0) {
            // Note on with velocity > 0
            noteOnTimes.set(noteKey, appliedCorrection);
          }
        } else if (
          preserveDurations &&
          event.type === 'channelNoteOff' &&
          event.data
        ) {
          const noteKey = `${event.channel}-${event.data[0]}`;
          const noteOnCorrection = noteOnTimes.get(noteKey);

          if (noteOnCorrection !== undefined) {
            // Apply same correction to maintain duration
            this.applyCorrection(track, eventIndex, noteOnCorrection);
            noteOnTimes.delete(noteKey);
            quantizedEvents++;
            totalCorrection += Math.abs(noteOnCorrection);
            maxCorrection = Math.max(maxCorrection, Math.abs(noteOnCorrection));
            continue;
          }
        }

        // Apply the correction
        if (appliedCorrection !== 0) {
          this.applyCorrection(track, eventIndex, appliedCorrection);
          quantizedEvents++;
          totalCorrection += Math.abs(appliedCorrection);
          maxCorrection = Math.max(maxCorrection, Math.abs(appliedCorrection));
        }
      }
    }

    const duration = performance.now() - startTime;
    logger.info('Quantization complete', {
      totalEvents,
      quantizedEvents,
      averageCorrection:
        quantizedEvents > 0 ? totalCorrection / quantizedEvents : 0,
      maxCorrection,
      duration,
    });

    return {
      quantizedFile,
      statistics: {
        totalEvents,
        quantizedEvents,
        averageCorrection:
          quantizedEvents > 0 ? totalCorrection / quantizedEvents : 0,
        maxCorrection,
      },
    };
  }

  /**
   * Apply timing correction to an event
   */
  private static applyCorrection(
    track: MidiTrack,
    eventIndex: number,
    correction: number,
  ): void {
    const event = track.events[eventIndex];
    const newDeltaTime = event.deltaTime + correction;

    if (newDeltaTime < 0) {
      // Need to adjust previous event
      if (eventIndex > 0) {
        track.events[eventIndex - 1].deltaTime += newDeltaTime;
        event.deltaTime = 0;
      } else {
        // Can't go before start
        event.deltaTime = 0;
      }
    } else {
      event.deltaTime = newDeltaTime;

      // Adjust next event to maintain absolute timing
      if (eventIndex < track.events.length - 1) {
        track.events[eventIndex + 1].deltaTime -= correction;

        // Ensure next event doesn't go negative
        if (track.events[eventIndex + 1].deltaTime < 0) {
          const overflow = -track.events[eventIndex + 1].deltaTime;
          track.events[eventIndex + 1].deltaTime = 0;
          event.deltaTime -= overflow;
        }
      }
    }
  }

  /**
   * Clone a MIDI file for modification
   */
  private static cloneMidiFile(file: ParsedMidiFile): ParsedMidiFile {
    return {
      header: { ...file.header },
      tracks: file.tracks.map((track) => ({
        ...track,
        events: track.events.map((event) => ({ ...event })),
      })),
    };
  }

  /**
   * Quantize to common note values
   */
  static quantizeToGrid(
    parsedFile: ParsedMidiFile,
    noteValue: '1/32' | '1/16' | '1/8' | '1/4' | '1/2' | '1',
    strength = 100,
  ): QuantizeResult {
    const resolutionMap = {
      '1/32': 32,
      '1/16': 16,
      '1/8': 8,
      '1/4': 4,
      '1/2': 2,
      '1': 1,
    };

    return this.quantize(parsedFile, {
      resolution: resolutionMap[noteValue],
      strength,
    });
  }

  /**
   * Apply groove template
   */
  static applyGroove(
    parsedFile: ParsedMidiFile,
    groove: {
      swing?: number;
      humanize?: number;
      microTiming?: Map<number, number>; // Beat position -> timing offset
    },
  ): QuantizeResult {
    logger.info('Applying groove template', groove);

    // First quantize to clean up timing
    const quantized = this.quantize(parsedFile, {
      resolution: 16,
      strength: 90,
      swing: groove.swing || 0,
      humanize: groove.humanize || 0,
    });

    // Apply micro-timing if provided
    if (groove.microTiming && groove.microTiming.size > 0) {
      this.applyMicroTiming(quantized.quantizedFile, groove.microTiming);
    }

    return quantized;
  }

  /**
   * Apply micro-timing adjustments
   */
  private static applyMicroTiming(
    file: ParsedMidiFile,
    microTiming: Map<number, number>,
  ): void {
    const tpq =
      file.header.ticksPerQuarterNote || this.DEFAULT_TICKS_PER_QUARTER;

    for (const track of file.tracks) {
      let currentTime = 0;
      let currentBeat = 0;

      for (let i = 0; i < track.events.length; i++) {
        const event = track.events[i];
        currentTime += event.deltaTime;
        currentBeat = (currentTime / tpq) % 4; // Assuming 4/4 time

        // Check if we have micro-timing for this beat position
        const beatPosition = Math.floor(currentBeat * 16) / 16; // Quantize to 16th notes
        const offset = microTiming.get(beatPosition);

        if (offset !== undefined && event.type === 'channelNoteOn') {
          this.applyCorrection(track, i, offset);
        }
      }
    }
  }

  /**
   * Create a shuffle/swing template
   */
  static createShuffleGroove(amount = 25): {
    swing: number;
    microTiming: Map<number, number>;
  } {
    const microTiming = new Map<number, number>();
    const tpq = this.DEFAULT_TICKS_PER_QUARTER;

    // Add slight push to downbeats
    for (let beat = 0; beat < 4; beat++) {
      microTiming.set(beat, -2); // Slight anticipation
      microTiming.set(beat + 0.5, amount); // Swing the off-beats
    }

    return {
      swing: amount,
      microTiming,
    };
  }
}
