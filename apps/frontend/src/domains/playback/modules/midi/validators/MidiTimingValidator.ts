/**
 * MIDI Timing Validator
 *
 * Validates timing-related aspects of MIDI data
 */

import { createStructuredLogger } from '@bassnotion/contracts';
import type { ParsedMidiFile, MidiEvent } from '../parser/index.js';

const logger = createStructuredLogger('MidiTimingValidator');

export interface TimingValidationResult {
  valid: boolean;
  issues: TimingIssue[];
  statistics: TimingStatistics;
  recommendations: string[];
}

export interface TimingIssue {
  type: 'overlap' | 'gap' | 'drift' | 'inconsistent' | 'invalid';
  severity: 'low' | 'medium' | 'high';
  track: number;
  eventIndex: number;
  description: string;
  deltaTime?: number;
  absoluteTime?: number;
}

export interface TimingStatistics {
  totalDuration: number;
  averageNoteDuration: number;
  shortestNote: number;
  longestNote: number;
  totalNotes: number;
  noteDensity: number; // notes per second
  tempoChanges: number;
  timeSignatureChanges: number;
}

export interface NoteTimingInfo {
  note: number;
  channel: number;
  startTime: number;
  endTime?: number;
  duration?: number;
  velocity: number;
}

/**
 * Validates MIDI timing consistency and correctness
 */
export class MidiTimingValidator {
  private static readonly MIN_NOTE_DURATION = 1; // ticks
  private static readonly MAX_NOTE_DURATION = 96000; // ~10 seconds at 480 tpq, 120 bpm
  private static readonly MAX_SIMULTANEOUS_NOTES = 128;

  /**
   * Validate timing in a parsed MIDI file
   */
  static validateTiming(
    parsedFile: ParsedMidiFile,
    options: {
      checkOverlaps?: boolean;
      checkGaps?: boolean;
      checkDrift?: boolean;
    } = {},
  ): TimingValidationResult {
    const {
      checkOverlaps = true,
      checkGaps = true,
      checkDrift = true,
    } = options;

    const issues: TimingIssue[] = [];
    const statistics = this.calculateStatistics(parsedFile);

    // Validate each track
    for (
      let trackIndex = 0;
      trackIndex < parsedFile.tracks.length;
      trackIndex++
    ) {
      const track = parsedFile.tracks[trackIndex];

      // Check delta times
      this.validateDeltaTimes(track, trackIndex, issues);

      // Check note timing
      if (checkOverlaps || checkGaps) {
        this.validateNoteTimings(track, trackIndex, issues, {
          checkOverlaps,
          checkGaps,
        });
      }

      // Check timing drift
      if (checkDrift) {
        this.validateTimingDrift(track, trackIndex, parsedFile.header, issues);
      }
    }

    // Generate recommendations
    const recommendations = this.generateRecommendations(issues, statistics);

    return {
      valid: issues.filter((i) => i.severity === 'high').length === 0,
      issues,
      statistics,
      recommendations,
    };
  }

  /**
   * Validate delta times
   */
  private static validateDeltaTimes(
    track: any,
    trackIndex: number,
    issues: TimingIssue[],
  ): void {
    let currentTime = 0;

    for (let eventIndex = 0; eventIndex < track.events.length; eventIndex++) {
      const event = track.events[eventIndex];

      // Check for negative delta time
      if (event.deltaTime < 0) {
        issues.push({
          type: 'invalid',
          severity: 'high',
          track: trackIndex,
          eventIndex,
          description: `Negative delta time: ${event.deltaTime}`,
          deltaTime: event.deltaTime,
          absoluteTime: currentTime,
        });
      }

      // Check for extremely large delta time
      if (event.deltaTime > 1000000) {
        issues.push({
          type: 'gap',
          severity: 'medium',
          track: trackIndex,
          eventIndex,
          description: `Very large delta time: ${event.deltaTime} ticks`,
          deltaTime: event.deltaTime,
          absoluteTime: currentTime,
        });
      }

      currentTime += event.deltaTime;
    }
  }

  /**
   * Validate note timings
   */
  private static validateNoteTimings(
    track: any,
    trackIndex: number,
    issues: TimingIssue[],
    options: { checkOverlaps: boolean; checkGaps: boolean },
  ): void {
    const activeNotes = new Map<string, NoteTimingInfo>();
    const completedNotes: NoteTimingInfo[] = [];
    let currentTime = 0;

    for (let eventIndex = 0; eventIndex < track.events.length; eventIndex++) {
      const event = track.events[eventIndex];
      currentTime += event.deltaTime;

      if (event.type === 'channelNoteOn' && event.data && event.data[1] > 0) {
        const key = `${event.channel}-${event.data[0]}`;

        // Check for overlapping notes
        if (options.checkOverlaps && activeNotes.has(key)) {
          const existingNote = activeNotes.get(key)!;
          issues.push({
            type: 'overlap',
            severity: 'medium',
            track: trackIndex,
            eventIndex,
            description: `Note ${event.data[0]} overlaps with previous instance`,
            absoluteTime: currentTime,
          });
        }

        activeNotes.set(key, {
          note: event.data[0],
          channel: event.channel,
          startTime: currentTime,
          velocity: event.data[1],
        });
      } else if (
        event.type === 'channelNoteOff' ||
        (event.type === 'channelNoteOn' && event.data && event.data[1] === 0)
      ) {
        const key = `${event.channel}-${event.data[0]}`;
        const noteInfo = activeNotes.get(key);

        if (noteInfo) {
          noteInfo.endTime = currentTime;
          noteInfo.duration = currentTime - noteInfo.startTime;
          completedNotes.push(noteInfo);
          activeNotes.delete(key);

          // Check for very short notes
          if (noteInfo.duration < this.MIN_NOTE_DURATION) {
            issues.push({
              type: 'invalid',
              severity: 'low',
              track: trackIndex,
              eventIndex,
              description: `Very short note duration: ${noteInfo.duration} ticks`,
              absoluteTime: currentTime,
            });
          }

          // Check for very long notes
          if (noteInfo.duration > this.MAX_NOTE_DURATION) {
            issues.push({
              type: 'invalid',
              severity: 'medium',
              track: trackIndex,
              eventIndex,
              description: `Very long note duration: ${noteInfo.duration} ticks`,
              absoluteTime: currentTime,
            });
          }
        }
      }
    }

    // Check for unclosed notes
    for (const [key, noteInfo] of activeNotes) {
      issues.push({
        type: 'invalid',
        severity: 'medium',
        track: trackIndex,
        eventIndex: track.events.length - 1,
        description: `Note ${noteInfo.note} never released`,
        absoluteTime: noteInfo.startTime,
      });
    }

    // Check for timing gaps
    if (options.checkGaps && completedNotes.length > 1) {
      this.checkTimingGaps(completedNotes, trackIndex, issues);
    }
  }

  /**
   * Check for timing gaps between notes
   */
  private static checkTimingGaps(
    notes: NoteTimingInfo[],
    trackIndex: number,
    issues: TimingIssue[],
  ): void {
    // Sort by start time
    const sortedNotes = [...notes].sort((a, b) => a.startTime - b.startTime);

    let lastEndTime = 0;
    for (const note of sortedNotes) {
      if (lastEndTime > 0 && note.startTime - lastEndTime > 48000) {
        // ~1 second gap at 480 tpq, 120 bpm
        issues.push({
          type: 'gap',
          severity: 'low',
          track: trackIndex,
          eventIndex: 0, // We don't have exact event index here
          description: `Large gap between notes: ${note.startTime - lastEndTime} ticks`,
          absoluteTime: lastEndTime,
        });
      }
      lastEndTime = Math.max(lastEndTime, note.endTime || note.startTime);
    }
  }

  /**
   * Check for timing drift
   */
  private static validateTimingDrift(
    track: any,
    trackIndex: number,
    header: any,
    issues: TimingIssue[],
  ): void {
    // Look for patterns that might indicate timing drift
    const noteTimes: number[] = [];
    let currentTime = 0;

    for (const event of track.events) {
      currentTime += event.deltaTime;
      if (event.type === 'channelNoteOn' && event.data && event.data[1] > 0) {
        noteTimes.push(currentTime);
      }
    }

    if (noteTimes.length < 4) return;

    // Check for consistent spacing (simple rhythm detection)
    const intervals: number[] = [];
    for (let i = 1; i < noteTimes.length; i++) {
      intervals.push(noteTimes[i] - noteTimes[i - 1]);
    }

    // Look for drift in supposedly regular patterns
    const commonInterval = this.findCommonInterval(intervals);
    if (commonInterval > 0) {
      let driftAccumulator = 0;
      for (let i = 0; i < intervals.length; i++) {
        const expectedTime = commonInterval;
        const actualTime = intervals[i];
        const drift = actualTime - expectedTime;

        if (Math.abs(drift) > commonInterval * 0.1) {
          // More than 10% drift
          driftAccumulator += drift;

          if (Math.abs(driftAccumulator) > commonInterval) {
            issues.push({
              type: 'drift',
              severity: 'low',
              track: trackIndex,
              eventIndex: i,
              description: `Timing drift detected: ${Math.abs(driftAccumulator)} ticks accumulated`,
              absoluteTime: noteTimes[i],
            });
            driftAccumulator = 0; // Reset
          }
        }
      }
    }
  }

  /**
   * Find the most common interval (for rhythm detection)
   */
  private static findCommonInterval(intervals: number[]): number {
    if (intervals.length === 0) return 0;

    // Round intervals to nearest common divisions
    const quantized = intervals.map((interval) => {
      const commonDivisions = [120, 240, 480, 960]; // Common tick divisions
      return commonDivisions.reduce((prev, curr) =>
        Math.abs(interval - curr) < Math.abs(interval - prev) ? curr : prev,
      );
    });

    // Find mode
    const counts = new Map<number, number>();
    for (const interval of quantized) {
      counts.set(interval, (counts.get(interval) || 0) + 1);
    }

    let maxCount = 0;
    let mode = 0;
    for (const [interval, count] of counts) {
      if (count > maxCount) {
        maxCount = count;
        mode = interval;
      }
    }

    // Only return if it's a significant pattern
    return maxCount >= intervals.length * 0.3 ? mode : 0;
  }

  /**
   * Calculate timing statistics
   */
  private static calculateStatistics(
    parsedFile: ParsedMidiFile,
  ): TimingStatistics {
    let totalNotes = 0;
    let totalNoteDuration = 0;
    let shortestNote = Infinity;
    let longestNote = 0;
    let maxTime = 0;
    let tempoChanges = 0;
    let timeSignatureChanges = 0;

    for (const track of parsedFile.tracks) {
      const activeNotes = new Map<string, number>(); // key -> start time
      let currentTime = 0;

      for (const event of track.events) {
        currentTime += event.deltaTime;
        maxTime = Math.max(maxTime, currentTime);

        if (event.type === 'channelNoteOn' && event.data && event.data[1] > 0) {
          const key = `${event.channel}-${event.data[0]}`;
          activeNotes.set(key, currentTime);
          totalNotes++;
        } else if (
          event.type === 'channelNoteOff' ||
          (event.type === 'channelNoteOn' && event.data && event.data[1] === 0)
        ) {
          const key = `${event.channel}-${event.data[0]}`;
          const startTime = activeNotes.get(key);
          if (startTime !== undefined) {
            const duration = currentTime - startTime;
            totalNoteDuration += duration;
            shortestNote = Math.min(shortestNote, duration);
            longestNote = Math.max(longestNote, duration);
            activeNotes.delete(key);
          }
        } else if (event.type === 'setTempo') {
          tempoChanges++;
        } else if (event.type === 'timeSignature') {
          timeSignatureChanges++;
        }
      }
    }

    const averageNoteDuration =
      totalNotes > 0 ? totalNoteDuration / totalNotes : 0;
    const totalDuration = maxTime; // in ticks
    const noteDensity =
      totalDuration > 0 ? (totalNotes / totalDuration) * 480 : 0; // Assuming 480 tpq

    return {
      totalDuration,
      averageNoteDuration,
      shortestNote: shortestNote === Infinity ? 0 : shortestNote,
      longestNote,
      totalNotes,
      noteDensity,
      tempoChanges,
      timeSignatureChanges,
    };
  }

  /**
   * Generate recommendations based on issues
   */
  private static generateRecommendations(
    issues: TimingIssue[],
    statistics: TimingStatistics,
  ): string[] {
    const recommendations: string[] = [];

    // Check for overlapping notes
    const overlapCount = issues.filter((i) => i.type === 'overlap').length;
    if (overlapCount > 5) {
      recommendations.push(
        'Consider using a MIDI cleanup tool to fix overlapping notes',
      );
    }

    // Check for timing drift
    const driftCount = issues.filter((i) => i.type === 'drift').length;
    if (driftCount > 0) {
      recommendations.push(
        'Timing drift detected - consider quantizing to improve timing consistency',
      );
    }

    // Check note density
    if (statistics.noteDensity > 20) {
      recommendations.push(
        'Very high note density - may cause playback issues on some devices',
      );
    }

    // Check for very short notes
    if (statistics.shortestNote < 10) {
      recommendations.push('Contains very short notes that may not be audible');
    }

    // Check for tempo changes
    if (statistics.tempoChanges > 10) {
      recommendations.push(
        'Many tempo changes detected - ensure playback engine supports tempo automation',
      );
    }

    return recommendations;
  }
}
