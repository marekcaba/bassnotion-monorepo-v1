/**
 * Scheduler - Event scheduling and timing management
 *
 * Responsibilities:
 * - Event queue management
 * - Look-ahead scheduling
 * - Priority-based scheduling
 * - Tone.js transport integration
 */

import { TimingEvent, ScheduleOptions } from '../types/index.js';
import { SchedulingError } from '../types/errors.js';
import { createStructuredLogger } from '../../shared/index.js';

const logger = createStructuredLogger('TransportScheduler');

// Helper to get Tone from window (must be initialized before Scheduler is used)
function getTone(): any {
  if (typeof window !== 'undefined') {
    // Check both locations where Tone.js may be stored
    const tone = window.Tone || window.__globalTone;
    if (tone) {
      return tone;
    }
  }
  throw new Error(
    'Scheduler: Tone.js not loaded. Ensure AudioEngine is initialized first.',
  );
}

export interface SchedulerConfig {
  lookAheadTime: number; // seconds
  scheduleInterval: number; // seconds
  maxQueueSize?: number;
}

export class Scheduler {
  private eventQueue: TimingEvent[] = [];
  private scheduledEvents = new Map<string, number>(); // eventId -> Tone scheduleId
  private eventIdCounter = 0;
  private scheduledUntil = 0;
  private isRunning = false;
  private config: SchedulerConfig;
  private updateTimer: number | null = null;

  constructor(config: SchedulerConfig) {
    this.config = {
      maxQueueSize: 10000,
      ...config,
    };
    logger.debug('Scheduler instance created', { config });
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
    this.startUpdateLoop();
    logger.info('Scheduler started');
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    this.stopUpdateLoop();
    this.clearAllScheduledEvents();
    logger.info('Scheduler stopped');
  }

  /**
   * Schedule a single event
   */
  scheduleEvent(event: Omit<TimingEvent, 'id'>): string {
    if (
      this.config.maxQueueSize &&
      this.eventQueue.length >= this.config.maxQueueSize
    ) {
      throw new SchedulingError(
        `Event queue full (max: ${this.config.maxQueueSize})`,
      );
    }

    const id = this.generateEventId();
    const fullEvent: TimingEvent = { ...event, id };

    // Insert into queue sorted by time
    this.insertSorted(fullEvent);

    // If running and event is within lookahead, schedule immediately
    const Tone = getTone();
    if (this.isRunning && Tone.getTransport().state === 'started') {
      const currentTime = Tone.getTransport().seconds;
      if (event.time <= currentTime + this.config.lookAheadTime) {
        this.processScheduleQueue(currentTime);
      }
    }

    logger.debug('Event scheduled', {
      id,
      time: event.time,
      priority: event.priority,
    });
    return id;
  }

  /**
   * Schedule a repeating event
   */
  scheduleRepeat(
    callback: (time: number) => void,
    interval: string | number,
    startTime?: number,
    _priority: 'high' | 'normal' | 'low' = 'normal',
  ): string {
    const id = this.generateEventId('repeat');

    try {
      const Tone = getTone();
      const scheduleId = Tone.getTransport().scheduleRepeat(
        (time: number) => {
          try {
            callback(time);
          } catch (error) {
            logger.error('Repeat callback error', error as Error);
          }
        },
        interval,
        startTime,
      );

      this.scheduledEvents.set(id, scheduleId);
      logger.debug('Repeat event scheduled', { id, interval, startTime });
      return id;
    } catch (error) {
      throw new SchedulingError(`Failed to schedule repeat: ${error}`);
    }
  }

  /**
   * Cancel a scheduled event
   */
  cancelEvent(eventId: string): void {
    // Remove from queue
    this.eventQueue = this.eventQueue.filter((e) => e.id !== eventId);

    // Cancel if already scheduled with Tone
    const scheduleId = this.scheduledEvents.get(eventId);
    if (scheduleId !== undefined) {
      const Tone = getTone();
      Tone.getTransport().clear(scheduleId);
      this.scheduledEvents.delete(eventId);
      logger.debug('Event cancelled', { eventId });
    }
  }

  /**
   * Cancel all scheduled events
   */
  clearAllScheduledEvents(): void {
    // Clear Tone.js scheduled events
    const Tone = getTone();
    for (const [_eventId, scheduleId] of this.scheduledEvents) {
      Tone.getTransport().clear(scheduleId);
    }
    this.scheduledEvents.clear();

    // Clear event queue
    this.eventQueue = [];
    this.scheduledUntil = 0;

    logger.info('All events cleared');
  }

  /**
   * Get pending events count
   */
  getPendingCount(): number {
    return this.eventQueue.length;
  }

  /**
   * Get scheduled events count
   */
  getScheduledCount(): number {
    return this.scheduledEvents.size;
  }

  /**
   * Process the schedule queue
   */
  private processScheduleQueue(currentTime: number): void {
    const scheduleUntil = currentTime + this.config.lookAheadTime;

    // Filter and sort events by priority and time
    const eventsToSchedule = this.eventQueue
      .filter(
        (event) =>
          event.time > currentTime &&
          event.time <= scheduleUntil &&
          !this.scheduledEvents.has(event.id),
      )
      .sort((a, b) => {
        // Sort by priority first, then by time
        const priorityOrder = { high: 0, normal: 1, low: 2 };
        if (a.priority !== b.priority) {
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        }
        return a.time - b.time;
      });

    // Schedule events with Tone.js
    const Tone = getTone();
    for (const event of eventsToSchedule) {
      try {
        const scheduleId = Tone.getTransport().schedule((time: number) => {
          try {
            event.callback(time);

            // Remove from queue after execution
            this.eventQueue = this.eventQueue.filter((e) => e.id !== event.id);
            this.scheduledEvents.delete(event.id);
          } catch (error) {
            logger.error('Event callback error', error as Error, {
              eventId: event.id,
            });
          }
        }, event.time);

        this.scheduledEvents.set(event.id, scheduleId);
      } catch (error) {
        logger.error('Failed to schedule event', error as Error, {
          eventId: event.id,
        });
      }
    }

    // Clean up past events
    const pastEvents = this.eventQueue.filter(
      (event) => event.time <= currentTime,
    );
    if (pastEvents.length > 0) {
      logger.warn('Removing past events', { count: pastEvents.length });
      this.eventQueue = this.eventQueue.filter(
        (event) => event.time > currentTime,
      );
    }

    this.scheduledUntil = scheduleUntil;
  }

  /**
   * Start the update loop
   */
  private startUpdateLoop(): void {
    if (this.updateTimer !== null) {
      return;
    }

    const update = () => {
      const Tone = getTone();
      if (!this.isRunning || Tone.getTransport().state !== 'started') {
        return;
      }

      const currentTime = Tone.getTransport().seconds;
      this.processScheduleQueue(currentTime);
    };

    // Initial update
    update();

    // Set up periodic updates
    this.updateTimer = window.setInterval(
      update,
      this.config.scheduleInterval * 1000,
    );
  }

  /**
   * Stop the update loop
   */
  private stopUpdateLoop(): void {
    if (this.updateTimer !== null) {
      window.clearInterval(this.updateTimer);
      this.updateTimer = null;
    }
  }

  /**
   * Insert event into queue maintaining sort order
   */
  private insertSorted(event: TimingEvent): void {
    // Binary search for insertion point
    let left = 0;
    let right = this.eventQueue.length;

    while (left < right) {
      const mid = Math.floor((left + right) / 2);
      const midEvent = this.eventQueue[mid];
      if (midEvent && midEvent.time <= event.time) {
        left = mid + 1;
      } else {
        right = mid;
      }
    }

    this.eventQueue.splice(left, 0, event);
  }

  /**
   * Generate unique event ID
   */
  private generateEventId(prefix = 'event'): string {
    return `${prefix}_${++this.eventIdCounter}`;
  }

  /**
   * Schedule a single callback at a specific time
   */
  scheduleOnce(
    callback: (time: number) => void,
    time: number,
    options?: ScheduleOptions,
  ): string {
    return this.scheduleEvent({
      time,
      callback,
      priority: options?.quantize ? 'high' : 'normal',
      metadata: options,
    });
  }

  /**
   * Schedule immediate execution (next possible slot)
   */
  scheduleImmediate(callback: (time: number) => void): string {
    const Tone = getTone();
    const time = Tone.getTransport().seconds + 0.001; // 1ms in future
    return this.scheduleOnce(callback, time);
  }

  /**
   * Get scheduler statistics
   */
  getStats(): {
    queueLength: number;
    scheduledCount: number;
    scheduledUntil: number;
    isRunning: boolean;
  } {
    return {
      queueLength: this.eventQueue.length,
      scheduledCount: this.scheduledEvents.size,
      scheduledUntil: this.scheduledUntil,
      isRunning: this.isRunning,
    };
  }

  /**
   * Reset scheduler state
   */
  reset(): void {
    this.stop();
    this.eventQueue = [];
    this.scheduledEvents.clear();
    this.eventIdCounter = 0;
    this.scheduledUntil = 0;
    logger.info('Scheduler reset');
  }
}
