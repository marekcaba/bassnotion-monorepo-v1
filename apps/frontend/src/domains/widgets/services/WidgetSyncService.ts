/**
 * Widget Synchronization Service
 *
 * Central event bus for widget communication and state synchronization.
 * Implements high-performance event throttling, batching, and monitoring
 * to ensure all widgets stay synchronized with <5ms overhead.
 *
 * Part of Story 3.6: Widget Synchronization
 * Task 3.6.1: Widget Synchronization Service
 */

import { EventEmitter } from 'events';

// ============================================================================
// SYNC EVENT INTERFACES
// ============================================================================

export interface WidgetSyncEvent {
  type:
    | 'PLAYBACK_STATE'
    | 'TIMELINE_UPDATE'
    | 'EXERCISE_CHANGE'
    | 'TEMPO_CHANGE'
    | 'VOLUME_CHANGE'
    | 'CUSTOM_BASSLINE';
  payload: any;
  timestamp: number;
  source: string;
  priority: 'low' | 'normal' | 'high' | 'critical';
}

export interface SyncState {
  playback: {
    isPlaying: boolean;
    currentTime: number;
    tempo: number;
    volume: number;
  };
  exercise: {
    selectedExercise?: any; // TODO: Import proper Exercise type
    customBassline?: any[]; // TODO: Import proper ExerciseNote[] type
  };
  ui: {
    masterVolume: number;
    activeWidget?: string;
  };
}

// ============================================================================
// PERFORMANCE MONITORING
// ============================================================================

export interface SyncPerformanceMetrics {
  totalEvents: number;
  throttledEvents: number;
  batchedEvents: number;
  averageLatency: number;
  maxLatency: number;
  eventQueue: number;
  droppedEvents: number;
  subscriberCount: number;
  lastUpdateTime: number;
}

export interface ThrottledEventConfig {
  eventType: string;
  throttleMs: number;
  batchSize: number;
  maxAge: number;
}

// ============================================================================
// WIDGET SYNC SERVICE
// ============================================================================

export class WidgetSyncService {
  private eventBus: EventEmitter;
  private throttledEvents: Map<
    string,
    {
      timer: NodeJS.Timeout | null;
      lastEvent: WidgetSyncEvent | null;
      queuedEvents: WidgetSyncEvent[];
    }
  >;

  private syncState: SyncState;
  private performanceMetrics: SyncPerformanceMetrics;
  private throttleConfigs: Map<string, ThrottledEventConfig>;

  // Performance monitoring
  private readonly PERFORMANCE_SAMPLE_SIZE = 100;
  private latencySamples: number[] = [];

  constructor() {
    this.eventBus = new EventEmitter();
    this.eventBus.setMaxListeners(50); // Allow many widget subscriptions

    this.throttledEvents = new Map();
    this.throttleConfigs = new Map();

    // Initialize default throttle configurations
    this.initializeThrottleConfigs();

    // Initialize sync state
    this.syncState = {
      playback: {
        isPlaying: false,
        currentTime: 0,
        tempo: 120,
        volume: 0.8,
      },
      exercise: {},
      ui: {
        masterVolume: 0.8,
      },
    };

    // Initialize performance metrics
    this.performanceMetrics = {
      totalEvents: 0,
      throttledEvents: 0,
      batchedEvents: 0,
      averageLatency: 0,
      maxLatency: 0,
      eventQueue: 0,
      droppedEvents: 0,
      subscriberCount: 0,
      lastUpdateTime: Date.now(),
    };
  }

  // ============================================================================
  // CORE EVENT METHODS
  // ============================================================================

  /**
   * Emit a synchronization event to all subscribed widgets
   */
  emit(event: WidgetSyncEvent): void {
    const startTime = performance.now();

    // Update performance metrics
    this.performanceMetrics.totalEvents++;
    this.performanceMetrics.lastUpdateTime = Date.now();

    // Check if event should be throttled
    if (this.shouldThrottleEvent(event)) {
      this.throttleEvent(event);
      return;
    }

    // Update sync state based on event
    this.updateSyncState(event);

    // Emit event to all subscribers
    this.eventBus.emit(event.type, event);
    this.eventBus.emit('*', event); // Global listener

    // Track performance
    const latency = performance.now() - startTime;
    this.updatePerformanceMetrics(latency);
  }

  /**
   * Subscribe to specific event type
   */
  subscribe(
    eventType: string,
    callback: (event: WidgetSyncEvent) => void,
  ): void {
    this.eventBus.on(eventType, callback);
    this.performanceMetrics.subscriberCount =
      this.eventBus.listenerCount(eventType);
  }

  /**
   * Subscribe to all events
   */
  subscribeToAll(callback: (event: WidgetSyncEvent) => void): void {
    this.eventBus.on('*', callback);
  }

  /**
   * Unsubscribe from event type
   */
  unsubscribe(
    eventType: string,
    callback: (event: WidgetSyncEvent) => void,
  ): void {
    this.eventBus.off(eventType, callback);
    this.performanceMetrics.subscriberCount =
      this.eventBus.listenerCount(eventType);
  }

  /**
   * Get current sync state (read-only)
   */
  getSyncState(): Readonly<SyncState> {
    return { ...this.syncState };
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): Readonly<SyncPerformanceMetrics> {
    return { ...this.performanceMetrics };
  }

  // ============================================================================
  // THROTTLING & BATCHING
  // ============================================================================

  private initializeThrottleConfigs(): void {
    // Timeline updates can be throttled more aggressively
    this.throttleConfigs.set('TIMELINE_UPDATE', {
      eventType: 'TIMELINE_UPDATE',
      throttleMs: 16, // ~60fps
      batchSize: 1,
      maxAge: 50,
    });

    // Tempo changes are less frequent but important
    this.throttleConfigs.set('TEMPO_CHANGE', {
      eventType: 'TEMPO_CHANGE',
      throttleMs: 0, // No throttling for immediate tempo updates
      batchSize: 1,
      maxAge: 0,
    });

    // Volume changes can be throttled
    this.throttleConfigs.set('VOLUME_CHANGE', {
      eventType: 'VOLUME_CHANGE',
      throttleMs: 50,
      batchSize: 1,
      maxAge: 100,
    });

    // Playback state changes should be immediate
    this.throttleConfigs.set('PLAYBACK_STATE', {
      eventType: 'PLAYBACK_STATE',
      throttleMs: 0, // No throttling
      batchSize: 1,
      maxAge: 0,
    });

    // Exercise changes should be immediate
    this.throttleConfigs.set('EXERCISE_CHANGE', {
      eventType: 'EXERCISE_CHANGE',
      throttleMs: 0, // No throttling
      batchSize: 1,
      maxAge: 0,
    });
  }

  private shouldThrottleEvent(event: WidgetSyncEvent): boolean {
    const config = this.throttleConfigs.get(event.type);
    return config ? config.throttleMs > 0 : false;
  }

  private throttleEvent(event: WidgetSyncEvent): void {
    const config = this.throttleConfigs.get(event.type);
    if (!config) return;

    const eventKey = `${event.type}_${event.source}`;
    let throttleData = this.throttledEvents.get(eventKey);

    if (!throttleData) {
      throttleData = {
        timer: null,
        lastEvent: null,
        queuedEvents: [],
      };
      this.throttledEvents.set(eventKey, throttleData);
    }

    // Add event to queue
    throttleData.queuedEvents.push(event);
    throttleData.lastEvent = event;

    // Clear existing timer
    if (throttleData.timer) {
      clearTimeout(throttleData.timer);
    }

    // Set new timer
    throttleData.timer = setTimeout(() => {
      this.processBatchedEvents(eventKey);
    }, config.throttleMs);

    this.performanceMetrics.throttledEvents++;
  }

  private processBatchedEvents(eventKey: string): void {
    const throttleData = this.throttledEvents.get(eventKey);
    if (!throttleData || !throttleData.lastEvent) return;

    // Process the most recent event (discarding older ones)
    const event = throttleData.lastEvent;

    // Update sync state
    this.updateSyncState(event);

    // Emit event
    this.eventBus.emit(event.type, event);
    this.eventBus.emit('*', event);

    // Update metrics
    this.performanceMetrics.batchedEvents += throttleData.queuedEvents.length;

    // Clean up
    throttleData.queuedEvents = [];
    throttleData.lastEvent = null;
    throttleData.timer = null;
  }

  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================

  private updateSyncState(event: WidgetSyncEvent): void {
    switch (event.type) {
      case 'PLAYBACK_STATE':
        if (event.payload.isPlaying !== undefined) {
          this.syncState.playback.isPlaying = event.payload.isPlaying;
        }
        if (event.payload.currentTime !== undefined) {
          this.syncState.playback.currentTime = event.payload.currentTime;
        }
        break;

      case 'TIMELINE_UPDATE':
        if (event.payload.currentTime !== undefined) {
          this.syncState.playback.currentTime = event.payload.currentTime;
        }
        break;

      case 'TEMPO_CHANGE':
        if (event.payload.tempo !== undefined) {
          this.syncState.playback.tempo = event.payload.tempo;
        }
        break;

      case 'VOLUME_CHANGE':
        if (event.payload.masterVolume !== undefined) {
          this.syncState.ui.masterVolume = event.payload.masterVolume;
        }
        if (event.payload.volume !== undefined) {
          this.syncState.playback.volume = event.payload.volume;
        }
        break;

      case 'EXERCISE_CHANGE':
        if (event.payload.exercise !== undefined) {
          this.syncState.exercise.selectedExercise = event.payload.exercise;
        }
        break;

      case 'CUSTOM_BASSLINE':
        if (event.payload.bassline !== undefined) {
          this.syncState.exercise.customBassline = event.payload.bassline;
        }
        break;
    }
  }

  // ============================================================================
  // PERFORMANCE MONITORING
  // ============================================================================

  private updatePerformanceMetrics(latency: number): void {
    // Track latency samples
    this.latencySamples.push(latency);
    if (this.latencySamples.length > this.PERFORMANCE_SAMPLE_SIZE) {
      this.latencySamples.shift();
    }

    // Update metrics
    this.performanceMetrics.averageLatency =
      this.latencySamples.reduce((sum, val) => sum + val, 0) /
      this.latencySamples.length;

    this.performanceMetrics.maxLatency = Math.max(
      this.performanceMetrics.maxLatency,
      latency,
    );

    // Check for performance warnings
    if (latency > 5.0) {
      // 5ms threshold from AC 3.6.4
      console.warn(`Widget sync latency exceeded 5ms: ${latency.toFixed(2)}ms`);
    }
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Reset all metrics
   */
  resetMetrics(): void {
    this.performanceMetrics = {
      totalEvents: 0,
      throttledEvents: 0,
      batchedEvents: 0,
      averageLatency: 0,
      maxLatency: 0,
      eventQueue: 0,
      droppedEvents: 0,
      subscriberCount: this.performanceMetrics.subscriberCount,
      lastUpdateTime: Date.now(),
    };
    this.latencySamples = [];
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    // Clear all throttled event timers
    this.throttledEvents.forEach((throttleData) => {
      if (throttleData.timer) {
        clearTimeout(throttleData.timer);
      }
    });

    // Clear maps
    this.throttledEvents.clear();
    this.throttleConfigs.clear();

    // Remove all listeners
    this.eventBus.removeAllListeners();
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

// Create singleton instance for application-wide use
export const widgetSyncService = new WidgetSyncService();

// Note: WidgetSyncService class is already exported above
