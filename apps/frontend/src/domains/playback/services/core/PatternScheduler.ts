import { Service, type ServiceConfig, type HealthCheckResult } from './ServiceRegistry.js';
import { UnifiedTransport } from './UnifiedTransport.js';
import { EventBus } from './EventBus.js';
import type { Region, MidiEvent } from '../../types/region.js';
import type { Pattern } from '../../types/pattern.js';
import type { MusicalPosition, TimingEvent } from '../../types/timing.js';
import { PlaybackError, ErrorSeverity } from '../errors/base.js';
import { compareMusicalPositions, addMusicalTime, musicalPositionToSeconds, subtractMusicalTime } from '../../utils/regionUtils.js';
import { PatternConverter, type SchedulableEvent } from './PatternConverter.js';
import { parseMusicalPosition, toMusicalPosition } from '../../types/pattern.js';

/**
 * Professional DAW-style pattern scheduler
 * Connects track regions to UnifiedTransport with sample-accurate timing
 */
export class PatternScheduler implements Service {
  private transport: UnifiedTransport | null = null;
  private eventBus: EventBus | null = null;
  
  // Region management
  private trackRegions = new Map<string, Region[]>();
  private activeRegions = new Map<string, ScheduledRegion>();
  
  // Scheduling configuration
  private readonly lookaheadTime = 0.2; // 200ms - matches UnifiedTransport
  private readonly scheduleInterval = 0.00267; // 2.67ms - matches transport
  
  // Performance tracking
  private metrics = {
    scheduledEvents: 0,
    missedEvents: 0,
    avgLatency: 0,
    cpuUsage: 0
  };

  // Service state
  private isInitialized = false;
  private isRunning = false;
  private positionUpdateListener: ((position: any) => void) | null = null;
  private stateChangeListener: ((state: any) => void) | null = null;
  private regionUpdateListener: ((data: any) => void) | null = null;

  // Logger placeholder
  private logger = {
    info: (msg: string) => console.log(`[PatternScheduler] ${msg}`),
    debug: (msg: string) => console.debug(`[PatternScheduler] ${msg}`),
    error: (msg: string, error?: any) => console.error(`[PatternScheduler] ${msg}`, error),
    warn: (msg: string) => console.warn(`[PatternScheduler] ${msg}`)
  };

  constructor() {
    // Service will be initialized through initialize() method
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Get transport instance
      this.transport = UnifiedTransport.getInstance();
      this.eventBus = EventBus.getInstance();
      
      // Create bound listeners
      this.positionUpdateListener = this.processScheduling.bind(this);
      this.stateChangeListener = this.handleTransportStateChange.bind(this);
      this.regionUpdateListener = this.handleTrackRegionsUpdate.bind(this);
      
      // Subscribe to transport updates
      this.transport.on('position-update', this.positionUpdateListener);
      this.transport.on('state-change', this.stateChangeListener);
      
      // Subscribe to track changes
      this.eventBus.on('track-regions-updated', this.regionUpdateListener);
      
      this.isInitialized = true;
      this.logger.info('PatternScheduler initialized successfully');
    } catch (error) {
      throw new PlaybackError(
        'Failed to initialize PatternScheduler',
        ErrorSeverity.HIGH,
        'SCHEDULER_INIT_FAILED',
        { error }
      );
    }
  }

  async start(): Promise<void> {
    if (!this.isInitialized) {
      throw new PlaybackError(
        'PatternScheduler not initialized',
        ErrorSeverity.HIGH,
        'SCHEDULER_NOT_INITIALIZED'
      );
    }
    
    this.isRunning = true;
    this.logger.info('PatternScheduler started');
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
    if (this.transport && this.positionUpdateListener) {
      this.transport.off('position-update', this.positionUpdateListener);
    }
    if (this.transport && this.stateChangeListener) {
      this.transport.off('state-change', this.stateChangeListener);
    }
    if (this.eventBus && this.regionUpdateListener) {
      this.eventBus.off('track-regions-updated', this.regionUpdateListener);
    }
    
    // Clear all data
    this.trackRegions.clear();
    this.activeRegions.clear();
    
    this.transport = null;
    this.eventBus = null;
    this.isInitialized = false;
    
    this.logger.info('PatternScheduler disposed');
  }

  async healthCheck(): Promise<HealthCheckResult> {
    const healthy = this.isInitialized && 
                   this.transport !== null && 
                   this.eventBus !== null &&
                   this.metrics.cpuUsage < 80;

    return {
      status: healthy ? 'healthy' : 'unhealthy',
      message: healthy ? 'PatternScheduler is operating normally' : 'PatternScheduler has issues',
      details: {
        isInitialized: this.isInitialized,
        isRunning: this.isRunning,
        trackCount: this.trackRegions.size,
        activeRegions: this.activeRegions.size,
        metrics: this.metrics
      },
      timestamp: Date.now()
    };
  }

  getConfig(): ServiceConfig {
    return {
      lookaheadTime: this.lookaheadTime,
      scheduleInterval: this.scheduleInterval,
      isRunning: this.isRunning
    };
  }

  /**
   * Core scheduling logic - called every 2.67ms by transport
   */
  private processScheduling(event: any): void {
    if (!this.isRunning || !this.transport) return;

    const position = event.position;
    const currentTime = event.audioTime;
    const scheduleUntil = currentTime + this.lookaheadTime;
    
    try {
      // Process each track's regions
      for (const [trackId, regions] of this.trackRegions) {
        for (const region of regions) {
          if (!region.muted) {
            this.scheduleRegion(trackId, region, currentTime, scheduleUntil, position);
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
    currentPosition: MusicalPosition
  ): void {
    const regionKey = `${trackId}-${region.id}`;
    let scheduledRegion = this.activeRegions.get(regionKey);
    
    // Check if current position is within region bounds
    const regionEnd = addMusicalTime(region.startPosition, region.duration);
    const isInRegion = compareMusicalPositions(currentPosition, region.startPosition) >= 0 &&
                      compareMusicalPositions(currentPosition, regionEnd) < 0;
    
    if (!isInRegion) {
      // Clean up if we've moved past this region
      if (scheduledRegion) {
        this.activeRegions.delete(regionKey);
      }
      return;
    }
    
    // Initialize scheduled region if not exists
    if (!scheduledRegion) {
      scheduledRegion = {
        region,
        trackId,
        nextEventIndex: 0,
        events: this.convertRegionToEvents(region),
        lastScheduledTime: currentTime
      };
      this.activeRegions.set(regionKey, scheduledRegion);
    }
    
    // Schedule events within lookahead window
    this.scheduleEventsInWindow(scheduledRegion, currentTime, scheduleUntil);
  }

  /**
   * Convert region content to schedulable events
   */
  private convertRegionToEvents(region: Region): SchedulableEvent[] {
    if (region.pattern) {
      return PatternConverter.patternToEvents(region.pattern, region.startPosition);
    } else if (region.midiEvents) {
      return this.midiEventsToSchedulableEvents(region.midiEvents, region.startPosition);
    }
    return [];
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
        if (this.eventBus) {
          this.eventBus.emit('midi-event', {
            event,
            audioTime: time,
            timestamp: Date.now()
          });
        }
      },
      priority: 'high',
      metadata: { 
        type: 'midi',
        midiEvent: event 
      }
    }));
  }

  /**
   * Schedule events within the lookahead window
   */
  private scheduleEventsInWindow(
    scheduledRegion: ScheduledRegion,
    currentTime: number,
    scheduleUntil: number
  ): void {
    const events = scheduledRegion.events;
    const tempo = this.transport?.getTempo() || 120;
    const timeSignature = { numerator: 4, denominator: 4 }; // Default, should come from track
    
    // Binary search optimization for large event lists
    if (scheduledRegion.nextEventIndex === 0 && events.length > 100) {
      scheduledRegion.nextEventIndex = this.findFirstEventIndex(events, currentTime, tempo, timeSignature);
    }
    
    // Process events from nextEventIndex
    const maxEventsPerCycle = 50; // Prevent blocking with too many events
    let eventsProcessed = 0;
    
    while (scheduledRegion.nextEventIndex < events.length && eventsProcessed < maxEventsPerCycle) {
      const event = events[scheduledRegion.nextEventIndex];
      const eventTimeInSeconds = musicalPositionToSeconds(event.time, tempo, timeSignature);
      
      // Check if event is within lookahead window
      if (eventTimeInSeconds > scheduleUntil) {
        break; // Event is too far in the future
      }
      
      // Check if event has already passed
      if (eventTimeInSeconds < currentTime - 0.005) { // 5ms tolerance for past events
        this.metrics.missedEvents++;
        scheduledRegion.nextEventIndex++;
        eventsProcessed++;
        continue;
      }
      
      // Schedule the event with priority handling
      if (this.transport) {
        const scheduleTime = Math.max(eventTimeInSeconds, currentTime);
        
        this.transport.scheduleOnce((time: number) => {
          try {
            event.callback(time);
          } catch (error) {
            this.logger.error(`Event callback error at ${time}:`, error);
            this.metrics.missedEvents++;
          }
        }, scheduleTime);
        
        this.metrics.scheduledEvents++;
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
    timeSignature: { numerator: number; denominator: number }
  ): number {
    let left = 0;
    let right = events.length - 1;
    let result = 0;
    
    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const eventTime = musicalPositionToSeconds(events[mid].time, tempo, timeSignature);
      
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
    const state = event.state;
    
    if (state === 'stopped') {
      // Clear all active regions on stop
      this.activeRegions.clear();
      this.logger.debug('Cleared active regions on transport stop');
    } else if (state === 'started') {
      // Reset metrics on start
      this.metrics = {
        scheduledEvents: 0,
        missedEvents: 0,
        avgLatency: 0,
        cpuUsage: 0
      };
    }
  }

  /**
   * Handle track regions update
   */
  private handleTrackRegionsUpdate(event: any): void {
    const { trackId, regions } = event;
    
    if (regions && regions.length > 0) {
      this.trackRegions.set(trackId, regions);
    } else {
      this.trackRegions.delete(trackId);
    }
    
    // Clean up active regions for this track
    for (const [key, scheduledRegion] of this.activeRegions) {
      if (scheduledRegion.trackId === trackId) {
        this.activeRegions.delete(key);
      }
    }
    
    this.logger.debug(`Updated regions for track ${trackId}: ${regions?.length || 0} regions`);
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
  private handleRegionLoop(region: Region, currentPosition: MusicalPosition): MusicalPosition | null {
    if (region.loopCount === 0) {
      // Infinite loop - always restart
      return region.startPosition;
    }
    
    // Calculate how many times the region has played
    const regionDuration = region.duration;
    const timeSinceStart = subtractMusicalTime(currentPosition, region.startPosition);
    const loopsCompleted = Math.floor(this.musicalPositionToLoopCount(timeSinceStart, regionDuration));
    
    if (loopsCompleted < region.loopCount) {
      // Still within loop count
      return addMusicalTime(region.startPosition, this.multiplyMusicalTime(regionDuration, loopsCompleted));
    }
    
    // Loop count exceeded
    return null;
  }
  
  /**
   * Convert musical position to loop count
   */
  private musicalPositionToLoopCount(position: MusicalPosition, loopDuration: MusicalPosition): number {
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
  private multiplyMusicalTime(position: MusicalPosition, factor: number): MusicalPosition {
    const totalBeats = this.musicalPositionToBeats(position) * factor;
    const bars = Math.floor(totalBeats / 4);
    const remainingBeats = totalBeats % 4;
    const beats = Math.floor(remainingBeats);
    const sixteenths = Math.round((remainingBeats - beats) * 4);
    
    return toMusicalPosition(bars, beats, sixteenths);
  }
  
  /**
   * Subtract musical positions (helper import from regionUtils)
   */
  private subtractMusicalTime(pos1: MusicalPosition, pos2: MusicalPosition): MusicalPosition {
    const p1 = parseMusicalPosition(pos1);
    const p2 = parseMusicalPosition(pos2);
    
    const totalSixteenths1 = p1.bar * 16 + p1.beat * 4 + p1.sixteenth;
    const totalSixteenths2 = p2.bar * 16 + p2.beat * 4 + p2.sixteenth;
    
    const difference = totalSixteenths1 - totalSixteenths2;
    
    if (difference < 0) {
      return '0:0:0';
    }
    
    const bars = Math.floor(difference / 16);
    const remainingSixteenths = difference % 16;
    const beats = Math.floor(remainingSixteenths / 4);
    const sixteenths = remainingSixteenths % 4;
    
    return toMusicalPosition(bars, beats, sixteenths);
  }

  /**
   * Register track regions with the scheduler
   */
  registerTrack(trackId: string, regions: Region[]): void {
    this.trackRegions.set(trackId, regions);
    this.logger.debug(`Registered ${regions.length} regions for track ${trackId}`);
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
}