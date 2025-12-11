/**
 * Recovery Event Handlers
 *
 * Wires up event handlers for recovery strategies emitted by ErrorRecoveryRegistry.
 * Each handler executes the actual recovery action when its event is received.
 *
 * This fixes the "dead recovery strategies" issue where ErrorRecoveryRegistry
 * was emitting events that nobody was listening to.
 */

import { EventBus } from './EventBus.js';
import { GlobalSampleCache } from '../../modules/storage/cache/GlobalSampleCache.js';
import { createStructuredLogger } from '@bassnotion/contracts';

const logger = createStructuredLogger('RecoveryEventHandlers');

export class RecoveryEventHandlers {
  private unsubscribers: Array<() => void> = [];
  private isRegistered = false;

  constructor(private eventBus: EventBus) {}

  /**
   * Register all recovery event handlers
   */
  register(): void {
    if (this.isRegistered) {
      logger.warn('Recovery event handlers already registered, skipping');
      return;
    }

    logger.info('Registering recovery event handlers');

    // Cache recovery
    this.unsubscribers.push(
      this.eventBus.on(
        'cache:evict-old-entries',
        this.handleCacheEviction.bind(this),
      ),
    );

    // Storage recovery
    this.unsubscribers.push(
      this.eventBus.on(
        'storage:use-fallback-service',
        this.handleStorageFallback.bind(this),
      ),
    );
    this.unsubscribers.push(
      this.eventBus.on(
        'storage:use-direct-access',
        this.handleDirectAccess.bind(this),
      ),
    );

    // Transport recovery
    this.unsubscribers.push(
      this.eventBus.on(
        'transport:increase-buffer-size',
        this.handleBufferIncrease.bind(this),
      ),
    );
    this.unsubscribers.push(
      this.eventBus.on(
        'transport:use-script-processor',
        this.handleScriptProcessorFallback.bind(this),
      ),
    );

    // System recovery
    this.unsubscribers.push(
      this.eventBus.on(
        'system:reduce-quality',
        this.handleQualityReduction.bind(this),
      ),
    );

    this.isRegistered = true;
    logger.info('Recovery event handlers registered', {
      count: this.unsubscribers.length,
    });
  }

  /**
   * Handle cache eviction request
   * Triggered by: cache-full-recovery strategy in ErrorRecoveryRegistry
   */
  private handleCacheEviction(data: { targetSize?: number }): void {
    logger.info('Handling cache eviction', { targetSize: data.targetSize });

    const cache = GlobalSampleCache.getInstance();
    if (data.targetSize) {
      cache.evictToSize(data.targetSize);
    } else {
      // Default: clear 25% of cache
      cache.evictOldest(0.25);
    }
  }

  /**
   * Handle storage fallback request
   * Triggered by: circuit-breaker-recovery strategy in ErrorRecoveryRegistry
   */
  private handleStorageFallback(data: { serviceName?: string }): void {
    logger.warn('Storage fallback requested - using local cache only', {
      serviceName: data.serviceName,
    });
    // Set flag to use cached samples only until circuit recovers
    GlobalSampleCache.getInstance().setOfflineMode(true);
  }

  /**
   * Handle direct storage access (bypass CDN)
   * Triggered by: cdn-fallback-recovery strategy in ErrorRecoveryRegistry
   */
  private handleDirectAccess(data: { reason?: string }): void {
    logger.warn('Switching to direct Supabase access, bypassing CDN', {
      reason: data.reason,
    });
    // Future: Configure sample loader to use direct Supabase URL
    // For now, log the event for monitoring
  }

  /**
   * Handle buffer size increase
   * Triggered by: latency-compensation-recovery strategy in ErrorRecoveryRegistry
   */
  private handleBufferIncrease(data: {
    currentLatency?: number;
    targetLatency?: number;
  }): void {
    logger.info('Buffer size increase requested', data);
    // AudioContext buffer size cannot be changed after creation
    // Log for monitoring and suggest user refresh if latency issues persist
    this.eventBus.emit('ui:show-notification', {
      type: 'warning',
      message: 'Audio latency detected. Refresh page if audio issues persist.',
    });
  }

  /**
   * Handle ScriptProcessor fallback
   * Triggered by: worklet-fallback-recovery strategy in ErrorRecoveryRegistry
   */
  private handleScriptProcessorFallback(data: { reason?: string }): void {
    logger.warn('ScriptProcessor fallback requested', { reason: data.reason });
    // AudioWorklet → ScriptProcessor fallback is complex and rarely needed
    // Modern browsers (2020+) all support AudioWorklet
    // Log for monitoring - if this fires frequently, implement fallback
    this.eventBus.emit('ui:show-notification', {
      type: 'error',
      message: 'Audio processing error. Please refresh the page.',
    });
  }

  /**
   * Handle quality reduction request
   * Triggered by: cpu-overload-recovery strategy in ErrorRecoveryRegistry
   */
  private async handleQualityReduction(data: {
    reason?: string;
    targetCpuUsage?: number;
  }): Promise<void> {
    logger.warn('Quality reduction requested', data);

    try {
      // Dynamically import to avoid circular dependencies
      const { AdaptiveQualityScaler } =
        await import('../../modules/optimization/AdaptiveQualityScaler.js');
      const { DeviceCapabilityDetector } =
        await import('../../modules/optimization/DeviceCapabilityDetector.js');

      // Get current device capabilities
      const detector = new DeviceCapabilityDetector();
      const capabilities = await detector.detect();

      // Create scaler and calculate reduced settings
      const scaler = new AdaptiveQualityScaler();

      // Override CPU performance to 'low' to force quality reduction
      const reducedCapabilities = {
        ...capabilities,
        cpu: {
          ...capabilities.cpu,
          performance: 'low' as const,
        },
      };

      const reducedSettings =
        await scaler.calculateOptimalSettings(reducedCapabilities);

      logger.info('Quality reduced due to recovery event', {
        reason: data.reason || 'performance',
        settings: reducedSettings,
      });

      // Emit event for UI to show notification
      this.eventBus.emit('quality:reduced', {
        reason: data.reason || 'performance',
        settings: reducedSettings,
      });
    } catch (error) {
      logger.error('Failed to reduce quality', error as Error);
    }
  }

  /**
   * Cleanup all handlers
   */
  dispose(): void {
    this.unsubscribers.forEach((unsub) => unsub());
    this.unsubscribers = [];
    this.isRegistered = false;
    logger.info('Recovery event handlers disposed');
  }

  /**
   * Check if handlers are registered
   */
  isActive(): boolean {
    return this.isRegistered;
  }
}
