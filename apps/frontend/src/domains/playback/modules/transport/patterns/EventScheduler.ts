/**
 * Event Scheduler
 * 
 * Handles lookahead scheduling with sample-accurate timing and performance optimization.
 * Extracted from PatternScheduler with all critical timing features preserved.
 */

import type { Transport } from '../core/Transport';
import type { MusicalPosition } from '../types';
import type {
  SchedulableEvent,
  ScheduledRegion,
  PatternSchedulerConfig,
  EventSchedulingResult,
  MusicalTimeOptions,
} from './types';
import {
  musicalPositionToSeconds,
  addMusicalTime,
} from '../../../utils/regionUtils';
import { createStructuredLogger } from '@bassnotion/contracts';

const logger = createStructuredLogger('EventScheduler');

export class EventScheduler {
  private scheduledEventCount = 0;
  private missedEventCount = 0;
  
  constructor(
    private readonly config: PatternSchedulerConfig,
    private readonly transport: Transport,
    private readonly onEventScheduled: (result: EventSchedulingResult) => void,
    private readonly onEventMissed: (data: any) => void
  ) {}
  
  /**
   * Schedule events for a region within the lookahead window
   */
  scheduleEventsInWindow(
    scheduledRegion: ScheduledRegion,
    currentTime: number,
    scheduleUntil: number
  ): void {
    const events = scheduledRegion.events;
    const tempo = this.transport.getTempo();
    const timeSignature = { numerator: 4, denominator: 4 }; // Should come from transport
    const region = scheduledRegion.region;
    
    const regionDurationSeconds = musicalPositionToSeconds(
      region.duration,
      tempo,
      timeSignature
    );
    
    // Update current loop based on current time for looping regions
    this.updateLoopIteration(scheduledRegion, currentTime, regionDurationSeconds);
    
    // Binary search optimization for large event lists
    if (this.shouldUseBinarySearch(scheduledRegion, events.length)) {
      this.optimizeEventIndex(scheduledRegion, currentTime, tempo, timeSignature);
    }
    
    // Process events within lookahead window
    this.processEventsInWindow(
      scheduledRegion,
      events,
      currentTime,
      scheduleUntil,
      tempo,
      timeSignature,
      regionDurationSeconds
    );
  }
  
  /**
   * Update loop iteration for looping regions
   */
  private updateLoopIteration(
    scheduledRegion: ScheduledRegion,
    currentTime: number,
    regionDurationSeconds: number
  ): void {
    const region = scheduledRegion.region;
    
    if (region.loopCount !== 1 && scheduledRegion.nextEventIndex >= scheduledRegion.events.length) {
      const timeElapsed = currentTime - scheduledRegion.loopStartTime;
      const expectedLoop = Math.floor(timeElapsed / regionDurationSeconds);
      
      // Check if we should advance to next loop
      if (region.loopCount === 0 || expectedLoop < region.loopCount) {
        if (expectedLoop > scheduledRegion.currentLoop) {
          // Advance to next loop
          scheduledRegion.currentLoop = expectedLoop;
          scheduledRegion.nextEventIndex = 0;
          
          logger.info(
            `Advanced to loop ${scheduledRegion.currentLoop + 1}/${region.loopCount || 'infinite'} for region ${region.id} at time ${currentTime.toFixed(3)}s`
          );
        }
      }
    }
  }
  
  /**
   * Check if binary search optimization should be used
   */
  private shouldUseBinarySearch(scheduledRegion: ScheduledRegion, eventCount: number): boolean {
    return (
      scheduledRegion.nextEventIndex === 0 &&
      eventCount > this.config.binarySearchThreshold &&
      scheduledRegion.currentLoop === 0
    );
  }
  
  /**
   * Use binary search to find optimal starting event index
   */
  private optimizeEventIndex(
    scheduledRegion: ScheduledRegion,
    currentTime: number,
    tempo: number,
    timeSignature: { numerator: number; denominator: number }
  ): void {
    const events = scheduledRegion.events;
    let left = 0;
    let right = events.length - 1;
    let result = 0;
    
    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const eventTime = musicalPositionToSeconds(
        events[mid].time,
        tempo,
        timeSignature
      );
      
      if (eventTime < currentTime) {
        left = mid + 1;
      } else {
        result = mid;
        right = mid - 1;
      }
    }
    
    scheduledRegion.nextEventIndex = result;
    logger.debug(`Binary search optimization: starting at event index ${result}/${events.length}`);
  }
  
  /**
   * Process events within the lookahead window
   */
  private processEventsInWindow(
    scheduledRegion: ScheduledRegion,
    events: SchedulableEvent[],
    currentTime: number,
    scheduleUntil: number,
    tempo: number,
    timeSignature: { numerator: number; denominator: number },
    regionDurationSeconds: number
  ): void {
    let eventsProcessed = 0;
    
    while (
      scheduledRegion.nextEventIndex < events.length &&
      eventsProcessed < this.config.maxEventsPerCycle
    ) {
      const event = events[scheduledRegion.nextEventIndex];
      
      // Calculate event absolute time
      const eventAbsoluteTime = this.calculateEventAbsoluteTime(
        event,
        scheduledRegion,
        regionDurationSeconds,
        tempo,
        timeSignature
      );
      
      // Check if event is within lookahead window
      if (eventAbsoluteTime > scheduleUntil) {
        break; // Event is too far in the future
      }
      
      // Check if event has already passed
      if (this.hasEventPassed(eventAbsoluteTime, currentTime)) {
        this.handleMissedEvent(scheduledRegion, event, eventAbsoluteTime, currentTime);
        scheduledRegion.nextEventIndex++;
        eventsProcessed++;
        continue;
      }
      
      // Schedule the event
      const result = this.scheduleEvent(event, eventAbsoluteTime, currentTime, scheduledRegion);
      this.onEventScheduled(result);
      
      scheduledRegion.nextEventIndex++;
      eventsProcessed++;
      this.scheduledEventCount++;
    }
    
    scheduledRegion.lastScheduledTime = scheduleUntil;
  }
  
  /**
   * Calculate absolute time for an event considering loops
   */
  private calculateEventAbsoluteTime(
    event: SchedulableEvent,
    scheduledRegion: ScheduledRegion,
    regionDurationSeconds: number,
    tempo: number,
    timeSignature: { numerator: number; denominator: number }
  ): number {
    // Event time relative to pattern start
    const eventRelativeTime = musicalPositionToSeconds(
      event.time,
      tempo,
      timeSignature
    );
    
    // Calculate absolute time considering current loop iteration
    const loopOffset = regionDurationSeconds * scheduledRegion.currentLoop;
    return scheduledRegion.loopStartTime + loopOffset + eventRelativeTime;
  }
  
  /**
   * Check if an event has already passed
   */
  private hasEventPassed(eventAbsoluteTime: number, currentTime: number): boolean {
    // Special handling for events at time 0
    if (eventAbsoluteTime === 0 && currentTime < 0.1) {
      return false; // Schedule immediately when starting
    }
    
    // 5ms tolerance for past events
    return eventAbsoluteTime < currentTime - 0.005;
  }
  
  /**
   * Handle missed event
   */
  private handleMissedEvent(
    scheduledRegion: ScheduledRegion,
    event: SchedulableEvent,
    eventAbsoluteTime: number,
    currentTime: number
  ): void {
    const lateness = (currentTime - eventAbsoluteTime) * 1000; // Convert to ms
    
    logger.warn(
      `Missed event at time=${eventAbsoluteTime.toFixed(3)}, currentTime=${currentTime.toFixed(3)}, lateness=${lateness.toFixed(3)}ms`
    );
    
    this.missedEventCount++;
    
    this.onEventMissed({
      trackId: scheduledRegion.trackId,
      regionId: scheduledRegion.region.id,
      eventTime: eventAbsoluteTime,
      currentTime,
      lateness,
    });
  }
  
  /**
   * Schedule an individual event
   */
  private scheduleEvent(
    event: SchedulableEvent,
    eventAbsoluteTime: number,
    currentTime: number,
    scheduledRegion: ScheduledRegion
  ): EventSchedulingResult {
    // Round schedule time to timing precision for accuracy
    const scheduleTime = Math.round(
      Math.max(eventAbsoluteTime, currentTime) / this.config.timingPrecision
    ) * this.config.timingPrecision;
    
    const startTime = performance.now();
    let success = false;
    let error: string | undefined;
    
    try {
      // Schedule with transport
      this.transport.scheduleEvent({
        time: scheduleTime,
        callback: (time: number) => {
          try {
            event.callback(time);
          } catch (callbackError) {
            logger.error(`Event callback error at ${time}:`, callbackError);
            this.missedEventCount++;
          }
        },
        priority: event.priority || 'normal',
      });
      
      success = true;
      
      // Log first few scheduled events for debugging
      if (this.scheduledEventCount <= 10 || scheduledRegion.currentLoop > 0) {
        logger.info(
          `Scheduled event #${this.scheduledEventCount + 1} (loop ${scheduledRegion.currentLoop + 1}): type=${event.metadata?.type}, time=${scheduleTime.toFixed(3)}`
        );
      }
    } catch (scheduleError) {
      error = scheduleError instanceof Error ? scheduleError.message : 'Unknown scheduling error';
      logger.error(`Failed to schedule event at ${scheduleTime}:`, scheduleError);
    }
    
    const endTime = performance.now();
    const latency = endTime - startTime;
    
    return {
      eventId: `${scheduledRegion.trackId}-${scheduledRegion.region.id}-${scheduledRegion.nextEventIndex}`,
      scheduledTime: scheduleTime,
      actualTime: eventAbsoluteTime,
      latency,
      success,
      error,
    };
  }
  
  /**
   * Get scheduling statistics
   */
  getSchedulingStats(): {
    scheduledEvents: number;
    missedEvents: number;
    successRate: number;
    averageLatency: number;
  } {
    const total = this.scheduledEventCount + this.missedEventCount;
    const successRate = total > 0 ? (this.scheduledEventCount / total) * 100 : 100;
    
    return {
      scheduledEvents: this.scheduledEventCount,
      missedEvents: this.missedEventCount,
      successRate,
      averageLatency: 0.5, // Placeholder - would need timing measurements
    };
  }
  
  /**
   * Reset statistics
   */
  resetStats(): void {
    this.scheduledEventCount = 0;
    this.missedEventCount = 0;
  }
  
  /**
   * Update configuration
   */
  updateConfig(config: Partial<PatternSchedulerConfig>): void {
    Object.assign(this.config, config);
  }
}