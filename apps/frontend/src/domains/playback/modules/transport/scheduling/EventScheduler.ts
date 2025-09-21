/**
 * EventScheduler - Professional event scheduling system
 *
 * Handles priority-based event scheduling with look-ahead buffering
 * for sample-accurate timing in audio applications.
 *
 * Features:
 * - Priority queue system (high/normal/low)
 * - Look-ahead buffering for smooth playback
 * - Automatic cleanup of expired events
 * - Integration with Tone.js scheduler
 */

import { EventEmitter } from '../shared/EventEmitter.js';
import { createStructuredLogger } from '../../shared/index.js';
import * as Tone from 'tone';

const logger = createStructuredLogger('EventScheduler');

export type EventPriority = 'high' | 'normal' | 'low';

export interface ScheduledEvent {
  id: string;
  time: number;
  callback: () => void;
  priority: EventPriority;
  metadata?: any;
}

export interface EventSchedulerConfig {
  lookAheadTime?: number; // How far to schedule events in advance (seconds)
  scheduleInterval?: number; // How often to check for events to schedule (ms)
  maxEventsPerCycle?: number; // Max events to schedule per update cycle
  cleanupInterval?: number; // How often to clean expired events (ms)
}

export class EventScheduler extends EventEmitter {
  private config: Required<EventSchedulerConfig>;
  private eventQueue: Map<string, ScheduledEvent> = new Map();
  private scheduledIds: Map<string, number> = new Map(); // Event ID -> Tone schedule ID
  private isRunning = false;
  private scheduleTimer: number | null = null;
  private cleanupTimer: number | null = null;
  private lastScheduleTime = 0;

  // Performance metrics
  private scheduledCount = 0;
  private missedCount = 0;
  private cleanedCount = 0;

  constructor(config: EventSchedulerConfig = {}) {
    super();

    this.config = {
      lookAheadTime: config.lookAheadTime ?? 0.1, // 100ms default
      scheduleInterval: config.scheduleInterval ?? 25, // 25ms default
      maxEventsPerCycle: config.maxEventsPerCycle ?? 50, // 50 events per cycle
      cleanupInterval: config.cleanupInterval ?? 1000, // 1s cleanup interval
    };

    logger.info('EventScheduler initialized', this.config);
  }

  /**
   * Start the scheduler
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('Scheduler already running');
      return;
    }

    this.isRunning = true;
    this.lastScheduleTime = Tone.now();

    // Start scheduling timer
    this.scheduleTimer = window.setInterval(
      () => this.scheduleEvents(),
      this.config.scheduleInterval,
    );

    // Start cleanup timer
    this.cleanupTimer = window.setInterval(
      () => this.cleanupExpiredEvents(),
      this.config.cleanupInterval,
    );

    logger.info('EventScheduler started');
    this.emit('start');
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    // Stop timers
    if (this.scheduleTimer) {
      clearInterval(this.scheduleTimer);
      this.scheduleTimer = null;
    }

    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    // Clear all scheduled events
    this.clearAllEvents();

    logger.info('EventScheduler stopped');
    this.emit('stop');
  }

  /**
   * Schedule an event
   */
  scheduleEvent(event: ScheduledEvent): void {
    if (this.eventQueue.has(event.id)) {
      logger.warn('Event already scheduled', { id: event.id });
      return;
    }

    this.eventQueue.set(event.id, event);

    logger.debug('Event queued', {
      id: event.id,
      time: event.time,
      priority: event.priority,
    });

    // Immediately try to schedule if within look-ahead window
    if (this.isRunning) {
      this.scheduleEvents();
    }
  }

  /**
   * Cancel a scheduled event
   */
  cancelEvent(eventId: string): void {
    const event = this.eventQueue.get(eventId);
    if (!event) {
      return;
    }

    // Remove from queue
    this.eventQueue.delete(eventId);

    // Cancel Tone.js schedule if exists
    const scheduleId = this.scheduledIds.get(eventId);
    if (scheduleId !== undefined) {
      Tone.Transport.clear(scheduleId);
      this.scheduledIds.delete(eventId);
    }

    logger.debug('Event cancelled', { id: eventId });
  }

  /**
   * Get all scheduled events
   */
  getScheduledEvents(): ScheduledEvent[] {
    return Array.from(this.eventQueue.values());
  }

  /**
   * Get events by priority
   */
  getEventsByPriority(priority: EventPriority): ScheduledEvent[] {
    return Array.from(this.eventQueue.values()).filter(
      (event) => event.priority === priority,
    );
  }

  /**
   * Clear all events
   */
  clearAllEvents(): void {
    // Cancel all Tone.js schedules
    for (const scheduleId of this.scheduledIds.values()) {
      Tone.Transport.clear(scheduleId);
    }

    const clearedCount = this.eventQueue.size;

    // Clear maps
    this.eventQueue.clear();
    this.scheduledIds.clear();

    logger.info('All events cleared', { count: clearedCount });
  }

  /**
   * Get scheduler metrics
   */
  getMetrics() {
    return {
      queuedEvents: this.eventQueue.size,
      scheduledEvents: this.scheduledIds.size,
      totalScheduled: this.scheduledCount,
      totalMissed: this.missedCount,
      totalCleaned: this.cleanedCount,
      isRunning: this.isRunning,
    };
  }

  /**
   * Process events for scheduling
   */
  private scheduleEvents(): void {
    if (!this.isRunning) {
      return;
    }

    const now = Tone.now();
    const lookAheadEnd = now + this.config.lookAheadTime;
    let scheduledInCycle = 0;

    // Get events sorted by priority and time
    const sortedEvents = this.getSortedEvents();

    for (const event of sortedEvents) {
      // Stop if we've scheduled enough events this cycle
      if (scheduledInCycle >= this.config.maxEventsPerCycle) {
        break;
      }

      // Skip if already scheduled
      if (this.scheduledIds.has(event.id)) {
        continue;
      }

      // Skip if event is in the past
      if (event.time < now) {
        logger.warn('Missed event', {
          id: event.id,
          scheduledTime: event.time,
          currentTime: now,
          delta: now - event.time,
        });
        this.missedCount++;
        this.eventQueue.delete(event.id);
        continue;
      }

      // Schedule if within look-ahead window
      if (event.time <= lookAheadEnd) {
        try {
          const scheduleId = Tone.Transport.scheduleOnce((time) => {
            this.executeEvent(event, time);
          }, event.time);

          this.scheduledIds.set(event.id, scheduleId);
          this.scheduledCount++;
          scheduledInCycle++;

          logger.debug('Event scheduled', {
            id: event.id,
            time: event.time,
            priority: event.priority,
          });
        } catch (error) {
          logger.error('Failed to schedule event', error as Error, {
            eventId: event.id,
          });
          this.eventQueue.delete(event.id);
        }
      }
    }

    this.lastScheduleTime = now;
  }

  /**
   * Execute a scheduled event
   */
  private executeEvent(event: ScheduledEvent, audioTime: number): void {
    // Remove from tracking
    this.eventQueue.delete(event.id);
    this.scheduledIds.delete(event.id);

    try {
      // Execute callback
      event.callback();

      // Emit event executed
      this.emit('eventExecuted', {
        id: event.id,
        scheduledTime: event.time,
        actualTime: audioTime,
        drift: audioTime - event.time,
        priority: event.priority,
      });
    } catch (error) {
      logger.error('Event execution failed', error as Error, {
        eventId: event.id,
      });

      this.emit('eventError', {
        id: event.id,
        error,
      });
    }
  }

  /**
   * Get events sorted by priority and time
   */
  private getSortedEvents(): ScheduledEvent[] {
    const events = Array.from(this.eventQueue.values());

    // Sort by priority (high first) then by time
    return events.sort((a, b) => {
      // Priority order: high=0, normal=1, low=2
      const priorityOrder = { high: 0, normal: 1, low: 2 };
      const priorityDiff =
        priorityOrder[a.priority] - priorityOrder[b.priority];

      if (priorityDiff !== 0) {
        return priorityDiff;
      }

      // Same priority, sort by time
      return a.time - b.time;
    });
  }

  /**
   * Clean up expired events
   */
  private cleanupExpiredEvents(): void {
    const now = Tone.now();
    let cleanedCount = 0;

    // Check for events that were scheduled but are now in the past
    for (const [eventId, event] of this.eventQueue) {
      if (event.time < now - 1) {
        // 1 second grace period
        this.eventQueue.delete(eventId);

        const scheduleId = this.scheduledIds.get(eventId);
        if (scheduleId !== undefined) {
          Tone.Transport.clear(scheduleId);
          this.scheduledIds.delete(eventId);
        }

        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.cleanedCount += cleanedCount;
      logger.debug('Cleaned expired events', { count: cleanedCount });
    }
  }

  /**
   * Destroy the scheduler
   */
  destroy(): void {
    this.stop();
    this.removeAllListeners();
    logger.info('EventScheduler destroyed');
  }
}
