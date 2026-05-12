/**
 * MIDI Time Stretch Processor
 *
 * Stretches or compresses MIDI timing without changing pitch
 */

import { createStructuredLogger } from '@bassnotion/contracts';
import type { ParsedMidiFile, MidiEvent, MidiTrack } from '../parser/index.js';

const logger = createStructuredLogger('MidiTimeStretchProcessor');

export interface TimeStretchOptions {
  // Stretch factor (0.5 = half speed, 2.0 = double speed)
  factor: number;

  // Preserve tempo events
  preserveTempo?: boolean;

  // Method ('linear' | 'musical' | 'rubato')
  method?: 'linear' | 'musical' | 'rubato';

  // For rubato method - expression curve
  rubatoCurve?: (position: number) => number;

  // Start and end time for partial stretching
  range?: {
    start: number; // In ticks
    end: number;
  };

  // Preserve note durations (only change timing between notes)
  preserveDurations?: boolean;

  // Adjust tempo events to match new timing
  adjustTempo?: boolean;

  // Quantize after stretching
  quantizeAfter?: boolean;

  // Quantize resolution (if quantizing)
  quantizeResolution?: number;
}

export interface TimeStretchResult {
  stretchedFile: ParsedMidiFile;
  statistics: {
    originalDuration: number;
    newDuration: number;
    factor: number;
    eventsProcessed: number;
    tempoEventsAdjusted: number;
  };
}

interface TimeMap {
  originalTime: number;
  stretchedTime: number;
}

/**
 * Stretches or compresses MIDI timing
 */
export class MidiTimeStretchProcessor {
  /**
   * Stretch or compress MIDI timing
   */
  static stretch(
    parsedFile: ParsedMidiFile,
    options: TimeStretchOptions,
  ): TimeStretchResult {
    const startTime = performance.now();

    const {
      factor,
      preserveTempo = false,
      method = 'linear',
      rubatoCurve,
      range,
      preserveDurations = false,
      adjustTempo = true,
      quantizeAfter = false,
      quantizeResolution = 16,
    } = options;

    logger.info('Starting time stretch', {
      factor,
      method,
      preserveTempo,
      preserveDurations,
      hasRange: !!range,
    });

    // Clone the file
    const stretchedFile = this.cloneMidiFile(parsedFile);

    // Calculate original duration
    const originalDuration = this.calculateDuration(parsedFile);

    // Statistics
    let eventsProcessed = 0;
    let tempoEventsAdjusted = 0;

    // Process each track
    for (const track of stretchedFile.tracks) {
      // Build time map for this track
      const timeMap = this.buildTimeMap(track, options);

      // Apply stretching
      if (preserveDurations) {
        this.stretchWithPreservedDurations(track, timeMap, options);
      } else {
        this.stretchAllEvents(track, timeMap, options);
      }

      eventsProcessed += track.events.length;

      // Adjust tempo events if requested
      if (adjustTempo && !preserveTempo) {
        tempoEventsAdjusted += this.adjustTempoEvents(track, factor);
      }
    }

    // Quantize if requested
    if (quantizeAfter) {
      this.quantizeAfterStretch(stretchedFile, quantizeResolution);
    }

    // Calculate new duration
    const newDuration = this.calculateDuration(stretchedFile);

    const duration = performance.now() - startTime;
    logger.info('Time stretch complete', {
      originalDuration,
      newDuration,
      actualFactor: newDuration / originalDuration,
      eventsProcessed,
      tempoEventsAdjusted,
      duration,
    });

    return {
      stretchedFile,
      statistics: {
        originalDuration,
        newDuration,
        factor,
        eventsProcessed,
        tempoEventsAdjusted,
      },
    };
  }

  /**
   * Build time mapping for stretching
   */
  private static buildTimeMap(
    track: MidiTrack,
    options: TimeStretchOptions,
  ): TimeMap[] {
    const { factor, method, rubatoCurve, range } = options;
    const timeMap: TimeMap[] = [];
    let currentTime = 0;

    for (const event of track.events) {
      const originalTime = currentTime;
      let stretchedTime: number;

      if (range && (originalTime < range.start || originalTime > range.end)) {
        // Outside range, no stretching
        stretchedTime = originalTime;
      } else {
        switch (method) {
          case 'musical':
            // Musical stretching - preserves phrase boundaries
            stretchedTime = this.musicalStretch(originalTime, factor, track);
            break;

          case 'rubato':
            // Expressive stretching with custom curve
            if (rubatoCurve) {
              const position =
                originalTime / this.calculateTrackDuration(track);
              const localFactor = rubatoCurve(position);
              stretchedTime = originalTime * localFactor;
            } else {
              stretchedTime = originalTime * factor;
            }
            break;

          default: // linear
            if (range) {
              // Stretch only within range
              const rangePosition =
                (originalTime - range.start) / (range.end - range.start);
              const stretchedRangeTime =
                rangePosition * (range.end - range.start) * factor;
              stretchedTime = range.start + stretchedRangeTime;
            } else {
              stretchedTime = originalTime * factor;
            }
        }
      }

      timeMap.push({ originalTime, stretchedTime });
      currentTime += event.deltaTime;
    }

    return timeMap;
  }

  /**
   * Musical stretch that preserves phrase boundaries
   */
  private static musicalStretch(
    time: number,
    factor: number,
    track: MidiTrack,
  ): number {
    // Simple implementation - could be enhanced with phrase detection
    // For now, apply less stretch at note boundaries
    const noteEvents = track.events.filter(
      (e) => e.type === 'channelNoteOn' || e.type === 'channelNoteOff',
    );

    // Find nearest note event
    let minDistance = Infinity;
    let currentTime = 0;

    for (const event of track.events) {
      const distance = Math.abs(currentTime - time);
      if (
        distance < minDistance &&
        (event.type === 'channelNoteOn' || event.type === 'channelNoteOff')
      ) {
        minDistance = distance;
      }
      currentTime += event.deltaTime;
    }

    // Apply less stretch near note boundaries
    const boundaryInfluence = Math.exp(-minDistance / 100); // Decay function
    const effectiveFactor = 1 + (factor - 1) * (1 - boundaryInfluence * 0.3);

    return time * effectiveFactor;
  }

  /**
   * Stretch all events uniformly
   */
  private static stretchAllEvents(
    track: MidiTrack,
    timeMap: TimeMap[],
    options: TimeStretchOptions,
  ): void {
    let previousStretchedTime = 0;

    for (let i = 0; i < track.events.length; i++) {
      const event = track.events[i];
      const mapping = timeMap[i];

      if (i === 0) {
        event.deltaTime = Math.round(mapping.stretchedTime);
      } else {
        event.deltaTime = Math.round(
          mapping.stretchedTime - previousStretchedTime,
        );
      }

      previousStretchedTime = mapping.stretchedTime;

      // Don't stretch tempo events if preserving
      if (options.preserveTempo && event.type === 'setTempo') {
        // Revert tempo event timing
        event.deltaTime = Math.round(event.deltaTime / options.factor);
      }
    }
  }

  /**
   * Stretch timing while preserving note durations
   */
  private static stretchWithPreservedDurations(
    track: MidiTrack,
    timeMap: TimeMap[],
    options: TimeStretchOptions,
  ): void {
    const noteStates = new Map<
      string,
      { startIndex: number; startTime: number }
    >();
    let currentTime = 0;
    let currentStretchedTime = 0;

    for (let i = 0; i < track.events.length; i++) {
      const event = track.events[i];
      const mapping = timeMap[i];

      if (event.type === 'channelNoteOn' && event.data && event.data[1] > 0) {
        // Note on - stretch the timing
        const noteKey = `${event.channel}-${event.data[0]}`;
        noteStates.set(noteKey, { startIndex: i, startTime: currentTime });

        if (i === 0) {
          event.deltaTime = Math.round(mapping.stretchedTime);
        } else {
          event.deltaTime = Math.round(
            mapping.stretchedTime - currentStretchedTime,
          );
        }
        currentStretchedTime = mapping.stretchedTime;
      } else if (
        (event.type === 'channelNoteOff' ||
          (event.type === 'channelNoteOn' &&
            event.data &&
            event.data[1] === 0)) &&
        event.data
      ) {
        // Note off - preserve duration
        const noteKey = `${event.channel}-${event.data[0]}`;
        const noteStart = noteStates.get(noteKey);

        if (noteStart) {
          const originalDuration =
            currentTime + event.deltaTime - noteStart.startTime;
          event.deltaTime = Math.round(originalDuration);
          currentStretchedTime += originalDuration;
          noteStates.delete(noteKey);
        } else {
          // No matching note on, stretch normally
          event.deltaTime = Math.round(
            mapping.stretchedTime - currentStretchedTime,
          );
          currentStretchedTime = mapping.stretchedTime;
        }
      } else {
        // Other events - stretch normally
        if (i === 0) {
          event.deltaTime = Math.round(mapping.stretchedTime);
        } else {
          event.deltaTime = Math.round(
            mapping.stretchedTime - currentStretchedTime,
          );
        }
        currentStretchedTime = mapping.stretchedTime;
      }

      currentTime += event.deltaTime;
    }
  }

  /**
   * Adjust tempo events to match new timing
   */
  private static adjustTempoEvents(track: MidiTrack, factor: number): number {
    let adjusted = 0;

    for (const event of track.events) {
      if (event.type === 'setTempo' && 'microsecondsPerQuarterNote' in event) {
        const currentTempo = event as { microsecondsPerQuarterNote: number; bpm?: number };
        // Inverse relationship - slower playback needs faster tempo
        currentTempo.microsecondsPerQuarterNote = Math.round(
          currentTempo.microsecondsPerQuarterNote / factor,
        );

        // Recalculate BPM if present
        if ('bpm' in currentTempo) {
          currentTempo.bpm = 60000000 / currentTempo.microsecondsPerQuarterNote;
        }

        adjusted++;
      }
    }

    return adjusted;
  }

  /**
   * Quantize after stretching
   */
  private static quantizeAfterStretch(
    file: ParsedMidiFile,
    resolution: number,
  ): void {
    const tpq = file.header.ticksPerQuarterNote || 480;
    const gridSize = (tpq * 4) / resolution;

    for (const track of file.tracks) {
      let accumulated = 0;

      for (const event of track.events) {
        const targetTime = accumulated + event.deltaTime;
        const quantizedTime = Math.round(targetTime / gridSize) * gridSize;
        event.deltaTime = quantizedTime - accumulated;
        accumulated = quantizedTime;
      }
    }
  }

  /**
   * Calculate file duration in ticks
   */
  private static calculateDuration(file: ParsedMidiFile): number {
    let maxDuration = 0;

    for (const track of file.tracks) {
      let trackDuration = 0;
      for (const event of track.events) {
        trackDuration += event.deltaTime;
      }
      maxDuration = Math.max(maxDuration, trackDuration);
    }

    return maxDuration;
  }

  /**
   * Calculate track duration
   */
  private static calculateTrackDuration(track: MidiTrack): number {
    return track.events.reduce((sum, event) => sum + event.deltaTime, 0);
  }

  /**
   * Clone a MIDI file
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
   * Create tempo change
   */
  static changeTempoByFactor(
    parsedFile: ParsedMidiFile,
    factor: number,
  ): TimeStretchResult {
    return this.stretch(parsedFile, {
      factor: 1 / factor, // Inverse for tempo change
      adjustTempo: false,
      preserveTempo: true,
    });
  }

  /**
   * Create rubato curve for expressive timing
   */
  static createRubatoCurve(
    accel = 0.2, // Acceleration at start
    decel = 0.3, // Deceleration at end
  ): (position: number) => number {
    return (position: number) => {
      if (position < 0.3) {
        // Accelerando in first 30%
        return 1 - accel * (1 - position / 0.3);
      } else if (position > 0.7) {
        // Ritardando in last 30%
        return 1 + decel * ((position - 0.7) / 0.3);
      }
      // Normal tempo in middle
      return 1;
    };
  }

  /**
   * Fit to specific duration
   */
  static fitToDuration(
    parsedFile: ParsedMidiFile,
    targetDuration: number, // In ticks
  ): TimeStretchResult {
    const currentDuration = this.calculateDuration(parsedFile);
    const factor = targetDuration / currentDuration;

    logger.info('Fitting to duration', {
      currentDuration,
      targetDuration,
      factor,
    });

    return this.stretch(parsedFile, { factor });
  }
}
