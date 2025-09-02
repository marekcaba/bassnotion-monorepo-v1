/**
 * ProductionDebugger - Production debugging capabilities
 * Story 3.18.5: Audio Reliability & Technical Debt Elimination
 *
 * Advanced debugging tools for production environments
 */

import { EventBus } from '../core/EventBus.js';
import { ProductionLogger } from '../logging/ProductionLogger.js';
import { MetricsCollector } from '../monitoring/MetricsCollector.js';
import { HealthMonitor } from '../monitoring/HealthMonitor.js';

export interface DebugSession {
  id: string;
  startTime: number;
  endTime?: number;
  mode: 'live' | 'replay';
  filters: DebugFilter[];
  captures: DebugCapture[];
  metadata: Record<string, any>;
}

export interface DebugFilter {
  type: 'event' | 'metric' | 'log' | 'error';
  pattern?: string | RegExp;
  category?: string;
  level?: string;
  tags?: Record<string, string>;
}

export interface DebugCapture {
  timestamp: number;
  type: string;
  category: string;
  data: any;
  stack?: string;
  context?: Record<string, any>;
}

export interface DebugSnapshot {
  timestamp: number;
  audioState: {
    initialized: boolean;
    contextState?: string;
    sampleRate?: number;
    latency?: number;
    activeNodes?: number;
  };
  performance: {
    memory?: number;
    cpu?: number;
    fps?: number;
    audioDropouts?: number;
  };
  errors: Array<{
    timestamp: number;
    message: string;
    count: number;
  }>;
  metrics: Record<string, number>;
  events: DebugCapture[];
}

export interface DebugConfig {
  enabled?: boolean;
  maxCaptures?: number;
  captureStackTraces?: boolean;
  remoteDebugging?: boolean;
  remoteEndpoint?: string;
  allowedDebugKeys?: string[];
  autoSnapshot?: boolean;
  snapshotInterval?: number;
}

export class ProductionDebugger {
  private eventBus: EventBus;
  private logger: ProductionLogger;
  private metrics: MetricsCollector;
  private health: HealthMonitor;
  private config: Required<DebugConfig>;
  private sessions: Map<string, DebugSession> = new Map();
  private activeSession: DebugSession | null = null;
  private captures: DebugCapture[] = [];
  private snapshotTimer?: NodeJS.Timeout;
  private debugHandlers: Map<string, Function> = new Map();

  constructor(
    eventBus: EventBus,
    logger: ProductionLogger,
    metrics: MetricsCollector,
    health: HealthMonitor,
    config: DebugConfig = {},
  ) {
    this.eventBus = eventBus;
    this.logger = logger;
    this.metrics = metrics;
    this.health = health;
    this.config = {
      enabled: false, // Disabled by default in production
      maxCaptures: 1000,
      captureStackTraces: false,
      remoteDebugging: false,
      remoteEndpoint: '/api/debug',
      allowedDebugKeys: ['debug123'], // Should be environment-specific
      autoSnapshot: false,
      snapshotInterval: 60000, // 1 minute
      ...config,
    };

    this.setupDebugInterface();
    this.setupEventCapture();
  }

  /**
   * Setup debug interface
   */
  private setupDebugInterface(): void {
    if (typeof window === 'undefined') return;

    // Global debug access (production-safe)
    (window as any).__bassnotionDebug = {
      start: (key: string) => this.startDebugSession(key),
      stop: () => this.stopDebugSession(),
      snapshot: () => this.captureSnapshot(),
      replay: (sessionId: string) => this.replaySession(sessionId),
      export: () => this.exportDebugData(),
      status: () => this.getDebugStatus(),
    };

    // Listen for debug key combination (Ctrl+Shift+D)
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        this.toggleDebugMode();
      }
    });
  }

  /**
   * Start debug session
   */
  startDebugSession(debugKey: string, filters: DebugFilter[] = []): string {
    // Verify debug key
    if (!this.config.allowedDebugKeys.includes(debugKey)) {
      this.logger.warn('debug', 'Invalid debug key attempted');
      throw new Error('Invalid debug key');
    }

    if (this.activeSession) {
      this.stopDebugSession();
    }

    const sessionId = this.generateSessionId();
    const session: DebugSession = {
      id: sessionId,
      startTime: Date.now(),
      mode: 'live',
      filters,
      captures: [],
      metadata: {
        userAgent: navigator.userAgent,
        url: window.location.href,
        timestamp: new Date().toISOString(),
      },
    };

    this.sessions.set(sessionId, session);
    this.activeSession = session;
    this.config.enabled = true;

    // Start auto snapshots if enabled
    if (this.config.autoSnapshot) {
      this.startAutoSnapshots();
    }

    this.logger.info('debug', 'Debug session started', { sessionId });
    this.eventBus.emit('debug:session-started', { sessionId });

    return sessionId;
  }

  /**
   * Stop debug session
   */
  stopDebugSession(): void {
    if (!this.activeSession) return;

    this.activeSession.endTime = Date.now();
    this.config.enabled = false;

    // Stop auto snapshots
    this.stopAutoSnapshots();

    // Save captures to session
    this.activeSession.captures = [...this.captures];
    this.captures = [];

    const sessionId = this.activeSession.id;
    this.logger.info('debug', 'Debug session stopped', {
      sessionId,
      duration: this.activeSession.endTime - this.activeSession.startTime,
      captures: this.activeSession.captures.length,
    });

    this.eventBus.emit('debug:session-stopped', { sessionId });
    this.activeSession = null;
  }

  /**
   * Capture debug snapshot
   */
  captureSnapshot(): DebugSnapshot {
    const audioEngine = this.getAudioEngine();
    const healthReport = this.health.getCurrentStatus();
    const metricsSnapshot = this.metrics.getSnapshot();
    const logStats = this.logger.getStats();

    const snapshot: DebugSnapshot = {
      timestamp: Date.now(),
      audioState: {
        initialized: audioEngine?.isReady() || false,
        contextState: audioEngine?.getContext()?.state,
        sampleRate: audioEngine?.getContext()?.sampleRate,
        latency: audioEngine?.getContext()?.baseLatency,
        activeNodes: this.countActiveAudioNodes(),
      },
      performance: {
        memory: performance.memory?.usedJSHeapSize
          ? Math.round(performance.memory.usedJSHeapSize / (1024 * 1024))
          : undefined,
        audioDropouts:
          metricsSnapshot.counters['performance.audio.dropouts'] || 0,
      },
      errors: this.getRecentErrors(),
      metrics: this.getKeyMetrics(metricsSnapshot),
      events: this.captures.slice(-50), // Last 50 events
    };

    // Calculate FPS if possible
    if (this.frameTimestamps.length > 1) {
      const frameDelta =
        this.frameTimestamps[this.frameTimestamps.length - 1] -
        this.frameTimestamps[0];
      snapshot.performance.fps = Math.round(
        (this.frameTimestamps.length - 1) / (frameDelta / 1000),
      );
    }

    this.logger.debug('debug', 'Snapshot captured', {
      timestamp: snapshot.timestamp,
    });

    return snapshot;
  }

  /**
   * Setup event capture
   */
  private setupEventCapture(): void {
    // Capture all events when debugging
    const originalEmit = this.eventBus.emit.bind(this.eventBus);

    this.eventBus.emit = (event: string, data?: any) => {
      if (this.config.enabled && this.shouldCapture('event', event)) {
        this.addCapture({
          timestamp: Date.now(),
          type: 'event',
          category: event.split(':')[0] || 'unknown',
          data: { event, ...data },
          stack: this.config.captureStackTraces ? new Error().stack : undefined,
        });
      }

      return originalEmit(event, data);
    };

    // Capture metrics
    this.eventBus.on('metrics:recorded', (metric) => {
      if (this.config.enabled && this.shouldCapture('metric', metric.name)) {
        this.addCapture({
          timestamp: Date.now(),
          type: 'metric',
          category: metric.category,
          data: metric,
        });
      }
    });

    // Capture logs
    this.eventBus.on('logger:entry', (entry) => {
      if (this.config.enabled && this.shouldCapture('log', entry.category)) {
        this.addCapture({
          timestamp: entry.timestamp,
          type: 'log',
          category: entry.category,
          data: entry,
        });
      }
    });

    // Track frame rate
    this.trackFrameRate();
  }

  /**
   * Should capture based on filters
   */
  private shouldCapture(type: string, value: string): boolean {
    if (!this.activeSession) return false;

    const filters = this.activeSession.filters;
    if (filters.length === 0) return true; // Capture all if no filters

    return filters.some((filter) => {
      if (filter.type !== type) return false;

      if (filter.pattern) {
        const pattern =
          filter.pattern instanceof RegExp
            ? filter.pattern
            : new RegExp(filter.pattern);
        return pattern.test(value);
      }

      return true;
    });
  }

  /**
   * Add capture
   */
  private addCapture(capture: DebugCapture): void {
    this.captures.push(capture);

    // Maintain max captures
    if (this.captures.length > this.config.maxCaptures) {
      this.captures.shift();
    }

    // Send to remote if enabled
    if (this.config.remoteDebugging && this.config.remoteEndpoint) {
      this.sendToRemote(capture);
    }
  }

  /**
   * Track frame rate
   */
  private frameTimestamps: number[] = [];
  private frameId?: number;

  private trackFrameRate(): void {
    const recordFrame = (timestamp: number) => {
      if (this.config.enabled) {
        this.frameTimestamps.push(timestamp);

        // Keep last 60 frames
        if (this.frameTimestamps.length > 60) {
          this.frameTimestamps.shift();
        }
      }

      this.frameId = requestAnimationFrame(recordFrame);
    };

    this.frameId = requestAnimationFrame(recordFrame);
  }

  /**
   * Replay debug session
   */
  async replaySession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    this.logger.info('debug', 'Replaying debug session', { sessionId });

    // Create replay session
    const replaySession: DebugSession = {
      ...session,
      id: `${sessionId}-replay`,
      mode: 'replay',
      startTime: Date.now(),
    };

    this.activeSession = replaySession;

    // Replay captures with timing
    for (let i = 0; i < session.captures.length; i++) {
      const capture = session.captures[i];
      const nextCapture = session.captures[i + 1];

      // Emit replay event
      this.eventBus.emit('debug:replay-event', capture);

      // Wait for next event timing
      if (nextCapture) {
        const delay = nextCapture.timestamp - capture.timestamp;
        await new Promise((resolve) =>
          setTimeout(resolve, Math.min(delay, 1000)),
        );
      }
    }

    this.activeSession = null;
    this.logger.info('debug', 'Debug session replay completed', { sessionId });
  }

  /**
   * Get recent errors
   */
  private getRecentErrors(): DebugSnapshot['errors'] {
    const errorMap = new Map<string, { timestamp: number; count: number }>();

    // Aggregate errors from captures
    this.captures
      .filter((c) => c.type === 'log' && c.data.level === 'error')
      .forEach((capture) => {
        const message = capture.data.message;
        const existing = errorMap.get(message);

        if (existing) {
          existing.count++;
        } else {
          errorMap.set(message, {
            timestamp: capture.timestamp,
            count: 1,
          });
        }
      });

    return Array.from(errorMap.entries()).map(([message, data]) => ({
      timestamp: data.timestamp,
      message,
      count: data.count,
    }));
  }

  /**
   * Get key metrics
   */
  private getKeyMetrics(snapshot: any): Record<string, number> {
    return {
      'audio.errors': snapshot.counters['audio.errors'] || 0,
      'audio.dropouts': snapshot.counters['performance.audio.dropouts'] || 0,
      'audio.initialization.attempts':
        snapshot.gauges['audio.initialization.attempts'] || 0,
      'memory.usage': performance.memory?.usedJSHeapSize
        ? Math.round(performance.memory.usedJSHeapSize / (1024 * 1024))
        : 0,
    };
  }

  /**
   * Count active audio nodes
   */
  private countActiveAudioNodes(): number {
    // This would need AudioEngine integration
    return 0;
  }

  /**
   * Get audio engine
   */
  private getAudioEngine(): any {
    // This would be injected or retrieved from service registry
    return null;
  }

  /**
   * Send capture to remote
   */
  private async sendToRemote(capture: DebugCapture): Promise<void> {
    try {
      await fetch(this.config.remoteEndpoint!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: this.activeSession?.id,
          capture,
        }),
      });
    } catch (error) {
      // Silently fail to avoid debug affecting production
    }
  }

  /**
   * Start auto snapshots
   */
  private startAutoSnapshots(): void {
    if (this.snapshotTimer) return;

    this.snapshotTimer = setInterval(() => {
      const snapshot = this.captureSnapshot();
      this.addCapture({
        timestamp: snapshot.timestamp,
        type: 'snapshot',
        category: 'debug',
        data: snapshot,
      });
    }, this.config.snapshotInterval);
  }

  /**
   * Stop auto snapshots
   */
  private stopAutoSnapshots(): void {
    if (this.snapshotTimer) {
      clearInterval(this.snapshotTimer);
      this.snapshotTimer = undefined;
    }
  }

  /**
   * Toggle debug mode
   */
  private toggleDebugMode(): void {
    if (this.activeSession) {
      this.stopDebugSession();
    } else {
      // Prompt for debug key
      const key = prompt('Enter debug key:');
      if (key) {
        try {
          this.startDebugSession(key);
          alert('Debug mode activated');
        } catch {
          alert('Invalid debug key');
        }
      }
    }
  }

  /**
   * Get debug status
   */
  getDebugStatus(): {
    enabled: boolean;
    activeSession?: string;
    captures: number;
    sessions: string[];
  } {
    return {
      enabled: this.config.enabled,
      activeSession: this.activeSession?.id,
      captures: this.captures.length,
      sessions: Array.from(this.sessions.keys()),
    };
  }

  /**
   * Export debug data
   */
  exportDebugData(): string {
    const data = {
      sessions: Array.from(this.sessions.entries()).map(([id, session]) => ({
        id,
        ...session,
      })),
      currentCaptures: this.captures,
      snapshot: this.captureSnapshot(),
    };

    return JSON.stringify(data, null, 2);
  }

  /**
   * Generate session ID
   */
  private generateSessionId(): string {
    return `debug-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Dispose debugger
   */
  dispose(): void {
    this.stopDebugSession();
    this.stopAutoSnapshots();

    if (this.frameId) {
      cancelAnimationFrame(this.frameId);
    }

    this.sessions.clear();
    this.captures = [];
  }
}
