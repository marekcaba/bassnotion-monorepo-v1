import {
  Service,
  type ServiceConfig,
  type HealthCheckResult,
  serviceRegistry,
} from './ServiceRegistry.js';
import { UnifiedTransport } from './UnifiedTransport.js';
import { EventBus } from './EventBus.js';
import type { Region, MidiEvent } from '../../types/region.js';
import type { Pattern } from '../../types/pattern.js';
import type { MusicalPosition, TimingEvent } from '../../types/timing.js';
import { PlaybackError, ErrorSeverity } from '../errors/base.js';
import {
  compareMusicalPositions,
  addMusicalTime,
  musicalPositionToSeconds,
  subtractMusicalTime,
} from '../../utils/regionUtils.js';
import { PatternConverter, type SchedulableEvent } from './PatternConverter.js';
import {
  parseMusicalPosition,
  toMusicalPosition,
} from '../../types/pattern.js';
import { getLogger } from '@/utils/logger.js';

/**
 * Professional DAW-style pattern scheduler
 * Connects track regions to UnifiedTransport with sample-accurate timing
 */
export class PatternScheduler implements Service {
  private transport: UnifiedTransport | null = null;
  private eventBus: EventBus | null = null;
  private registry: any = null;

  // Region management
  private trackRegions = new Map<string, Region[]>();
  private activeRegions = new Map<string, ScheduledRegion>();

  // Scheduling configuration
  private readonly lookaheadTime = 0.2; // 200ms - matches UnifiedTransport
  private readonly scheduleInterval = 0.00267; // 2.67ms - matches transport
  private readonly timingPrecision = 0.001; // 1ms precision for scheduling

  // Performance tracking
  private metrics = {
    scheduledEvents: 0,
    missedEvents: 0,
    avgLatency: 0,
    cpuUsage: 0,
  };

  // Service state
  private isInitialized = false;
  private isRunning = false;

  // Logger
  private logger = getLogger('pattern-scheduler');

  // Event listeners
  private positionUpdateListener: ((position: any) => void) | null = null;
  private regionUpdateListener: ((data: any) => void) | null = null;

  constructor() {
    // Service will be initialized through initialize() method
  }

  /**
   * Set the service registry for dependency resolution
   */
  setRegistry(registry: any): void {
    this.registry = registry;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    // Connect to EventBus early to catch track-regions-updated events
    this.logger.info(
      'PatternScheduler: Connecting to EventBus during initialization',
    );

    // Try to get EventBus from various sources
    const reg = this.registry || serviceRegistry;

    if (!this.eventBus && reg.has('eventBus')) {
      this.eventBus = reg.get<EventBus>('eventBus');
    }

    // Try fallback methods
    if (!this.eventBus && typeof window !== 'undefined') {
      // Try global EventBus singleton first
      if ((window as any).__globalEventBus) {
        this.eventBus = (window as any).__globalEventBus;
        this.logger.info(
          'PatternScheduler: Got EventBus from __globalEventBus during init',
        );
      }
      // Try global services
      else if ((window as any).__globalCoreServices?.getEventBus) {
        this.eventBus = (window as any).__globalCoreServices.getEventBus();
        this.logger.info(
          'PatternScheduler: Got EventBus from __globalCoreServices during init',
        );
      }
      // Try creating global singleton as last resort
      else {
        this.eventBus = EventBus.getGlobalInstance();
        this.logger.info(
          'PatternScheduler: Created EventBus global singleton during init',
        );
      }
    }

    // Subscribe to track-regions-updated early
    if (this.eventBus) {
      const unsubscribe = this.eventBus.on(
        'track-regions-updated',
        (event: any) => {
          this.logger.info(
            '🎵 PatternScheduler: Received track-regions-updated event during init!',
            {
              eventBusId:
                (this.eventBus as any).getInstanceId?.() ||
                (this.eventBus as any)._instanceId ||
                'no-id',
              event: event,
            },
          );
          this.handleTrackRegionsUpdate(event);
        },
      );

      this.logger.info(
        '🎵 PatternScheduler: Subscribed to track-regions-updated during initialization',
        {
          eventBusId:
            (this.eventBus as any).getInstanceId?.() ||
            (this.eventBus as any)._instanceId ||
            'no-id',
        },
      );
    }

    this.isInitialized = true;
    this.logger.info(
      'PatternScheduler initialized with early event subscription',
    );
  }

  async start(): Promise<void> {
    if (!this.isInitialized) {
      throw new PlaybackError(
        'PatternScheduler not initialized',
        ErrorSeverity.HIGH,
        'SCHEDULER_NOT_INITIALIZED',
      );
    }

    // Connect services if not connected during initialization
    if (!this.transport || !this.eventBus) {
      this.logger.info('PatternScheduler: Connecting to services on start');

      // Use the registry passed to us if available, otherwise fall back to global
      const reg = this.registry || serviceRegistry;

      if (!this.transport && reg.has('unifiedTransport')) {
        this.transport = reg.get<UnifiedTransport>('unifiedTransport');
      }

      if (!this.eventBus && reg.has('eventBus')) {
        this.eventBus = reg.get<EventBus>('eventBus');
      }

      // If still no EventBus, try multiple fallback methods
      if (!this.eventBus && typeof window !== 'undefined') {
        // Try global EventBus singleton first
        if ((window as any).__globalEventBus) {
          this.eventBus = (window as any).__globalEventBus;
          this.logger.info(
            'PatternScheduler: Got EventBus from __globalEventBus',
          );
        }
        // Try global services
        else if ((window as any).__globalCoreServices?.getEventBus) {
          this.eventBus = (window as any).__globalCoreServices.getEventBus();
          this.logger.info(
            'PatternScheduler: Got EventBus from __globalCoreServices',
          );
        }
        // Try creating global singleton as last resort
        else {
          this.eventBus = EventBus.getGlobalInstance();
          this.logger.info(
            'PatternScheduler: Created EventBus global singleton',
          );
        }
      }

      // If still no transport, try to get it from global services
      if (!this.transport) {
        const globalServices = (window as any).__globalCoreServices;
        if (globalServices && globalServices.getUnifiedTransport) {
          this.transport = globalServices.getUnifiedTransport();
          this.logger.info(
            'PatternScheduler: Got UnifiedTransport from global services',
          );
        }
      }

      if (this.transport && this.eventBus) {
        // Create bound listeners if not already created
        if (!this.positionUpdateListener) {
          this.positionUpdateListener = this.processScheduling.bind(this);
          this.regionUpdateListener = this.handleTrackRegionsUpdate.bind(this);
        }

        // Subscribe to events via EventBus
        this.eventBus.on(
          'transport:timing-update',
          this.positionUpdateListener,
        );
        this.eventBus.on(
          'transport:start',
          this.handleTransportStart.bind(this),
        );
        this.eventBus.on('transport:stop', this.handleTransportStop.bind(this));

        // Subscribe to track-regions-updated with explicit logging
        const unsubscribe = this.eventBus.on(
          'track-regions-updated',
          (event: any) => {
            this.logger.info(
              '🎵 PatternScheduler: Received track-regions-updated event!',
              {
                eventBusId:
                  (this.eventBus as any).getInstanceId?.() ||
                  (this.eventBus as any)._instanceId ||
                  'no-id',
                event: event,
              },
            );
            this.handleTrackRegionsUpdate(event);
          },
        );

        this.logger.info('🎵 PatternScheduler: Subscribed to events', {
          eventBusId:
            (this.eventBus as any).getInstanceId?.() ||
            (this.eventBus as any)._instanceId ||
            'no-id',
          eventBusListeners:
            (this.eventBus as any).listeners?.size || 'unknown',
        });
      } else {
        throw new PlaybackError(
          'PatternScheduler cannot start - required services not available',
          ErrorSeverity.HIGH,
          'SCHEDULER_SERVICES_NOT_AVAILABLE',
        );
      }
    }

    this.isRunning = true;
    this.logger.info('PatternScheduler started');

    // Request all tracks to re-emit their regions after PatternScheduler is ready
    if (this.eventBus) {
      this.logger.info(
        '🎵 PatternScheduler: Requesting tracks to re-emit regions...',
      );
      this.eventBus.emit('pattern-scheduler:request-regions', {
        schedulerId: 'main',
      });
    }
  }

  async stop(): Promise<void> {
    this.isRunning = false;

    // Clear active regions
    this.activeRegions.clear();

    this.logger.info('PatternScheduler stopped');
  }

  async restart(): Promise<void> {
    await this.stop();
    await this.start();
  }

  async dispose(): Promise<void> {
    await this.stop();

    // Unsubscribe from events
    // EventBus doesn't have .off() method - subscriptions should be stored and unsubscribed
    // For now, just log a warning since we can't fix this without refactoring the subscription logic
    this.logger.warn(
      'PatternScheduler disposal: Event listeners not properly cleaned up - EventBus lacks .off() method',
    );

    // Clear all data
    this.trackRegions.clear();
    this.activeRegions.clear();

    this.transport = null;
    this.eventBus = null;
    this.isInitialized = false;

    this.logger.info('PatternScheduler disposed');
  }

  async healthCheck(): Promise<HealthCheckResult> {
    const healthy =
      this.isInitialized &&
      this.transport !== null &&
      this.eventBus !== null &&
      this.metrics.cpuUsage < 80;

    return {
      status: healthy ? 'healthy' : 'unhealthy',
      message: healthy
        ? 'PatternScheduler is operating normally'
        : 'PatternScheduler has issues',
      details: {
        isInitialized: this.isInitialized,
        isRunning: this.isRunning,
        trackCount: this.trackRegions.size,
        activeRegions: this.activeRegions.size,
        metrics: this.metrics,
      },
      timestamp: Date.now(),
    };
  }

  getConfig(): ServiceConfig {
    return {
      lookaheadTime: this.lookaheadTime,
      scheduleInterval: this.scheduleInterval,
      isRunning: this.isRunning,
    };
  }

  /**
   * Core scheduling logic - called every 2.67ms by transport
   */
  private processScheduling(event: any): void {
    if (!this.isRunning || !this.transport) return;

    const position = event.position;
    const currentTime = event.time || 0; // UnifiedTransport sends 'time' not 'audioTime'
    const scheduleUntil = currentTime + this.lookaheadTime;

    // Log first few timing updates for debugging
    if (this.metrics.scheduledEvents < 10) {
      this.logger.info(`🎵 PatternScheduler: Processing timing update`, {
        position,
        currentTime,
        scheduleUntil,
        trackRegionsCount: this.trackRegions.size,
        activeRegionsCount: this.activeRegions.size,
        event: event,
      });
    }

    // Convert position object to string format if needed
    let musicalPosition: MusicalPosition;
    if (
      typeof position === 'object' &&
      position !== null &&
      'bars' in position
    ) {
      musicalPosition = toMusicalPosition(
        position.bars || 0,
        position.beats || 0,
        position.sixteenths || 0,
      );
    } else if (typeof position === 'string') {
      musicalPosition = position;
    } else {
      // Default position if invalid
      musicalPosition = toMusicalPosition(0, 0, 0);
    }

    try {
      // Log scheduling details periodically (every 100 calls)
      if (
        this.metrics.scheduledEvents % 100 === 0 &&
        currentTime !== undefined &&
        scheduleUntil !== undefined
      ) {
        this.logger.debug(
          `Processing scheduling: position=${musicalPosition}, currentTime=${currentTime?.toFixed(3)}, scheduleUntil=${scheduleUntil?.toFixed(3)}`,
        );
        this.logger.debug(
          `Active tracks: ${this.trackRegions.size}, Active regions: ${this.activeRegions.size}`,
        );
      }

      // Process each track's regions
      for (const [trackId, regions] of this.trackRegions) {
        for (const region of regions) {
          if (!region.muted) {
            this.scheduleRegion(
              trackId,
              region,
              currentTime,
              scheduleUntil,
              musicalPosition,
            );
          }
        }
      }

      // Update performance metrics
      this.updateMetrics();
    } catch (error) {
      this.logger.error('Scheduling error:', error);
      this.metrics.missedEvents++;
    }
  }

  /**
   * Schedule events for a specific region
   */
  private scheduleRegion(
    trackId: string,
    region: Region,
    currentTime: number,
    scheduleUntil: number,
    currentPosition: MusicalPosition,
  ): void {
    const regionKey = `${trackId}-${region.id}`;
    let scheduledRegion = this.activeRegions.get(regionKey);

    // Check if current position is within region bounds
    // Handle both startPosition and startTime formats
    const startPos = region.startPosition || `0:${region.startTime || 0}:0`;
    const duration =
      typeof region.duration === 'number'
        ? `0:${region.duration}:0`
        : region.duration;

    // For looping regions, we need to check if we're within ANY valid loop iteration
    let isInRegion = false;

    if (region.loopCount === 0 || region.loopCount > 1) {
      // This is a looping region - check if we're within any loop bounds
      const originalEndPos = addMusicalTime(startPos, duration);

      // Calculate which loop we should be in based on current position
      const timeSinceStart = subtractMusicalTime(currentPosition, startPos);
      const loopDurationBeats = this.musicalPositionToBeats(duration);
      const timeSinceStartBeats = this.musicalPositionToBeats(timeSinceStart);

      if (timeSinceStartBeats >= 0 && loopDurationBeats > 0) {
        const currentLoopIndex = Math.floor(
          timeSinceStartBeats / loopDurationBeats,
        );

        // Check if we're within valid loop count (0 means infinite loops)
        if (region.loopCount === 0 || currentLoopIndex < region.loopCount) {
          // We're in a valid loop - calculate position within this loop
          const positionInLoop = timeSinceStartBeats % loopDurationBeats;
          isInRegion =
            positionInLoop >= 0 && positionInLoop < loopDurationBeats;
        }
      }
    } else {
      // Single play region - use original logic
      const endPos = addMusicalTime(startPos, duration);
      isInRegion =
        compareMusicalPositions(currentPosition, startPos) >= 0 &&
        compareMusicalPositions(currentPosition, endPos) < 0;
    }

    if (!isInRegion) {
      // Clean up if we've moved past this region
      if (scheduledRegion) {
        this.activeRegions.delete(regionKey);
      }
      return;
    }

    // Initialize scheduled region if not exists
    if (!scheduledRegion) {
      const events = this.convertRegionToEvents(region);

      // Calculate the start time in seconds for this region
      const startPosSeconds = musicalPositionToSeconds(
        startPos,
        this.transport?.getTempo() || 120,
        { numerator: 4, denominator: 4 },
      );

      // Calculate which loop we should be in based on current position
      let initialLoop = 0;
      if (region.loopCount === 0 || region.loopCount > 1) {
        const timeSinceStart = subtractMusicalTime(currentPosition, startPos);
        const loopDurationBeats = this.musicalPositionToBeats(duration);
        const timeSinceStartBeats = this.musicalPositionToBeats(timeSinceStart);

        if (timeSinceStartBeats >= 0 && loopDurationBeats > 0) {
          initialLoop = Math.floor(timeSinceStartBeats / loopDurationBeats);
          if (region.loopCount > 0) {
            initialLoop = Math.min(initialLoop, region.loopCount - 1);
          }
        }
      }

      scheduledRegion = {
        region,
        trackId,
        nextEventIndex: 0,
        events,
        lastScheduledTime: currentTime,
        currentLoop: initialLoop,
        loopStartTime: startPosSeconds,
      };
      this.activeRegions.set(regionKey, scheduledRegion);
      this.logger.info(
        `🎵 Activated region ${regionKey} with ${scheduledRegion.events.length} events, starting at ${startPosSeconds.toFixed(3)}s, loop ${initialLoop + 1}`,
      );
    }

    // Schedule events within lookahead window
    this.scheduleEventsInWindow(scheduledRegion, currentTime, scheduleUntil);
  }

  /**
   * Convert region content to schedulable events
   */
  private convertRegionToEvents(region: Region): SchedulableEvent[] {
    // Handle both pattern and patterns format
    const pattern = region.pattern || (region.patterns && region.patterns[0]);

    if (pattern) {
      const startPos = region.startPosition || `0:${region.startTime || 0}:0`;
      const events = PatternConverter.patternToEvents(
        pattern,
        startPos,
        region.trackId,
      );
      this.logger.info(
        `🎵 Converted pattern to ${events.length} events for region ${region.id}`,
      );
      // Log first few events for debugging
      if (events.length > 0) {
        this.logger.info(
          `🎵 First event details: time=${events[0].time}, metadata=${JSON.stringify(events[0].metadata)}`,
        );
      }
      return events;
    } else if (region.midiEvents) {
      const events = this.midiEventsToSchedulableEvents(
        region.midiEvents,
        region.startPosition,
      );
      this.logger.info(
        `🎵 Converted ${events.length} MIDI events for region ${region.id}`,
      );
      return events;
    }
    this.logger.warn(`⚠️ Region ${region.id} has no pattern or MIDI events`);
    return [];
  }

  /**
   * Convert MIDI events to schedulable events
   */
  private midiEventsToSchedulableEvents(
    midiEvents: MidiEvent[],
    startPosition: MusicalPosition,
  ): SchedulableEvent[] {
    return midiEvents.map((event) => ({
      time: addMusicalTime(startPosition, event.time),
      callback: (time: number) => {
        if (this.eventBus) {
          this.eventBus.emit('midi-event', {
            event,
            audioTime: time,
            timestamp: Date.now(),
          });
        }
      },
      priority: 'high',
      metadata: {
        type: 'midi',
        midiEvent: event,
      },
    }));
  }

  /**
   * Schedule events within the lookahead window
   */
  private scheduleEventsInWindow(
    scheduledRegion: ScheduledRegion,
    currentTime: number,
    scheduleUntil: number,
  ): void {
    const events = scheduledRegion.events;
    const tempo = this.transport?.getTempo() || 120;
    const timeSignature = { numerator: 4, denominator: 4 }; // Default, should come from track
    const region = scheduledRegion.region;
    const regionDurationSeconds = musicalPositionToSeconds(
      region.duration,
      tempo,
      timeSignature,
    );

    // Update current loop based on current time if we're in a looping region
    if (
      region.loopCount !== 1 &&
      scheduledRegion.nextEventIndex >= events.length
    ) {
      // Calculate which loop we should be in based on current time
      const timeElapsed = currentTime - scheduledRegion.loopStartTime;
      const expectedLoop = Math.floor(timeElapsed / regionDurationSeconds);

      // Check if we should advance to next loop
      if (region.loopCount === 0 || expectedLoop < region.loopCount) {
        if (expectedLoop > scheduledRegion.currentLoop) {
          // Advance to next loop
          scheduledRegion.currentLoop = expectedLoop;
          scheduledRegion.nextEventIndex = 0;

          this.logger.info(
            `🎵 Advanced to loop ${scheduledRegion.currentLoop + 1}/${region.loopCount || 'infinite'} for region ${region.id} at time ${currentTime.toFixed(3)}s`,
          );
        } else {
          // We've finished all events in current loop but it's not time for next loop yet
          return;
        }
      } else {
        // Looping complete
        this.logger.info(
          `🎵 Looping complete for region ${region.id} after ${region.loopCount} iterations`,
        );
        return;
      }
    }

    // Binary search optimization for large event lists
    // Skip this during looping as it doesn't account for loop offset
    if (
      scheduledRegion.nextEventIndex === 0 &&
      events.length > 100 &&
      scheduledRegion.currentLoop === 0
    ) {
      scheduledRegion.nextEventIndex = this.findFirstEventIndex(
        events,
        currentTime,
        tempo,
        timeSignature,
      );
    }

    // Process events from nextEventIndex
    const maxEventsPerCycle = 50; // Prevent blocking with too many events
    let eventsProcessed = 0;

    // Log when starting to process events for a loop or for debugging
    if (scheduledRegion.currentLoop >= 0 && eventsProcessed === 0) {
      this.logger.info(
        `🎵 Processing events for loop ${scheduledRegion.currentLoop + 1}: nextIndex=${scheduledRegion.nextEventIndex}, totalEvents=${events.length}, currentTime=${currentTime.toFixed(3)}, scheduleUntil=${scheduleUntil.toFixed(3)}`,
      );
    }

    while (
      scheduledRegion.nextEventIndex < events.length &&
      eventsProcessed < maxEventsPerCycle
    ) {
      const event = events[scheduledRegion.nextEventIndex];

      // Calculate event time relative to pattern start
      // Defensive check - ensure event.time is in correct format
      if (typeof event.time !== 'string') {
        this.logger.warn(
          `⚠️ Event time is not a string for region ${region.id}:`,
          {
            eventTime: event.time,
            eventTimeType: typeof event.time,
            eventMetadata: event.metadata,
          },
        );
      }

      const eventRelativeTime = musicalPositionToSeconds(
        event.time,
        tempo,
        timeSignature,
      );

      // Calculate absolute time considering current loop iteration
      // loopStartTime is the base time when the first loop started
      // Add the duration of all completed loops plus the relative time within current loop
      const loopOffset = regionDurationSeconds * scheduledRegion.currentLoop;
      const eventAbsoluteTime =
        scheduledRegion.loopStartTime + loopOffset + eventRelativeTime;

      // Check if event is within lookahead window
      if (eventAbsoluteTime > scheduleUntil) {
        break; // Event is too far in the future
      }

      // Check if event has already passed
      // Special handling for events at the very start (time 0)
      if (eventAbsoluteTime === 0 && currentTime < 0.1) {
        // Schedule events at time 0 immediately when we're just starting
        this.logger.info(`🎵 Scheduling event at time 0 immediately`);
      } else if (eventAbsoluteTime < currentTime - 0.005) {
        // 5ms tolerance for past events
        this.logger.warn(
          `⚠️ Missed event at time=${eventAbsoluteTime.toFixed(3)}, currentTime=${currentTime.toFixed(3)}`,
        );
        this.metrics.missedEvents++;
        scheduledRegion.nextEventIndex++;
        eventsProcessed++;
        continue;
      }

      // Schedule the event with priority handling
      if (this.transport) {
        // Round schedule time to nearest timing precision for accuracy
        const scheduleTime =
          Math.round(
            Math.max(eventAbsoluteTime, currentTime) / this.timingPrecision,
          ) * this.timingPrecision;

        // Use UnifiedTransport's scheduleEvent method instead of scheduleOnce
        this.transport.scheduleEvent({
          time: scheduleTime,
          callback: (time: number) => {
            try {
              this.logger.debug(
                `🎵 Executing event callback at time=${time.toFixed(3)}, metadata=${JSON.stringify(event.metadata)}`,
              );
              event.callback(time);
            } catch (error) {
              this.logger.error(`Event callback error at ${time}:`, error);
              this.metrics.missedEvents++;
            }
          },
          priority: event.priority || 'normal',
        });

        this.metrics.scheduledEvents++;

        // Log first few scheduled events for debugging
        if (
          this.metrics.scheduledEvents <= 10 ||
          scheduledRegion.currentLoop > 0
        ) {
          this.logger.info(
            `🎵 Scheduled event #${this.metrics.scheduledEvents} (loop ${scheduledRegion.currentLoop + 1}): type=${event.metadata?.type}, time=${scheduleTime.toFixed(3)}, relativeTime=${eventRelativeTime.toFixed(3)}, loopOffset=${loopOffset.toFixed(3)}, baseTime=${scheduledRegion.loopStartTime.toFixed(3)}`,
          );
        }
      }

      scheduledRegion.nextEventIndex++;
      eventsProcessed++;
    }

    scheduledRegion.lastScheduledTime = scheduleUntil;
  }

  /**
   * Binary search to find first event index after given time
   */
  private findFirstEventIndex(
    events: SchedulableEvent[],
    targetTime: number,
    tempo: number,
    timeSignature: { numerator: number; denominator: number },
  ): number {
    let left = 0;
    let right = events.length - 1;
    let result = 0;

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const eventTime = musicalPositionToSeconds(
        events[mid].time,
        tempo,
        timeSignature,
      );

      if (eventTime < targetTime) {
        left = mid + 1;
      } else {
        result = mid;
        right = mid - 1;
      }
    }

    return result;
  }

  /**
   * Handle transport state changes
   */
  private handleTransportStateChange(event: any): void {
    // For transport:start, stop, pause events
    const eventType = event.type || '';

    if (eventType.includes('stop')) {
      // Clear all active regions on stop
      this.activeRegions.clear();
      this.logger.debug('Cleared active regions on transport stop');
    } else if (eventType.includes('start')) {
      // Reset metrics on start
      this.metrics = {
        scheduledEvents: 0,
        missedEvents: 0,
        avgLatency: 0,
        cpuUsage: 0,
      };
    }
  }

  /**
   * Handle transport stop event
   */
  private handleTransportStop = (): void => {
    // Clear all active regions on stop
    this.activeRegions.clear();
    this.logger.debug('Cleared active regions on transport stop');
  };

  /**
   * Handle transport start event
   */
  private handleTransportStart = (): void => {
    // Reset metrics on start
    this.metrics = {
      scheduledEvents: 0,
      missedEvents: 0,
      avgLatency: 0,
      cpuUsage: 0,
    };
    this.logger.info('🎵 PatternScheduler: Transport started!', {
      trackRegionsCount: this.trackRegions.size,
      isRunning: this.isRunning,
    });
  };

  /**
   * Handle track regions update
   */
  private handleTrackRegionsUpdate(event: any): void {
    const { trackId, regions } = event;

    this.logger.info(`🎵 PatternScheduler: Received track-regions-updated`, {
      trackId,
      regionsCount: regions?.length || 0,
      isRunning: this.isRunning,
      hasEventBus: !!this.eventBus,
      hasTransport: !!this.transport,
      trackRegionsSize: this.trackRegions.size,
    });

    // Log the first region details for debugging
    if (regions && regions.length > 0) {
      this.logger.info(`🎵 PatternScheduler: First region details`, {
        region: regions[0],
        hasPattern: !!regions[0].pattern,
        hasPatterns: !!regions[0].patterns,
        startPosition: regions[0].startPosition,
        startTime: regions[0].startTime,
        duration: regions[0].duration,
      });
    }

    if (regions && regions.length > 0) {
      this.trackRegions.set(trackId, regions);
      this.logger.info(
        `🎵 PatternScheduler: Stored ${regions.length} regions for track ${trackId}`,
      );
    } else {
      this.trackRegions.delete(trackId);
      this.logger.info(
        `🎵 PatternScheduler: Removed regions for track ${trackId}`,
      );
    }

    // Clean up active regions for this track
    let cleanedCount = 0;
    for (const [key, scheduledRegion] of this.activeRegions) {
      if (scheduledRegion.trackId === trackId) {
        this.activeRegions.delete(key);
        cleanedCount++;
      }
    }

    this.logger.info(
      `🎵 PatternScheduler: Updated regions for track ${trackId}`,
      {
        storedRegions: regions?.length || 0,
        cleanedActiveRegions: cleanedCount,
        totalTracksWithRegions: this.trackRegions.size,
        allTrackIds: Array.from(this.trackRegions.keys()),
      },
    );
  }

  /**
   * Update performance metrics
   */
  private updateMetrics(): void {
    // Simple CPU usage estimation based on active regions
    const activeCount = this.activeRegions.size;
    this.metrics.cpuUsage = Math.min(activeCount * 5, 100); // Rough estimate

    // Calculate average latency (placeholder for now)
    if (this.metrics.scheduledEvents > 0) {
      this.metrics.avgLatency = 0.5; // Placeholder value in ms
    }
  }

  /**
   * Handle region looping
   */
  private handleRegionLoop(
    region: Region,
    currentPosition: MusicalPosition,
  ): MusicalPosition | null {
    if (region.loopCount === 0) {
      // Infinite loop - always restart
      return region.startPosition;
    }

    // Calculate how many times the region has played
    const regionDuration = region.duration;
    const timeSinceStart = subtractMusicalTime(
      currentPosition,
      region.startPosition,
    );
    const loopsCompleted = Math.floor(
      this.musicalPositionToLoopCount(timeSinceStart, regionDuration),
    );

    if (loopsCompleted < region.loopCount) {
      // Still within loop count
      return addMusicalTime(
        region.startPosition,
        this.multiplyMusicalTime(regionDuration, loopsCompleted),
      );
    }

    // Loop count exceeded
    return null;
  }

  /**
   * Convert musical position to loop count
   */
  private musicalPositionToLoopCount(
    position: MusicalPosition,
    loopDuration: MusicalPosition,
  ): number {
    const positionBeats = this.musicalPositionToBeats(position);
    const durationBeats = this.musicalPositionToBeats(loopDuration);

    return durationBeats > 0 ? positionBeats / durationBeats : 0;
  }

  /**
   * Convert musical position to total beats
   */
  private musicalPositionToBeats(position: MusicalPosition): number {
    const parsed = parseMusicalPosition(position);
    return parsed.bar * 4 + parsed.beat + parsed.sixteenth / 4;
  }

  /**
   * Multiply musical time by a factor
   */
  private multiplyMusicalTime(
    position: MusicalPosition,
    factor: number,
  ): MusicalPosition {
    const totalBeats = this.musicalPositionToBeats(position) * factor;
    const bars = Math.floor(totalBeats / 4);
    const remainingBeats = totalBeats % 4;
    const beats = Math.floor(remainingBeats);
    const sixteenths = Math.round((remainingBeats - beats) * 4);

    return toMusicalPosition(bars, beats, sixteenths);
  }

  /**
   * Register track regions with the scheduler
   */
  registerTrack(trackId: string, regions: Region[]): void {
    this.trackRegions.set(trackId, regions);
    this.logger.info(
      `🎵 Registered ${regions.length} regions for track ${trackId}`,
    );
    regions.forEach((region) => {
      this.logger.info(
        `  - Region ${region.id}: start=${JSON.stringify(region.startPosition)}, duration=${JSON.stringify(region.duration)}, muted=${region.muted}`,
      );
    });
  }

  /**
   * Unregister track from scheduler
   */
  unregisterTrack(trackId: string): void {
    this.trackRegions.delete(trackId);

    // Clean up active regions
    for (const [key, scheduledRegion] of this.activeRegions) {
      if (scheduledRegion.trackId === trackId) {
        this.activeRegions.delete(key);
      }
    }

    this.logger.debug(`Unregistered track ${trackId}`);
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): typeof this.metrics {
    return { ...this.metrics };
  }
}

/**
 * Internal interfaces
 */
interface ScheduledRegion {
  region: Region;
  trackId: string;
  nextEventIndex: number;
  events: SchedulableEvent[];
  lastScheduledTime: number;
  currentLoop: number;
  loopStartTime: number; // Absolute time when current loop started
}
