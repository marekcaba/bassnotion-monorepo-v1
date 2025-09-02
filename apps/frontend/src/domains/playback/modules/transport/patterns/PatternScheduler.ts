/**
 * Pattern Scheduler
 * 
 * Professional DAW-style pattern scheduler that connects track regions
 * to Transport with sample-accurate timing. Extracted from the original
 * PatternScheduler with all critical features preserved.
 */

import type { Transport } from '../core/Transport';
import type { EventBus } from '../../../../services/core/EventBus';
import type { Region } from '../../../types/region';
import type { Pattern } from '../../../types/pattern';
import type { MusicalPosition } from '../types';
import { RegionManager } from './RegionManager';
import { EventScheduler } from './EventScheduler';
import { PatternConverter } from './PatternConverter';
import type {
  IPatternScheduler,
  PatternSchedulerConfig,
  PatternSchedulingMetrics,
  ScheduledRegion,
  SchedulableEvent,
  EventSchedulingResult,
} from './types';
import { PlaybackError, ErrorSeverity } from '../../../../errors/base';
import { createStructuredLogger } from '@bassnotion/contracts';

const logger = createStructuredLogger('PatternScheduler');

export class PatternScheduler implements IPatternScheduler {
  private static instance: PatternScheduler | null = null;
  
  // Configuration
  private config: PatternSchedulerConfig = {
    lookaheadTime: 0.2,              // 200ms - matches UnifiedTransport
    scheduleInterval: 0.00267,       // 2.67ms - matches transport
    timingPrecision: 0.001,          // 1ms precision for scheduling
    maxEventsPerCycle: 50,           // Prevent blocking with too many events
    binarySearchThreshold: 100,      // Use binary search for large patterns
  };
  
  // Core components
  private regionManager: RegionManager;
  private eventScheduler: EventScheduler;
  private patternConverter: PatternConverter;
  
  // Dependencies
  private transport: Transport | null = null;
  private eventBus: EventBus | null = null;
  
  // Performance tracking
  private metrics: PatternSchedulingMetrics = {
    scheduledEvents: 0,
    missedEvents: 0,
    avgLatency: 0,
    cpuUsage: 0,
    activeRegions: 0,
    totalTracks: 0,
  };
  
  // Service state
  private isInitialized = false;
  private isRunning = false;
  
  // Event listeners
  private eventUnsubscribers: Array<() => void> = [];
  
  private constructor() {
    this.regionManager = new RegionManager();
    this.patternConverter = new PatternConverter();
    
    // Event scheduler will be created after transport is available
  }
  
  /**
   * Get singleton instance
   */
  static getInstance(): PatternScheduler {
    if (!PatternScheduler.instance) {
      PatternScheduler.instance = new PatternScheduler();
    }
    return PatternScheduler.instance;
  }
  
  /**
   * Initialize with dependencies
   */
  async initialize(transport: Transport, eventBus: EventBus): Promise<void> {
    if (this.isInitialized) return;
    
    this.transport = transport;
    this.eventBus = eventBus;
    
    // Create event scheduler with dependencies
    this.eventScheduler = new EventScheduler(
      this.config,
      transport,
      this.handleEventScheduled.bind(this),
      this.handleEventMissed.bind(this)
    );
    
    // Set up event listeners
    this.setupEventListeners();
    
    this.isInitialized = true;
    logger.info('PatternScheduler initialized with early event subscription');
  }
  
  /**
   * Start the scheduler
   */
  async start(): Promise<void> {
    if (!this.isInitialized) {
      throw new PlaybackError(
        'PatternScheduler not initialized',
        ErrorSeverity.HIGH,
        'SCHEDULER_NOT_INITIALIZED'
      );
    }
    
    this.isRunning = true;
    
    // Request tracks to re-emit their regions
    if (this.eventBus) {
      logger.info('Requesting tracks to re-emit regions...');
      this.eventBus.emit('pattern-scheduler:request-regions', {
        schedulerId: 'main',
      });
    }
    
    logger.info('PatternScheduler started');
  }
  
  /**
   * Stop the scheduler
   */
  async stop(): Promise<void> {
    this.isRunning = false;
    this.regionManager.clearActiveRegions();
    logger.info('PatternScheduler stopped');
  }
  
  /**
   * Dispose of the scheduler
   */
  async dispose(): Promise<void> {
    await this.stop();
    
    // Unsubscribe from events
    this.eventUnsubscribers.forEach(unsub => unsub());
    this.eventUnsubscribers = [];
    
    this.transport = null;
    this.eventBus = null;
    this.isInitialized = false;
    
    // Clear singleton
    PatternScheduler.instance = null;
    
    logger.info('PatternScheduler disposed');
  }
  
  /**
   * Register track regions
   */
  registerTrack(trackId: string, regions: Region[]): void {
    this.regionManager.registerTrack(trackId, regions);
    this.updateMetrics();
  }
  
  /**
   * Unregister track
   */
  unregisterTrack(trackId: string): void {
    this.regionManager.unregisterTrack(trackId);
    this.updateMetrics();
  }
  
  /**
   * Update track regions
   */
  updateTrackRegions(trackId: string, regions: Region[]): void {
    this.regionManager.updateTrackRegions(trackId, regions);
    this.updateMetrics();
  }
  
  /**
   * Get active regions
   */
  getActiveRegions(): Map<string, ScheduledRegion> {
    return this.regionManager.getActiveRegions();
  }
  
  /**
   * Get performance metrics
   */
  getMetrics(): PatternSchedulingMetrics {
    return { ...this.metrics };
  }
  
  /**
   * Update configuration
   */
  updateConfig(config: Partial<PatternSchedulerConfig>): void {
    Object.assign(this.config, config);
    this.eventScheduler?.updateConfig(config);
  }
  
  /**
   * Get configuration
   */
  getConfig(): PatternSchedulerConfig {
    return { ...this.config };
  }
  
  /**
   * Set up event listeners
   */
  private setupEventListeners(): void {
    if (!this.eventBus) return;
    
    // Transport timing updates for scheduling
    const unsubTiming = this.eventBus.on('transport:timing-update', (event) => {
      this.processScheduling(event);
    });
    
    // Transport state changes
    const unsubStart = this.eventBus.on('transport:start', () => {
      this.handleTransportStart();
    });
    
    const unsubStop = this.eventBus.on('transport:stop', () => {
      this.handleTransportStop();
    });
    
    // Track region updates
    const unsubRegions = this.eventBus.on('track-regions-updated', (event) => {
      this.handleTrackRegionsUpdate(event);
    });
    
    this.eventUnsubscribers = [unsubTiming, unsubStart, unsubStop, unsubRegions];
  }
  
  /**
   * Core scheduling logic - called every 2.67ms by transport
   */
  private processScheduling(event: any): void {
    if (!this.isRunning || !this.transport) return;
    
    const position = event.position;
    const currentTime = event.time || 0;
    const scheduleUntil = currentTime + this.config.lookaheadTime;
    
    // Convert position to standard format
    const musicalPosition = this.normalizeMusicalPosition(position);
    
    try {
      // Process each track's regions
      const trackRegions = this.regionManager.getRegisteredTracks();
      
      for (const trackId of trackRegions) {
        const regions = this.regionManager.getTrackRegions(trackId);
        
        for (const region of regions) {
          if (!region.muted) {
            this.scheduleRegion(
              trackId,
              region,
              currentTime,
              scheduleUntil,
              musicalPosition
            );
          }
        }
      }
      
      this.updateMetrics();
    } catch (error) {
      logger.error('Scheduling error:', error);
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
    if (!this.transport) return;
    
    const regionKey = this.regionManager.createRegionKey(trackId, region.id);
    let scheduledRegion = this.regionManager.getActiveRegion(regionKey);
    
    // Check if current position is within region bounds
    const positionCheck = this.regionManager.isPositionInRegion(
      region,
      currentPosition,
      this.transport.getTempo()
    );
    
    if (!positionCheck.isInRegion) {
      // Clean up if we've moved past this region
      if (scheduledRegion) {
        this.regionManager.removeActiveRegion(regionKey);
      }
      return;
    }
    
    // Initialize scheduled region if needed
    if (!scheduledRegion) {
      scheduledRegion = this.createScheduledRegion(
        trackId,
        region,
        currentTime,
        positionCheck.loopIteration || 0
      );
      
      this.regionManager.setActiveRegion(regionKey, scheduledRegion);
      
      logger.info(
        `Activated region ${regionKey} with ${scheduledRegion.events.length} events, loop ${positionCheck.loopIteration || 0 + 1}`
      );
    }
    
    // Schedule events within lookahead window
    this.eventScheduler.scheduleEventsInWindow(
      scheduledRegion,
      currentTime,
      scheduleUntil
    );
  }
  
  /**
   * Create a new scheduled region
   */
  private createScheduledRegion(
    trackId: string,
    region: Region,
    currentTime: number,
    initialLoop: number
  ): ScheduledRegion {
    const events = this.patternConverter.convertRegionToEvents(region);
    
    // Calculate region start time
    const startPos = region.startPosition || `0:${region.startTime || 0}:0`;
    const startPosSeconds = this.transport ? 
      this.musicalPositionToSeconds(startPos, this.transport.getTempo()) : 0;
    
    return {
      region,
      trackId,
      nextEventIndex: 0,
      events,
      lastScheduledTime: currentTime,
      currentLoop: initialLoop,
      loopStartTime: startPosSeconds,
    };
  }
  
  /**
   * Handle transport start
   */
  private handleTransportStart(): void {
    // Reset metrics on start
    this.metrics = {
      scheduledEvents: 0,
      missedEvents: 0,
      avgLatency: 0,
      cpuUsage: 0,
      activeRegions: 0,
      totalTracks: 0,
    };
    
    this.eventScheduler?.resetStats();
    
    logger.info('Transport started - metrics reset');
  }
  
  /**
   * Handle transport stop
   */
  private handleTransportStop(): void {
    this.regionManager.clearActiveRegions();
    logger.info('Transport stopped - cleared active regions');
  }
  
  /**
   * Handle track regions update
   */
  private handleTrackRegionsUpdate(event: any): void {
    const { trackId, regions } = event;
    
    logger.info(`Received track-regions-updated for ${trackId} with ${regions?.length || 0} regions`);
    
    if (regions && regions.length > 0) {
      this.regionManager.updateTrackRegions(trackId, regions);
    } else {
      this.regionManager.unregisterTrack(trackId);
    }
    
    this.updateMetrics();
  }
  
  /**
   * Handle successful event scheduling
   */
  private handleEventScheduled(result: EventSchedulingResult): void {
    if (result.success) {
      this.metrics.scheduledEvents++;
      this.metrics.avgLatency = (this.metrics.avgLatency + result.latency) / 2;
    } else {
      this.metrics.missedEvents++;
    }
  }
  
  /**
   * Handle missed event
   */
  private handleEventMissed(data: any): void {
    this.metrics.missedEvents++;
    
    if (this.eventBus) {
      this.eventBus.emit('pattern:eventMissed', data);
    }
  }
  
  /**
   * Normalize musical position to standard format
   */
  private normalizeMusicalPosition(position: any): MusicalPosition {
    if (typeof position === 'object' && position !== null && 'bars' in position) {
      return `${position.bars || 0}:${position.beats || 0}:${position.sixteenths || 0}`;
    } else if (typeof position === 'string') {
      return position;
    }
    
    // Default position if invalid
    return '0:0:0';
  }
  
  /**
   * Convert musical position to seconds
   */
  private musicalPositionToSeconds(position: MusicalPosition, tempo: number): number {
    const timeSignature = { numerator: 4, denominator: 4 };
    
    // Parse position
    const parts = position.split(':');
    const bars = parseInt(parts[0] || '0', 10);
    const beats = parseInt(parts[1] || '0', 10);
    const sixteenths = parseInt(parts[2] || '0', 10);
    
    const beatDuration = 60 / tempo;
    const totalBeats = bars * 4 + beats + sixteenths / 4;
    
    return totalBeats * beatDuration;
  }
  
  /**
   * Update performance metrics
   */
  private updateMetrics(): void {
    const regionStats = this.regionManager.getRegionStats();
    const schedulingStats = this.eventScheduler?.getSchedulingStats() || {
      scheduledEvents: 0,
      missedEvents: 0,
      successRate: 100,
      averageLatency: 0,
    };
    
    this.metrics = {
      scheduledEvents: schedulingStats.scheduledEvents,
      missedEvents: schedulingStats.missedEvents,
      avgLatency: schedulingStats.averageLatency,
      cpuUsage: Math.min(regionStats.activeRegions * 5, 100), // Rough estimate
      activeRegions: regionStats.activeRegions,
      totalTracks: regionStats.totalTracks,
    };
  }
}