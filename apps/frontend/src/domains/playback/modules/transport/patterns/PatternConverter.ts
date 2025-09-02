/**
 * Pattern Converter
 * 
 * Converts high-level patterns to schedulable events.
 * Simplified version extracted from the original PatternConverter.
 */

import type { Region, MidiEvent } from '../../../types/region';
import type { Pattern } from '../../../types/pattern';
import type { MusicalPosition } from '../types';
import type { SchedulableEvent } from './types';
import { addMusicalTime } from '../../../utils/regionUtils';
import { createStructuredLogger } from '@bassnotion/contracts';

const logger = createStructuredLogger('PatternConverter');

export class PatternConverter {
  /**
   * Convert region content to schedulable events
   */
  convertRegionToEvents(region: Region): SchedulableEvent[] {
    // Handle both pattern and patterns format
    const pattern = region.pattern || (region.patterns && region.patterns[0]);
    
    if (pattern) {
      const startPos = region.startPosition || `0:${region.startTime || 0}:0`;
      const events = this.patternToEvents(pattern, startPos, region.trackId);
      
      logger.info(`Converted pattern to ${events.length} events for region ${region.id}`);
      
      if (events.length > 0) {
        logger.info(`First event: time=${events[0].time}, type=${events[0].metadata?.type}`);
      }
      
      return events;
    } else if (region.midiEvents) {
      const events = this.midiEventsToSchedulableEvents(
        region.midiEvents,
        region.startPosition || '0:0:0'
      );
      
      logger.info(`Converted ${events.length} MIDI events for region ${region.id}`);
      return events;
    }
    
    logger.warn(`Region ${region.id} has no pattern or MIDI events`);
    return [];
  }
  
  /**
   * Convert pattern to schedulable events
   */
  private patternToEvents(
    pattern: Pattern,
    startTime: MusicalPosition,
    trackId?: string
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
    
    throw new Error(`Unknown pattern type: ${(pattern as any).constructor?.name || 'unknown'}`);
  }
  
  /**
   * Convert MIDI events to schedulable events
   */
  private midiEventsToSchedulableEvents(
    midiEvents: MidiEvent[],
    startPosition: MusicalPosition
  ): SchedulableEvent[] {
    return midiEvents.map(event => ({
      time: addMusicalTime(startPosition, event.time),
      callback: (time: number) => {
        // Emit MIDI event
        this.emitMidiEvent(event, time);
      },
      priority: 'high',
      metadata: {
        type: 'midi',
        midiEvent: event,
      },
    }));
  }
  
  /**
   * Convert drum pattern to events
   */
  private drumPatternToEvents(
    pattern: any, // DrumPattern
    startTime: MusicalPosition,
    trackId?: string
  ): SchedulableEvent[] {
    if (!pattern.events) return [];
    
    return pattern.events.map((event: any) => ({
      time: addMusicalTime(startTime, event.position),
      callback: (time: number) => {
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
  private metronomePatternToEvents(
    pattern: any, // MetronomePattern
    startTime: MusicalPosition,
    trackId?: string
  ): SchedulableEvent[] {
    if (!pattern.events) return [];
    
    return pattern.events.map((event: any) => ({
      time: addMusicalTime(startTime, event.position),
      callback: (time: number) => {
        this.triggerMetronomeClick(event, time, trackId);
      },
      priority: 'normal',
      metadata: {
        type: 'metronome',
        beat: event.beat,
        accent: event.accent,
        trackId,
      },
    }));
  }
  
  /**
   * Convert harmony pattern to events
   */
  private harmonyPatternToEvents(
    pattern: any, // HarmonyPattern
    startTime: MusicalPosition,
    trackId?: string
  ): SchedulableEvent[] {
    if (!pattern.events) return [];
    
    return pattern.events.map((event: any) => ({
      time: addMusicalTime(startTime, event.position),
      callback: (time: number) => {
        this.triggerChord(event, time, trackId);
      },
      priority: 'normal',
      metadata: {
        type: 'harmony',
        chord: event.chord,
        voicing: event.voicing,
        trackId,
      },
    }));
  }
  
  /**
   * Convert bass pattern to events
   */
  private bassPatternToEvents(
    pattern: any, // BassPattern
    startTime: MusicalPosition,
    trackId?: string
  ): SchedulableEvent[] {
    if (!pattern.events) return [];
    
    return pattern.events.map((event: any) => ({
      time: addMusicalTime(startTime, event.position),
      callback: (time: number) => {
        this.triggerBassNote(event, time, trackId);
      },
      priority: 'normal',
      metadata: {
        type: 'bass',
        note: event.note,
        velocity: event.velocity,
        technique: event.technique,
        trackId,
      },
    }));
  }
  
  /**
   * Type guards for pattern identification
   */
  private isDrumPattern(pattern: Pattern): boolean {
    return (pattern as any).type === 'drum' || 'drums' in pattern;
  }
  
  private isMetronomePattern(pattern: Pattern): boolean {
    return (pattern as any).type === 'metronome' || 'clicks' in pattern;
  }
  
  private isHarmonyPattern(pattern: Pattern): boolean {
    return (pattern as any).type === 'harmony' || 'chords' in pattern;
  }
  
  private isBassPattern(pattern: Pattern): boolean {
    return (pattern as any).type === 'bass' || 'notes' in pattern;
  }
  
  /**
   * Trigger drum sample
   */
  private triggerDrumSample(event: any, time: number, trackId?: string): void {
    // Emit event for drum instrument to handle
    this.emitInstrumentEvent('drum:trigger', {
      drum: event.drum,
      velocity: event.velocity,
      time,
      trackId,
    });
  }
  
  /**
   * Trigger metronome click
   */
  private triggerMetronomeClick(event: any, time: number, trackId?: string): void {
    this.emitInstrumentEvent('metronome:click', {
      beat: event.beat,
      accent: event.accent,
      time,
      trackId,
    });
  }
  
  /**
   * Trigger chord
   */
  private triggerChord(event: any, time: number, trackId?: string): void {
    this.emitInstrumentEvent('harmony:chord', {
      chord: event.chord,
      voicing: event.voicing,
      time,
      trackId,
    });
  }
  
  /**
   * Trigger bass note
   */
  private triggerBassNote(event: any, time: number, trackId?: string): void {
    this.emitInstrumentEvent('bass:note', {
      note: event.note,
      velocity: event.velocity,
      technique: event.technique,
      time,
      trackId,
    });
  }
  
  /**
   * Emit MIDI event
   */
  private emitMidiEvent(event: MidiEvent, time: number): void {
    this.emitInstrumentEvent('midi:event', {
      event,
      audioTime: time,
      timestamp: Date.now(),
    });
  }
  
  /**
   * Emit instrument event via EventBus
   */
  private emitInstrumentEvent(eventType: string, data: any): void {
    // For now, emit to a global event bus if available
    if (typeof window !== 'undefined' && (window as any).__globalEventBus) {
      (window as any).__globalEventBus.emit(eventType, data);
    }
  }
}