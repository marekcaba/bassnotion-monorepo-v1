import type {
  Pattern,
  DrumPattern,
  MetronomePattern,
  HarmonyPattern,
  BassPattern,
  DrumPatternEvent,
  MetronomePatternEvent,
  ChordPatternEvent,
  BassPatternEvent,
  MusicalPosition,
} from '../../types/pattern.js';
import { addMusicalTime } from '../../utils/regionUtils.js';
import { EventBus } from './EventBus.js';
import { createStructuredLogger } from '@bassnotion/contracts';

const logger = createStructuredLogger('PatternConverter');

/**
 * Schedulable event interface
 */
export interface SchedulableEvent {
  time: MusicalPosition;
  callback: (time: number) => void;
  priority: 'high' | 'normal' | 'low';
  metadata?: Record<string, any>;
}

/**
 * Converts high-level patterns to schedulable events
 */
export class PatternConverter {
  private static _eventBus: EventBus | null = null;

  private static get eventBus(): EventBus {
    if (!this._eventBus) {
      this._eventBus = EventBus.getGlobalInstance();
    }
    return this._eventBus;
  }

  /**
   * Set EventBus instance for testing
   */
  public static setEventBus(eventBus: EventBus): void {
    this._eventBus = eventBus;
  }

  /**
   * Convert any pattern type to schedulable events
   */
  static patternToEvents(
    pattern: Pattern,
    startTime: MusicalPosition,
    trackId?: string,
  ): SchedulableEvent[] {
    if (this.isDrumPattern(pattern)) {
      return this.drumPatternToEvents(pattern, startTime, trackId);
    } else if (this.isMetronomePattern(pattern)) {
      return this.metronomePatternToEvents(pattern, startTime, trackId);
    } else if (this.isHarmonyPattern(pattern)) {
      return this.harmonyPatternToEvents(pattern, startTime, trackId);
    } else if (this.isBassPattern(pattern)) {
      return this.bassPatternToEvents(pattern, startTime, trackId);
    }

    throw new Error(
      `Unknown pattern type: ${(pattern as any).constructor?.name || 'unknown'}`,
    );
  }

  /**
   * Convert drum pattern to events
   */
  private static drumPatternToEvents(
    pattern: DrumPattern,
    startTime: MusicalPosition,
    trackId?: string,
  ): SchedulableEvent[] {
    return pattern.events.map((event) => ({
      time: addMusicalTime(startTime, event.position),
      callback: (time: number) => {
        // Trigger drum sample at exact audio time
        this.triggerDrumSample(event, time, trackId);
      },
      priority: 'high',
      metadata: {
        type: 'drum',
        drum: event.drum,
        velocity: event.velocity,
        trackId,
      },
    }));
  }

  /**
   * Convert metronome pattern to events
   */
  private static metronomePatternToEvents(
    pattern: MetronomePattern,
    startTime: MusicalPosition,
    trackId?: string,
  ): SchedulableEvent[] {
    return pattern.events.map((event) => ({
      time: addMusicalTime(startTime, event.position),
      callback: (time: number) => {
        this.triggerMetronomeClick(event, time, trackId);
      },
      priority: 'high',
      metadata: {
        type: 'metronome',
        clickType: event.type,
        pitch: event.pitch,
        trackId,
      },
    }));
  }

  /**
   * Convert harmony pattern to events
   */
  private static harmonyPatternToEvents(
    pattern: HarmonyPattern,
    startTime: MusicalPosition,
    trackId?: string,
  ): SchedulableEvent[] {
    return pattern.events.map((event) => ({
      time: addMusicalTime(startTime, event.position),
      callback: (time: number) => {
        this.triggerChord(event, time, trackId);
      },
      priority: 'normal',
      metadata: {
        type: 'harmony',
        chord: event.chord,
        voicing: event.voicing,
        notes: event.notes,
        trackId,
      },
    }));
  }

  /**
   * Convert bass pattern to events
   */
  private static bassPatternToEvents(
    pattern: BassPattern,
    startTime: MusicalPosition,
    trackId?: string,
  ): SchedulableEvent[] {
    return pattern.events.map((event) => ({
      time: addMusicalTime(startTime, event.position),
      callback: (time: number) => {
        this.triggerBassNote(event, time, trackId);
      },
      priority: 'high',
      metadata: {
        type: 'bass',
        note: event.note,
        technique: event.technique,
        trackId,
      },
    }));
  }

  /**
   * Trigger drum sample playback
   */
  private static triggerDrumSample(
    event: DrumPatternEvent,
    time: number,
    trackId?: string,
  ): void {
    const eventData = {
      drum: event.drum,
      velocity: event.velocity,
      duration: event.duration || '16n',
      audioTime: time,
      timestamp: Date.now(),
      trackId,
      position: event.position,
    };

    const eventBusId = (this.eventBus as any).getInstanceId?.() || 'no-id';
    logger.info(
      `🎵 PatternConverter: Emitting drum-trigger to EventBus ${eventBusId}:`,
      { ...eventData, correlationId: 'system' },
    );

    this.eventBus.emit('drum-trigger', eventData);
  }

  /**
   * Trigger metronome click
   */
  private static triggerMetronomeClick(
    event: MetronomePatternEvent,
    time: number,
    trackId?: string,
  ): void {
    const eventData = {
      type: event.type,
      pitch: event.pitch || (event.type === 'accent' ? 'C5' : 'C4'),
      velocity: event.velocity,
      audioTime: time,
      timestamp: Date.now(),
      trackId,
      position: event.position,
    };

    const eventBusId = (this.eventBus as any).getInstanceId?.() || 'no-id';
    logger.info(
      `🎵 PatternConverter: Emitting metronome-trigger to EventBus ${eventBusId}:`,
      { ...eventData, correlationId: 'system' },
    );

    this.eventBus.emit('metronome-trigger', eventData);
  }

  /**
   * Trigger chord playback
   */
  private static triggerChord(
    event: ChordPatternEvent,
    time: number,
    trackId?: string,
  ): void {
    const eventData = {
      chord: event.chord,
      notes: event.notes,
      voicing: event.voicing || 'root',
      velocity: event.velocity,
      duration: event.duration || '4n',
      audioTime: time,
      timestamp: Date.now(),
      trackId,
      position: event.position,
    };

    const eventBusId = (this.eventBus as any).getInstanceId?.() || 'no-id';
    logger.info(
      `🎵 PatternConverter: Emitting chord-trigger to EventBus ${eventBusId}:`,
      { ...eventData, correlationId: 'system' },
    );

    this.eventBus.emit('chord-trigger', eventData);
  }

  /**
   * Trigger bass note playback
   */
  private static triggerBassNote(
    event: BassPatternEvent,
    time: number,
    trackId?: string,
  ): void {
    const eventData = {
      note: event.note,
      technique: event.technique || 'normal',
      velocity: event.velocity,
      duration: event.duration || '8n',
      audioTime: time,
      timestamp: Date.now(),
      trackId,
      position: event.position,
    };

    const eventBusId = (this.eventBus as any).getInstanceId?.() || 'no-id';
    logger.info(
      `🎵 PatternConverter: Emitting bass-trigger to EventBus ${eventBusId}:`,
      { ...eventData, correlationId: 'system' },
    );

    this.eventBus.emit('bass-trigger', eventData);
  }

  // Type guards
  private static isDrumPattern(pattern: Pattern): pattern is DrumPattern {
    return (
      'events' in pattern &&
      pattern.events.length > 0 &&
      'drum' in pattern.events[0]
    );
  }

  private static isMetronomePattern(
    pattern: Pattern,
  ): pattern is MetronomePattern {
    return (
      ('events' in pattern &&
        'timeSignature' in pattern &&
        pattern.events.length > 0 &&
        'type' in pattern.events[0] &&
        (pattern.events[0] as any).type === 'click') ||
      (pattern.events[0] as any).type === 'accent'
    );
  }

  private static isHarmonyPattern(pattern: Pattern): pattern is HarmonyPattern {
    return (
      'events' in pattern &&
      pattern.events.length > 0 &&
      'chord' in pattern.events[0]
    );
  }

  private static isBassPattern(pattern: Pattern): pattern is BassPattern {
    return (
      'events' in pattern &&
      pattern.events.length > 0 &&
      'note' in pattern.events[0] &&
      !('chord' in pattern.events[0])
    );
  }

  /**
   * Create a scheduled event from raw data
   */
  static createSchedulableEvent(
    time: MusicalPosition,
    type: string,
    data: any,
    priority: 'high' | 'normal' | 'low' = 'normal',
  ): SchedulableEvent {
    return {
      time,
      callback: (audioTime: number) => {
        this.eventBus.emit(`${type}-trigger`, {
          ...data,
          audioTime,
          timestamp: Date.now(),
        });
      },
      priority,
      metadata: {
        type,
        ...data,
      },
    };
  }

  /**
   * Batch convert multiple patterns
   */
  static batchConvertPatterns(
    patterns: Array<{
      pattern: Pattern;
      startTime: MusicalPosition;
      trackId?: string;
    }>,
  ): SchedulableEvent[] {
    const allEvents: SchedulableEvent[] = [];

    for (const { pattern, startTime, trackId } of patterns) {
      try {
        const events = this.patternToEvents(pattern, startTime, trackId);
        allEvents.push(...events);
      } catch (error) {
        logger.error(`Failed to convert pattern: ${error}`, { correlationId: 'system' });
      }
    }

    // Sort events by time for efficient scheduling
    return allEvents.sort((a, b) => {
      const aParsed = this.parseMusicalPosition(a.time);
      const bParsed = this.parseMusicalPosition(b.time);

      const aTotal = aParsed.bar * 16 + aParsed.beat * 4 + aParsed.sixteenth;
      const bTotal = bParsed.bar * 16 + bParsed.beat * 4 + bParsed.sixteenth;

      return aTotal - bTotal;
    });
  }

  /**
   * Helper to parse musical position
   */
  private static parseMusicalPosition(position: MusicalPosition): {
    bar: number;
    beat: number;
    sixteenth: number;
  } {
    const [bar, beat, sixteenth] = position.split(':').map(Number);
    return { bar, beat, sixteenth };
  }
}
