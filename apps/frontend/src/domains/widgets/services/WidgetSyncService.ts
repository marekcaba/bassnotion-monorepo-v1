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
    | 'CUSTOM_BASSLINE'
    | 'CLEAR_CUSTOM_BASSLINE'
    | 'AUDIO_SOURCE_REGISTERED'
    | 'AUDIO_SOURCE_UNREGISTERED'
    | 'MUTE_CHANGE'
    | 'SOLO_CHANGE'
    | 'WIDGET_RECONNECT'
    | 'SYNC_RESTART'
    | 'TIME_SIGNATURE_CHANGE'
    | 'PLAY'
    | 'PAUSE'
    | 'STOP'
    | 'SEEK'
    | 'MUSICAL_TIME_UPDATE'
    | 'HEARTBEAT'
    | 'POSITION';
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

  // Heartbeat mechanism to prevent sync timeout
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private readonly HEARTBEAT_INTERVAL_MS = 5000; // 5 seconds
  private positionUpdateInterval: NodeJS.Timeout | null = null;
  private readonly POSITION_UPDATE_INTERVAL_MS = 50; // 50ms for smooth updates

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
    //   console.log(`🔄 WidgetSyncService: Received ${event.type} event from ${event.source}`);
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
      console.warn(
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
    switch (event.type) {
      case 'PLAYBACK_STATE':
        if (event.payload.isPlaying !== undefined) {
          this.syncState.playback.isPlaying = event.payload.isPlaying;
        }
        if (event.payload.currentTime !== undefined) {
          this.syncState.playback.currentTime = event.payload.currentTime;
        }
        break;

      // Handle PlaybackOrchestrator events
      case 'PLAY':
        // Processing PLAY event
        console.log('🔄 WidgetSyncService: Processing PLAY event, setting isPlaying to true');
        this.syncState.playback.isPlaying = true;
        this.startHeartbeat();
        this.startPositionUpdates();
        break;

      case 'PAUSE':
      case 'STOP':
        // Processing PAUSE/STOP event
        console.log(`🔄 WidgetSyncService: Processing ${event.type} event, setting isPlaying to false`);
        this.syncState.playback.isPlaying = false;
        this.stopHeartbeat();
        this.stopPositionUpdates();
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

      case 'CLEAR_CUSTOM_BASSLINE':
        // Clear the custom bassline to show default exercise notes
        this.syncState.exercise.customBassline = undefined;
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
   * Start heartbeat to prevent widget sync timeout
   */
  private startHeartbeat(): void {
    if (this.heartbeatInterval) return; // Already running
    
    console.log('💓 WidgetSyncService: Starting heartbeat');
    
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
      console.log('💔 WidgetSyncService: Stopping heartbeat');
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Send heartbeat event
   */
  private sendHeartbeat(): void {
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
    
    console.log('📍 WidgetSyncService: Starting position updates');
    
    this.positionUpdateInterval = setInterval(() => {
      if (this.syncState.playback.isPlaying) {
        // Get current position from Tone.Transport if available
        let currentPosition = this.syncState.playback.currentTime;
        
        if (typeof window !== 'undefined' && (window as any).Tone?.Transport) {
          const transport = (window as any).Tone.Transport;
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
      console.log('📍 WidgetSyncService: Stopping position updates');
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
    
    // Try to connect to EventBus when services are ready
    const connectToEventBusWhenReady = () => {
      const coreServices = (window as any).__coreServices;
      if (!coreServices || typeof coreServices.getEventBus !== 'function') {
        console.log('WidgetSyncService: Waiting for CoreServices...');
        // Try again in 100ms
        setTimeout(connectToEventBusWhenReady, 100);
        return;
      }
      
      const eventBus = coreServices.getEventBus();
      if (!eventBus) {
        console.warn('WidgetSyncService: EventBus not available');
        return;
      }
      
      console.log('🔌 WidgetSyncService: Connecting to EventBus from CoreServices');
      
      // Subscribe to transport events from UnifiedTransport
      eventBus.on('PLAY', (event: any) => {
        console.log('🔄 WidgetSyncService: Received PLAY from EventBus', event);
        this.emit({
          type: 'PLAY',
          payload: event,
          timestamp: Date.now(),
          source: event.source || 'UnifiedTransport',
          priority: 'high'
        });
      });
      
      eventBus.on('STOP', (event: any) => {
        console.log('🔄 WidgetSyncService: Received STOP from EventBus', event);
        this.emit({
          type: 'STOP',
          payload: event,
          timestamp: Date.now(),
          source: event.source || 'UnifiedTransport',
          priority: 'high'
        });
      });
      
      eventBus.on('PAUSE', (event: any) => {
        console.log('🔄 WidgetSyncService: Received PAUSE from EventBus', event);
        this.emit({
          type: 'PAUSE',
          payload: event,
          timestamp: Date.now(),
          source: event.source || 'UnifiedTransport',
          priority: 'high'
        });
      });
      
      eventBus.on('transport:tempo-changed', (event: any) => {
        console.log('🔄 WidgetSyncService: Received tempo change from EventBus', event);
        this.emit({
          type: 'TEMPO_CHANGE',
          payload: { tempo: event.tempo },
          timestamp: Date.now(),
          source: 'UnifiedTransport',
          priority: 'high'
        });
      });
      
      console.log('✅ WidgetSyncService: Successfully connected to EventBus');
    };
    
    // Also listen for the audioServicesReady event
    window.addEventListener('audioServicesReady', () => {
      console.log('🎉 WidgetSyncService: Audio services ready event received');
      connectToEventBusWhenReady();
    });
    
    // Start trying to connect immediately in case services are already ready
    connectToEventBusWhenReady();
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
