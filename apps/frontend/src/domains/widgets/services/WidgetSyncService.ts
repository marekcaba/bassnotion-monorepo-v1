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
import { createStructuredLogger } from '@bassnotion/contracts';

// Re-export shared types for backward compatibility
export type {
  WidgetSyncEvent,
  WidgetSyncEventType,
  WidgetSyncPriority,
} from '@/shared/types/widget-sync.types';

import type { WidgetSyncEvent } from '@/shared/types/widget-sync.types';

const logger = createStructuredLogger('WidgetSyncService');

// ============================================================================
// SYNC EVENT INTERFACES
// ============================================================================

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

  // Heartbeat mechanism to prevent sync timeout
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private readonly HEARTBEAT_INTERVAL_MS = 5000; // 5 seconds
  private positionUpdateInterval: NodeJS.Timeout | null = null;
  private readonly POSITION_UPDATE_INTERVAL_MS = 50; // 50ms for smooth updates

  private isConnecting = false;
  private isConnected = false;

  constructor() {
    this.eventBus = new EventEmitter();
    this.eventBus.setMaxListeners(100); // Allow many widget subscriptions - increased for complex pages

    this.throttledEvents = new Map();
    this.throttleConfigs = new Map();

    // Initialize default throttle configurations
    this.initializeThrottleConfigs();

    // Connect to EventBus from CoreServices (delay to ensure client-side only)
    if (typeof window !== 'undefined') {
      setTimeout(() => this.connectToEventBus(), 0);
    }

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

    // Debug log for PLAY/PAUSE/STOP events (disabled for performance)
    // if (event.type === 'PLAY' || event.type === 'PAUSE' || event.type === 'STOP') {
    //   logger.info(`🔄 WidgetSyncService: Received ${event.type} event from ${event.source}`);
    // }

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

    // Track performance only for non-position events to reduce overhead
    if (event.type !== 'POSITION' && event.type !== 'TIMELINE_UPDATE') {
      const latency = performance.now() - startTime;
      this.updatePerformanceMetrics(latency);
    }
  }

  /**
   * Subscribe to specific event type
   */
  subscribe(
    eventType: string,
    callback: (event: WidgetSyncEvent) => void,
  ): void {
    this.eventBus.on(eventType, callback);
    const listenerCount = this.eventBus.listenerCount(eventType);
    this.performanceMetrics.subscriberCount = listenerCount;

    // Debug warning for high listener counts
    if (listenerCount > 20) {
      logger.warn(
        `⚠️ High listener count for ${eventType}: ${listenerCount} listeners. ` +
          'Check for missing cleanup in useEffect hooks.',
      );
    }
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
  private getSyncStateCallCount = 0;
  private cachedSyncState: SyncState | null = null;
  private lastSyncStateJSON = '';

  getSyncState(): Readonly<SyncState> {
    this.getSyncStateCallCount++;

    // Create a JSON representation to detect actual changes
    const currentJSON = JSON.stringify(this.syncState);

    // Only create new object if state actually changed
    if (currentJSON !== this.lastSyncStateJSON || !this.cachedSyncState) {
      // State changed, create new object
      this.cachedSyncState = { ...this.syncState };
      this.lastSyncStateJSON = currentJSON;

      // Only log every 10th state change to reduce console noise
      if (this.getSyncStateCallCount % 10 === 0) {
        logger.info(
          `🔄 [WidgetSyncService] getSyncState - STATE CHANGED, creating new object`,
          {
            callCount: this.getSyncStateCallCount,
            timestamp: new Date().toISOString(),
          },
        );
      }
    } else if (this.getSyncStateCallCount % 50 === 0) {
      // Log reuse of cached state every 50th call to reduce noise
      logger.info(
        `✅ [WidgetSyncService] getSyncState - returning CACHED state (no change)`,
        {
          callCount: this.getSyncStateCallCount,
          timestamp: new Date().toISOString(),
        },
      );
    }

    return this.cachedSyncState;
  }

  /**
   * Get performance metrics
   */
  private cachedPerformanceMetrics: SyncPerformanceMetrics | null = null;
  private lastPerformanceMetricsJSON = '';

  getPerformanceMetrics(): Readonly<SyncPerformanceMetrics> {
    // Create a JSON representation to detect actual changes (excluding lastUpdateTime)
    const { lastUpdateTime, ...metricsWithoutTime } = this.performanceMetrics;
    const currentJSON = JSON.stringify(metricsWithoutTime);

    // Only create new object if metrics actually changed (ignoring lastUpdateTime)
    if (
      currentJSON !== this.lastPerformanceMetricsJSON ||
      !this.cachedPerformanceMetrics
    ) {
      // Metrics changed, create new object
      this.cachedPerformanceMetrics = { ...this.performanceMetrics };
      this.lastPerformanceMetricsJSON = currentJSON;
    }

    return this.cachedPerformanceMetrics;
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

    // Critical timing events - NEVER throttle
    this.throttleConfigs.set('PLAY', {
      eventType: 'PLAY',
      throttleMs: 0, // No throttling
      batchSize: 1,
      maxAge: 0,
    });

    this.throttleConfigs.set('PAUSE', {
      eventType: 'PAUSE',
      throttleMs: 0, // No throttling
      batchSize: 1,
      maxAge: 0,
    });

    this.throttleConfigs.set('STOP', {
      eventType: 'STOP',
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

    // Position updates can be throttled
    this.throttleConfigs.set('POSITION', {
      eventType: 'POSITION',
      throttleMs: 50, // 20Hz is enough for UI
      batchSize: 1,
      maxAge: 100,
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
    // Track if state actually changes
    let stateChanged = false;

    switch (event.type) {
      case 'PLAYBACK_STATE':
        if (
          event.payload.isPlaying !== undefined &&
          this.syncState.playback.isPlaying !== event.payload.isPlaying
        ) {
          this.syncState.playback.isPlaying = event.payload.isPlaying;
          stateChanged = true;
        }
        if (
          event.payload.currentTime !== undefined &&
          this.syncState.playback.currentTime !== event.payload.currentTime
        ) {
          this.syncState.playback.currentTime = event.payload.currentTime;
          stateChanged = true;
        }
        break;

      // Handle PlaybackOrchestrator events
      case 'PLAY':
        // Processing PLAY event
        logger.info(
          '🔄 WidgetSyncService: Processing PLAY event, setting isPlaying to true',
        );
        if (this.syncState.playback.isPlaying !== true) {
          this.syncState.playback.isPlaying = true;
          stateChanged = true;
        }
        this.startHeartbeat();
        this.startPositionUpdates();
        break;

      case 'PAUSE':
      case 'STOP':
        // Processing PAUSE/STOP event
        logger.info(
          `🔄 WidgetSyncService: Processing ${event.type} event, setting isPlaying to false`,
        );
        if (this.syncState.playback.isPlaying !== false) {
          this.syncState.playback.isPlaying = false;
          stateChanged = true;
        }
        this.stopHeartbeat();
        this.stopPositionUpdates();
        break;

      case 'TIMELINE_UPDATE':
        if (
          event.payload.currentTime !== undefined &&
          this.syncState.playback.currentTime !== event.payload.currentTime
        ) {
          this.syncState.playback.currentTime = event.payload.currentTime;
          stateChanged = true;
        }
        break;

      case 'TEMPO_CHANGE':
        if (
          event.payload.tempo !== undefined &&
          this.syncState.playback.tempo !== event.payload.tempo
        ) {
          this.syncState.playback.tempo = event.payload.tempo;
          stateChanged = true;
        }
        break;

      case 'VOLUME_CHANGE':
        if (
          event.payload.masterVolume !== undefined &&
          this.syncState.ui.masterVolume !== event.payload.masterVolume
        ) {
          this.syncState.ui.masterVolume = event.payload.masterVolume;
          stateChanged = true;
        }
        if (
          event.payload.volume !== undefined &&
          this.syncState.playback.volume !== event.payload.volume
        ) {
          this.syncState.playback.volume = event.payload.volume;
          stateChanged = true;
        }
        break;

      case 'EXERCISE_CHANGE':
        if (
          event.payload.exercise !== undefined &&
          this.syncState.exercise.selectedExercise !== event.payload.exercise
        ) {
          this.syncState.exercise.selectedExercise = event.payload.exercise;
          stateChanged = true;
        }
        break;

      case 'CUSTOM_BASSLINE':
        if (
          event.payload.bassline !== undefined &&
          this.syncState.exercise.customBassline !== event.payload.bassline
        ) {
          this.syncState.exercise.customBassline = event.payload.bassline;
          stateChanged = true;
        }
        break;

      case 'CLEAR_CUSTOM_BASSLINE':
        // Clear the custom bassline to show default exercise notes
        if (this.syncState.exercise.customBassline !== undefined) {
          this.syncState.exercise.customBassline = undefined;
          stateChanged = true;
        }
        break;
    }

    // If state changed, clear the cached sync state to force recreation next time
    if (stateChanged) {
      this.cachedSyncState = null;
      this.lastSyncStateJSON = '';
      logger.info(
        `🔄 [WidgetSyncService] State updated by ${event.type} event, clearing cache`,
      );
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

    // Clear cached performance metrics since we updated them
    this.cachedPerformanceMetrics = null;
    this.lastPerformanceMetricsJSON = '';

    // Check for performance warnings
    if (latency > 5.0) {
      // 5ms threshold from AC 3.6.4
      logger.warn(`Widget sync latency exceeded 5ms: ${latency.toFixed(2)}ms`);
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

    // Clear performance metrics cache
    this.cachedPerformanceMetrics = null;
    this.lastPerformanceMetricsJSON = '';
  }

  /**
   * Start heartbeat to prevent widget sync timeout
   */
  private startHeartbeat(): void {
    if (this.heartbeatInterval) return; // Already running

    logger.info('💓 WidgetSyncService: Starting heartbeat');

    // Send initial heartbeat
    this.sendHeartbeat();

    // Set up interval
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, this.HEARTBEAT_INTERVAL_MS);
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      logger.info('💔 WidgetSyncService: Stopping heartbeat');
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Send heartbeat event
   */
  private heartbeatCount = 0;
  private sendHeartbeat(): void {
    this.heartbeatCount++;

    // Only log every 10th heartbeat to reduce noise (every 50 seconds)
    if (this.heartbeatCount % 10 === 0) {
      logger.info('💓 [WidgetSyncService] Sending HEARTBEAT event', {
        count: this.heartbeatCount,
        timestamp: new Date().toISOString(),
      });
    }

    const heartbeatEvent: WidgetSyncEvent = {
      type: 'HEARTBEAT',
      payload: {
        timestamp: Date.now(),
        isPlaying: this.syncState.playback.isPlaying,
        currentTime: this.syncState.playback.currentTime,
        tempo: this.syncState.playback.tempo,
      },
      timestamp: Date.now(),
      source: 'widget-sync-service',
      priority: 'normal',
    };

    // Emit without going through throttling
    this.eventBus.emit('HEARTBEAT', heartbeatEvent);
    this.eventBus.emit('*', heartbeatEvent);
  }

  /**
   * Start position updates for smooth timeline sync
   */
  private startPositionUpdates(): void {
    if (this.positionUpdateInterval) return; // Already running

    logger.info('📍 WidgetSyncService: Starting position updates');

    this.positionUpdateInterval = setInterval(() => {
      if (this.syncState.playback.isPlaying) {
        // Get current position from Tone.Transport if available
        let currentPosition = this.syncState.playback.currentTime;

        if (typeof window !== 'undefined' && window.Tone?.Transport) {
          const transport = window.Tone.Transport;
          if (transport.state === 'started') {
            currentPosition = transport.seconds;
          }
        }

        const positionEvent: WidgetSyncEvent = {
          type: 'POSITION',
          payload: {
            currentTime: currentPosition,
            position: currentPosition,
            timestamp: Date.now(),
          },
          timestamp: Date.now(),
          source: 'widget-sync-service',
          priority: 'low',
        };

        // This will be throttled appropriately
        this.emit(positionEvent);
      }
    }, this.POSITION_UPDATE_INTERVAL_MS);
  }

  /**
   * Stop position updates
   */
  private stopPositionUpdates(): void {
    if (this.positionUpdateInterval) {
      logger.info('📍 WidgetSyncService: Stopping position updates');
      clearInterval(this.positionUpdateInterval);
      this.positionUpdateInterval = null;
    }
  }

  /**
   * Connect to EventBus from CoreServices
   */
  private connectToEventBus(): void {
    // Only run on client side
    if (typeof window === 'undefined') {
      return;
    }

    // Prevent multiple concurrent connection attempts
    if (this.isConnecting || this.isConnected) {
      logger.info(
        'WidgetSyncService: Already connecting or connected, skipping...',
      );
      return;
    }

    this.isConnecting = true;

    // Try to connect to EventBus when services are ready
    let connectionAttempts = 0;
    const maxConnectionAttempts = 50; // Max 5 seconds of trying

    const connectToEventBusWhenReady = () => {
      // Skip if already connected
      if (this.isConnected) {
        return;
      }

      connectionAttempts++;

      // Check for both old and new global service locations
      const coreServices = (window.__coreServices ||
        window.__globalCoreServices) as
        | { getEventBus?: () => unknown }
        | undefined;

      if (!coreServices || typeof coreServices.getEventBus !== 'function') {
        if (connectionAttempts < maxConnectionAttempts) {
          logger.info(
            `WidgetSyncService: Waiting for CoreServices... (attempt ${connectionAttempts}/${maxConnectionAttempts})`,
          );
          // Try again in 100ms
          setTimeout(connectToEventBusWhenReady, 100);
        } else {
          logger.warn(
            'WidgetSyncService: Could not connect to CoreServices after 5 seconds. Widget sync disabled.',
          );
          this.isConnecting = false;
        }
        return;
      }

      const eventBus = coreServices.getEventBus();
      if (!eventBus) {
        logger.warn('WidgetSyncService: EventBus not available');
        this.isConnecting = false;
        return;
      }

      logger.info(
        '🔌 WidgetSyncService: Connecting to EventBus from CoreServices',
      );

      // Subscribe to transport events from UnifiedTransport
      eventBus.on('PLAY', (event: any) => {
        logger.info('🔄 WidgetSyncService: Received PLAY from EventBus', event);
        this.emit({
          type: 'PLAY',
          payload: event,
          timestamp: Date.now(),
          source: event.source || 'UnifiedTransport',
          priority: 'high',
        });
      });

      eventBus.on('STOP', (event: any) => {
        logger.info('🔄 WidgetSyncService: Received STOP from EventBus', event);
        this.emit({
          type: 'STOP',
          payload: event,
          timestamp: Date.now(),
          source: event.source || 'UnifiedTransport',
          priority: 'high',
        });
      });

      eventBus.on('PAUSE', (event: any) => {
        logger.info(
          '🔄 WidgetSyncService: Received PAUSE from EventBus',
          event,
        );
        this.emit({
          type: 'PAUSE',
          payload: event,
          timestamp: Date.now(),
          source: event.source || 'UnifiedTransport',
          priority: 'high',
        });
      });

      eventBus.on('transport:tempo-change', (event: any) => {
        logger.info(
          '🔄 WidgetSyncService: Received tempo change from EventBus',
          event,
        );
        this.emit({
          type: 'TEMPO_CHANGE',
          payload: { tempo: event.tempo },
          timestamp: Date.now(),
          source: 'UnifiedTransport',
          priority: 'high',
        });
      });

      logger.info('✅ WidgetSyncService: Successfully connected to EventBus');
      this.isConnecting = false;
      this.isConnected = true;
    };

    // Also listen for the audioServicesReady event
    window.addEventListener('audioServicesReady', () => {
      logger.info('🎉 WidgetSyncService: Audio services ready event received');
      connectToEventBusWhenReady();
    });

    // Start trying to connect immediately in case services are already ready
    connectToEventBusWhenReady();
  }

  /**
   * Reset sync state to initial values
   * Called when switching between tutorials to clear stale state
   */
  resetState(): void {
    logger.info('🔄 WidgetSyncService: Resetting state');

    // Reset to initial state
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

    // Clear cached sync state
    this.cachedSyncState = null;
    this.lastSyncStateJSON = '';

    // Reset metrics
    this.resetMetrics();

    // Emit state reset event so all widgets know to reset
    this.emit({
      type: 'SYNC_STATE_RESET',
      payload: this.syncState,
      timestamp: Date.now(),
      source: 'WidgetSyncService',
      priority: 'high',
    });

    logger.info('✅ WidgetSyncService: State reset complete');
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    // Stop heartbeat and position updates
    this.stopHeartbeat();
    this.stopPositionUpdates();

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
