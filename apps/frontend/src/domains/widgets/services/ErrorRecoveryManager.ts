/**
 * ErrorRecoveryManager Service
 *
 * Implements robust error handling and recovery mechanisms to prevent cascade failures
 * in the global playback synchronization system. Provides circuit breakers, graceful degradation,
 * and automatic recovery strategies.
 *
 * Part of Story 3.14: Global Playback Synchronization
 * Task 6.4: Implement Error Handling to Prevent Cascade Failures
 */

import { playbackOrchestrator } from './PlaybackOrchestrator';
import { createStructuredLogger } from '@bassnotion/contracts';
import { syncPerformanceMonitor } from './SyncPerformanceMonitor';
import { widgetSyncService } from './WidgetSyncService';
import { useCorrelation } from '@/shared/hooks/useCorrelation';

// ============================================================================
// INTERFACES
// ============================================================================

export interface CircuitBreakerConfig {
  failureThreshold: number; // Number of failures before opening circuit
  timeout: number; // Time in ms before trying to close circuit
  monitoringWindow: number; // Time window for failure counting
  halfOpenMaxCalls: number; // Max calls to allow in half-open state
  resetTimeout: number; // Time to wait before resetting failure count
}

export interface ErrorRecoveryConfig {
  enableCircuitBreakers: boolean;
  enableGracefulDegradation: boolean;
  enableAutoRecovery: boolean;
  maxRetryAttempts: number;
  retryBackoffMultiplier: number;
  isolateFailingWidgets: boolean;

  // Circuit breaker configurations
  widgetCircuitBreaker: CircuitBreakerConfig;
  audioCircuitBreaker: CircuitBreakerConfig;
  syncCircuitBreaker: CircuitBreakerConfig;
}

export interface ErrorEvent {
  id: string;
  timestamp: number;
  source: 'widget' | 'audio' | 'sync' | 'network' | 'system';
  category: 'connection' | 'performance' | 'data' | 'timeout' | 'unknown';
  severity: 'low' | 'medium' | 'high' | 'critical';
  error: Error;
  context: Record<string, any>;
  widgetId?: string;
  recoveryAttempts: number;
  resolved: boolean;
  resolvedAt?: number;
}

export interface RecoveryStrategy {
  id: string;
  name: string;
  description: string;
  applicableCategories: string[];
  priority: number;
  execute: (errorEvent: ErrorEvent) => Promise<RecoveryResult>;
}

export interface RecoveryResult {
  success: boolean;
  message: string;
  details?: Record<string, any>;
  nextRetryDelay?: number;
}

export interface CircuitBreakerState {
  id: string;
  state: 'closed' | 'open' | 'half-open';
  failureCount: number;
  lastFailureTime: number;
  nextAttemptTime: number;
  halfOpenCalls: number;
  consecutiveSuccesses: number;
}

export interface SystemHealthStatus {
  overall: 'healthy' | 'degraded' | 'critical' | 'failing';
  components: {
    orchestrator: 'healthy' | 'degraded' | 'failing';
    widgets: 'healthy' | 'degraded' | 'failing';
    audio: 'healthy' | 'degraded' | 'failing';
    sync: 'healthy' | 'degraded' | 'failing';
  };
  activeErrors: number;
  criticalErrors: number;
  recoveryInProgress: boolean;
  lastHealthCheck: number;
}

// ============================================================================
// CIRCUIT BREAKER CLASS
// ============================================================================

class CircuitBreaker {
  private config: CircuitBreakerConfig;
  private state: CircuitBreakerState;
  private failureWindow: number[] = [];

  constructor(id: string, config: CircuitBreakerConfig) {
    this.config = config;
    this.state = {
      id,
      state: 'closed',
      failureCount: 0,
      lastFailureTime: 0,
      nextAttemptTime: 0,
      halfOpenCalls: 0,
      consecutiveSuccesses: 0,
    };
  }

  public async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state.state === 'open') {
      if (Date.now() < this.state.nextAttemptTime) {
        throw new Error(`Circuit breaker ${this.state.id} is OPEN`);
      } else {
        this.state.state = 'half-open';
        this.state.halfOpenCalls = 0;
      }
    }

    if (
      this.state.state === 'half-open' &&
      this.state.halfOpenCalls >= this.config.halfOpenMaxCalls
    ) {
      throw new Error(
        `Circuit breaker ${this.state.id} is HALF-OPEN and at max calls`,
      );
    }

    try {
      if (this.state.state === 'half-open') {
        this.state.halfOpenCalls++;
      }

      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    if (this.state.state === 'half-open') {
      this.state.consecutiveSuccesses++;
      if (this.state.consecutiveSuccesses >= 3) {
        this.state.state = 'closed';
        this.state.failureCount = 0;
        this.state.consecutiveSuccesses = 0;
        this.failureWindow = [];
      }
    } else if (this.state.state === 'closed') {
      this.state.failureCount = Math.max(0, this.state.failureCount - 1);
    }
  }

  private onFailure(): void {
    const now = Date.now();
    this.state.lastFailureTime = now;
    this.state.consecutiveSuccesses = 0;

    // Add to failure window
    this.failureWindow.push(now);

    // Remove old failures outside the monitoring window
    const windowStart = now - this.config.monitoringWindow;
    this.failureWindow = this.failureWindow.filter(
      (time) => time > windowStart,
    );

    this.state.failureCount = this.failureWindow.length;

    if (this.state.failureCount >= this.config.failureThreshold) {
      this.state.state = 'open';
      this.state.nextAttemptTime = now + this.config.timeout;
    }
  }

  public getState(): CircuitBreakerState {
    return { ...this.state };
  }

  public reset(): void {
    this.state.state = 'closed';
    this.state.failureCount = 0;
    this.state.consecutiveSuccesses = 0;
    this.failureWindow = [];
  }
}

// ============================================================================
// ERROR RECOVERY MANAGER CLASS
// ============================================================================

export class ErrorRecoveryManager {
  private static instance: ErrorRecoveryManager | null = null;

  private config: ErrorRecoveryConfig;
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private errorEvents: ErrorEvent[] = [];
  private recoveryStrategies: Map<string, RecoveryStrategy> = new Map();
  private isInitialized = false;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private systemHealth: SystemHealthStatus;

  // ============================================================================
  // SINGLETON PATTERN
  // ============================================================================

  public static getInstance(): ErrorRecoveryManager {
    if (!ErrorRecoveryManager.instance) {
      ErrorRecoveryManager.instance = new ErrorRecoveryManager();
    }
    return ErrorRecoveryManager.instance;
  }

  private constructor() {
    // Default configuration
    this.config = {
      enableCircuitBreakers: true,
      enableGracefulDegradation: true,
      enableAutoRecovery: true,
      maxRetryAttempts: 3,
      retryBackoffMultiplier: 2,
      isolateFailingWidgets: true,

      widgetCircuitBreaker: {
        failureThreshold: 5,
        timeout: 30000, // 30 seconds
        monitoringWindow: 60000, // 1 minute
        halfOpenMaxCalls: 3,
        resetTimeout: 300000, // 5 minutes
      },

      audioCircuitBreaker: {
        failureThreshold: 3,
        timeout: 10000, // 10 seconds
        monitoringWindow: 30000, // 30 seconds
        halfOpenMaxCalls: 2,
        resetTimeout: 120000, // 2 minutes
      },

      syncCircuitBreaker: {
        failureThreshold: 10,
        timeout: 5000, // 5 seconds
        monitoringWindow: 15000, // 15 seconds
        halfOpenMaxCalls: 5,
        resetTimeout: 60000, // 1 minute
      },
    };

    // Initialize system health
    this.systemHealth = {
      overall: 'healthy',
      components: {
        orchestrator: 'healthy',
        widgets: 'healthy',
        audio: 'healthy',
        sync: 'healthy',
      },
      activeErrors: 0,
      criticalErrors: 0,
      recoveryInProgress: false,
      lastHealthCheck: Date.now(),
    };
  }

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  public async initialize(
    config?: Partial<ErrorRecoveryConfig>,
  ): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Update configuration
      if (config) {
        this.config = { ...this.config, ...config };
      }

      // Initialize circuit breakers
      this.initializeCircuitBreakers();

      // Register recovery strategies
      this.registerRecoveryStrategies();

      // Set up error listeners
      this.setupErrorListeners();

      // Start health monitoring
      this.startHealthMonitoring();

      this.isInitialized = true;
      logger.info('[ErrorRecoveryManager] Initialized successfully');
    } catch (error) {
      logger.error('[ErrorRecoveryManager] Initialization failed:', error);
      throw error;
    }
  }

  public async dispose(): Promise<void> {
    if (!this.isInitialized) return;

    try {
      // Stop health monitoring
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
        this.healthCheckInterval = null;
      }

      // Clear state
      this.circuitBreakers.clear();
      this.errorEvents = [];
      this.recoveryStrategies.clear();

      this.isInitialized = false;
      logger.info('[ErrorRecoveryManager] Disposed successfully');
    } catch (error) {
      logger.error('[ErrorRecoveryManager] Disposal failed:', error);
    }
  }

  // ============================================================================
  // CIRCUIT BREAKER INITIALIZATION
  // ============================================================================

  private initializeCircuitBreakers(): void {
    if (!this.config.enableCircuitBreakers) return;

    // Widget circuit breaker
    this.circuitBreakers.set(
      'widget',
      new CircuitBreaker('widget', this.config.widgetCircuitBreaker),
    );

    // Audio circuit breaker
    this.circuitBreakers.set(
      'audio',
      new CircuitBreaker('audio', this.config.audioCircuitBreaker),
    );

    // Sync circuit breaker
    this.circuitBreakers.set(
      'sync',
      new CircuitBreaker('sync', this.config.syncCircuitBreaker),
    );
  }

  // ============================================================================
  // RECOVERY STRATEGIES
  // ============================================================================

  private registerRecoveryStrategies(): void {
    // Widget reconnection strategy
    this.recoveryStrategies.set('widget-reconnect', {
      id: 'widget-reconnect',
      name: 'Widget Reconnection',
      description: 'Attempts to reconnect disconnected widgets',
      applicableCategories: ['connection', 'timeout'],
      priority: 1,
      execute: this.executeWidgetReconnection.bind(this),
    });

    // Audio source reset strategy
    this.recoveryStrategies.set('audio-reset', {
      id: 'audio-reset',
      name: 'Audio Source Reset',
      description: 'Resets and re-initializes audio sources',
      applicableCategories: ['audio', 'performance'],
      priority: 2,
      execute: this.executeAudioReset.bind(this),
    });

    // Sync service restart strategy
    this.recoveryStrategies.set('sync-restart', {
      id: 'sync-restart',
      name: 'Sync Service Restart',
      description: 'Restarts the widget synchronization service',
      applicableCategories: ['sync', 'performance'],
      priority: 3,
      execute: this.executeSyncRestart.bind(this),
    });

    // Widget isolation strategy
    this.recoveryStrategies.set('widget-isolate', {
      id: 'widget-isolate',
      name: 'Widget Isolation',
      description: 'Isolates problematic widgets to prevent cascade failures',
      applicableCategories: ['performance', 'data'],
      priority: 4,
      execute: this.executeWidgetIsolation.bind(this),
    });

    // Graceful degradation strategy
    this.recoveryStrategies.set('graceful-degradation', {
      id: 'graceful-degradation',
      name: 'Graceful Degradation',
      description: 'Reduces system functionality to maintain core operations',
      applicableCategories: ['system', 'performance'],
      priority: 5,
      execute: this.executeGracefulDegradation.bind(this),
    });
  }

  // ============================================================================
  // ERROR HANDLING
  // ============================================================================

  public async handleError(
    error: Error,
    source: ErrorEvent['source'],
    category: ErrorEvent['category'],
    context: Record<string, any> = {},
    widgetId?: string,
  ): Promise<void> {
    const errorEvent: ErrorEvent = {
      id: `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      source,
      category,
      severity: this.calculateSeverity(error, source, category),
      error,
      context,
      widgetId,
      recoveryAttempts: 0,
      resolved: false,
    };

    this.errorEvents.push(errorEvent);
    this.updateSystemHealth();

    logger.error(`[ErrorRecoveryManager] Error handled:`, {
      id: errorEvent.id,
      source,
      category,
      severity: errorEvent.severity,
      message: error.message,
      widgetId,
    });

    // Attempt recovery if auto-recovery is enabled
    if (this.config.enableAutoRecovery) {
      await this.attemptRecovery(errorEvent);
    }
  }

  private calculateSeverity(
    error: Error,
    source: ErrorEvent['source'],
    category: ErrorEvent['category'],
  ): ErrorEvent['severity'] {
    // Critical errors that affect core functionality
    if (source === 'audio' && category === 'connection') return 'critical';
    if (source === 'sync' && category === 'performance') return 'critical';

    // High severity errors
    if (category === 'timeout' || category === 'performance') return 'high';
    if (source === 'widget' && category === 'connection') return 'high';

    // Medium severity errors
    if (category === 'data') return 'medium';

    // Default to low severity
    return 'low';
  }

  // ============================================================================
  // RECOVERY EXECUTION
  // ============================================================================

  private async attemptRecovery(errorEvent: ErrorEvent): Promise<void> {
    if (errorEvent.recoveryAttempts >= this.config.maxRetryAttempts) {
      logger.warn(
        `[ErrorRecoveryManager] Max recovery attempts reached for error ${errorEvent.id}`,
      );
      return;
    }

    this.systemHealth.recoveryInProgress = true;
    errorEvent.recoveryAttempts++;

    try {
      // Find applicable recovery strategies
      const applicableStrategies = Array.from(this.recoveryStrategies.values())
        .filter((strategy) =>
          strategy.applicableCategories.includes(errorEvent.category),
        )
        .sort((a, b) => a.priority - b.priority);

      for (const strategy of applicableStrategies) {
        logger.info(
          `[ErrorRecoveryManager] Attempting recovery strategy: ${strategy.name}`,
        );

        try {
          const result = await strategy.execute(errorEvent);

          if (result.success) {
            errorEvent.resolved = true;
            errorEvent.resolvedAt = Date.now();
            logger.info(
              `[ErrorRecoveryManager] Recovery successful: ${result.message}`,
            );
            break;
          } else {
            logger.warn(
              `[ErrorRecoveryManager] Recovery failed: ${result.message}`,
            );

            // Schedule retry if specified
            if (result.nextRetryDelay) {
              setTimeout(
                () => this.attemptRecovery(errorEvent),
                result.nextRetryDelay,
              );
              break;
            }
          }
        } catch (strategyError) {
          logger.error(
            `[ErrorRecoveryManager] Recovery strategy failed:`,
            strategyError,
          );
        }
      }
    } finally {
      this.systemHealth.recoveryInProgress = false;
      this.updateSystemHealth();
    }
  }

  // ============================================================================
  // RECOVERY STRATEGY IMPLEMENTATIONS
  // ============================================================================

  private async executeWidgetReconnection(
    errorEvent: ErrorEvent,
  ): Promise<RecoveryResult> {
    if (!errorEvent.widgetId) {
      return {
        success: false,
        message: 'No widget ID provided for reconnection',
      };
    }

    try {
      // Check if widget is still registered
      const isRegistered = playbackOrchestrator.isWidgetRegistered(
        errorEvent.widgetId,
      );

      if (!isRegistered) {
        return { success: false, message: 'Widget is not registered' };
      }

      // Attempt to refresh widget connection via sync service
      widgetSyncService.emit({
        type: 'WIDGET_RECONNECT',
        payload: { widgetId: errorEvent.widgetId },
        timestamp: Date.now(),
        source: 'error-recovery',
        priority: 'high',
      });

      return {
        success: true,
        message: `Widget ${errorEvent.widgetId} reconnection initiated`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Widget reconnection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  private async executeAudioReset(
    errorEvent: ErrorEvent,
  ): Promise<RecoveryResult> {
    try {
      // Reset audio sources for the affected widget or all widgets
      if (errorEvent.widgetId) {
        // Reset specific widget audio
        const syncState = playbackOrchestrator.getSyncState();
        const widgetConfig = syncState.activeAudioSources.get(
          errorEvent.widgetId,
        );

        if (widgetConfig) {
          playbackOrchestrator.updateWidgetConfig(errorEvent.widgetId, {
            ...widgetConfig,
            volume: 1.0,
            muted: false,
          });
        }
      } else {
        // Reset all audio sources
        const registeredWidgets = playbackOrchestrator.getRegisteredWidgets();
        for (const widget of registeredWidgets) {
          playbackOrchestrator.updateWidgetConfig(widget.widgetId, {
            volume: 1.0,
            muted: false,
          });
        }
      }

      return {
        success: true,
        message: 'Audio sources reset successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: `Audio reset failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  private async executeSyncRestart(
    errorEvent: ErrorEvent,
  ): Promise<RecoveryResult> {
    try {
      // Emit sync restart event
      widgetSyncService.emit({
        type: 'SYNC_RESTART',
        payload: { reason: 'error-recovery' },
        timestamp: Date.now(),
        source: 'error-recovery',
        priority: 'critical',
      });

      return {
        success: true,
        message: 'Sync service restart initiated',
      };
    } catch (error) {
      return {
        success: false,
        message: `Sync restart failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  private async executeWidgetIsolation(
    errorEvent: ErrorEvent,
  ): Promise<RecoveryResult> {
    if (!this.config.isolateFailingWidgets || !errorEvent.widgetId) {
      return {
        success: false,
        message: 'Widget isolation not enabled or no widget ID',
      };
    }

    try {
      // Temporarily disable the problematic widget
      playbackOrchestrator.updateWidgetConfig(errorEvent.widgetId, {
        isActive: false,
        muted: true,
      });

      // Schedule re-enabling after a delay
      setTimeout(() => {
        playbackOrchestrator.updateWidgetConfig(errorEvent.widgetId!, {
          isActive: true,
          muted: false,
        });
      }, 30000); // 30 seconds

      return {
        success: true,
        message: `Widget ${errorEvent.widgetId} isolated temporarily`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Widget isolation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  private async executeGracefulDegradation(
    errorEvent: ErrorEvent,
  ): Promise<RecoveryResult> {
    if (!this.config.enableGracefulDegradation) {
      return { success: false, message: 'Graceful degradation not enabled' };
    }

    try {
      // Reduce system complexity by disabling non-essential features
      const registeredWidgets = playbackOrchestrator.getRegisteredWidgets();
      const essentialWidgets = registeredWidgets.filter(
        (w) => w.audioConfig.priority >= 7, // Only keep high-priority widgets
      );

      // Disable low-priority widgets temporarily
      for (const widget of registeredWidgets) {
        if (widget.audioConfig.priority < 7) {
          playbackOrchestrator.updateWidgetConfig(widget.widgetId, {
            isActive: false,
          });
        }
      }

      // Reduce sync frequency to improve stability
      const performanceMetrics = syncPerformanceMonitor.getPerformanceSummary();
      if (performanceMetrics.syncLatency.current > 50) {
        // Further degradation if needed
      }

      return {
        success: true,
        message: 'Graceful degradation applied',
        nextRetryDelay: 60000, // Retry restoration in 1 minute
      };
    } catch (error) {
      return {
        success: false,
        message: `Graceful degradation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  // ============================================================================
  // HEALTH MONITORING
  // ============================================================================

  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, 5000); // Check every 5 seconds
  }

  private performHealthCheck(): void {
    try {
      // Check orchestrator health
      const orchestratorMetrics = playbackOrchestrator.getPerformanceMetrics();
      this.systemHealth.components.orchestrator =
        orchestratorMetrics.averageLatency < 50
          ? 'healthy'
          : orchestratorMetrics.averageLatency < 100
            ? 'degraded'
            : 'failing';

      // Check widget health
      const widgetMetrics = syncPerformanceMonitor.getWidgetMetrics();
      const healthyWidgets = widgetMetrics.filter(
        (w) => w.healthScore >= 80,
      ).length;
      const healthyRatio =
        widgetMetrics.length > 0 ? healthyWidgets / widgetMetrics.length : 1;

      this.systemHealth.components.widgets =
        healthyRatio >= 0.8
          ? 'healthy'
          : healthyRatio >= 0.5
            ? 'degraded'
            : 'failing';

      // Check audio health
      const audioMetrics = syncPerformanceMonitor.getAudioMetrics();
      this.systemHealth.components.audio =
        audioMetrics.consecutiveDropouts === 0
          ? 'healthy'
          : audioMetrics.consecutiveDropouts < 3
            ? 'degraded'
            : 'failing';

      // Check sync health
      const latencyMetrics = syncPerformanceMonitor.getLatencyMetrics();
      this.systemHealth.components.sync =
        latencyMetrics.averageLatency < 50
          ? 'healthy'
          : latencyMetrics.averageLatency < 100
            ? 'degraded'
            : 'failing';

      // Update overall health
      const componentStates = Object.values(this.systemHealth.components);
      const failingCount = componentStates.filter(
        (state) => state === 'failing',
      ).length;
      const degradedCount = componentStates.filter(
        (state) => state === 'degraded',
      ).length;

      if (failingCount > 0) {
        this.systemHealth.overall = 'failing';
      } else if (failingCount > 1 || degradedCount > 2) {
        this.systemHealth.overall = 'critical';
      } else if (degradedCount > 0) {
        this.systemHealth.overall = 'degraded';
      } else {
        this.systemHealth.overall = 'healthy';
      }

      this.systemHealth.lastHealthCheck = Date.now();
    } catch (error) {
      logger.error('[ErrorRecoveryManager] Health check failed:', error);
    }
  }

  private updateSystemHealth(): void {
    const activeErrors = this.errorEvents.filter((e) => !e.resolved);
    this.systemHealth.activeErrors = activeErrors.length;
    this.systemHealth.criticalErrors = activeErrors.filter(
      (e) => e.severity === 'critical',
    ).length;
  }

  // ============================================================================
  // ERROR LISTENERS
  // ============================================================================

  private setupErrorListeners(): void {
    // Listen for unhandled errors
    window.addEventListener('error', (event) => {
      this.handleError(new Error(event.message), 'system', 'unknown', {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      });
    });

    // Listen for unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.handleError(
        new Error(`Unhandled promise rejection: ${event.reason}`),
        'system',
        'unknown',
        { reason: event.reason },
      );
    });

    // Listen for sync service errors
    widgetSyncService.subscribe('ERROR', (event) => {
      this.handleError(
        new Error(event.payload.message),
        'sync',
        'unknown',
        event.payload,
      );
    });
  }

  // ============================================================================
  // CIRCUIT BREAKER OPERATIONS
  // ============================================================================

  public async executeWithCircuitBreaker<T>(
    breakerId: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    if (!this.config.enableCircuitBreakers) {
      return await operation();
    }

    const circuitBreaker = this.circuitBreakers.get(breakerId);
    if (!circuitBreaker) {
      throw new Error(`Circuit breaker ${breakerId} not found`);
    }

    return await circuitBreaker.execute(operation);
  }

  public getCircuitBreakerState(breakerId: string): CircuitBreakerState | null {
    const circuitBreaker = this.circuitBreakers.get(breakerId);
    return circuitBreaker ? circuitBreaker.getState() : null;
  }

  public resetCircuitBreaker(breakerId: string): boolean {
    const circuitBreaker = this.circuitBreakers.get(breakerId);
    if (circuitBreaker) {
      circuitBreaker.reset();
      return true;
    }
    return false;
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  public getErrorEvents(): ErrorEvent[] {
    return [...this.errorEvents];
  }

  public getActiveErrors(): ErrorEvent[] {
    return this.errorEvents.filter((error) => !error.resolved);
  }

  public getCriticalErrors(): ErrorEvent[] {
    return this.errorEvents.filter(
      (error) => !error.resolved && error.severity === 'critical',
    );
  }

  public getSystemHealth(): SystemHealthStatus {
    return { ...this.systemHealth };
  }

  public getRecoveryStrategies(): RecoveryStrategy[] {
    return Array.from(this.recoveryStrategies.values());
  }

  public updateConfig(newConfig: Partial<ErrorRecoveryConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  public async manualRecovery(errorId: string): Promise<boolean> {
    const errorEvent = this.errorEvents.find((e) => e.id === errorId);
    if (!errorEvent || errorEvent.resolved) {
      return false;
    }

    await this.attemptRecovery(errorEvent);
    return errorEvent.resolved;
  }

  public clearResolvedErrors(): void {
    this.errorEvents = this.errorEvents.filter((error) => !error.resolved);
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const errorRecoveryManager = ErrorRecoveryManager.getInstance();
